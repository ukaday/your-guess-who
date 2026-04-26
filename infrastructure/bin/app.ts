import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack.js';

const app = new cdk.App();

new AuthStack(app, 'AuthStack', {
    env: {
        account: process.env['CDK_DEFAULT_ACCOUNT'],
        region: process.env['CDK_DEFAULT_REGION'],
    },
});
