import { describe, it } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { BackendStack } from '../lib/backend-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
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

    return new BackendStack(app, 'TestBackend', {
        env: testEnv,
        vpc,
        publicSubnetIds: ['subnet-public1', 'subnet-public2'],
        dbInstance,
        bucket,
        userPool,
        userPoolClient,
        frontendOrigin: 'https://example.cloudfront.net',
    });
}

describe('BackendStack', function () {
    it('imports the existing ECR repository (does not create one)', function () {
        Template.fromStack(makeStack()).resourceCountIs(
            'AWS::ECR::Repository',
            0,
        );
    });

    it('creates an ECS Express gateway service backed by the ECR image', function () {
        const template = Template.fromStack(makeStack());

        template.resourceCountIs('AWS::ECS::ExpressGatewayService', 1);
        template.hasResourceProperties('AWS::ECS::ExpressGatewayService', {
            PrimaryContainer: Match.objectLike({
                Image: Match.anyValue(),
                ContainerPort: 3000,
            }),
        });
    });

    it('leaves no App Runner resources behind', function () {
        const template = Template.fromStack(makeStack());

        template.resourceCountIs('AWS::AppRunner::Service', 0);
        template.resourceCountIs('AWS::AppRunner::VpcConnector', 0);
        template.resourceCountIs('AWS::AppRunner::AutoScalingConfiguration', 0);
    });

    it('runs exactly one task because Socket.io rooms are held in process memory', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::ECS::ExpressGatewayService',
            { ScalingTarget: { MinTaskCount: 1, MaxTaskCount: 1 } },
        );
    });

    it('sizes tasks to match the previous App Runner allocation', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::ECS::ExpressGatewayService',
            { Cpu: '256', Memory: '512' },
        );
    });

    it('health checks against /api/health rather than the platform default', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::ECS::ExpressGatewayService',
            { HealthCheckPath: '/api/health' },
        );
    });

    it('publishes config via env vars and secret refs', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::ECS::ExpressGatewayService',
            {
                PrimaryContainer: Match.objectLike({
                    Environment: Match.arrayWith([
                        Match.objectLike({ Name: 'PORT' }),
                        Match.objectLike({
                            Name: 'FRONTEND_ORIGIN',
                            Value: 'https://example.cloudfront.net',
                        }),
                        Match.objectLike({ Name: 'S3_BUCKET' }),
                        Match.objectLike({ Name: 'COGNITO_USER_POOL_ID' }),
                        Match.objectLike({ Name: 'COGNITO_CLIENT_ID' }),
                        Match.objectLike({ Name: 'DB_HOST' }),
                        Match.objectLike({ Name: 'DB_PORT' }),
                        Match.objectLike({ Name: 'DB_NAME' }),
                    ]),
                    Secrets: Match.arrayWith([
                        Match.objectLike({ Name: 'DB_USERNAME' }),
                        Match.objectLike({ Name: 'DB_PASSWORD' }),
                    ]),
                }),
            },
        );
    });

    it('places tasks in the public subnets with the task security group attached', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::ECS::ExpressGatewayService',
            {
                NetworkConfiguration: {
                    Subnets: ['subnet-public1', 'subnet-public2'],
                    SecurityGroups: Match.anyValue(),
                },
            },
        );
    });

    it('creates a task security group with egress but no ingress of its own, ECS Express manages the load balancer path', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::EC2::SecurityGroup',
            {
                GroupDescription: Match.stringLikeRegexp('ECS Express'),
                SecurityGroupEgress: Match.anyValue(),
                SecurityGroupIngress: Match.absent(),
            },
        );
    });

    it('opens the database security group to the task security group', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::EC2::SecurityGroupIngress',
            {
                FromPort: 5432,
                ToPort: 5432,
                IpProtocol: 'tcp',
                SourceSecurityGroupId: Match.anyValue(),
            },
        );
    });

    it('creates an execution role ECS tasks can assume', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Role',
            {
                AssumeRolePolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Principal: { Service: 'ecs-tasks.amazonaws.com' },
                        }),
                    ]),
                }),
                ManagedPolicyArns: Match.arrayWith([
                    Match.objectLike({
                        'Fn::Join': Match.arrayWith([
                            Match.arrayWith([
                                Match.stringLikeRegexp(
                                    'AmazonECSTaskExecutionRolePolicy',
                                ),
                            ]),
                        ]),
                    }),
                ]),
            },
        );
    });

    it('creates an infrastructure role ECS itself can assume to manage the load balancer', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Role',
            {
                AssumeRolePolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Principal: { Service: 'ecs.amazonaws.com' },
                        }),
                    ]),
                }),
                ManagedPolicyArns: Match.arrayWith([
                    Match.objectLike({
                        'Fn::Join': Match.arrayWith([
                            Match.arrayWith([
                                Match.stringLikeRegexp(
                                    'AmazonECSInfrastructureRoleforExpressGatewayServices',
                                ),
                            ]),
                        ]),
                    }),
                ]),
            },
        );
    });

    it('grants the task role read/write on the image bucket', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Policy',
            {
                PolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Action: Match.arrayWith([
                                's3:GetObject*',
                                's3:PutObject',
                            ]),
                        }),
                    ]),
                }),
            },
        );
    });

    it('creates an ECS cluster to host the service', function () {
        Template.fromStack(makeStack()).resourceCountIs('AWS::ECS::Cluster', 1);
    });

    it('outputs the service endpoint for the CloudFront origin', function () {
        Template.fromStack(makeStack()).hasOutput('*', {
            Value: { 'Fn::GetAtt': Match.arrayWith(['Endpoint']) },
        });
    });
});
