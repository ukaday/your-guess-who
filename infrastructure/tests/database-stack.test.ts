import { describe, it } from 'vitest';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DatabaseStack } from '../lib/database-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeVpc() {
    const app = new App();
    const networkStack = new Stack(app, 'TestNetwork', { env: testEnv });
    const vpc = new ec2.Vpc(networkStack, 'Vpc', {
        maxAzs: 2,
        subnetConfiguration: [
            { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        ],
    });

    return { app, vpc };
}

describe('DatabaseStack', function () {
    it('creates an RDS DB instance', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).resourceCountIs('AWS::RDS::DBInstance', 1);
    });

    it('runs Postgres 15', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::RDS::DBInstance',
            { Engine: 'postgres', EngineVersion: Match.stringLikeRegexp('15') },
        );
    });

    it('runs on a Graviton t4g.micro instance', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::RDS::DBInstance',
            { DBInstanceClass: 'db.t4g.micro' },
        );
    });

    it('provisions 20 GB of encrypted gp2 storage', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::RDS::DBInstance',
            {
                AllocatedStorage: '20',
                StorageType: 'gp2',
                StorageEncrypted: true,
            },
        );
    });

    it('runs single-AZ with 1-day backup retention (free tier cap)', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::RDS::DBInstance',
            { MultiAZ: false, BackupRetentionPeriod: 1 },
        );
    });

    it('enables deletion protection and snapshots on removal', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::RDS::DBInstance', {
            DeletionProtection: true,
        });
        template.hasResource('AWS::RDS::DBInstance', {
            DeletionPolicy: 'Snapshot',
            UpdateReplacePolicy: 'Snapshot',
        });
    });

    it('names the database your_guess_who', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });

        Template.fromStack(stack).hasResourceProperties(
            'AWS::RDS::DBInstance',
            { DBName: 'your_guess_who' },
        );
    });

    it('stores generated postgres credentials in Secrets Manager', function () {
        const { app, vpc } = makeVpc();
        const stack = new DatabaseStack(app, 'TestDatabase', {
            env: testEnv,
            vpc,
        });
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::SecretsManager::Secret', 1);
        template.hasResourceProperties('AWS::SecretsManager::Secret', {
            GenerateSecretString: Match.objectLike({
                SecretStringTemplate: Match.stringLikeRegexp('postgres'),
            }),
        });
    });
});
