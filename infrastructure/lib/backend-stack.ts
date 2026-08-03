import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export interface BackendStackProps extends cdk.StackProps {
    vpc: ec2.IVpc;
    publicSubnetIds: string[];
    dbInstance: rds.DatabaseInstance;
    bucket: s3.IBucket;
    userPool: cognito.IUserPool;
    userPoolClient: cognito.IUserPoolClient;
    frontendOrigin: string;
}

export class BackendStack extends cdk.Stack {
    private static readonly containerPort = 3000;
    private static readonly databasePort = 5432;

    readonly repository: ecr.IRepository;
    readonly cluster: ecs.Cluster;
    readonly taskSecurityGroup: ec2.SecurityGroup;
    readonly executionRole: iam.Role;
    readonly infrastructureRole: iam.Role;
    readonly taskRole: iam.Role;
    readonly service: ecs.CfnExpressGatewayService;

    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        this.repository = this.importRepository();
        this.cluster = this.createCluster(props.vpc);
        this.taskSecurityGroup = this.createTaskSecurityGroup(props.vpc);
        this.executionRole = this.createExecutionRole(props.dbInstance);
        this.infrastructureRole = this.createInfrastructureRole();
        this.taskRole = this.createTaskRole(props.bucket);
        this.service = this.createService(props);
        this.allowTasksToReachDatabase(props.dbInstance);
        this.createOutputs();
    }

    get serviceEndpoint(): string {
        return this.service.attrEndpoint;
    }

    private importRepository(): ecr.IRepository {
        return ecr.Repository.fromRepositoryName(
            this,
            'Repository',
            'your-guess-who-backend',
        );
    }

    private createCluster(vpc: ec2.IVpc): ecs.Cluster {
        return new ecs.Cluster(this, 'Cluster', {
            vpc,
            clusterName: 'your-guess-who',
        });
    }

    private createTaskSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
        const securityGroup = new ec2.SecurityGroup(
            this,
            'TaskSecurityGroup',
            {
                vpc,
                description: 'ECS Express backend tasks',
                allowAllOutbound: true,
            },
        );

        securityGroup.addIngressRule(
            ec2.Peer.ipv4(vpc.vpcCidrBlock),
            ec2.Port.tcp(BackendStack.containerPort),
            'ECS-managed load balancer to backend tasks',
        );

        return securityGroup;
    }

    private createExecutionRole(dbInstance: rds.DatabaseInstance): iam.Role {
        const role = new iam.Role(this, 'ExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'service-role/AmazonECSTaskExecutionRolePolicy',
                ),
            ],
        });

        dbInstance.secret!.grantRead(role);

        return role;
    }

    private createInfrastructureRole(): iam.Role {
        return new iam.Role(this, 'InfrastructureRole', {
            assumedBy: new iam.ServicePrincipal('ecs.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'service-role/AmazonECSInfrastructureRoleforExpressGatewayServices',
                ),
            ],
        });
    }

    private createTaskRole(bucket: s3.IBucket): iam.Role {
        const role = new iam.Role(this, 'TaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        bucket.grantReadWrite(role);

        return role;
    }

    private createService(
        props: BackendStackProps,
    ): ecs.CfnExpressGatewayService {
        const dbSecret = props.dbInstance.secret!;

        return new ecs.CfnExpressGatewayService(this, 'Service', {
            serviceName: 'your-guess-who-backend',
            cluster: this.cluster.clusterName,
            cpu: '256',
            memory: '512',
            healthCheckPath: '/api/health',
            executionRoleArn: this.executionRole.roleArn,
            infrastructureRoleArn: this.infrastructureRole.roleArn,
            taskRoleArn: this.taskRole.roleArn,
            networkConfiguration: {
                subnets: props.publicSubnetIds,
                securityGroups: [this.taskSecurityGroup.securityGroupId],
            },
            scalingTarget: {
                minTaskCount: 1,
                maxTaskCount: 1,
            },
            primaryContainer: {
                image: `${this.repository.repositoryUri}:latest`,
                containerPort: BackendStack.containerPort,
                environment: [
                    { name: 'PORT', value: String(BackendStack.containerPort) },
                    { name: 'FRONTEND_ORIGIN', value: props.frontendOrigin },
                    { name: 'S3_BUCKET', value: props.bucket.bucketName },
                    {
                        name: 'COGNITO_USER_POOL_ID',
                        value: props.userPool.userPoolId,
                    },
                    {
                        name: 'COGNITO_CLIENT_ID',
                        value: props.userPoolClient.userPoolClientId,
                    },
                    {
                        name: 'DB_HOST',
                        value: props.dbInstance.dbInstanceEndpointAddress,
                    },
                    {
                        name: 'DB_PORT',
                        value: props.dbInstance.dbInstanceEndpointPort,
                    },
                    { name: 'DB_NAME', value: 'your_guess_who' },
                ],
                secrets: [
                    {
                        name: 'DB_USERNAME',
                        valueFrom: `${dbSecret.secretArn}:username::`,
                    },
                    {
                        name: 'DB_PASSWORD',
                        valueFrom: `${dbSecret.secretArn}:password::`,
                    },
                ],
            },
        });
    }

    private allowTasksToReachDatabase(dbInstance: rds.DatabaseInstance): void {
        const dbSecurityGroup = dbInstance.connections.securityGroups[0]!;

        new ec2.CfnSecurityGroupIngress(this, 'DatabaseIngressFromTasks', {
            groupId: dbSecurityGroup.securityGroupId,
            sourceSecurityGroupId: this.taskSecurityGroup.securityGroupId,
            ipProtocol: 'tcp',
            fromPort: BackendStack.databasePort,
            toPort: BackendStack.databasePort,
            description: 'ECS Express backend tasks to Postgres',
        });
    }

    private createOutputs(): void {
        new cdk.CfnOutput(this, 'ServiceEndpoint', {
            value: this.serviceEndpoint,
        });
    }
}
