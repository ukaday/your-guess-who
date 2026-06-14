import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

describe('StorageStack', function () {
    it('creates an S3 bucket', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).resourceCountIs('AWS::S3::Bucket', 1);
    });

    it('names the bucket using account and region', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            BucketName: 'your-guess-who-images-111111111111-us-east-2',
        });
    });

    it('blocks all public access', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
            },
        });
    });

    it('encrypts objects at rest with S3-managed keys', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                    {
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'AES256',
                        },
                    },
                ],
            },
        });
    });

    it('enables versioning', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            VersioningConfiguration: { Status: 'Enabled' },
        });
    });

    it('expires non-current versions after 30 days', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            LifecycleConfiguration: {
                Rules: [
                    {
                        Status: 'Enabled',
                        NoncurrentVersionExpiration: { NoncurrentDays: 30 },
                    },
                ],
            },
        });
    });

    it('retains the bucket on stack deletion', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
        });
    });

    it('allows CORS PUT, GET, HEAD from the local dev origin', function () {
        const stack = new StorageStack(new App(), 'TestStorage', {
            env: testEnv,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::S3::Bucket', {
            CorsConfiguration: {
                CorsRules: [
                    {
                        AllowedMethods: ['GET', 'HEAD', 'PUT'],
                        AllowedOrigins: ['http://localhost:5173'],
                        AllowedHeaders: ['*'],
                    },
                ],
            },
        });
    });
});
