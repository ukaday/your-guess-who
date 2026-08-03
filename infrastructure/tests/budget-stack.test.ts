import { describe, it, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BudgetStack } from '../lib/budget-stack.js';

const testEnv = { account: '111111111111', region: 'us-east-2' };

function makeStack() {
    return new BudgetStack(new App(), 'TestBudget', {
        env: testEnv,
        alertEmailParameterName: '/your-guess-who/budget-alert-email',
    });
}

describe('BudgetStack', function () {
    it('creates one budget per cost line being watched', function () {
        Template.fromStack(makeStack()).resourceCountIs(
            'AWS::Budgets::Budget',
            6,
        );
    });

    it('caps the account at 60 USD a month with early and forecast warnings', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::Budgets::Budget',
            {
                Budget: Match.objectLike({
                    BudgetName: 'AccountMonthly',
                    TimeUnit: 'MONTHLY',
                    BudgetLimit: { Amount: 60, Unit: 'USD' },
                }),
                NotificationsWithSubscribers: Match.arrayWith([
                    Match.objectLike({
                        Notification: Match.objectLike({
                            NotificationType: 'ACTUAL',
                            Threshold: 80,
                        }),
                    }),
                    Match.objectLike({
                        Notification: Match.objectLike({
                            NotificationType: 'FORECASTED',
                            Threshold: 100,
                        }),
                    }),
                ]),
            },
        );
    });

    it('watches a daily budget so a runaway cost is caught within a day', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::Budgets::Budget',
            {
                Budget: Match.objectLike({
                    BudgetName: 'AccountDaily',
                    TimeUnit: 'DAILY',
                    BudgetLimit: { Amount: 3, Unit: 'USD' },
                }),
            },
        );
    });

    it('budgets the load balancer separately since it bills continuously', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::Budgets::Budget',
            {
                Budget: Match.objectLike({
                    BudgetName: 'LoadBalancerMonthly',
                    CostFilters: { Service: ['Elastic Load Balancing'] },
                }),
            },
        );
    });

    it('budgets the container service that replaced App Runner', function () {
        Template.fromStack(makeStack()).hasResourceProperties(
            'AWS::Budgets::Budget',
            {
                Budget: Match.objectLike({
                    BudgetName: 'ComputeMonthly',
                    CostFilters: {
                        Service: ['Amazon Elastic Container Service'],
                    },
                }),
            },
        );
    });

    it('no longer filters any budget on App Runner', function () {
        const rendered = JSON.stringify(
            Template.fromStack(makeStack()).toJSON(),
        );

        expect(rendered).not.toContain('App Runner');
    });

    it('excludes credits so credit-offset spend still triggers alerts', function () {
        const budgetResources = Template.fromStack(makeStack()).findResources(
            'AWS::Budgets::Budget',
        );

        Object.values(budgetResources).forEach(function (resource) {
            expect(resource.Properties.Budget.CostTypes).toEqual({
                IncludeCredit: false,
            });
        });
    });

    it('reads the alert address from Parameter Store instead of embedding it', function () {
        const template = Template.fromStack(makeStack());
        const rendered = JSON.stringify(template.toJSON());

        expect(rendered).not.toContain('@');
        template.hasParameter('*', {
            Type: 'AWS::SSM::Parameter::Value<String>',
            Default: '/your-guess-who/budget-alert-email',
        });
    });
});
