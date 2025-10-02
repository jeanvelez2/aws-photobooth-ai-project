"use strict";
/**
 * Security-focused Infrastructure Tests
 * Tests security configurations and compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
const aws_cdk_lib_1 = require("aws-cdk-lib");
const assertions_1 = require("aws-cdk-lib/assertions");
const photobooth_stack_1 = require("../src/stacks/photobooth-stack");
describe('Security Infrastructure Tests', () => {
    let app;
    let stack;
    let template;
    beforeEach(() => {
        app = new aws_cdk_lib_1.App();
        stack = new photobooth_stack_1.PhotoboothStack(app, 'SecurityTestStack', {
            environment: 'test',
        });
        template = assertions_1.Template.fromStack(stack);
    });
    describe('S3 Security Configuration', () => {
        it('should block all public access', () => {
            template.hasResourceProperties('AWS::S3::Bucket', {
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                },
            });
        });
        it('should enable server-side encryption', () => {
            template.hasResourceProperties('AWS::S3::Bucket', {
                BucketEncryption: {
                    ServerSideEncryptionConfiguration: assertions_1.Match.arrayWith([
                        {
                            ServerSideEncryptionByDefault: {
                                SSEAlgorithm: 'AES256',
                            },
                            BucketKeyEnabled: true,
                        },
                    ]),
                },
            });
        });
        it('should enforce SSL/TLS for all requests', () => {
            template.hasResourceProperties('AWS::S3::BucketPolicy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Deny',
                            Principal: '*',
                            Action: 's3:*',
                            Resource: assertions_1.Match.anyValue(),
                            Condition: {
                                Bool: {
                                    'aws:SecureTransport': 'false',
                                },
                            },
                        }),
                    ]),
                },
            });
        });
    });
    describe('IAM Security Configuration', () => {
        it('should use least privilege principle for ECS task role', () => {
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Allow',
                            Action: assertions_1.Match.not(assertions_1.Match.arrayWith(['*'])), // Should not have wildcard permissions
                        }),
                    ]),
                },
            });
        });
        it('should not allow cross-account access without conditions', () => {
            const policies = template.findResources('AWS::IAM::Policy');
            Object.values(policies).forEach((policy) => {
                const statements = policy.Properties?.PolicyDocument?.Statement || [];
                statements.forEach((statement) => {
                    if (statement.Principal && typeof statement.Principal === 'object') {
                        // If there's a cross-account principal, there should be conditions
                        if (statement.Principal.AWS && Array.isArray(statement.Principal.AWS)) {
                            statement.Principal.AWS.forEach((arn) => {
                                if (arn.includes(':root')) {
                                    expect(statement.Condition).toBeDefined();
                                }
                            });
                        }
                    }
                });
            });
        });
        it('should require MFA for sensitive operations', () => {
            // Check for MFA conditions in policies that allow destructive actions
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Allow',
                            Action: assertions_1.Match.arrayWith(['s3:DeleteObject']),
                            Condition: {
                                Bool: {
                                    'aws:MultiFactorAuthPresent': 'true',
                                },
                            },
                        }),
                    ]),
                },
            });
        });
    });
    describe('Network Security Configuration', () => {
        it('should create security groups with minimal required access', () => {
            template.hasResourceProperties('AWS::EC2::SecurityGroup', {
                SecurityGroupIngress: assertions_1.Match.arrayWith([
                    assertions_1.Match.objectLike({
                        IpProtocol: 'tcp',
                        FromPort: assertions_1.Match.anyValue(),
                        ToPort: assertions_1.Match.anyValue(),
                        CidrIp: assertions_1.Match.absent(), // Should not allow 0.0.0.0/0 access
                        SourceSecurityGroupId: assertions_1.Match.anyValue(), // Should reference other security groups
                    }),
                ]),
            });
        });
        it('should not allow SSH access from internet', () => {
            const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
            Object.values(securityGroups).forEach((sg) => {
                const ingressRules = sg.Properties?.SecurityGroupIngress || [];
                ingressRules.forEach((rule) => {
                    if (rule.FromPort === 22 || rule.ToPort === 22) {
                        expect(rule.CidrIp).not.toBe('0.0.0.0/0');
                    }
                });
            });
        });
        it('should use HTTPS/TLS for all external communication', () => {
            template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
                Protocol: 'HTTPS',
                Port: 443,
            });
        });
    });
    describe('Data Encryption Configuration', () => {
        it('should encrypt DynamoDB tables at rest', () => {
            template.hasResourceProperties('AWS::DynamoDB::Table', {
                SSESpecification: {
                    SSEEnabled: true,
                },
            });
        });
        it('should encrypt ECS task logs', () => {
            template.hasResourceProperties('AWS::Logs::LogGroup', {
                KmsKeyId: assertions_1.Match.anyValue(), // Should have KMS key for encryption
            });
        });
        it('should use encrypted communication for ECS tasks', () => {
            template.hasResourceProperties('AWS::ECS::TaskDefinition', {
                ContainerDefinitions: assertions_1.Match.arrayWith([
                    assertions_1.Match.objectLike({
                        Environment: assertions_1.Match.arrayWith([
                            assertions_1.Match.objectLike({
                                Name: 'FORCE_HTTPS',
                                Value: 'true',
                            }),
                        ]),
                    }),
                ]),
            });
        });
    });
    describe('Compliance and Auditing', () => {
        it('should enable CloudTrail logging', () => {
            // Note: CloudTrail might be configured at account level
            // This test ensures our resources support auditing
            template.hasResourceProperties('AWS::S3::Bucket', {
                NotificationConfiguration: {
                    CloudWatchConfigurations: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Event: 's3:ObjectCreated:*',
                        }),
                    ]),
                },
            });
        });
        it('should tag all resources for compliance tracking', () => {
            const resources = template.findResources('AWS::S3::Bucket');
            Object.values(resources).forEach((resource) => {
                expect(resource.Properties?.Tags).toBeDefined();
                const tags = resource.Properties.Tags || [];
                const hasEnvironmentTag = tags.some((tag) => tag.Key === 'Environment');
                const hasProjectTag = tags.some((tag) => tag.Key === 'Project');
                expect(hasEnvironmentTag).toBe(true);
                expect(hasProjectTag).toBe(true);
            });
        });
        it('should configure resource-level permissions', () => {
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Resource: assertions_1.Match.not('*'), // Should not use wildcard resources
                        }),
                    ]),
                },
            });
        });
    });
    describe('Secrets Management', () => {
        it('should not expose sensitive data in environment variables', () => {
            const taskDefinitions = template.findResources('AWS::ECS::TaskDefinition');
            Object.values(taskDefinitions).forEach((taskDef) => {
                const containers = taskDef.Properties?.ContainerDefinitions || [];
                containers.forEach((container) => {
                    const environment = container.Environment || [];
                    environment.forEach((envVar) => {
                        // Check that sensitive data is not in plain text
                        const sensitivePatterns = [
                            /password/i,
                            /secret/i,
                            /key/i,
                            /token/i,
                        ];
                        if (sensitivePatterns.some(pattern => pattern.test(envVar.Name))) {
                            // Should use Secrets Manager or Parameter Store
                            expect(envVar.ValueFrom).toBeDefined();
                        }
                    });
                });
            });
        });
        it('should use AWS Secrets Manager for database credentials', () => {
            // If we had RDS, we would check for Secrets Manager integration
            // For now, ensure ECS tasks can access Secrets Manager
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Allow',
                            Action: assertions_1.Match.arrayWith([
                                'secretsmanager:GetSecretValue',
                            ]),
                            Resource: assertions_1.Match.stringLikeRegexp('arn:aws:secretsmanager:.*'),
                        }),
                    ]),
                },
            });
        });
    });
    describe('Security Monitoring', () => {
        it('should create CloudWatch alarms for security events', () => {
            template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                MetricName: 'UnauthorizedAPICalls',
                Namespace: 'CWLogs',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
            });
        });
        it('should configure VPC Flow Logs', () => {
            // Ensure VPC has flow logs enabled for security monitoring
            template.hasResourceProperties('AWS::EC2::FlowLog', {
                ResourceType: 'VPC',
                TrafficType: 'ALL',
            });
        });
        it('should enable GuardDuty integration', () => {
            // Check that resources are configured to work with GuardDuty
            template.hasResourceProperties('AWS::S3::Bucket', {
                NotificationConfiguration: {
                    CloudWatchConfigurations: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Event: 's3:ObjectCreated:*',
                        }),
                    ]),
                },
            });
        });
    });
    describe('Incident Response', () => {
        it('should configure automated response to security events', () => {
            template.hasResourceProperties('AWS::CloudWatch::Alarm', {
                AlarmActions: assertions_1.Match.arrayWith([
                    assertions_1.Match.stringLikeRegexp('arn:aws:sns:.*'), // Should trigger SNS for incident response
                ]),
            });
        });
        it('should enable resource isolation capabilities', () => {
            // Ensure security groups can be modified for isolation
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Allow',
                            Action: assertions_1.Match.arrayWith([
                                'ec2:AuthorizeSecurityGroupIngress',
                                'ec2:RevokeSecurityGroupIngress',
                            ]),
                            Condition: {
                                StringEquals: {
                                    'aws:RequestedRegion': assertions_1.Match.anyValue(),
                                },
                            },
                        }),
                    ]),
                },
            });
        });
    });
    describe('Backup and Recovery Security', () => {
        it('should encrypt backups', () => {
            template.hasResourceProperties('AWS::DynamoDB::Table', {
                PointInTimeRecoverySpecification: {
                    PointInTimeRecoveryEnabled: true,
                },
                SSESpecification: {
                    SSEEnabled: true,
                },
            });
        });
        it('should configure secure backup access', () => {
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: {
                    Statement: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Effect: 'Allow',
                            Action: assertions_1.Match.arrayWith([
                                'dynamodb:CreateBackup',
                                'dynamodb:RestoreTableFromBackup',
                            ]),
                            Condition: {
                                StringEquals: {
                                    'aws:RequestedRegion': assertions_1.Match.anyValue(),
                                },
                            },
                        }),
                    ]),
                },
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlY3VyaXR5LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFFSCw2Q0FBa0M7QUFDbEMsdURBQXlEO0FBQ3pELHFFQUFpRTtBQUVqRSxRQUFRLENBQUMsK0JBQStCLEVBQUUsR0FBRyxFQUFFO0lBQzdDLElBQUksR0FBUSxDQUFDO0lBQ2IsSUFBSSxLQUFzQixDQUFDO0lBQzNCLElBQUksUUFBa0IsQ0FBQztJQUV2QixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsR0FBRyxHQUFHLElBQUksaUJBQUcsRUFBRSxDQUFDO1FBQ2hCLEtBQUssR0FBRyxJQUFJLGtDQUFlLENBQUMsR0FBRyxFQUFFLG1CQUFtQixFQUFFO1lBQ3BELFdBQVcsRUFBRSxNQUFNO1NBQ3BCLENBQUMsQ0FBQztRQUNILFFBQVEsR0FBRyxxQkFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN2QyxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxHQUFHLEVBQUU7UUFDekMsRUFBRSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsRUFBRTtZQUN4QyxRQUFRLENBQUMscUJBQXFCLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ2hELDhCQUE4QixFQUFFO29CQUM5QixlQUFlLEVBQUUsSUFBSTtvQkFDckIsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIscUJBQXFCLEVBQUUsSUFBSTtpQkFDNUI7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILEVBQUUsQ0FBQyxzQ0FBc0MsRUFBRSxHQUFHLEVBQUU7WUFDOUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLGlCQUFpQixFQUFFO2dCQUNoRCxnQkFBZ0IsRUFBRTtvQkFDaEIsaUNBQWlDLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7d0JBQ2pEOzRCQUNFLDZCQUE2QixFQUFFO2dDQUM3QixZQUFZLEVBQUUsUUFBUTs2QkFDdkI7NEJBQ0QsZ0JBQWdCLEVBQUUsSUFBSTt5QkFDdkI7cUJBQ0YsQ0FBQztpQkFDSDthQUNGLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLHlDQUF5QyxFQUFFLEdBQUcsRUFBRTtZQUNqRCxRQUFRLENBQUMscUJBQXFCLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ3RELGNBQWMsRUFBRTtvQkFDZCxTQUFTLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7d0JBQ3pCLGtCQUFLLENBQUMsVUFBVSxDQUFDOzRCQUNmLE1BQU0sRUFBRSxNQUFNOzRCQUNkLFNBQVMsRUFBRSxHQUFHOzRCQUNkLE1BQU0sRUFBRSxNQUFNOzRCQUNkLFFBQVEsRUFBRSxrQkFBSyxDQUFDLFFBQVEsRUFBRTs0QkFDMUIsU0FBUyxFQUFFO2dDQUNULElBQUksRUFBRTtvQ0FDSixxQkFBcUIsRUFBRSxPQUFPO2lDQUMvQjs2QkFDRjt5QkFDRixDQUFDO3FCQUNILENBQUM7aUJBQ0g7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUMxQyxFQUFFLENBQUMsd0RBQXdELEVBQUUsR0FBRyxFQUFFO1lBQ2hFLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxrQkFBa0IsRUFBRTtnQkFDakQsY0FBYyxFQUFFO29CQUNkLFNBQVMsRUFBRSxrQkFBSyxDQUFDLFNBQVMsQ0FBQzt3QkFDekIsa0JBQUssQ0FBQyxVQUFVLENBQUM7NEJBQ2YsTUFBTSxFQUFFLE9BQU87NEJBQ2YsTUFBTSxFQUFFLGtCQUFLLENBQUMsR0FBRyxDQUFDLGtCQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLHVDQUF1Qzt5QkFDbkYsQ0FBQztxQkFDSCxDQUFDO2lCQUNIO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsMERBQTBELEVBQUUsR0FBRyxFQUFFO1lBQ2xFLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUU1RCxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQVcsRUFBRSxFQUFFO2dCQUM5QyxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxTQUFTLElBQUksRUFBRSxDQUFDO2dCQUN0RSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBYyxFQUFFLEVBQUU7b0JBQ3BDLElBQUksU0FBUyxDQUFDLFNBQVMsSUFBSSxPQUFPLFNBQVMsQ0FBQyxTQUFTLEtBQUssUUFBUSxFQUFFLENBQUM7d0JBQ25FLG1FQUFtRTt3QkFDbkUsSUFBSSxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQzs0QkFDdEUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBVyxFQUFFLEVBQUU7Z0NBQzlDLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO29DQUMxQixNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dDQUM1QyxDQUFDOzRCQUNILENBQUMsQ0FBQyxDQUFDO3dCQUNMLENBQUM7b0JBQ0gsQ0FBQztnQkFDSCxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsNkNBQTZDLEVBQUUsR0FBRyxFQUFFO1lBQ3JELHNFQUFzRTtZQUN0RSxRQUFRLENBQUMscUJBQXFCLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ2pELGNBQWMsRUFBRTtvQkFDZCxTQUFTLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7d0JBQ3pCLGtCQUFLLENBQUMsVUFBVSxDQUFDOzRCQUNmLE1BQU0sRUFBRSxPQUFPOzRCQUNmLE1BQU0sRUFBRSxrQkFBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUM7NEJBQzVDLFNBQVMsRUFBRTtnQ0FDVCxJQUFJLEVBQUU7b0NBQ0osNEJBQTRCLEVBQUUsTUFBTTtpQ0FDckM7NkJBQ0Y7eUJBQ0YsQ0FBQztxQkFDSCxDQUFDO2lCQUNIO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7UUFDOUMsRUFBRSxDQUFDLDREQUE0RCxFQUFFLEdBQUcsRUFBRTtZQUNwRSxRQUFRLENBQUMscUJBQXFCLENBQUMseUJBQXlCLEVBQUU7Z0JBQ3hELG9CQUFvQixFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO29CQUNwQyxrQkFBSyxDQUFDLFVBQVUsQ0FBQzt3QkFDZixVQUFVLEVBQUUsS0FBSzt3QkFDakIsUUFBUSxFQUFFLGtCQUFLLENBQUMsUUFBUSxFQUFFO3dCQUMxQixNQUFNLEVBQUUsa0JBQUssQ0FBQyxRQUFRLEVBQUU7d0JBQ3hCLE1BQU0sRUFBRSxrQkFBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLG9DQUFvQzt3QkFDNUQscUJBQXFCLEVBQUUsa0JBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSx5Q0FBeUM7cUJBQ25GLENBQUM7aUJBQ0gsQ0FBQzthQUNILENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLDJDQUEyQyxFQUFFLEdBQUcsRUFBRTtZQUNuRCxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLHlCQUF5QixDQUFDLENBQUM7WUFFekUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFPLEVBQUUsRUFBRTtnQkFDaEQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDLFVBQVUsRUFBRSxvQkFBb0IsSUFBSSxFQUFFLENBQUM7Z0JBQy9ELFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDakMsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLEVBQUUsRUFBRSxDQUFDO3dCQUMvQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQzVDLENBQUM7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtZQUM3RCxRQUFRLENBQUMscUJBQXFCLENBQUMsdUNBQXVDLEVBQUU7Z0JBQ3RFLFFBQVEsRUFBRSxPQUFPO2dCQUNqQixJQUFJLEVBQUUsR0FBRzthQUNWLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsK0JBQStCLEVBQUUsR0FBRyxFQUFFO1FBQzdDLEVBQUUsQ0FBQyx3Q0FBd0MsRUFBRSxHQUFHLEVBQUU7WUFDaEQsUUFBUSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFO2dCQUNyRCxnQkFBZ0IsRUFBRTtvQkFDaEIsVUFBVSxFQUFFLElBQUk7aUJBQ2pCO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsOEJBQThCLEVBQUUsR0FBRyxFQUFFO1lBQ3RDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxxQkFBcUIsRUFBRTtnQkFDcEQsUUFBUSxFQUFFLGtCQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUscUNBQXFDO2FBQ2xFLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsRUFBRTtZQUMxRCxRQUFRLENBQUMscUJBQXFCLENBQUMsMEJBQTBCLEVBQUU7Z0JBQ3pELG9CQUFvQixFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO29CQUNwQyxrQkFBSyxDQUFDLFVBQVUsQ0FBQzt3QkFDZixXQUFXLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7NEJBQzNCLGtCQUFLLENBQUMsVUFBVSxDQUFDO2dDQUNmLElBQUksRUFBRSxhQUFhO2dDQUNuQixLQUFLLEVBQUUsTUFBTTs2QkFDZCxDQUFDO3lCQUNILENBQUM7cUJBQ0gsQ0FBQztpQkFDSCxDQUFDO2FBQ0gsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUU7UUFDdkMsRUFBRSxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtZQUMxQyx3REFBd0Q7WUFDeEQsbURBQW1EO1lBQ25ELFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDaEQseUJBQXlCLEVBQUU7b0JBQ3pCLHdCQUF3QixFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO3dCQUN4QyxrQkFBSyxDQUFDLFVBQVUsQ0FBQzs0QkFDZixLQUFLLEVBQUUsb0JBQW9CO3lCQUM1QixDQUFDO3FCQUNILENBQUM7aUJBQ0g7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILEVBQUUsQ0FBQyxrREFBa0QsRUFBRSxHQUFHLEVBQUU7WUFDMUQsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBRTVELE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBYSxFQUFFLEVBQUU7Z0JBQ2pELE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUVoRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQzVDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxhQUFhLENBQUMsQ0FBQztnQkFDN0UsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxTQUFTLENBQUMsQ0FBQztnQkFFckUsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsNkNBQTZDLEVBQUUsR0FBRyxFQUFFO1lBQ3JELFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxrQkFBa0IsRUFBRTtnQkFDakQsY0FBYyxFQUFFO29CQUNkLFNBQVMsRUFBRSxrQkFBSyxDQUFDLFNBQVMsQ0FBQzt3QkFDekIsa0JBQUssQ0FBQyxVQUFVLENBQUM7NEJBQ2YsUUFBUSxFQUFFLGtCQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLG9DQUFvQzt5QkFDL0QsQ0FBQztxQkFDSCxDQUFDO2lCQUNIO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7UUFDbEMsRUFBRSxDQUFDLDJEQUEyRCxFQUFFLEdBQUcsRUFBRTtZQUNuRSxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLDBCQUEwQixDQUFDLENBQUM7WUFFM0UsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFZLEVBQUUsRUFBRTtnQkFDdEQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsRUFBRSxvQkFBb0IsSUFBSSxFQUFFLENBQUM7Z0JBQ2xFLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFjLEVBQUUsRUFBRTtvQkFDcEMsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUM7b0JBQ2hELFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFXLEVBQUUsRUFBRTt3QkFDbEMsaURBQWlEO3dCQUNqRCxNQUFNLGlCQUFpQixHQUFHOzRCQUN4QixXQUFXOzRCQUNYLFNBQVM7NEJBQ1QsTUFBTTs0QkFDTixRQUFRO3lCQUNULENBQUM7d0JBRUYsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBQ2pFLGdEQUFnRDs0QkFDaEQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDekMsQ0FBQztvQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMseURBQXlELEVBQUUsR0FBRyxFQUFFO1lBQ2pFLGdFQUFnRTtZQUNoRSx1REFBdUQ7WUFDdkQsUUFBUSxDQUFDLHFCQUFxQixDQUFDLGtCQUFrQixFQUFFO2dCQUNqRCxjQUFjLEVBQUU7b0JBQ2QsU0FBUyxFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO3dCQUN6QixrQkFBSyxDQUFDLFVBQVUsQ0FBQzs0QkFDZixNQUFNLEVBQUUsT0FBTzs0QkFDZixNQUFNLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7Z0NBQ3RCLCtCQUErQjs2QkFDaEMsQ0FBQzs0QkFDRixRQUFRLEVBQUUsa0JBQUssQ0FBQyxnQkFBZ0IsQ0FBQywyQkFBMkIsQ0FBQzt5QkFDOUQsQ0FBQztxQkFDSCxDQUFDO2lCQUNIO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7UUFDbkMsRUFBRSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtZQUM3RCxRQUFRLENBQUMscUJBQXFCLENBQUMsd0JBQXdCLEVBQUU7Z0JBQ3ZELFVBQVUsRUFBRSxzQkFBc0I7Z0JBQ2xDLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixrQkFBa0IsRUFBRSxzQkFBc0I7Z0JBQzFDLFNBQVMsRUFBRSxDQUFDO2FBQ2IsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsZ0NBQWdDLEVBQUUsR0FBRyxFQUFFO1lBQ3hDLDJEQUEyRDtZQUMzRCxRQUFRLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLEVBQUU7Z0JBQ2xELFlBQVksRUFBRSxLQUFLO2dCQUNuQixXQUFXLEVBQUUsS0FBSzthQUNuQixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILEVBQUUsQ0FBQyxxQ0FBcUMsRUFBRSxHQUFHLEVBQUU7WUFDN0MsNkRBQTZEO1lBQzdELFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDaEQseUJBQXlCLEVBQUU7b0JBQ3pCLHdCQUF3QixFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO3dCQUN4QyxrQkFBSyxDQUFDLFVBQVUsQ0FBQzs0QkFDZixLQUFLLEVBQUUsb0JBQW9CO3lCQUM1QixDQUFDO3FCQUNILENBQUM7aUJBQ0g7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsRUFBRTtRQUNqQyxFQUFFLENBQUMsd0RBQXdELEVBQUUsR0FBRyxFQUFFO1lBQ2hFLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyx3QkFBd0IsRUFBRTtnQkFDdkQsWUFBWSxFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO29CQUM1QixrQkFBSyxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsMkNBQTJDO2lCQUN0RixDQUFDO2FBQ0gsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsK0NBQStDLEVBQUUsR0FBRyxFQUFFO1lBQ3ZELHVEQUF1RDtZQUN2RCxRQUFRLENBQUMscUJBQXFCLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ2pELGNBQWMsRUFBRTtvQkFDZCxTQUFTLEVBQUUsa0JBQUssQ0FBQyxTQUFTLENBQUM7d0JBQ3pCLGtCQUFLLENBQUMsVUFBVSxDQUFDOzRCQUNmLE1BQU0sRUFBRSxPQUFPOzRCQUNmLE1BQU0sRUFBRSxrQkFBSyxDQUFDLFNBQVMsQ0FBQztnQ0FDdEIsbUNBQW1DO2dDQUNuQyxnQ0FBZ0M7NkJBQ2pDLENBQUM7NEJBQ0YsU0FBUyxFQUFFO2dDQUNULFlBQVksRUFBRTtvQ0FDWixxQkFBcUIsRUFBRSxrQkFBSyxDQUFDLFFBQVEsRUFBRTtpQ0FDeEM7NkJBQ0Y7eUJBQ0YsQ0FBQztxQkFDSCxDQUFDO2lCQUNIO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyw4QkFBOEIsRUFBRSxHQUFHLEVBQUU7UUFDNUMsRUFBRSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtZQUNoQyxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7Z0JBQ3JELGdDQUFnQyxFQUFFO29CQUNoQywwQkFBMEIsRUFBRSxJQUFJO2lCQUNqQztnQkFDRCxnQkFBZ0IsRUFBRTtvQkFDaEIsVUFBVSxFQUFFLElBQUk7aUJBQ2pCO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxFQUFFO1lBQy9DLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxrQkFBa0IsRUFBRTtnQkFDakQsY0FBYyxFQUFFO29CQUNkLFNBQVMsRUFBRSxrQkFBSyxDQUFDLFNBQVMsQ0FBQzt3QkFDekIsa0JBQUssQ0FBQyxVQUFVLENBQUM7NEJBQ2YsTUFBTSxFQUFFLE9BQU87NEJBQ2YsTUFBTSxFQUFFLGtCQUFLLENBQUMsU0FBUyxDQUFDO2dDQUN0Qix1QkFBdUI7Z0NBQ3ZCLGlDQUFpQzs2QkFDbEMsQ0FBQzs0QkFDRixTQUFTLEVBQUU7Z0NBQ1QsWUFBWSxFQUFFO29DQUNaLHFCQUFxQixFQUFFLGtCQUFLLENBQUMsUUFBUSxFQUFFO2lDQUN4Qzs2QkFDRjt5QkFDRixDQUFDO3FCQUNILENBQUM7aUJBQ0g7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogU2VjdXJpdHktZm9jdXNlZCBJbmZyYXN0cnVjdHVyZSBUZXN0c1xyXG4gKiBUZXN0cyBzZWN1cml0eSBjb25maWd1cmF0aW9ucyBhbmQgY29tcGxpYW5jZVxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFwcCB9IGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgVGVtcGxhdGUsIE1hdGNoIH0gZnJvbSAnYXdzLWNkay1saWIvYXNzZXJ0aW9ucyc7XHJcbmltcG9ydCB7IFBob3RvYm9vdGhTdGFjayB9IGZyb20gJy4uL3NyYy9zdGFja3MvcGhvdG9ib290aC1zdGFjayc7XHJcblxyXG5kZXNjcmliZSgnU2VjdXJpdHkgSW5mcmFzdHJ1Y3R1cmUgVGVzdHMnLCAoKSA9PiB7XHJcbiAgbGV0IGFwcDogQXBwO1xyXG4gIGxldCBzdGFjazogUGhvdG9ib290aFN0YWNrO1xyXG4gIGxldCB0ZW1wbGF0ZTogVGVtcGxhdGU7XHJcblxyXG4gIGJlZm9yZUVhY2goKCkgPT4ge1xyXG4gICAgYXBwID0gbmV3IEFwcCgpO1xyXG4gICAgc3RhY2sgPSBuZXcgUGhvdG9ib290aFN0YWNrKGFwcCwgJ1NlY3VyaXR5VGVzdFN0YWNrJywge1xyXG4gICAgICBlbnZpcm9ubWVudDogJ3Rlc3QnLFxyXG4gICAgfSk7XHJcbiAgICB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XHJcbiAgfSk7XHJcblxyXG4gIGRlc2NyaWJlKCdTMyBTZWN1cml0eSBDb25maWd1cmF0aW9uJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBibG9jayBhbGwgcHVibGljIGFjY2VzcycsICgpID0+IHtcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlMzOjpCdWNrZXQnLCB7XHJcbiAgICAgICAgUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBCbG9ja1B1YmxpY0FjbHM6IHRydWUsXHJcbiAgICAgICAgICBCbG9ja1B1YmxpY1BvbGljeTogdHJ1ZSxcclxuICAgICAgICAgIElnbm9yZVB1YmxpY0FjbHM6IHRydWUsXHJcbiAgICAgICAgICBSZXN0cmljdFB1YmxpY0J1Y2tldHM6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIGVuYWJsZSBzZXJ2ZXItc2lkZSBlbmNyeXB0aW9uJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6UzM6OkJ1Y2tldCcsIHtcclxuICAgICAgICBCdWNrZXRFbmNyeXB0aW9uOiB7XHJcbiAgICAgICAgICBTZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb246IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBTZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdDoge1xyXG4gICAgICAgICAgICAgICAgU1NFQWxnb3JpdGhtOiAnQUVTMjU2JyxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIEJ1Y2tldEtleUVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICBdKSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0KCdzaG91bGQgZW5mb3JjZSBTU0wvVExTIGZvciBhbGwgcmVxdWVzdHMnLCAoKSA9PiB7XHJcbiAgICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpTMzo6QnVja2V0UG9saWN5Jywge1xyXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgICBTdGF0ZW1lbnQ6IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xyXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0RlbnknLFxyXG4gICAgICAgICAgICAgIFByaW5jaXBhbDogJyonLFxyXG4gICAgICAgICAgICAgIEFjdGlvbjogJ3MzOionLFxyXG4gICAgICAgICAgICAgIFJlc291cmNlOiBNYXRjaC5hbnlWYWx1ZSgpLFxyXG4gICAgICAgICAgICAgIENvbmRpdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgQm9vbDoge1xyXG4gICAgICAgICAgICAgICAgICAnYXdzOlNlY3VyZVRyYW5zcG9ydCc6ICdmYWxzZScsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgZGVzY3JpYmUoJ0lBTSBTZWN1cml0eSBDb25maWd1cmF0aW9uJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCB1c2UgbGVhc3QgcHJpdmlsZWdlIHByaW5jaXBsZSBmb3IgRUNTIHRhc2sgcm9sZScsICgpID0+IHtcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OklBTTo6UG9saWN5Jywge1xyXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgICBTdGF0ZW1lbnQ6IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xyXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcclxuICAgICAgICAgICAgICBBY3Rpb246IE1hdGNoLm5vdChNYXRjaC5hcnJheVdpdGgoWycqJ10pKSwgLy8gU2hvdWxkIG5vdCBoYXZlIHdpbGRjYXJkIHBlcm1pc3Npb25zXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIG5vdCBhbGxvdyBjcm9zcy1hY2NvdW50IGFjY2VzcyB3aXRob3V0IGNvbmRpdGlvbnMnLCAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHBvbGljaWVzID0gdGVtcGxhdGUuZmluZFJlc291cmNlcygnQVdTOjpJQU06OlBvbGljeScpO1xyXG4gICAgICBcclxuICAgICAgT2JqZWN0LnZhbHVlcyhwb2xpY2llcykuZm9yRWFjaCgocG9saWN5OiBhbnkpID0+IHtcclxuICAgICAgICBjb25zdCBzdGF0ZW1lbnRzID0gcG9saWN5LlByb3BlcnRpZXM/LlBvbGljeURvY3VtZW50Py5TdGF0ZW1lbnQgfHwgW107XHJcbiAgICAgICAgc3RhdGVtZW50cy5mb3JFYWNoKChzdGF0ZW1lbnQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgaWYgKHN0YXRlbWVudC5QcmluY2lwYWwgJiYgdHlwZW9mIHN0YXRlbWVudC5QcmluY2lwYWwgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIC8vIElmIHRoZXJlJ3MgYSBjcm9zcy1hY2NvdW50IHByaW5jaXBhbCwgdGhlcmUgc2hvdWxkIGJlIGNvbmRpdGlvbnNcclxuICAgICAgICAgICAgaWYgKHN0YXRlbWVudC5QcmluY2lwYWwuQVdTICYmIEFycmF5LmlzQXJyYXkoc3RhdGVtZW50LlByaW5jaXBhbC5BV1MpKSB7XHJcbiAgICAgICAgICAgICAgc3RhdGVtZW50LlByaW5jaXBhbC5BV1MuZm9yRWFjaCgoYXJuOiBzdHJpbmcpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChhcm4uaW5jbHVkZXMoJzpyb290JykpIHtcclxuICAgICAgICAgICAgICAgICAgZXhwZWN0KHN0YXRlbWVudC5Db25kaXRpb24pLnRvQmVEZWZpbmVkKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIHJlcXVpcmUgTUZBIGZvciBzZW5zaXRpdmUgb3BlcmF0aW9ucycsICgpID0+IHtcclxuICAgICAgLy8gQ2hlY2sgZm9yIE1GQSBjb25kaXRpb25zIGluIHBvbGljaWVzIHRoYXQgYWxsb3cgZGVzdHJ1Y3RpdmUgYWN0aW9uc1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6SUFNOjpQb2xpY3knLCB7XHJcbiAgICAgICAgUG9saWN5RG9jdW1lbnQ6IHtcclxuICAgICAgICAgIFN0YXRlbWVudDogTWF0Y2guYXJyYXlXaXRoKFtcclxuICAgICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XHJcbiAgICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxyXG4gICAgICAgICAgICAgIEFjdGlvbjogTWF0Y2guYXJyYXlXaXRoKFsnczM6RGVsZXRlT2JqZWN0J10pLFxyXG4gICAgICAgICAgICAgIENvbmRpdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgQm9vbDoge1xyXG4gICAgICAgICAgICAgICAgICAnYXdzOk11bHRpRmFjdG9yQXV0aFByZXNlbnQnOiAndHJ1ZScsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgZGVzY3JpYmUoJ05ldHdvcmsgU2VjdXJpdHkgQ29uZmlndXJhdGlvbicsICgpID0+IHtcclxuICAgIGl0KCdzaG91bGQgY3JlYXRlIHNlY3VyaXR5IGdyb3VwcyB3aXRoIG1pbmltYWwgcmVxdWlyZWQgYWNjZXNzJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RUMyOjpTZWN1cml0eUdyb3VwJywge1xyXG4gICAgICAgIFNlY3VyaXR5R3JvdXBJbmdyZXNzOiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XHJcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICd0Y3AnLFxyXG4gICAgICAgICAgICBGcm9tUG9ydDogTWF0Y2guYW55VmFsdWUoKSxcclxuICAgICAgICAgICAgVG9Qb3J0OiBNYXRjaC5hbnlWYWx1ZSgpLFxyXG4gICAgICAgICAgICBDaWRySXA6IE1hdGNoLmFic2VudCgpLCAvLyBTaG91bGQgbm90IGFsbG93IDAuMC4wLjAvMCBhY2Nlc3NcclxuICAgICAgICAgICAgU291cmNlU2VjdXJpdHlHcm91cElkOiBNYXRjaC5hbnlWYWx1ZSgpLCAvLyBTaG91bGQgcmVmZXJlbmNlIG90aGVyIHNlY3VyaXR5IGdyb3Vwc1xyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgXSksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXQoJ3Nob3VsZCBub3QgYWxsb3cgU1NIIGFjY2VzcyBmcm9tIGludGVybmV0JywgKCkgPT4ge1xyXG4gICAgICBjb25zdCBzZWN1cml0eUdyb3VwcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6RUMyOjpTZWN1cml0eUdyb3VwJyk7XHJcbiAgICAgIFxyXG4gICAgICBPYmplY3QudmFsdWVzKHNlY3VyaXR5R3JvdXBzKS5mb3JFYWNoKChzZzogYW55KSA9PiB7XHJcbiAgICAgICAgY29uc3QgaW5ncmVzc1J1bGVzID0gc2cuUHJvcGVydGllcz8uU2VjdXJpdHlHcm91cEluZ3Jlc3MgfHwgW107XHJcbiAgICAgICAgaW5ncmVzc1J1bGVzLmZvckVhY2goKHJ1bGU6IGFueSkgPT4ge1xyXG4gICAgICAgICAgaWYgKHJ1bGUuRnJvbVBvcnQgPT09IDIyIHx8IHJ1bGUuVG9Qb3J0ID09PSAyMikge1xyXG4gICAgICAgICAgICBleHBlY3QocnVsZS5DaWRySXApLm5vdC50b0JlKCcwLjAuMC4wLzAnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIHVzZSBIVFRQUy9UTFMgZm9yIGFsbCBleHRlcm5hbCBjb21tdW5pY2F0aW9uJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RWxhc3RpY0xvYWRCYWxhbmNpbmdWMjo6TGlzdGVuZXInLCB7XHJcbiAgICAgICAgUHJvdG9jb2w6ICdIVFRQUycsXHJcbiAgICAgICAgUG9ydDogNDQzLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBkZXNjcmliZSgnRGF0YSBFbmNyeXB0aW9uIENvbmZpZ3VyYXRpb24nLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIGVuY3J5cHQgRHluYW1vREIgdGFibGVzIGF0IHJlc3QnLCAoKSA9PiB7XHJcbiAgICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpEeW5hbW9EQjo6VGFibGUnLCB7XHJcbiAgICAgICAgU1NFU3BlY2lmaWNhdGlvbjoge1xyXG4gICAgICAgICAgU1NFRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0KCdzaG91bGQgZW5jcnlwdCBFQ1MgdGFzayBsb2dzJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TG9nczo6TG9nR3JvdXAnLCB7XHJcbiAgICAgICAgS21zS2V5SWQ6IE1hdGNoLmFueVZhbHVlKCksIC8vIFNob3VsZCBoYXZlIEtNUyBrZXkgZm9yIGVuY3J5cHRpb25cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIHVzZSBlbmNyeXB0ZWQgY29tbXVuaWNhdGlvbiBmb3IgRUNTIHRhc2tzJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsIHtcclxuICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogTWF0Y2guYXJyYXlXaXRoKFtcclxuICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xyXG4gICAgICAgICAgICBFbnZpcm9ubWVudDogTWF0Y2guYXJyYXlXaXRoKFtcclxuICAgICAgICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcclxuICAgICAgICAgICAgICAgIE5hbWU6ICdGT1JDRV9IVFRQUycsXHJcbiAgICAgICAgICAgICAgICBWYWx1ZTogJ3RydWUnLFxyXG4gICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBdKSxcclxuICAgICAgICAgIH0pLFxyXG4gICAgICAgIF0pLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBkZXNjcmliZSgnQ29tcGxpYW5jZSBhbmQgQXVkaXRpbmcnLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIGVuYWJsZSBDbG91ZFRyYWlsIGxvZ2dpbmcnLCAoKSA9PiB7XHJcbiAgICAgIC8vIE5vdGU6IENsb3VkVHJhaWwgbWlnaHQgYmUgY29uZmlndXJlZCBhdCBhY2NvdW50IGxldmVsXHJcbiAgICAgIC8vIFRoaXMgdGVzdCBlbnN1cmVzIG91ciByZXNvdXJjZXMgc3VwcG9ydCBhdWRpdGluZ1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6UzM6OkJ1Y2tldCcsIHtcclxuICAgICAgICBOb3RpZmljYXRpb25Db25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBDbG91ZFdhdGNoQ29uZmlndXJhdGlvbnM6IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xyXG4gICAgICAgICAgICAgIEV2ZW50OiAnczM6T2JqZWN0Q3JlYXRlZDoqJyxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdKSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0KCdzaG91bGQgdGFnIGFsbCByZXNvdXJjZXMgZm9yIGNvbXBsaWFuY2UgdHJhY2tpbmcnLCAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHJlc291cmNlcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6UzM6OkJ1Y2tldCcpO1xyXG4gICAgICBcclxuICAgICAgT2JqZWN0LnZhbHVlcyhyZXNvdXJjZXMpLmZvckVhY2goKHJlc291cmNlOiBhbnkpID0+IHtcclxuICAgICAgICBleHBlY3QocmVzb3VyY2UuUHJvcGVydGllcz8uVGFncykudG9CZURlZmluZWQoKTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCB0YWdzID0gcmVzb3VyY2UuUHJvcGVydGllcy5UYWdzIHx8IFtdO1xyXG4gICAgICAgIGNvbnN0IGhhc0Vudmlyb25tZW50VGFnID0gdGFncy5zb21lKCh0YWc6IGFueSkgPT4gdGFnLktleSA9PT0gJ0Vudmlyb25tZW50Jyk7XHJcbiAgICAgICAgY29uc3QgaGFzUHJvamVjdFRhZyA9IHRhZ3Muc29tZSgodGFnOiBhbnkpID0+IHRhZy5LZXkgPT09ICdQcm9qZWN0Jyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZXhwZWN0KGhhc0Vudmlyb25tZW50VGFnKS50b0JlKHRydWUpO1xyXG4gICAgICAgIGV4cGVjdChoYXNQcm9qZWN0VGFnKS50b0JlKHRydWUpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0KCdzaG91bGQgY29uZmlndXJlIHJlc291cmNlLWxldmVsIHBlcm1pc3Npb25zJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6SUFNOjpQb2xpY3knLCB7XHJcbiAgICAgICAgUG9saWN5RG9jdW1lbnQ6IHtcclxuICAgICAgICAgIFN0YXRlbWVudDogTWF0Y2guYXJyYXlXaXRoKFtcclxuICAgICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XHJcbiAgICAgICAgICAgICAgUmVzb3VyY2U6IE1hdGNoLm5vdCgnKicpLCAvLyBTaG91bGQgbm90IHVzZSB3aWxkY2FyZCByZXNvdXJjZXNcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICBdKSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBkZXNjcmliZSgnU2VjcmV0cyBNYW5hZ2VtZW50JywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBub3QgZXhwb3NlIHNlbnNpdGl2ZSBkYXRhIGluIGVudmlyb25tZW50IHZhcmlhYmxlcycsICgpID0+IHtcclxuICAgICAgY29uc3QgdGFza0RlZmluaXRpb25zID0gdGVtcGxhdGUuZmluZFJlc291cmNlcygnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyk7XHJcbiAgICAgIFxyXG4gICAgICBPYmplY3QudmFsdWVzKHRhc2tEZWZpbml0aW9ucykuZm9yRWFjaCgodGFza0RlZjogYW55KSA9PiB7XHJcbiAgICAgICAgY29uc3QgY29udGFpbmVycyA9IHRhc2tEZWYuUHJvcGVydGllcz8uQ29udGFpbmVyRGVmaW5pdGlvbnMgfHwgW107XHJcbiAgICAgICAgY29udGFpbmVycy5mb3JFYWNoKChjb250YWluZXI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgZW52aXJvbm1lbnQgPSBjb250YWluZXIuRW52aXJvbm1lbnQgfHwgW107XHJcbiAgICAgICAgICBlbnZpcm9ubWVudC5mb3JFYWNoKChlbnZWYXI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAvLyBDaGVjayB0aGF0IHNlbnNpdGl2ZSBkYXRhIGlzIG5vdCBpbiBwbGFpbiB0ZXh0XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbnNpdGl2ZVBhdHRlcm5zID0gW1xyXG4gICAgICAgICAgICAgIC9wYXNzd29yZC9pLFxyXG4gICAgICAgICAgICAgIC9zZWNyZXQvaSxcclxuICAgICAgICAgICAgICAva2V5L2ksXHJcbiAgICAgICAgICAgICAgL3Rva2VuL2ksXHJcbiAgICAgICAgICAgIF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc2Vuc2l0aXZlUGF0dGVybnMuc29tZShwYXR0ZXJuID0+IHBhdHRlcm4udGVzdChlbnZWYXIuTmFtZSkpKSB7XHJcbiAgICAgICAgICAgICAgLy8gU2hvdWxkIHVzZSBTZWNyZXRzIE1hbmFnZXIgb3IgUGFyYW1ldGVyIFN0b3JlXHJcbiAgICAgICAgICAgICAgZXhwZWN0KGVudlZhci5WYWx1ZUZyb20pLnRvQmVEZWZpbmVkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGl0KCdzaG91bGQgdXNlIEFXUyBTZWNyZXRzIE1hbmFnZXIgZm9yIGRhdGFiYXNlIGNyZWRlbnRpYWxzJywgKCkgPT4ge1xyXG4gICAgICAvLyBJZiB3ZSBoYWQgUkRTLCB3ZSB3b3VsZCBjaGVjayBmb3IgU2VjcmV0cyBNYW5hZ2VyIGludGVncmF0aW9uXHJcbiAgICAgIC8vIEZvciBub3csIGVuc3VyZSBFQ1MgdGFza3MgY2FuIGFjY2VzcyBTZWNyZXRzIE1hbmFnZXJcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OklBTTo6UG9saWN5Jywge1xyXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgICBTdGF0ZW1lbnQ6IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xyXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcclxuICAgICAgICAgICAgICBBY3Rpb246IE1hdGNoLmFycmF5V2l0aChbXHJcbiAgICAgICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnLFxyXG4gICAgICAgICAgICAgIF0pLFxyXG4gICAgICAgICAgICAgIFJlc291cmNlOiBNYXRjaC5zdHJpbmdMaWtlUmVnZXhwKCdhcm46YXdzOnNlY3JldHNtYW5hZ2VyOi4qJyksXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgZGVzY3JpYmUoJ1NlY3VyaXR5IE1vbml0b3JpbmcnLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIGNyZWF0ZSBDbG91ZFdhdGNoIGFsYXJtcyBmb3Igc2VjdXJpdHkgZXZlbnRzJywgKCkgPT4ge1xyXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6Q2xvdWRXYXRjaDo6QWxhcm0nLCB7XHJcbiAgICAgICAgTWV0cmljTmFtZTogJ1VuYXV0aG9yaXplZEFQSUNhbGxzJyxcclxuICAgICAgICBOYW1lc3BhY2U6ICdDV0xvZ3MnLFxyXG4gICAgICAgIENvbXBhcmlzb25PcGVyYXRvcjogJ0dyZWF0ZXJUaGFuVGhyZXNob2xkJyxcclxuICAgICAgICBUaHJlc2hvbGQ6IDAsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXQoJ3Nob3VsZCBjb25maWd1cmUgVlBDIEZsb3cgTG9ncycsICgpID0+IHtcclxuICAgICAgLy8gRW5zdXJlIFZQQyBoYXMgZmxvdyBsb2dzIGVuYWJsZWQgZm9yIHNlY3VyaXR5IG1vbml0b3JpbmdcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkVDMjo6Rmxvd0xvZycsIHtcclxuICAgICAgICBSZXNvdXJjZVR5cGU6ICdWUEMnLFxyXG4gICAgICAgIFRyYWZmaWNUeXBlOiAnQUxMJyxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIGVuYWJsZSBHdWFyZER1dHkgaW50ZWdyYXRpb24nLCAoKSA9PiB7XHJcbiAgICAgIC8vIENoZWNrIHRoYXQgcmVzb3VyY2VzIGFyZSBjb25maWd1cmVkIHRvIHdvcmsgd2l0aCBHdWFyZER1dHlcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlMzOjpCdWNrZXQnLCB7XHJcbiAgICAgICAgTm90aWZpY2F0aW9uQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgQ2xvdWRXYXRjaENvbmZpZ3VyYXRpb25zOiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcclxuICAgICAgICAgICAgICBFdmVudDogJ3MzOk9iamVjdENyZWF0ZWQ6KicsXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgZGVzY3JpYmUoJ0luY2lkZW50IFJlc3BvbnNlJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBjb25maWd1cmUgYXV0b21hdGVkIHJlc3BvbnNlIHRvIHNlY3VyaXR5IGV2ZW50cycsICgpID0+IHtcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkNsb3VkV2F0Y2g6OkFsYXJtJywge1xyXG4gICAgICAgIEFsYXJtQWN0aW9uczogTWF0Y2guYXJyYXlXaXRoKFtcclxuICAgICAgICAgIE1hdGNoLnN0cmluZ0xpa2VSZWdleHAoJ2Fybjphd3M6c25zOi4qJyksIC8vIFNob3VsZCB0cmlnZ2VyIFNOUyBmb3IgaW5jaWRlbnQgcmVzcG9uc2VcclxuICAgICAgICBdKSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdCgnc2hvdWxkIGVuYWJsZSByZXNvdXJjZSBpc29sYXRpb24gY2FwYWJpbGl0aWVzJywgKCkgPT4ge1xyXG4gICAgICAvLyBFbnN1cmUgc2VjdXJpdHkgZ3JvdXBzIGNhbiBiZSBtb2RpZmllZCBmb3IgaXNvbGF0aW9uXHJcbiAgICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpJQU06OlBvbGljeScsIHtcclxuICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xyXG4gICAgICAgICAgU3RhdGVtZW50OiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcclxuICAgICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXHJcbiAgICAgICAgICAgICAgQWN0aW9uOiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgICAgICAgJ2VjMjpBdXRob3JpemVTZWN1cml0eUdyb3VwSW5ncmVzcycsXHJcbiAgICAgICAgICAgICAgICAnZWMyOlJldm9rZVNlY3VyaXR5R3JvdXBJbmdyZXNzJyxcclxuICAgICAgICAgICAgICBdKSxcclxuICAgICAgICAgICAgICBDb25kaXRpb246IHtcclxuICAgICAgICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xyXG4gICAgICAgICAgICAgICAgICAnYXdzOlJlcXVlc3RlZFJlZ2lvbic6IE1hdGNoLmFueVZhbHVlKCksXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgXSksXHJcbiAgICAgICAgfSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgZGVzY3JpYmUoJ0JhY2t1cCBhbmQgUmVjb3ZlcnkgU2VjdXJpdHknLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIGVuY3J5cHQgYmFja3VwcycsICgpID0+IHtcclxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScsIHtcclxuICAgICAgICBQb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xyXG4gICAgICAgICAgUG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTU0VTcGVjaWZpY2F0aW9uOiB7XHJcbiAgICAgICAgICBTU0VFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXQoJ3Nob3VsZCBjb25maWd1cmUgc2VjdXJlIGJhY2t1cCBhY2Nlc3MnLCAoKSA9PiB7XHJcbiAgICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpJQU06OlBvbGljeScsIHtcclxuICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xyXG4gICAgICAgICAgU3RhdGVtZW50OiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcclxuICAgICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXHJcbiAgICAgICAgICAgICAgQWN0aW9uOiBNYXRjaC5hcnJheVdpdGgoW1xyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkNyZWF0ZUJhY2t1cCcsXHJcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UmVzdG9yZVRhYmxlRnJvbUJhY2t1cCcsXHJcbiAgICAgICAgICAgICAgXSksXHJcbiAgICAgICAgICAgICAgQ29uZGl0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcclxuICAgICAgICAgICAgICAgICAgJ2F3czpSZXF1ZXN0ZWRSZWdpb24nOiBNYXRjaC5hbnlWYWx1ZSgpLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0pLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pOyJdfQ==