import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface EcrStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
}

export class EcrStack extends cdk.Stack {
  public readonly frontendRepository: ecr.Repository;
  public readonly backendRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { frontendRepository, backendRepository } = this.createEcrRepositories(props.environmentConfig);
    this.frontendRepository = frontendRepository;
    this.backendRepository = backendRepository;

    this.createOutputs();
  }

  private createEcrRepositories(environmentConfig: EnvironmentConfig): { frontendRepository: ecr.Repository; backendRepository: ecr.Repository } {
    const frontendRepository = new ecr.Repository(this, 'FrontendRepository', {
      repositoryName: `ai-photobooth-frontend-${environmentConfig.environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          maxImageCount: 5,
          tagStatus: ecr.TagStatus.ANY,
          tagPrefixList: ['latest'],
        },
      ],
    });

    const backendRepository = new ecr.Repository(this, 'BackendRepository', {
      repositoryName: `ai-photobooth-backend-${environmentConfig.environment}`,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          maxImageCount: 5,
          tagStatus: ecr.TagStatus.ANY,
          tagPrefixList: ['latest'],
        },
      ],
    });

    return { frontendRepository, backendRepository };
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'FrontendRepositoryUri', {
      value: this.frontendRepository.repositoryUri,
      description: 'ECR repository URI for frontend',
    });

    new cdk.CfnOutput(this, 'BackendRepositoryUri', {
      value: this.backendRepository.repositoryUri,
      description: 'ECR repository URI for backend',
    });
  }
}