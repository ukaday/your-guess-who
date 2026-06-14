import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack.js';
import { NetworkStack } from '../lib/network-stack.js';
import { DatabaseStack } from '../lib/database-stack.js';
import { StorageStack } from '../lib/storage-stack.js';

const app = new cdk.App();

const env = {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'],
};

new AuthStack(app, 'AuthStack', { env });

const network = new NetworkStack(app, 'NetworkStack', { env });

new DatabaseStack(app, 'DatabaseStack', { env, vpc: network.vpc });

new StorageStack(app, 'StorageStack', { env });
