import * as cdk from 'aws-cdk-lib';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { AuthStack } from '../lib/auth-stack.js';
import { NetworkStack } from '../lib/network-stack.js';
import { DatabaseStack } from '../lib/database-stack.js';
import { StorageStack } from '../lib/storage-stack.js';
import { BackendStack } from '../lib/backend-stack.js';
import { FrontendStack } from '../lib/frontend-stack.js';
import { CicdStack } from '../lib/cicd-stack.js';
import { BudgetStack } from '../lib/budget-stack.js';

const app = new cdk.App();

const env = {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'],
};

const frontendOrigin = 'https://dql4zzzglw3o5.cloudfront.net';
const localDevOrigin = 'http://localhost:5173';

const auth = new AuthStack(app, 'AuthStack', { env });
const network = new NetworkStack(app, 'NetworkStack', { env });
const database = new DatabaseStack(app, 'DatabaseStack', {
    env,
    vpc: network.vpc,
});
const storage = new StorageStack(app, 'StorageStack', {
    env,
    frontendOrigin,
    localDevOrigin,
});

const backend = new BackendStack(app, 'BackendStack', {
    env,
    vpc: network.vpc,
    publicSubnetIds: network.publicSubnetIds,
    dbInstance: database.instance,
    bucket: storage.bucket,
    userPool: auth.userPool,
    userPoolClient: auth.userPoolClient,
    frontendOrigin,
});

const frontendSources = [
    s3deploy.Source.asset('../frontend', {
        bundling: {
            image: cdk.DockerImage.fromRegistry('node:22-alpine'),
            environment: {
                HOME: '/tmp',
                npm_config_cache: '/tmp/.npm',
            },
            command: [
                'sh',
                '-c',
                'npm ci && npm run build && cp -r dist/. /asset-output/',
            ],
        },
    }),
];

new FrontendStack(app, 'FrontendStack', {
    env,
    apiEndpoint: backend.serviceEndpoint,
    frontendSources,
});

new CicdStack(app, 'CicdStack', {
    env,
    githubRepo: 'ukaday/your-guess-who',
    cdkBootstrapQualifier: 'hnb659fds',
    backendEcrRepoName: 'your-guess-who-backend',
});

new BudgetStack(app, 'BudgetStack', {
    env,
    alertEmailParameterName: '/your-guess-who/budget-alert-email',
});
