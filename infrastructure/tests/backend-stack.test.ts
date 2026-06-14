import { describe, it } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { BackendStack } from '../lib/backend-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeDeps() {
    const app = new App();
    const supportStack: Stack = new Stack(app, 'TestSupport', { env: testEnv });
    const vpc = new ec2.Vpc(supportStack, 'Vpc', {
        maxAzs: 2,
        subnetConfiguration: [
            { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        ],
    });
    const dbInstance = new rds.DatabaseInstance(supportStack, 'Database', {
        engine: rds.DatabaseInstanceEngine.postgres({
            version: rds.PostgresEngineVersion.VER_15,
        }),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        databaseName: 'your_guess_who',
        credentials: rds.Credentials.fromGeneratedSecret('postgres'),
    });
    const bucket = new s3.Bucket(supportStack, 'Bucket');
    const userPool = new cognito.UserPool(supportStack, 'UserPool');
    const userPoolClient = new cognito.UserPoolClient(
        supportStack,
        'UserPoolClient',
        { userPool },
    );

    return {
        app,
        supportStack,
        vpc,
        dbInstance,
        bucket,
        userPool,
        userPoolClient,
    };
}

describe('BackendStack', function () {
    it('creates an ECR repository', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });

        Template.fromStack(stack).resourceCountIs('AWS::ECR::Repository', 1);
    });

    it('creates an App Runner service backed by the ECR image', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::AppRunner::Service', 1);
        template.hasResourceProperties('AWS::AppRunner::Service', {
            SourceConfiguration: Match.objectLike({
                ImageRepository: Match.objectLike({
                    ImageRepositoryType: 'ECR',
                }),
            }),
        });
    });

    it('opens the database security group to the App Runner connector', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::EC2::SecurityGroupIngress',
            { FromPort: 5432, ToPort: 5432, IpProtocol: 'tcp' },
        );
    });

    it('publishes config to App Runner via env vars and secret refs', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::AppRunner::Service',
            {
                SourceConfiguration: Match.objectLike({
                    ImageRepository: Match.objectLike({
                        ImageConfiguration: Match.objectLike({
                            RuntimeEnvironmentVariables: Match.arrayWith([
                                Match.objectLike({ Name: 'S3_BUCKET' }),
                                Match.objectLike({
                                    Name: 'COGNITO_USER_POOL_ID',
                                }),
                                Match.objectLike({ Name: 'COGNITO_CLIENT_ID' }),
                                Match.objectLike({ Name: 'DB_HOST' }),
                                Match.objectLike({ Name: 'DB_PORT' }),
                                Match.objectLike({ Name: 'DB_NAME' }),
                            ]),
                            RuntimeEnvironmentSecrets: Match.arrayWith([
                                Match.objectLike({ Name: 'DB_USERNAME' }),
                                Match.objectLike({ Name: 'DB_PASSWORD' }),
                            ]),
                        }),
                    }),
                }),
            },
        );
    });

    it('configures HTTP health checks against /api/health', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::AppRunner::Service',
            {
                HealthCheckConfiguration: Match.objectLike({
                    Protocol: 'HTTP',
                    Path: '/api/health',
                }),
            },
        );
    });

    it('scales between 1 and 5 instances', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs(
            'AWS::AppRunner::AutoScalingConfiguration',
            1,
        );
        template.hasResourceProperties(
            'AWS::AppRunner::AutoScalingConfiguration',
            { MinSize: 1, MaxSize: 5 },
        );
    });

    it('grants the App Runner instance role read/write on the bucket', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: Match.objectLike({
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: Match.arrayWith(['s3:GetObject*', 's3:PutObject']),
                    }),
                ]),
            }),
        });
    });

    it('joins the App Runner service to the VPC via a connector', function () {
        const deps = makeDeps();
        const stack = new BackendStack(deps.app, 'TestBackend', {
            env: testEnv,
            vpc: deps.vpc,
            dbInstance: deps.dbInstance,
            bucket: deps.bucket,
            userPool: deps.userPool,
            userPoolClient: deps.userPoolClient,
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::AppRunner::VpcConnector', 1);
        template.hasResourceProperties('AWS::AppRunner::Service', {
            NetworkConfiguration: Match.objectLike({
                EgressConfiguration: Match.objectLike({
                    EgressType: 'VPC',
                }),
            }),
        });
    });
});
