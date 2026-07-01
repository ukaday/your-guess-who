import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    readonly s3GatewayEndpoint: ec2.GatewayVpcEndpoint;
    readonly cognitoIdpEndpoint: ec2.InterfaceVpcEndpoint;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.createVpc();
        this.s3GatewayEndpoint = this.createS3GatewayEndpoint();
        this.cognitoIdpEndpoint = this.createCognitoIdpEndpoint();
    }

    private createVpc(): ec2.Vpc {
        return new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });
    }

    private createS3GatewayEndpoint(): ec2.GatewayVpcEndpoint {
        return this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
        });
    }

    private createCognitoIdpEndpoint(): ec2.InterfaceVpcEndpoint {
        return this.vpc.addInterfaceEndpoint('CognitoIdpEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
            privateDnsEnabled: true,
        });
    }
}
