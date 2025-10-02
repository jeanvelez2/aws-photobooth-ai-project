import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface CicdStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  ecsClusterName: string;
  ecsServiceName: string;
  targetEnvironment: string;
}

export class CicdStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly artifactsBucket: s3.Bucket;
  public readonly frontendRepository: ecr.Repository;
  public readonly backendRepository: ecr.Repository;

  private readonly environmentConfig: EnvironmentConfig;
  private readonly targetEnvironment: string;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);
    
    this.environmentConfig = props.environmentConfig;
    this.targetEnvironment = props.targetEnvironment;

    // Create ECR repositories
    this.frontendRepository = this.createEcrRepository('frontend');
    this.backendRepository = this.createEcrRepository('backend');

    // Create S3 bucket for pipeline artifacts
    this.artifactsBucket = this.createArtifactsBucket();

    // Create Parameter Store parameters for environment configuration
    this.createParameterStoreParameters();

    // Create Secrets Manager secrets
    this.createSecretsManagerSecrets();

    // Create CodeBuild projects
    const frontendBuildProject = this.createFrontendBuildProject();
    const backendBuildProject = this.createBackendBuildProject();
    const deploymentValidationProject = this.createDeploymentValidationProject();

    // Create CodeDeploy application and deployment group
    const { application, deploymentGroup } = this.createCodeDeployResources(
      props.ecsClusterName,
      props.ecsServiceName
    );

    // Create deployment validation Lambda function
    const validationLambda = this.createDeploymentValidationLambda();

    // Create EventBridge rules for pipeline orchestration
    this.createEventBridgeRules();

    // Create X-Ray tracing for deployment pipeline
    if (this.environmentConfig.enableXRay) {
      this.createXRayTracing();
    }

    // Create the main CI/CD pipeline
    this.pipeline = this.createCodePipeline(
      frontendBuildProject,
      backendBuildProject,
      deploymentValidationProject,
      application,
      deploymentGroup,
      validationLambda
    );

    // Create outputs
    this.createOutputs();
  }

  private createEcrRepository(name: string): ecr.Repository {
    return new ecr.Repository(this, `${name}Repository`, {
      repositoryName: `ai-photobooth-${name}-${this.targetEnvironment}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          description: 'Delete untagged images after 1 day',
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 1,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 2,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createArtifactsBucket(): s3.Bucket {
    return new s3.Bucket(this, 'PipelineArtifactsBucket', {
      bucketName: `ai-photobooth-pipeline-artifacts-${this.targetEnvironment}-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createParameterStoreParameters(): void {
    // Environment configuration parameters
    new ssm.StringParameter(this, 'EnvironmentParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/environment`,
      stringValue: this.targetEnvironment,
      description: 'Target environment name',
    });

    new ssm.StringParameter(this, 'RegionParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/region`,
      stringValue: this.region,
      description: 'AWS region for deployment',
    });

    new ssm.StringParameter(this, 'LogRetentionParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/log-retention-days`,
      stringValue: this.environmentConfig.logRetentionDays.toString(),
      description: 'CloudWatch log retention in days',
    });

    // Auto-scaling configuration
    new ssm.StringParameter(this, 'MinCapacityParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/autoscaling/min-capacity`,
      stringValue: this.environmentConfig.autoScaling.minCapacity.toString(),
      description: 'Minimum ECS task capacity',
    });

    new ssm.StringParameter(this, 'MaxCapacityParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/autoscaling/max-capacity`,
      stringValue: this.environmentConfig.autoScaling.maxCapacity.toString(),
      description: 'Maximum ECS task capacity',
    });

    // Performance configuration
    new ssm.StringParameter(this, 'ProcessingTimeoutParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/performance/processing-timeout-ms`,
      stringValue: this.environmentConfig.performance.processingTimeoutMs.toString(),
      description: 'Image processing timeout in milliseconds',
    });

    // Feature flags
    new ssm.StringParameter(this, 'EnableXRayParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/features/enable-xray`,
      stringValue: this.environmentConfig.enableXRay.toString(),
      description: 'Enable AWS X-Ray tracing',
    });

    new ssm.StringParameter(this, 'EnableWafParameter', {
      parameterName: `/ai-photobooth/${this.targetEnvironment}/features/enable-waf`,
      stringValue: this.environmentConfig.enableWaf.toString(),
      description: 'Enable AWS WAF protection',
    });
  }

  private createSecretsManagerSecrets(): void {
    // GitHub token for source control access
    new secretsmanager.Secret(this, 'GitHubTokenSecret', {
      secretName: `/ai-photobooth/${this.targetEnvironment}/github-token`,
      description: 'GitHub personal access token for repository access',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'github-user' }),
        generateStringKey: 'token',
        excludeCharacters: '"@/\\',
      },
    });

    // Database credentials (if needed for future database integration)
    new secretsmanager.Secret(this, 'DatabaseCredentialsSecret', {
      secretName: `/ai-photobooth/${this.targetEnvironment}/database-credentials`,
      description: 'Database connection credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // API keys for external services
    new secretsmanager.Secret(this, 'ExternalApiKeysSecret', {
      secretName: `/ai-photobooth/${this.targetEnvironment}/external-api-keys`,
      description: 'API keys for external services',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          rekognitionApiKey: 'placeholder',
          monitoringApiKey: 'placeholder',
        }),
        generateStringKey: 'secretKey',
        excludeCharacters: '"@/\\',
      },
    });
  }

  private createFrontendBuildProject(): codebuild.Project {
    const buildRole = new iam.Role(this, 'FrontendBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      inlinePolicies: {
        FrontendBuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:GetAuthorizationToken',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
                'ecr:PutImage',
              ],
              resources: [
                this.frontendRepository.repositoryArn,
                '*', // For GetAuthorizationToken
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
              ],
              resources: [this.artifactsBucket.arnForObjects('*')],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
              ],
              resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/ai-photobooth/${this.targetEnvironment}/*`],
            }),
          ],
        }),
      },
    });

    return new codebuild.Project(this, 'FrontendBuildProject', {
      projectName: `ai-photobooth-frontend-build-${this.targetEnvironment}`,
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true, // Required for Docker builds
      },
      source: codebuild.Source.gitHub({
        owner: 'your-github-username', // Replace with actual GitHub username
        repo: 'ai-photobooth',
        webhook: true,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs('main'),
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_CREATED),
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_UPDATED),
        ],
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/' + this.frontendRepository.repositoryName,
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
              'echo Installing dependencies...',
              'npm ci',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the frontend application...',
              'npm run build --workspace=packages/frontend',
              'echo Building the Docker image...',
              'docker build -f Dockerfile.frontend -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker image...',
              'docker push $REPOSITORY_URI:latest',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'echo Writing image definitions file...',
              'printf \'[{"name":"frontend-container","imageUri":"%s"}]\' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: [
            'imagedefinitions.json',
          ],
        },
        env: {
          'exported-variables': [
            'AWS_DEFAULT_REGION',
            'AWS_ACCOUNT_ID',
            'IMAGE_TAG',
            'REPOSITORY_URI',
          ],
        },
      }),
      timeout: cdk.Duration.minutes(30),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'FrontendBuildLogGroup', {
            logGroupName: `/aws/codebuild/ai-photobooth-frontend-${this.targetEnvironment}`,
            retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });
  }

  private createBackendBuildProject(): codebuild.Project {
    const buildRole = new iam.Role(this, 'BackendBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      inlinePolicies: {
        BackendBuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:GetAuthorizationToken',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
                'ecr:PutImage',
              ],
              resources: [
                this.backendRepository.repositoryArn,
                '*', // For GetAuthorizationToken
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
              ],
              resources: [this.artifactsBucket.arnForObjects('*')],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
              ],
              resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/ai-photobooth/${this.targetEnvironment}/*`],
            }),
          ],
        }),
      },
    });

    return new codebuild.Project(this, 'BackendBuildProject', {
      projectName: `ai-photobooth-backend-build-${this.targetEnvironment}`,
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // Required for Docker builds
      },
      source: codebuild.Source.gitHub({
        owner: 'your-github-username', // Replace with actual GitHub username
        repo: 'ai-photobooth',
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/' + this.backendRepository.repositoryName,
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
              'echo Installing dependencies...',
              'npm ci',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Running backend tests...',
              'npm run test --workspace=packages/backend',
              'echo Building the backend application...',
              'npm run build --workspace=packages/backend',
              'echo Building the Docker image...',
              'docker build -f Dockerfile.backend -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker image...',
              'docker push $REPOSITORY_URI:latest',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'echo Writing image definitions file...',
              'printf \'[{"name":"backend-container","imageUri":"%s"}]\' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: [
            'imagedefinitions.json',
          ],
        },
        env: {
          'exported-variables': [
            'AWS_DEFAULT_REGION',
            'AWS_ACCOUNT_ID',
            'IMAGE_TAG',
            'REPOSITORY_URI',
          ],
        },
      }),
      timeout: cdk.Duration.minutes(45),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'BackendBuildLogGroup', {
            logGroupName: `/aws/codebuild/ai-photobooth-backend-${this.targetEnvironment}`,
            retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });
  }  
private createDeploymentValidationProject(): codebuild.Project {
    const validationRole = new iam.Role(this, 'ValidationBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      inlinePolicies: {
        ValidationPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecs:DescribeServices',
                'ecs:DescribeTasks',
                'ecs:ListTasks',
                'elbv2:DescribeTargetHealth',
                'elbv2:DescribeTargetGroups',
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:GetMetricData',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
              ],
              resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/ai-photobooth/${this.targetEnvironment}/*`],
            }),
          ],
        }),
      },
    });

    return new codebuild.Project(this, 'DeploymentValidationProject', {
      projectName: `ai-photobooth-validation-${this.targetEnvironment}`,
      role: validationRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      source: codebuild.Source.gitHub({
        owner: 'your-github-username', // Replace with actual GitHub username
        repo: 'ai-photobooth',
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Starting deployment validation...',
              'npm ci',
              'npm install -g artillery',
            ],
          },
          build: {
            commands: [
              'echo Running health checks...',
              'npm run test:health --workspace=packages/backend',
              'echo Running integration tests...',
              'npm run test:integration --workspace=packages/backend',
              'echo Running load tests...',
              'artillery run packages/backend/tests/load/basic-load-test.yml',
              'echo Validating ECS service health...',
              'node packages/infrastructure/scripts/validate-deployment.js',
            ],
          },
          post_build: {
            commands: [
              'echo Deployment validation completed on `date`',
            ],
          },
        },
        reports: {
          'validation-reports': {
            files: [
              'test-results.xml',
              'load-test-results.json',
            ],
            'file-format': 'JUNITXML',
          },
        },
      }),
      timeout: cdk.Duration.minutes(20),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'ValidationLogGroup', {
            logGroupName: `/aws/codebuild/ai-photobooth-validation-${this.targetEnvironment}`,
            retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });
  }

  private createCodeDeployResources(ecsClusterName: string, ecsServiceName: string): {
    application: codedeploy.EcsApplication;
    deploymentGroup: codedeploy.EcsDeploymentGroup;
  } {
    // Create CodeDeploy application
    const application = new codedeploy.EcsApplication(this, 'PhotoboothCodeDeployApp', {
      applicationName: `ai-photobooth-${this.targetEnvironment}`,
    });

    // Create service role for CodeDeploy
    const codeDeployRole = new iam.Role(this, 'CodeDeployServiceRole', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeDeployRoleForECS'),
      ],
    });

    // Create deployment group with blue-green deployment configuration
    const deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'PhotoboothDeploymentGroup', {
      application,
      deploymentGroupName: `ai-photobooth-dg-${this.targetEnvironment}`,
      service: ecs.FargateService.fromFargateServiceAttributes(this, 'ImportedEcsService', {
        serviceName: ecsServiceName,
        cluster: ecs.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
          clusterName: ecsClusterName,
          vpc: ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
            vpcId: 'vpc-placeholder',
            availabilityZones: ['us-east-1a', 'us-east-1b'],
          }),
          securityGroups: [],
        }),
      }),
      role: codeDeployRole,
      blueGreenDeploymentConfig: {
        listener: elbv2.ApplicationListener.fromApplicationListenerAttributes(this, 'ImportedListener', {
          listenerArn: `arn:aws:elasticloadbalancing:${this.region}:${this.account}:listener/app/photobooth-alb-${this.targetEnvironment}/*/`,
          securityGroup: ec2.SecurityGroup.fromSecurityGroupId(this, 'ImportedAlbSg', 'sg-placeholder'),
        }),
        blueTargetGroup: elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(this, 'ImportedBlueTargetGroup', {
          targetGroupArn: `arn:aws:elasticloadbalancing:${this.region}:${this.account}:targetgroup/photobooth-tg-${this.targetEnvironment}/*`,
        }),
        greenTargetGroup: elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(this, 'ImportedGreenTargetGroup', {
          targetGroupArn: `arn:aws:elasticloadbalancing:${this.region}:${this.account}:targetgroup/photobooth-tg-green-${this.targetEnvironment}/*`,
        }),
        terminationWaitTime: cdk.Duration.minutes(5),
        deploymentApprovalWaitTime: cdk.Duration.minutes(0), // Auto-approve for single environment
      },
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
        deploymentInAlarm: true,
      },
      alarms: [
        // Add CloudWatch alarms for deployment monitoring
        new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
          alarmName: `ai-photobooth-high-error-rate-${this.targetEnvironment}`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: {
              LoadBalancer: `app/photobooth-alb-${this.targetEnvironment}`,
            },
            statistic: cloudwatch.Stats.SUM,
            period: cdk.Duration.minutes(1),
          }),
          threshold: 10,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        }),
      ],
    });

    return { application, deploymentGroup };
  }

  private createDeploymentValidationLambda(): lambda.Function {
    const validationRole = new iam.Role(this, 'ValidationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        ValidationPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecs:DescribeServices',
                'ecs:DescribeTasks',
                'ecs:ListTasks',
                'elbv2:DescribeTargetHealth',
                'cloudwatch:GetMetricStatistics',
                'codepipeline:PutJobSuccessResult',
                'codepipeline:PutJobFailureResult',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
              ],
              resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/ai-photobooth/${this.targetEnvironment}/*`],
            }),
          ],
        }),
      },
    });

    // Add X-Ray permissions if enabled
    if (this.environmentConfig.enableXRay) {
      validationRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
    }

    return new lambda.Function(this, 'DeploymentValidationLambda', {
      functionName: `ai-photobooth-validation-${this.targetEnvironment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      role: validationRole,
      code: lambda.Code.fromInline(`
const AWS = require('aws-sdk');
const ecs = new AWS.ECS();
const elbv2 = new AWS.ELBv2();
const cloudwatch = new AWS.CloudWatch();
const codepipeline = new AWS.CodePipeline();

exports.handler = async (event) => {
    console.log('Deployment validation started:', JSON.stringify(event, null, 2));
    
    const jobId = event['CodePipeline.job'].id;
    
    try {
        // Get environment configuration from event
        const environment = process.env.TARGET_ENVIRONMENT || 'dev';
        const clusterName = \`photobooth-cluster-\${environment}\`;
        const serviceName = \`photobooth-processing-\${environment}\`;
        
        // Validate ECS service health
        const serviceHealth = await validateEcsService(clusterName, serviceName);
        if (!serviceHealth.healthy) {
            throw new Error(\`ECS service validation failed: \${serviceHealth.reason}\`);
        }
        
        // Validate target group health
        const targetGroupHealth = await validateTargetGroupHealth(environment);
        if (!targetGroupHealth.healthy) {
            throw new Error(\`Target group validation failed: \${targetGroupHealth.reason}\`);
        }
        
        // Validate application metrics
        const metricsHealth = await validateApplicationMetrics(environment);
        if (!metricsHealth.healthy) {
            throw new Error(\`Metrics validation failed: \${metricsHealth.reason}\`);
        }
        
        // All validations passed
        await codepipeline.putJobSuccessResult({ jobId }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Deployment validation successful',
                validations: {
                    ecsService: serviceHealth,
                    targetGroup: targetGroupHealth,
                    metrics: metricsHealth
                }
            })
        };
        
    } catch (error) {
        console.error('Deployment validation failed:', error);
        
        await codepipeline.putJobFailureResult({
            jobId,
            failureDetails: {
                message: error.message,
                type: 'JobFailed'
            }
        }).promise();
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};

async function validateEcsService(clusterName, serviceName) {
    try {
        const response = await ecs.describeServices({
            cluster: clusterName,
            services: [serviceName]
        }).promise();
        
        if (response.services.length === 0) {
            return { healthy: false, reason: 'Service not found' };
        }
        
        const service = response.services[0];
        
        // Check if service is stable and running
        if (service.status !== 'ACTIVE') {
            return { healthy: false, reason: \`Service status is \${service.status}\` };
        }
        
        if (service.runningCount < service.desiredCount) {
            return { healthy: false, reason: \`Running count (\${service.runningCount}) is less than desired count (\${service.desiredCount})\` };
        }
        
        return { healthy: true, runningCount: service.runningCount, desiredCount: service.desiredCount };
        
    } catch (error) {
        return { healthy: false, reason: error.message };
    }
}

async function validateTargetGroupHealth(environment) {
    try {
        // This is a simplified validation - in practice, you'd get the actual target group ARN
        // from the deployment or from tags/parameters
        const targetGroups = await elbv2.describeTargetGroups({
            Names: [\`photobooth-tg-\${environment}\`]
        }).promise();
        
        if (targetGroups.TargetGroups.length === 0) {
            return { healthy: false, reason: 'Target group not found' };
        }
        
        const targetGroup = targetGroups.TargetGroups[0];
        
        const healthCheck = await elbv2.describeTargetHealth({
            TargetGroupArn: targetGroup.TargetGroupArn
        }).promise();
        
        const healthyTargets = healthCheck.TargetHealthDescriptions.filter(
            target => target.TargetHealth.State === 'healthy'
        );
        
        if (healthyTargets.length === 0) {
            return { healthy: false, reason: 'No healthy targets found' };
        }
        
        return { 
            healthy: true, 
            healthyTargets: healthyTargets.length,
            totalTargets: healthCheck.TargetHealthDescriptions.length
        };
        
    } catch (error) {
        return { healthy: false, reason: error.message };
    }
}

async function validateApplicationMetrics(environment) {
    try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes
        
        // Check error rate
        const errorRateMetrics = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'HTTPCode_Target_5XX_Count',
            Dimensions: [
                {
                    Name: 'LoadBalancer',
                    Value: \`app/photobooth-alb-\${environment}\`
                }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Sum']
        }).promise();
        
        const totalErrors = errorRateMetrics.Datapoints.reduce((sum, point) => sum + point.Sum, 0);
        
        if (totalErrors > 10) {
            return { healthy: false, reason: \`High error rate: \${totalErrors} errors in last 5 minutes\` };
        }
        
        return { healthy: true, errorCount: totalErrors };
        
    } catch (error) {
        return { healthy: false, reason: error.message };
    }
}
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        TARGET_ENVIRONMENT: this.targetEnvironment,
      },
      tracing: this.environmentConfig.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logGroup: new logs.LogGroup(this, 'ValidationLambdaLogGroup', {
        logGroupName: `/aws/lambda/ai-photobooth-validation-${this.targetEnvironment}`,
        retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
  }

  private createEventBridgeRules(): void {
    // Create EventBridge rule for pipeline state changes
    const pipelineStateRule = new events.Rule(this, 'PipelineStateChangeRule', {
      ruleName: `ai-photobooth-pipeline-state-${this.targetEnvironment}`,
      description: 'Capture pipeline state changes for orchestration',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: [`ai-photobooth-pipeline-${this.targetEnvironment}`],
        },
      },
    });

    // Create EventBridge rule for deployment state changes
    const deploymentStateRule = new events.Rule(this, 'DeploymentStateChangeRule', {
      ruleName: `ai-photobooth-deployment-state-${this.targetEnvironment}`,
      description: 'Capture deployment state changes for monitoring',
      eventPattern: {
        source: ['aws.codedeploy'],
        detailType: ['CodeDeploy Deployment State-change Notification'],
        detail: {
          application: [`ai-photobooth-${this.targetEnvironment}`],
        },
      },
    });

    // Create Lambda function for handling pipeline events
    const eventHandlerLambda = new lambda.Function(this, 'PipelineEventHandler', {
      functionName: `ai-photobooth-event-handler-${this.targetEnvironment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

exports.handler = async (event) => {
    console.log('Pipeline event received:', JSON.stringify(event, null, 2));
    
    try {
        const detail = event.detail;
        const source = event.source;
        
        if (source === 'aws.codepipeline') {
            await handlePipelineEvent(detail);
        } else if (source === 'aws.codedeploy') {
            await handleDeploymentEvent(detail);
        }
        
        return { statusCode: 200, body: 'Event processed successfully' };
        
    } catch (error) {
        console.error('Error processing event:', error);
        throw error;
    }
};

async function handlePipelineEvent(detail) {
    const { pipeline, state, 'execution-id': executionId } = detail;
    
    console.log(\`Pipeline \${pipeline} changed to state: \${state}\`);
    
    // Add custom logic for pipeline orchestration
    if (state === 'FAILED') {
        console.log('Pipeline failed, triggering alerts...');
        // Add notification logic here
    } else if (state === 'SUCCEEDED') {
        console.log('Pipeline succeeded, updating metrics...');
        // Add success metrics logic here
    }
}

async function handleDeploymentEvent(detail) {
    const { application, deploymentId, state } = detail;
    
    console.log(\`Deployment \${deploymentId} for application \${application} changed to state: \${state}\`);
    
    // Add custom logic for deployment monitoring
    if (state === 'FAILURE') {
        console.log('Deployment failed, triggering rollback procedures...');
        // Add rollback logic here
    } else if (state === 'SUCCESS') {
        console.log('Deployment succeeded, updating deployment metrics...');
        // Add success tracking logic here
    }
}
      `),
      timeout: cdk.Duration.minutes(2),
      tracing: this.environmentConfig.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    });

    // Add EventBridge targets
    pipelineStateRule.addTarget(new targets.LambdaFunction(eventHandlerLambda));
    deploymentStateRule.addTarget(new targets.LambdaFunction(eventHandlerLambda));

    // Grant EventBridge permission to invoke Lambda
    eventHandlerLambda.addPermission('AllowEventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: pipelineStateRule.ruleArn,
    });

    eventHandlerLambda.addPermission('AllowEventBridgeInvokeDeployment', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: deploymentStateRule.ruleArn,
    });
  }

  private createXRayTracing(): void {
    // Create X-Ray sampling rule for CI/CD pipeline
    new xray.CfnSamplingRule(this, 'CicdXRaySamplingRule', {
      samplingRule: {
        ruleName: `photobooth-cicd-sampling-${this.targetEnvironment}`,
        priority: 8000,
        fixedRate: 0.2, // Higher sampling rate for CI/CD operations
        reservoirSize: 2,
        serviceName: 'ai-photobooth-cicd',
        serviceType: '*',
        host: '*',
        httpMethod: '*',
        urlPath: '*',
        version: 1,
        resourceArn: '*',
      },
    });
  }
  private createCodePipeline(
    frontendBuildProject: codebuild.Project,
    backendBuildProject: codebuild.Project,
    validationProject: codebuild.Project,
    codeDeployApp: codedeploy.EcsApplication,
    deploymentGroup: codedeploy.EcsDeploymentGroup,
    validationLambda: lambda.Function
  ): codepipeline.Pipeline {
    // Create pipeline service role
    const pipelineRole = new iam.Role(this, 'PipelineServiceRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      inlinePolicies: {
        PipelinePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetBucketVersioning',
                's3:GetObject',
                's3:GetObjectVersion',
                's3:PutObject',
              ],
              resources: [
                this.artifactsBucket.bucketArn,
                this.artifactsBucket.arnForObjects('*'),
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codebuild:BatchGetBuilds',
                'codebuild:StartBuild',
              ],
              resources: [
                frontendBuildProject.projectArn,
                backendBuildProject.projectArn,
                validationProject.projectArn,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'codedeploy:CreateDeployment',
                'codedeploy:GetApplication',
                'codedeploy:GetApplicationRevision',
                'codedeploy:GetDeployment',
                'codedeploy:GetDeploymentConfig',
                'codedeploy:RegisterApplicationRevision',
              ],
              resources: [
                codeDeployApp.applicationArn,
                deploymentGroup.deploymentGroupArn,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:InvokeFunction',
              ],
              resources: [validationLambda.functionArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecs:DescribeServices',
                'ecs:DescribeTaskDefinition',
                'ecs:DescribeTasks',
                'ecs:ListTasks',
                'ecs:RegisterTaskDefinition',
                'ecs:UpdateService',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iam:PassRole',
              ],
              resources: ['*'],
              conditions: {
                StringEqualsIfExists: {
                  'iam:PassedToService': [
                    'ecs-tasks.amazonaws.com',
                  ],
                },
              },
            }),
          ],
        }),
      },
    });

    // Define pipeline artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const frontendBuildOutput = new codepipeline.Artifact('FrontendBuildOutput');
    const backendBuildOutput = new codepipeline.Artifact('BackendBuildOutput');

    // Create the pipeline
    const pipeline = new codepipeline.Pipeline(this, 'PhotoboothPipeline', {
      pipelineName: `ai-photobooth-pipeline-${this.targetEnvironment}`,
      pipelineType: codepipeline.PipelineType.V2,
      role: pipelineRole,
      artifactBucket: this.artifactsBucket,
      stages: [
        // Source Stage
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: 'YOUR_GITHUB_USERNAME', // Replace with your actual GitHub username
              repo: 'YOUR_REPO_NAME', // Replace with your actual repository name
              branch: 'main',
              oauthToken: cdk.SecretValue.secretsManager(`/ai-photobooth/${this.targetEnvironment}/github-token`, {
                jsonField: 'token',
              }),
              output: sourceOutput,
              trigger: codepipelineActions.GitHubTrigger.WEBHOOK,
            }),
          ],
        },
        
        // Build Stage - Parallel builds for frontend and backend
        {
          stageName: 'Build',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'Frontend_Build',
              project: frontendBuildProject,
              input: sourceOutput,
              outputs: [frontendBuildOutput],
              runOrder: 1,
            }),
            new codepipelineActions.CodeBuildAction({
              actionName: 'Backend_Build',
              project: backendBuildProject,
              input: sourceOutput,
              outputs: [backendBuildOutput],
              runOrder: 1,
            }),
          ],
        },
        
        // Pre-deployment Validation
        {
          stageName: 'PreDeploymentValidation',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'Pre_Deployment_Tests',
              project: validationProject,
              input: sourceOutput,
              runOrder: 1,
            }),
          ],
        },
        
        // Deploy Stage - Blue-Green Deployment
        {
          stageName: 'Deploy',
          actions: [
            new codepipelineActions.CodeDeployEcsDeployAction({
              actionName: 'ECS_Deploy',
              deploymentGroup: deploymentGroup,
              appSpecTemplateInput: backendBuildOutput,
              taskDefinitionTemplateInput: backendBuildOutput,
              runOrder: 1,
            }),
          ],
        },
        
        // Post-deployment Validation
        {
          stageName: 'PostDeploymentValidation',
          actions: [
            new codepipelineActions.LambdaInvokeAction({
              actionName: 'Deployment_Validation',
              lambda: validationLambda,
              userParameters: {
                environment: this.targetEnvironment,
                deploymentType: 'blue-green',
              },
              runOrder: 1,
            }),
            new codepipelineActions.CodeBuildAction({
              actionName: 'Integration_Tests',
              project: validationProject,
              input: sourceOutput,
              runOrder: 2,
            }),
          ],
        },
      ],
      
      // Enable pipeline execution role for cross-account deployments if needed
      crossAccountKeys: false, // Single account deployment
      
      // Restart execution on update
      restartExecutionOnUpdate: true,
    });

    return pipeline;
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CodePipeline name for AI Photobooth deployment',
    });

    new cdk.CfnOutput(this, 'FrontendRepositoryUri', {
      value: this.frontendRepository.repositoryUri,
      description: 'ECR repository URI for frontend images',
    });

    new cdk.CfnOutput(this, 'BackendRepositoryUri', {
      value: this.backendRepository.repositoryUri,
      description: 'ECR repository URI for backend images',
    });

    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: this.artifactsBucket.bucketName,
      description: 'S3 bucket name for pipeline artifacts',
    });

    new cdk.CfnOutput(this, 'PipelineConsoleUrl', {
      value: `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
      description: 'AWS Console URL for the CI/CD pipeline',
    });
  }
}