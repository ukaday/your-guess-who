import { describe, it, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
    return new NetworkStack(new App(), 'TestNetwork', { env: testEnv });
}

describe('NetworkStack', function () {
    it('creates a VPC', function () {
        Template.fromStack(makeStack()).resourceCountIs('AWS::EC2::VPC', 1);
    });

    it('leaves the isolated subnets on their original /17 blocks so the database is never replaced', function () {
        const template = Template.fromStack(makeStack());

        template.resourcePropertiesCountIs(
            'AWS::EC2::Subnet',
            { CidrBlock: '10.0.0.0/17' },
            1,
        );
        template.resourcePropertiesCountIs(
            'AWS::EC2::Subnet',
            { CidrBlock: '10.0.128.0/17' },
            1,
        );
    });

    it('carves public subnets out of a secondary CIDR because the primary block is fully consumed', function () {
        const template = Template.fromStack(makeStack());

        template.hasResourceProperties('AWS::EC2::VPCCidrBlock', {
            CidrBlock: '10.1.0.0/16',
        });
        template.resourcePropertiesCountIs(
            'AWS::EC2::Subnet',
            { MapPublicIpOnLaunch: true },
            2,
        );
    });

    it('spreads the public subnets across both availability zones', function () {
        const template = Template.fromStack(makeStack());

        template.hasResourceProperties('AWS::EC2::Subnet', {
            CidrBlock: '10.1.0.0/24',
            AvailabilityZone: { 'Fn::Select': [0, { 'Fn::GetAZs': '' }] },
        });
        template.hasResourceProperties('AWS::EC2::Subnet', {
            CidrBlock: '10.1.1.0/24',
            AvailabilityZone: { 'Fn::Select': [1, { 'Fn::GetAZs': '' }] },
        });
    });

    it('provisions an internet gateway so Fargate tasks reach ECR and CloudWatch without NAT', function () {
        const template = Template.fromStack(makeStack());

        template.resourceCountIs('AWS::EC2::InternetGateway', 1);
        template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    });

    it('provisions no NAT gateways', function () {
        Template.fromStack(makeStack()).resourceCountIs(
            'AWS::EC2::NatGateway',
            0,
        );
    });

    it('routes the public subnets at the internet gateway', function () {
        const template = Template.fromStack(makeStack());

        template.hasResourceProperties('AWS::EC2::Route', {
            DestinationCidrBlock: '0.0.0.0/0',
            GatewayId: Match.anyValue(),
        });
        template.resourcePropertiesCountIs(
            'AWS::EC2::SubnetRouteTableAssociation',
            { RouteTableId: { Ref: 'PublicRouteTable' } },
            2,
        );
    });

    it('exposes both public subnet ids for the backend service', function () {
        expect(makeStack().publicSubnetIds).toHaveLength(2);
    });

    it('provisions an S3 gateway endpoint for free egress to S3', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::EC2::VPCEndpoint',
            {
                VpcEndpointType: 'Gateway',
                ServiceName: {
                    'Fn::Join': [
                        '',
                        ['com.amazonaws.', { Ref: 'AWS::Region' }, '.s3'],
                    ],
                },
            },
        );
    });

    it('provisions no interface endpoints, tasks reach AWS services over the internet gateway instead', function () {
        Template.fromStack(makeStack()).resourcePropertiesCountIs(
            'AWS::EC2::VPCEndpoint',
            { VpcEndpointType: 'Interface' },
            0,
        );
    });
});
