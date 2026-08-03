import { describe, it, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CicdStack } from '../lib/cicd-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
    return new CicdStack(new App(), 'TestCicd', {
        env: testEnv,
        githubRepo: 'ukaday/your-guess-who',
        cdkBootstrapQualifier: 'hnb659fds',
        backendEcrRepoName: 'your-guess-who-backend',
    });
}

describe('CicdStack', function () {
    it('trusts GitHub as an OIDC provider for the STS audience', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'Custom::AWSCDKOpenIdConnectProvider',
            {
                Url: 'https://token.actions.githubusercontent.com',
                ClientIDList: ['sts.amazonaws.com'],
            },
        );
    });

    it('pins the trust policy to the master branch of the one repo', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Role',
            {
                RoleName: 'github-actions-deploy',
                AssumeRolePolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Action: 'sts:AssumeRoleWithWebIdentity',
                            Condition: {
                                StringEquals: {
                                    'token.actions.githubusercontent.com:aud':
                                        'sts.amazonaws.com',
                                    'token.actions.githubusercontent.com:sub':
                                        'repo:ukaday/your-guess-who:ref:refs/heads/master',
                                },
                            },
                        }),
                    ]),
                }),
            },
        );
    });

    it('matches the sub claim exactly rather than by wildcard', function () {
        const rendered = JSON.stringify(
            Template.fromStack(makeStack()).toJSON(),
        );

        expect(rendered).not.toContain('StringLike');
    });

    it('caps session duration at one hour', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Role',
            { MaxSessionDuration: 3600 },
        );
    });

    it('allows assuming only the CDK bootstrap roles it needs, including lookup for AZ context', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Policy',
            {
                PolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Sid: 'AssumeCdkBootstrapRoles',
                            Action: 'sts:AssumeRole',
                            Resource: [
                                'arn:aws:iam::111111111111:role/cdk-hnb659fds-deploy-role-111111111111-us-east-2',
                                'arn:aws:iam::111111111111:role/cdk-hnb659fds-file-publishing-role-111111111111-us-east-2',
                                'arn:aws:iam::111111111111:role/cdk-hnb659fds-lookup-role-111111111111-us-east-2',
                            ],
                        }),
                    ]),
                }),
            },
        );
    });

    it('grants no image-publishing role, there are no Docker image assets', function () {
        const rendered = JSON.stringify(
            Template.fromStack(makeStack()).toJSON(),
        );

        expect(rendered).not.toContain('image-publishing-role');
    });

    it('scopes ECR layer pushes to the backend repository', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::IAM::Policy',
            {
                PolicyDocument: Match.objectLike({
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Sid: 'EcrPushBackendImage',
                            Resource:
                                'arn:aws:ecr:us-east-2:111111111111:repository/your-guess-who-backend',
                        }),
                    ]),
                }),
            },
        );
    });

    it('grants no ECR pull permissions, the base image comes from Docker Hub', function () {
        const rendered = JSON.stringify(
            Template.fromStack(makeStack()).toJSON(),
        );

        expect(rendered).not.toContain('ecr:GetDownloadUrlForLayer');
        expect(rendered).not.toContain('ecr:BatchGetImage');
    });

    it('attaches no administrator policy directly to the deploy role', function () {
        const rendered = JSON.stringify(
            Template.fromStack(makeStack()).toJSON(),
        );

        expect(rendered).not.toContain('AdministratorAccess');
    });

    it('outputs the deploy role ARN for the workflows to assume', function () {
        Template.fromStack(makeStack()).hasOutput('*', {
            Value: {
                'Fn::GetAtt': Match.arrayWith([
                    Match.stringLikeRegexp('DeployRole'),
                    'Arn',
                ]),
            },
        });
    });
});
