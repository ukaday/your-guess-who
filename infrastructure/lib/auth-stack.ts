import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const userPool = this.createUserPool();
        const client = this.createUserPoolClient(userPool);
        this.createOutputs(userPool, client);
    }

    private createUserPool(): cognito.UserPool {
        return new cognito.UserPool(this, 'UserPool', {
            userPoolName: 'your-guess-who',
            selfSignUpEnabled: true,
            signInAliases: { username: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.NONE,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }

    private createUserPoolClient(userPool: cognito.UserPool): cognito.UserPoolClient {
        return new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            userPoolClientName: 'your-guess-who-client',
            authFlows: { userPassword: true },
            generateSecret: false,
        });
    }

    private createOutputs(userPool: cognito.UserPool, client: cognito.UserPoolClient): void {
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
    }
}
