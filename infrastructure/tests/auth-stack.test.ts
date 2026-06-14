import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/auth-stack.js';

describe('AuthStack', function () {
    it('creates a Cognito user pool and client', function () {
        const stack = new AuthStack(new App(), 'TestAuth');
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::Cognito::UserPool', 1);
        template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    it('allows self sign-up with username alias', function () {
        const stack = new AuthStack(new App(), 'TestAuth');

        Template.fromStack(stack).hasResourceProperties(
            'AWS::Cognito::UserPool',
            {
                AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
                UsernameAttributes: Match.absent(),
            },
        );
    });

    it('requires 8-character mixed-case passwords with digits', function () {
        const stack = new AuthStack(new App(), 'TestAuth');

        Template.fromStack(stack).hasResourceProperties(
            'AWS::Cognito::UserPool',
            {
                Policies: {
                    PasswordPolicy: {
                        MinimumLength: 8,
                        RequireLowercase: true,
                        RequireUppercase: true,
                        RequireNumbers: true,
                        RequireSymbols: false,
                    },
                },
            },
        );
    });

    it('configures the client for USER_PASSWORD_AUTH without a client secret', function () {
        const stack = new AuthStack(new App(), 'TestAuth');

        Template.fromStack(stack).hasResourceProperties(
            'AWS::Cognito::UserPoolClient',
            {
                ExplicitAuthFlows: Match.arrayWith([
                    'ALLOW_USER_PASSWORD_AUTH',
                ]),
                GenerateSecret: false,
            },
        );
    });

    it('exports user pool id and client id', function () {
        const stack = new AuthStack(new App(), 'TestAuth');

        Template.fromStack(stack).hasOutput('UserPoolId', {});
        Template.fromStack(stack).hasOutput('UserPoolClientId', {});
    });
});
