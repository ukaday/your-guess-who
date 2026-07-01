import { describe, it } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { FrontendStack } from '../lib/frontend-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeDeps() {
    const app = new App();
    const supportStack = new Stack(app, 'TestSupport', { env: testEnv });
    const vpc = new ec2.Vpc(supportStack, 'Vpc', {
        maxAzs: 2,
        subnetConfiguration: [
            { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        ],
    });
    const vpcConnector = new apprunner.VpcConnector(supportStack, 'VpcConnector', {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    const apiService = new apprunner.Service(supportStack, 'ApiService', {
        source: apprunner.Source.fromEcrPublic({
            imageIdentifier: 'public.ecr.aws/aws-containers/hello-app-runner:latest',
        }),
        vpcConnector,
    });
    const frontendSources = [s3deploy.Source.data('index.html', '<html></html>')];

    return { app, supportStack, apiService, frontendSources };
}

describe('FrontendStack', function () {
    it('creates a CloudFront distribution rooted at index.html on PRICE_CLASS_100 with HTTP/2+3', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    DefaultRootObject: 'index.html',
                    PriceClass: 'PriceClass_100',
                    HttpVersion: 'http2and3',
                }),
            },
        );
    });

    it('outputs the CloudFront distribution domain name', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasOutput('*', {
            Value: {
                'Fn::GetAtt': Match.arrayWith([
                    Match.stringLikeRegexp('Distribution'),
                    'DomainName',
                ]),
            },
        });
    });

    it('deploys assets with immutable long-cache and other files with short stale-while-revalidate cache', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties('Custom::CDKBucketDeployment', {
            SystemMetadata: {
                'cache-control': 'public, max-age=31536000, immutable',
            },
            Include: ['assets/*'],
        });
        template.hasResourceProperties('Custom::CDKBucketDeployment', {
            SystemMetadata: {
                'cache-control':
                    'public, max-age=60, stale-while-revalidate=2592000',
            },
            Exclude: ['assets/*'],
        });
    });

    it('serves the SPA default behavior over HTTPS with compression enabled', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    DefaultCacheBehavior: Match.objectLike({
                        ViewerProtocolPolicy: 'redirect-to-https',
                        Compress: true,
                    }),
                }),
            },
        );
    });

    it('routes /socket.io/* through the same App Runner origin', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    CacheBehaviors: Match.arrayWith([
                        Match.objectLike({ PathPattern: '/socket.io/*' }),
                    ]),
                }),
            },
        );
    });

    it('routes /api/* to the App Runner origin with caching disabled and all HTTP methods', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    CacheBehaviors: Match.arrayWith([
                        Match.objectLike({
                            PathPattern: '/api/*',
                            CachePolicyId:
                                '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
                            AllowedMethods: [
                                'GET',
                                'HEAD',
                                'OPTIONS',
                                'PUT',
                                'PATCH',
                                'POST',
                                'DELETE',
                            ],
                        }),
                    ]),
                }),
            },
        );
    });

    it('rewrites 403 and 404 errors to /index.html with 200 (for SPA routing)', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    CustomErrorResponses: Match.arrayWith([
                        {
                            ErrorCode: 403,
                            ResponseCode: 200,
                            ResponsePagePath: '/index.html',
                            ErrorCachingMinTTL: 0,
                        },
                        {
                            ErrorCode: 404,
                            ResponseCode: 200,
                            ResponsePagePath: '/index.html',
                            ErrorCachingMinTTL: 0,
                        },
                    ]),
                }),
            },
        );
    });

    it('grants the distribution access to the bucket via OAC (not OAI)', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
        template.resourceCountIs(
            'AWS::CloudFront::CloudFrontOriginAccessIdentity',
            0,
        );
    });

    it('creates a private S3 bucket that gets cleaned up on stack destroy', function () {
        const deps = makeDeps();
        const stack = new FrontendStack(deps.app, 'TestFrontend', {
            env: testEnv,
            apiService: deps.apiService,
            frontendSources: deps.frontendSources,
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::S3::Bucket', {
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
            },
        });
        template.hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Delete',
            UpdateReplacePolicy: 'Delete',
        });
        template.hasResourceProperties('AWS::S3::Bucket', {
            VersioningConfiguration: Match.absent(),
        });
    });
});
