import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
    apiEndpoint: string;
    frontendSources: s3deploy.ISource[];
}

export class FrontendStack extends cdk.Stack {
    readonly bucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        this.bucket = this.createBucket();
        this.distribution = this.createDistribution(props.apiEndpoint);
        this.allowDistributionToListBucket();
        this.deployAssets(props.frontendSources);
        this.deployAppShell(props.frontendSources);
        this.createOutputs();
    }

    private createBucket(): s3.Bucket {
        return new s3.Bucket(this, 'SiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
    }

    private createDistribution(apiEndpoint: string): cloudfront.Distribution {
        const apiOrigin = new origins.HttpOrigin(apiEndpoint);
        const apiBehavior: cloudfront.BehaviorOptions = {
            origin: apiOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
                cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy:
                cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        };

        return new cloudfront.Distribution(this, 'Distribution', {
            defaultRootObject: 'index.html',
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(
                    this.bucket,
                ),
                viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress: true,
            },
            additionalBehaviors: {
                '/api/*': apiBehavior,
                '/socket.io/*': apiBehavior,
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.seconds(0),
                },
            ],
        });
    }

    private allowDistributionToListBucket(): void {
        this.bucket.addToResourcePolicy(
            new iam.PolicyStatement({
                actions: ['s3:ListBucket'],
                principals: [
                    new iam.ServicePrincipal('cloudfront.amazonaws.com'),
                ],
                resources: [this.bucket.bucketArn],
                conditions: {
                    StringEquals: {
                        'AWS:SourceArn': `arn:${this.partition}:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
                    },
                },
            }),
        );
    }

    private deployAssets(sources: s3deploy.ISource[]): void {
        new s3deploy.BucketDeployment(this, 'AssetsDeployment', {
            sources,
            destinationBucket: this.bucket,
            distribution: this.distribution,
            distributionPaths: ['/index.html'],
            cacheControl: [
                s3deploy.CacheControl.fromString(
                    'public, max-age=31536000, immutable',
                ),
            ],
            include: ['assets/*'],
            prune: false,
        });
    }

    private deployAppShell(sources: s3deploy.ISource[]): void {
        new s3deploy.BucketDeployment(this, 'AppShellDeployment', {
            sources,
            destinationBucket: this.bucket,
            cacheControl: [
                s3deploy.CacheControl.fromString(
                    'public, max-age=60, stale-while-revalidate=2592000',
                ),
            ],
            exclude: ['assets/*'],
            prune: true,
        });
    }

    private createOutputs(): void {
        new cdk.CfnOutput(this, 'DistributionDomain', {
            value: this.distribution.distributionDomainName,
        });
    }
}
