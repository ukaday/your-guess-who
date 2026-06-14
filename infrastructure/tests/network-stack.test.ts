import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack.js';

describe('NetworkStack', function () {
    it('creates a VPC', function () {
        const stack = new NetworkStack(new App(), 'TestNetwork');

        Template.fromStack(stack).resourceCountIs('AWS::EC2::VPC', 1);
    });

    it('provisions no internet gateway and no NAT gateways', function () {
        const stack = new NetworkStack(new App(), 'TestNetwork');
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::EC2::InternetGateway', 0);
        template.resourceCountIs('AWS::EC2::NatGateway', 0);
    });

    it('spans 2 availability zones with one isolated subnet each', function () {
        const stack = new NetworkStack(new App(), 'TestNetwork');

        Template.fromStack(stack).resourceCountIs('AWS::EC2::Subnet', 2);
    });
});
