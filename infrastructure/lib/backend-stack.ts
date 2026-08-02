import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import type { Construct } from 'constructs';

export interface BackendStackProps extends cdk.StackProps {
    vpc: ec2.IVpc;
    dbInstance: rds.DatabaseInstance;
    bucket: s3.IBucket;
    userPool: cognito.IUserPool;
    userPoolClient: cognito.IUserPoolClient;
}

export class BackendStack extends cdk.Stack {
    readonly repository: ecr.IRepository;
    readonly service: apprunner.Service;
    readonly vpcConnector: apprunner.VpcConnector;

    readonly autoScalingConfiguration: apprunner.AutoScalingConfiguration;

    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        this.repository = this.importRepository();
        this.vpcConnector = this.createVpcConnector(props.vpc);
        this.autoScalingConfiguration = this.createAutoScalingConfiguration();
        this.service = this.createService(props);
        this.allowConnectorToReachDatabase(props.dbInstance);
        props.bucket.grantReadWrite(this.service);
    }

    private importRepository(): ecr.IRepository {
        return ecr.Repository.fromRepositoryName(
            this,
            'Repository',
            'your-guess-who-backend',
        );
    }

    private createVpcConnector(vpc: ec2.IVpc): apprunner.VpcConnector {
        return new apprunner.VpcConnector(this, 'VpcConnector', {
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        });
    }

    private createService(props: BackendStackProps): apprunner.Service {
        const dbSecret = props.dbInstance.secret!;

        return new apprunner.Service(this, 'Service', {
            source: apprunner.Source.fromEcr({
                repository: this.repository,
                tagOrDigest: 'latest',
                imageConfiguration: {
                    port: 3000,
                    environmentVariables: {
                        PORT: '3000',
                        FRONTEND_ORIGIN: 'https://dql4zzzglw3o5.cloudfront.net',
                        S3_BUCKET: props.bucket.bucketName,
                        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
                        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
                        DB_HOST: props.dbInstance.dbInstanceEndpointAddress,
                        DB_PORT: props.dbInstance.dbInstanceEndpointPort,
                        DB_NAME: 'your_guess_who',
                    },
                    environmentSecrets: {
                        DB_USERNAME: apprunner.Secret.fromSecretsManager(
                            dbSecret,
                            'username',
                        ),
                        DB_PASSWORD: apprunner.Secret.fromSecretsManager(
                            dbSecret,
                            'password',
                        ),
                    },
                },
            }),
            cpu: apprunner.Cpu.QUARTER_VCPU,
            memory: apprunner.Memory.HALF_GB,
            vpcConnector: this.vpcConnector,
            healthCheck: apprunner.HealthCheck.http({
                path: '/api/health',
                timeout: cdk.Duration.seconds(10),
                interval: cdk.Duration.seconds(10),
                healthyThreshold: 1,
                unhealthyThreshold: 5,
            }),
            autoScalingConfiguration: this.autoScalingConfiguration,
        });
    }

    private createAutoScalingConfiguration(): apprunner.AutoScalingConfiguration {
        return new apprunner.AutoScalingConfiguration(this, 'AutoScaling', {
            minSize: 1,
            maxSize: 3,
        });
    }

    private allowConnectorToReachDatabase(
        dbInstance: rds.DatabaseInstance,
    ): void {
        const dbSecurityGroup = dbInstance.connections.securityGroups[0]!;
        const connectorSecurityGroup =
            this.vpcConnector.connections.securityGroups[0]!;

        new ec2.CfnSecurityGroupIngress(this, 'DatabaseIngressFromConnector', {
            groupId: dbSecurityGroup.securityGroupId,
            sourceSecurityGroupId: connectorSecurityGroup.securityGroupId,
            ipProtocol: 'tcp',
            fromPort: 5432,
            toPort: 5432,
            description: 'App Runner VPC connector to Postgres',
        });
    }
}
