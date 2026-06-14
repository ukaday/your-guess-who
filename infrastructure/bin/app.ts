import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack.js';
import { NetworkStack } from '../lib/network-stack.js';
import { DatabaseStack } from '../lib/database-stack.js';
import { StorageStack } from '../lib/storage-stack.js';
import { BackendStack } from '../lib/backend-stack.js';

const app = new cdk.App();

const env = {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'],
};

const auth = new AuthStack(app, 'AuthStack', { env });
const network = new NetworkStack(app, 'NetworkStack', { env });
const database = new DatabaseStack(app, 'DatabaseStack', {
    env,
    vpc: network.vpc,
});
const storage = new StorageStack(app, 'StorageStack', { env });

new BackendStack(app, 'BackendStack', {
    env,
    vpc: network.vpc,
    dbInstance: database.instance,
    bucket: storage.bucket,
    userPool: auth.userPool,
    userPoolClient: auth.userPoolClient,
});
