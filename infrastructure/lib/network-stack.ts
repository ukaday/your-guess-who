import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
    private static readonly publicCidrBlock = '10.1.0.0/16';
    private static readonly publicSubnetCidrBlocks = [
        '10.1.0.0/24',
        '10.1.1.0/24',
    ];

    readonly vpc: ec2.Vpc;
    readonly s3GatewayEndpoint: ec2.GatewayVpcEndpoint;
    readonly publicSubnetIds: string[];

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = this.createVpc();
        this.s3GatewayEndpoint = this.createS3GatewayEndpoint();
        this.publicSubnetIds = this.createPublicSubnets();
        this.retainVpcCidrBlockExportUntilBackendStackStopsImportingIt();
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

    private createPublicSubnets(): string[] {
        const cidrBlock = this.attachSecondaryCidrBlock();
        const routeTable = this.createPublicRouteTable();

        return NetworkStack.publicSubnetCidrBlocks.map(
            (subnetCidrBlock, index) => {
                const subnet = new ec2.CfnSubnet(
                    this,
                    `PublicSubnet${index + 1}`,
                    {
                        vpcId: this.vpc.vpcId,
                        cidrBlock: subnetCidrBlock,
                        availabilityZone: cdk.Fn.select(
                            index,
                            cdk.Fn.getAzs(),
                        ),
                        mapPublicIpOnLaunch: true,
                    },
                );
                subnet.addDependency(cidrBlock);

                new ec2.CfnSubnetRouteTableAssociation(
                    this,
                    `PublicSubnet${index + 1}RouteTableAssociation`,
                    {
                        subnetId: subnet.ref,
                        routeTableId: routeTable.ref,
                    },
                );

                return subnet.ref;
            },
        );
    }

    private attachSecondaryCidrBlock(): ec2.CfnVPCCidrBlock {
        return new ec2.CfnVPCCidrBlock(this, 'PublicCidrBlock', {
            vpcId: this.vpc.vpcId,
            cidrBlock: NetworkStack.publicCidrBlock,
        });
    }

    private createPublicRouteTable(): ec2.CfnRouteTable {
        const internetGateway = new ec2.CfnInternetGateway(
            this,
            'InternetGateway',
            {},
        );

        const attachment = new ec2.CfnVPCGatewayAttachment(
            this,
            'InternetGatewayAttachment',
            {
                vpcId: this.vpc.vpcId,
                internetGatewayId: internetGateway.ref,
            },
        );

        const routeTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
            vpcId: this.vpc.vpcId,
        });

        const defaultRoute = new ec2.CfnRoute(this, 'PublicDefaultRoute', {
            routeTableId: routeTable.ref,
            destinationCidrBlock: '0.0.0.0/0',
            gatewayId: internetGateway.ref,
        });
        defaultRoute.addDependency(attachment);

        return routeTable;
    }

    private retainVpcCidrBlockExportUntilBackendStackStopsImportingIt(): void {
        this.exportValue(this.vpc.vpcCidrBlock);
    }
}
