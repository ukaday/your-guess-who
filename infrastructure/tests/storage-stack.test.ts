import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
    return new StorageStack(new App(), 'TestStorage', {
        env: testEnv,
        frontendOrigin: 'https://example.cloudfront.net',
        localDevOrigin: 'http://localhost:5173',
    });
}

describe('StorageStack', function () {
    it('creates an S3 bucket', function () {
        Template.fromStack(makeStack()).resourceCountIs('AWS::S3::Bucket', 1);
    });

    it('names the bucket using account and region', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            { BucketName: 'your-guess-who-images-111111111111-us-east-2' },
        );
    });

    it('blocks all public access', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            {
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                },
            },
        );
    });

    it('encrypts objects at rest with S3-managed keys', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            {
                BucketEncryption: {
                    ServerSideEncryptionConfiguration: [
                        {
                            ServerSideEncryptionByDefault: {
                                SSEAlgorithm: 'AES256',
                            },
                        },
                    ],
                },
            },
        );
    });

    it('enables versioning', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            { VersioningConfiguration: { Status: 'Enabled' } },
        );
    });

    it('expires non-current versions after 30 days', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            {
                LifecycleConfiguration: {
                    Rules: [
                        {
                            Status: 'Enabled',
                            NoncurrentVersionExpiration: {
                                NoncurrentDays: 30,
                            },
                        },
                    ],
                },
            },
        );
    });

    it('retains the bucket on stack deletion', function () {
        Template.fromStack(makeStack()).hasResource('AWS::S3::Bucket', {
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
        });
    });

    it('allows CORS PUT, GET, HEAD from both the local dev and deployed frontend origins', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::S3::Bucket',
            {
                CorsConfiguration: {
                    CorsRules: [
                        {
                            AllowedMethods: ['GET', 'HEAD', 'PUT'],
                            AllowedOrigins: [
                                'http://localhost:5173',
                                'https://example.cloudfront.net',
                            ],
                            AllowedHeaders: ['*'],
                        },
                    ],
                },
            },
        );
    });
});
