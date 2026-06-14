import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import type { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
    vpc: ec2.IVpc;
}

export class DatabaseStack extends cdk.Stack {
    readonly instance: rds.DatabaseInstance;

    constructor(scope: Construct, id: string, props: DatabaseStackProps) {
        super(scope, id, props);

        this.instance = this.createInstance(props.vpc);
    }

    private createInstance(vpc: ec2.IVpc): rds.DatabaseInstance {
        return new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_15,
            }),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            instanceType: ec2.InstanceType.of(
                ec2.InstanceClass.T3,
                ec2.InstanceSize.MICRO,
            ),
            allocatedStorage: 20,
            storageType: rds.StorageType.GP2,
            storageEncrypted: true,
            multiAz: false,
            backupRetention: cdk.Duration.days(1),
            deletionProtection: true,
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            databaseName: 'your_guess_who',
            credentials: rds.Credentials.fromGeneratedSecret('postgres'),
        });
    }
}
