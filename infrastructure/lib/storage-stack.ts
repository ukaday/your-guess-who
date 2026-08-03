import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
    frontendOrigin: string;
    localDevOrigin: string;
}

export class StorageStack extends cdk.Stack {
    readonly bucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: StorageStackProps) {
        super(scope, id, props);

        this.bucket = this.createBucket(props);
    }

    private createBucket(props: StorageStackProps): s3.Bucket {
        return new s3.Bucket(this, 'ImagesBucket', {
            bucketName: `your-guess-who-images-${this.account}-${this.region}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            lifecycleRules: [
                {
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.HEAD,
                        s3.HttpMethods.PUT,
                    ],
                    allowedOrigins: [
                        props.localDevOrigin,
                        props.frontendOrigin,
                    ],
                    allowedHeaders: ['*'],
                },
            ],
        });
    }
}
