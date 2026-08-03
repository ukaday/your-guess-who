import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

export interface BudgetStackProps extends cdk.StackProps {
    alertEmailParameterName: string;
}

interface BudgetAlert {
    threshold: number;
    notificationType: 'ACTUAL' | 'FORECASTED';
}

interface BudgetDefinition {
    id: string;
    amount: number;
    timeUnit: 'DAILY' | 'MONTHLY';
    alerts: BudgetAlert[];
    service?: string;
}

export class BudgetStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: BudgetStackProps) {
        super(scope, id, props);

        const alertEmail = ssm.StringParameter.valueForStringParameter(
            this,
            props.alertEmailParameterName,
        );

        this.createBudgets(alertEmail);
    }

    private createBudgets(alertEmail: string): void {
        this.budgetDefinitions().forEach((definition) => {
            new budgets.CfnBudget(this, definition.id, {
                budget: {
                    budgetName: definition.id,
                    budgetType: 'COST',
                    timeUnit: definition.timeUnit,
                    budgetLimit: { amount: definition.amount, unit: 'USD' },
                    costFilters: definition.service
                        ? { Service: [definition.service] }
                        : undefined,
                    costTypes: { includeCredit: false },
                },
                notificationsWithSubscribers: definition.alerts.map((alert) => ({
                    notification: {
                        notificationType: alert.notificationType,
                        comparisonOperator: 'GREATER_THAN',
                        threshold: alert.threshold,
                        thresholdType: 'PERCENTAGE',
                    },
                    subscribers: [
                        {
                            subscriptionType: 'EMAIL',
                            address: alertEmail,
                        },
                    ],
                })),
            });
        });
    }

    private budgetDefinitions(): BudgetDefinition[] {
        return [
            {
                id: 'AccountMonthly',
                amount: 60,
                timeUnit: 'MONTHLY',
                alerts: [
                    { threshold: 80, notificationType: 'ACTUAL' },
                    { threshold: 100, notificationType: 'ACTUAL' },
                    { threshold: 100, notificationType: 'FORECASTED' },
                ],
            },
            {
                id: 'AccountDaily',
                amount: 3,
                timeUnit: 'DAILY',
                alerts: [{ threshold: 100, notificationType: 'ACTUAL' }],
            },
            {
                id: 'DatabaseMonthly',
                amount: 16,
                timeUnit: 'MONTHLY',
                service: 'Amazon Relational Database Service',
                alerts: [{ threshold: 100, notificationType: 'ACTUAL' }],
            },
            {
                id: 'ComputeMonthly',
                amount: 13,
                timeUnit: 'MONTHLY',
                service: 'Amazon Elastic Container Service',
                alerts: [{ threshold: 100, notificationType: 'ACTUAL' }],
            },
            {
                id: 'LoadBalancerMonthly',
                amount: 25,
                timeUnit: 'MONTHLY',
                service: 'Elastic Load Balancing',
                alerts: [{ threshold: 100, notificationType: 'ACTUAL' }],
            },
            {
                id: 'NetworkMonthly',
                amount: 8,
                timeUnit: 'MONTHLY',
                service: 'Amazon Virtual Private Cloud',
                alerts: [{ threshold: 100, notificationType: 'ACTUAL' }],
            },
        ];
    }
}
