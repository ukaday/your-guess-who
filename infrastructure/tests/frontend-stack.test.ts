import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { FrontendStack } from '../lib/frontend-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
    return new FrontendStack(new App(), 'TestFrontend', {
        env: testEnv,
        apiEndpoint: 'api.example.com',
        frontendSources: [
            s3deploy.Source.data('index.html', '<html></html>'),
        ],
    });
}

describe('FrontendStack', function () {
    it('creates a CloudFront distribution rooted at index.html on PRICE_CLASS_100 with HTTP/2+3', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
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
        Template.fromStack(makeStack()).hasOutput('*', {
            Value: {
                'Fn::GetAtt': Match.arrayWith([
                    Match.stringLikeRegexp('Distribution'),
                    'DomainName',
                ]),
            },
        });
    });

    it('deploys assets with immutable long-cache and other files with short stale-while-revalidate cache', function () {
        const template = Template.fromStack(makeStack());

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
        Template.fromStack(makeStack()).hasResourceProperties(
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

    it('routes /api/* and /socket.io/* to the backend endpoint', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    Origins: Match.arrayWith([
                        Match.objectLike({ DomainName: 'api.example.com' }),
                    ]),
                    CacheBehaviors: Match.arrayWith([
                        Match.objectLike({ PathPattern: '/api/*' }),
                        Match.objectLike({ PathPattern: '/socket.io/*' }),
                    ]),
                }),
            },
        );
    });

    it('disables caching and allows all HTTP methods on the API behavior', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
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

    it('rewrites only 404 to /index.html so backend 403s reach the client intact', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::CloudFront::Distribution',
            {
                DistributionConfig: Match.objectLike({
                    CustomErrorResponses: [
                        {
                            ErrorCode: 404,
                            ResponseCode: 200,
                            ResponsePagePath: '/index.html',
                            ErrorCachingMinTTL: 0,
                        },
                    ],
                }),
            },
        );
    });

    it('lets the distribution list the bucket so missing objects return 404 rather than 403', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::BucketPolicy',
            {
                PolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Action: 's3:ListBucket',
                            Principal: {
                                Service: 'cloudfront.amazonaws.com',
                            },
                        }),
                    ]),
                }),
            },
        );
    });

    it('grants the distribution access to the bucket via OAC (not OAI)', function () {
        const template = Template.fromStack(makeStack());

        template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
        template.resourceCountIs(
            'AWS::CloudFront::CloudFrontOriginAccessIdentity',
            0,
        );
    });

    it('creates a private S3 bucket that gets cleaned up on stack destroy', function () {
        const template = Template.fromStack(makeStack());

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
