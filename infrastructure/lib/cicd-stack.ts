import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface CicdStackProps extends cdk.StackProps {
    githubRepo: string;
    cdkBootstrapQualifier: string;
    backendEcrRepoName: string;
}

export class CicdStack extends cdk.Stack {
    readonly deployRole: iam.Role;

    constructor(scope: Construct, id: string, props: CicdStackProps) {
        super(scope, id, props);

        const provider = new iam.OpenIdConnectProvider(this, 'GithubProvider', {
            url: 'https://token.actions.githubusercontent.com',
            clientIds: ['sts.amazonaws.com'],
        });

        this.deployRole = new iam.Role(this, 'DeployRole', {
            roleName: 'github-actions-deploy',
            maxSessionDuration: cdk.Duration.hours(1),
            assumedBy: new iam.WebIdentityPrincipal(
                provider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                        'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:ref:refs/heads/master`,
                    },
                },
            ),
        });

        const deployPolicy = new iam.Policy(this, 'DeployPolicy', {
            policyName: 'deploy',
            document: iam.PolicyDocument.fromJson({
                Version: '2012-10-17',
                Statement: [
                    {
                        Sid: 'AssumeCdkBootstrapRoles',
                        Effect: 'Allow',
                        Action: 'sts:AssumeRole',
                        Resource: [
                            `arn:aws:iam::${this.account}:role/cdk-${props.cdkBootstrapQualifier}-deploy-role-${this.account}-${this.region}`,
                            `arn:aws:iam::${this.account}:role/cdk-${props.cdkBootstrapQualifier}-file-publishing-role-${this.account}-${this.region}`,
                            `arn:aws:iam::${this.account}:role/cdk-${props.cdkBootstrapQualifier}-lookup-role-${this.account}-${this.region}`,
                        ],
                    },
                    {
                        Sid: 'EcrGetToken',
                        Effect: 'Allow',
                        Action: 'ecr:GetAuthorizationToken',
                        Resource: '*',
                    },
                    {
                        Sid: 'EcrPushBackendImage',
                        Effect: 'Allow',
                        Action: [
                            'ecr:BatchCheckLayerAvailability',
                            'ecr:PutImage',
                            'ecr:InitiateLayerUpload',
                            'ecr:UploadLayerPart',
                            'ecr:CompleteLayerUpload',
                        ],
                        Resource: `arn:aws:ecr:${this.region}:${this.account}:repository/${props.backendEcrRepoName}`,
                    },
                ],
            }),
        });

        this.deployRole.attachInlinePolicy(deployPolicy);

        new cdk.CfnOutput(this, 'DeployRoleArn', { value: this.deployRole.roleArn });
    }
}
