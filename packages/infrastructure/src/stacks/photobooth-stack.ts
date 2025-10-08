import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface PhotoboothStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class PhotoboothStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly processingJobsTable: dynamodb.Table;
  public readonly themesTable: dynamodb.Table;
  public readonly cluster: ecs.Cluster;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly distribution: cloudfront.Distribution;
  public readonly service: ecs.FargateService;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly appConfigSecret: secretsmanager.Secret;

  private readonly environmentConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: PhotoboothStackProps) {
    super(scope, id, props);
    
    this.environmentConfig = props.environmentConfig;

    // Create S3 bucket for image storage
    this.bucket = this.createS3Bucket();

    // Create DynamoDB tables
    this.processingJobsTable = this.createProcessingJobsTable();
    this.themesTable = this.createThemesTable();

    // Create VPC and security groups
    const vpc = this.createVpc();
    const albSecurityGroup = this.createAlbSecurityGroup(vpc);
    const ecsSecurityGroup = this.createEcsSecurityGroup(vpc, albSecurityGroup);

    // Create ECS cluster
    this.cluster = this.createEcsCluster(vpc, ecsSecurityGroup);

    // Create Application Load Balancer
    const { loadBalancer, targetGroup } = this.createApplicationLoadBalancer(vpc, albSecurityGroup);
    this.loadBalancer = loadBalancer;
    this.targetGroup = targetGroup;

    // Create CloudFront distribution
    this.distribution = this.createCloudFrontDistribution();

    // Create Secrets Manager secret with app configuration (after ALB and CloudFront)
    this.appConfigSecret = this.createAppConfigSecret();

    // Create ECS service
    this.service = this.createEcsService();

    // Create X-Ray tracing if enabled
    if (this.environmentConfig.enableXRay) {
      this.createXRayTracing();
    }

    // Output important values
    this.createOutputs();
  }

  private createS3Bucket(): s3.Bucket {
    const bucket = new s3.Bucket(this, 'PhotoboothBucket', {
      bucketName: `ai-photobooth-${this.environmentConfig.environment}-${this.account}`,
      versioned: true, // Enable versioning for data protection
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true, // Enforce SSL for all requests
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: [
            `https://${this.distribution?.distributionDomainName || '*'}`,
            'http://localhost:3000',
            'https://localhost:3000'
          ],
          allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'Authorization',
            'x-amz-date',
            'x-amz-security-token',
            'x-amz-user-agent'
          ],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteUploadsAfter24Hours',
          enabled: true,
          prefix: 'uploads/',
          expiration: cdk.Duration.days(this.environmentConfig.s3.uploadRetentionDays),
        },
        {
          id: 'DeleteProcessedAfter7Days',
          enabled: true,
          prefix: 'processed/',
          expiration: cdk.Duration.days(this.environmentConfig.s3.processedRetentionDays),
        },
        {
          id: 'AbortIncompleteMultipartUploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });

    // Bucket notifications can be added later for processing triggers

    return bucket;
  }



  private createProcessingJobsTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'ProcessingJobsTable', {
      tableName: `photobooth-processing-jobs-${this.environmentConfig.environment}-${this.account}`,
      partitionKey: {
        name: 'jobId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Add Global Secondary Index with higher capacity
    table.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      // Use on-demand billing for GSI to handle traffic spikes
    });

    return table;
  }

  private createThemesTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'ThemesTable', {
      tableName: `photobooth-themes-${this.environmentConfig.environment}-${this.account}`,
      partitionKey: {
        name: 'themeId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // Enable TTL for automatic cleanup
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });
  }

  private createVpc(): ec2.Vpc {
    const vpc = new ec2.Vpc(this, 'PhotoboothVpc', {
      maxAzs: 2,
      natGateways: 1, // Cost optimization - use 1 NAT gateway
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Add VPC endpoints for AWS services to improve connectivity from private subnets
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Add interface endpoints for other AWS services
    vpc.addInterfaceEndpoint('RekognitionEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.REKOGNITION,
    });

    vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_MONITORING,
    });

    vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });

    vpc.addInterfaceEndpoint('BedrockEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
    });

    return vpc;
  }

  private createEcsCluster(vpc: ec2.Vpc, ecsSecurityGroup: ec2.SecurityGroup): ecs.Cluster {
    const cluster = new ecs.Cluster(this, 'PhotoboothCluster', {
      vpc,
      clusterName: `photobooth-cluster-${this.environmentConfig.environment}`,
      enableFargateCapacityProviders: true,
      // Use the new containerInsightsV2 property instead of deprecated containerInsights
      ...(this.environmentConfig.monitoring.enableDetailedMonitoring && {
        containerInsightsV2: ecs.ContainerInsights.ENABLED,
      }),
    });





    return cluster;
  }

  private createEcsService(): ecs.FargateService {
    // Get the task definition from the cluster (we need to store it as a property)
    const taskDefinition = this.createTaskDefinition();

    // Create ECS service
    const service = new ecs.FargateService(this, 'ProcessingService', {
      cluster: this.cluster,
      taskDefinition,
      serviceName: `photobooth-processing-${this.environmentConfig.environment}`,
      desiredCount: this.environmentConfig.autoScaling.minCapacity,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      enableExecuteCommand: true,
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      // Enable circuit breaker for faster rollbacks
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
    });

    // Attach service to target group
    this.targetGroup.addTarget(service);

    // Configure comprehensive auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: this.environmentConfig.autoScaling.minCapacity,
      maxCapacity: this.environmentConfig.autoScaling.maxCapacity,
    });

    // CPU-based scaling with optimized thresholds
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: this.environmentConfig.autoScaling.targetCpuUtilization,
      scaleInCooldown: cdk.Duration.seconds(this.environmentConfig.autoScaling.scaleInCooldown),
      scaleOutCooldown: cdk.Duration.seconds(this.environmentConfig.autoScaling.scaleOutCooldown),
      disableScaleIn: false,
    });

    // Memory-based scaling
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: this.environmentConfig.autoScaling.targetMemoryUtilization,
      scaleInCooldown: cdk.Duration.seconds(this.environmentConfig.autoScaling.scaleInCooldown),
      scaleOutCooldown: cdk.Duration.seconds(this.environmentConfig.autoScaling.scaleOutCooldown),
      disableScaleIn: false,
    });

    // Custom metric scaling for processing queue depth
    scaling.scaleOnMetric('QueueDepthScaling', {
      metric: new cloudwatch.Metric({
        namespace: 'AI-Photobooth',
        metricName: 'ProcessingQueueDepth',
        dimensionsMap: {
          Environment: this.environmentConfig.environment,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(1),
      }),
      scalingSteps: [
        { upper: 5, change: 0 },    // No scaling if queue < 5
        { lower: 5, upper: 15, change: +1 }, // Scale out by 1 if queue 5-15
        { lower: 15, upper: 30, change: +2 }, // Scale out by 2 if queue 15-30
        { lower: 30, change: +3 },  // Scale out by 3 if queue > 30
      ],
      cooldown: cdk.Duration.minutes(2),
    });

    return service;
  }

  private createTaskDefinition(): ecs.FargateTaskDefinition {
    // Create task execution role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Add X-Ray permissions if enabled
    if (this.environmentConfig.enableXRay) {
      taskExecutionRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
    }

    // Create task role with permissions for S3, DynamoDB, Rekognition, and CloudWatch
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        PhotoboothTaskPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectVersion',
              ],
              resources: [this.bucket.arnForObjects('*')],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket',
                's3:GetBucketLocation',
              ],
              resources: [this.bucket.bucketArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                this.processingJobsTable.tableArn,
                this.themesTable.tableArn,
                `${this.processingJobsTable.tableArn}/index/*`,
                `${this.themesTable.tableArn}/index/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'rekognition:DetectFaces',
                'rekognition:DetectLabels',
                'rekognition:RecognizeCelebrities',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
              ],
              resources: [this.appConfigSecret.secretArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
              ],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-canvas-v1`,
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-image-generator-v1`,
                `arn:aws:bedrock:${this.region}::foundation-model/stability.stable-diffusion-xl-v1`,
              ],
            }),
          ],
        }),
      },
    });

    // Add X-Ray permissions to task role if enabled
    if (this.environmentConfig.enableXRay) {
      taskRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
    }

    // Create task definition with GPU support
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProcessingTaskDefinition', {
      memoryLimitMiB: 4096,
      cpu: 2048,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    // Add container to task definition - will use ECR image from separate stack
    const backendRepository = ecr.Repository.fromRepositoryName(this, 'BackendRepositoryRef', `ai-photobooth-backend-${this.environmentConfig.environment}`);
    const container = taskDefinition.addContainer('ProcessingContainer', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepository, 'latest'),
      memoryLimitMiB: 3584,
      cpu: 1792,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'photobooth-processing',
        logGroup: new logs.LogGroup(this, 'ProcessingLogGroup', {
          logGroupName: `/ecs/photobooth-processing-${this.environmentConfig.environment}`,
          retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
      environment: {
        AWS_REGION: this.region,
        S3_BUCKET_NAME: this.bucket.bucketName,
        PROCESSING_JOBS_TABLE: this.processingJobsTable.tableName,
        THEMES_TABLE: this.themesTable.tableName,
        NODE_ENV: 'production',
        ENABLE_XRAY: this.environmentConfig.enableXRay.toString(),
        APP_CONFIG_SECRET_ARN: this.appConfigSecret.secretArn,
        CLOUDFRONT_DOMAIN: this.distribution.distributionDomainName,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'nc -z localhost 3001 || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });

    return taskDefinition;
  }

  private createXRayTracing(): void {
    // Create X-Ray sampling rule
    new xray.CfnSamplingRule(this, 'XRaySamplingRule', {
      samplingRule: {
        ruleName: `photobooth-sampling-${this.environmentConfig.environment}`,
        priority: 9000,
        fixedRate: 0.1,
        reservoirSize: 1,
        serviceName: 'ai-photobooth-backend',
        serviceType: '*',
        host: '*',
        httpMethod: '*',
        urlPath: '*',
        version: 1,
        resourceArn: '*', // Required property for CDK v2
      },
    });
  }

  private createEcsSecurityGroup(vpc: ec2.Vpc, albSecurityGroup: ec2.SecurityGroup): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    // Allow inbound traffic from ALB
    securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      ec2.Port.tcp(3001),
      'Allow traffic from ALB'
    );

    return securityGroup;
  }

  private createAlbSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow HTTP and HTTPS traffic from internet
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    return securityGroup;
  }

  private createApplicationLoadBalancer(vpc: ec2.Vpc, albSecurityGroup: ec2.SecurityGroup): { loadBalancer: elbv2.ApplicationLoadBalancer; targetGroup: elbv2.ApplicationTargetGroup } {
    const alb = new elbv2.ApplicationLoadBalancer(this, 'PhotoboothALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `photobooth-alb-${this.environmentConfig.environment}`,
      securityGroup: albSecurityGroup,
    });

    // Create target group for ECS service
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'EcsTargetGroup', {
      vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/api/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3001',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
    });

    // Create HTTP listener - for dev it forwards to target group, for prod it redirects to HTTPS
    if (this.environmentConfig.environment === 'production') {
      alb.addListener('HttpListener', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });

      alb.addListener('HttpsListener', {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
        // certificateArns: [props.sslCertificateArn], // Add SSL certificate ARN
      });
    } else {
      // For dev environment, use HTTP listener that forwards to target group
      alb.addListener('HttpListener', {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      });
    }

    return { loadBalancer: alb, targetGroup };
  }

  private createCloudFrontDistribution(): cloudfront.Distribution {
    // Create S3 origin for static website hosting
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    // Create ALB origin for API requests
    const albOrigin = new origins.HttpOrigin(this.loadBalancer.loadBalancerDnsName, {
      protocolPolicy: this.environmentConfig.environment === 'production' 
        ? cloudfront.OriginProtocolPolicy.HTTPS_ONLY 
        : cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      connectionAttempts: 3,
      connectionTimeout: cdk.Duration.seconds(10),
      readTimeout: cdk.Duration.seconds(30),
    });

    // Create custom cache policies for different content types
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `photobooth-static-assets-${this.environmentConfig.environment}`,
      comment: 'Cache policy for static assets (JS, CSS, images)',
      defaultTtl: cdk.Duration.days(7),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const imagesCachePolicy = new cloudfront.CachePolicy(this, 'ImagesCachePolicy', {
      cachePolicyName: `photobooth-images-${this.environmentConfig.environment}`,
      comment: 'Cache policy for processed images',
      defaultTtl: cdk.Duration.hours(24),
      maxTtl: cdk.Duration.days(7),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('v', 'format'),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `photobooth-api-${this.environmentConfig.environment}`,
      comment: 'Cache policy for API responses',
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.hours(1),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'Accept'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const distribution = new cloudfront.Distribution(this, 'PhotoboothDistribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: staticAssetsCachePolicy,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      additionalBehaviors: {
        // API endpoints - no caching for dynamic content
        '/api/process*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        '/api/upload*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        // Themes API - cache for 5 minutes
        '/api/themes*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        },
        // Health check - short cache
        '/api/health': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: new cloudfront.CachePolicy(this, 'HealthCheckCachePolicy', {
            cachePolicyName: `photobooth-health-${this.environmentConfig.environment}`,
            defaultTtl: cdk.Duration.seconds(30),
            maxTtl: cdk.Duration.minutes(5),
            minTtl: cdk.Duration.seconds(0),
          }),
        },
        // Catch-all for any other API routes
        '/api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        // Static JS/CSS files - long cache with versioning
        '*.js': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: staticAssetsCachePolicy,
        },
        '*.css': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: staticAssetsCachePolicy,
        },
        // Image assets - medium cache
        '/processed/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: imagesCachePolicy,
        },
        '/themes/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: imagesCachePolicy,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Cost optimization
      enabled: true,
      comment: 'AI Photobooth CloudFront Distribution with optimized caching',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      // No geo restrictions by default
    });

    return distribution;
  }

  private createAppConfigSecret(): secretsmanager.Secret {
    // Create secret with initial placeholder values
    const secret = new secretsmanager.Secret(this, 'AppConfigSecret', {
      secretName: `photobooth-config-${this.environmentConfig.environment}`,
      description: 'Application configuration URLs and settings',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        API_URL: `http://${this.loadBalancer.loadBalancerDnsName}/api`,
        FRONTEND_URL: `https://${this.distribution.distributionDomainName}`,
        CLOUDFRONT_URL: `https://${this.distribution.distributionDomainName}`,
        ALB_URL: `http://${this.loadBalancer.loadBalancerDnsName}`,
        S3_BUCKET: this.bucket.bucketName,
        ENVIRONMENT: this.environmentConfig.environment,
      })),
    });

    return secret;
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for image storage',
    });

    new cdk.CfnOutput(this, 'ProcessingJobsTableName', {
      value: this.processingJobsTable.tableName,
      description: 'DynamoDB table name for processing jobs',
    });

    new cdk.CfnOutput(this, 'ThemesTableName', {
      value: this.themesTable.tableName,
      description: 'DynamoDB table name for themes',
    });

    new cdk.CfnOutput(this, 'LoadBalancerUrl', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}`,
      description: 'Application Load Balancer URL',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
      description: 'ECS service name',
    });

    new cdk.CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroup.targetGroupArn,
      description: 'ALB target group ARN',
    });

    new cdk.CfnOutput(this, 'LoadBalancerArn', {
      value: this.loadBalancer.loadBalancerArn,
      description: 'Application Load Balancer ARN',
    });

    new cdk.CfnOutput(this, 'AppConfigSecretArn', {
      value: this.appConfigSecret.secretArn,
      description: 'Application configuration secret ARN',
    });
  }
}