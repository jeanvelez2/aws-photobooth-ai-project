export interface EnvironmentConfig {
  environment: string;
  region: string;
  domainName?: string;
  certificateArn?: string;
  enableWaf: boolean;
  enableXRay: boolean;
  logRetentionDays: number;
  autoScaling: {
    minCapacity: number;
    maxCapacity: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
    scaleOutCooldown: number; // seconds
    scaleInCooldown: number; // seconds
    targetRequestCount?: number; // requests per target
  };
  s3: {
    uploadRetentionDays: number;
    processedRetentionDays: number;
  };
  monitoring: {
    enableDetailedMonitoring: boolean;
    alarmEmail?: string;
  };
  performance: {
    connectionPoolSize: number;
    maxConcurrentProcessing: number;
    processingTimeoutMs: number;
  };
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    environment: 'dev',
    region: 'us-east-1',
    enableWaf: false,
    enableXRay: false,
    logRetentionDays: 7,
    autoScaling: {
      minCapacity: 1,
      maxCapacity: 5,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleOutCooldown: 60,
      scaleInCooldown: 300,
      targetRequestCount: 100,
    },
    s3: {
      uploadRetentionDays: 1,
      processedRetentionDays: 3,
    },
    monitoring: {
      enableDetailedMonitoring: false,
    },
    performance: {
      connectionPoolSize: 10,
      maxConcurrentProcessing: 20,
      processingTimeoutMs: 15000,
    },
  },
  staging: {
    environment: 'staging',
    region: 'us-east-1',
    enableWaf: true,
    enableXRay: true,
    logRetentionDays: 14,
    autoScaling: {
      minCapacity: 2,
      maxCapacity: 10,
      targetCpuUtilization: 60,
      targetMemoryUtilization: 75,
      scaleOutCooldown: 45,
      scaleInCooldown: 300,
      targetRequestCount: 150,
    },
    s3: {
      uploadRetentionDays: 1,
      processedRetentionDays: 7,
    },
    monitoring: {
      enableDetailedMonitoring: true,
    },
    performance: {
      connectionPoolSize: 15,
      maxConcurrentProcessing: 50,
      processingTimeoutMs: 12000,
    },
  },
  prod: {
    environment: 'prod',
    region: 'us-east-1',
    enableWaf: true,
    enableXRay: true,
    logRetentionDays: 30,
    autoScaling: {
      minCapacity: 3,
      maxCapacity: 20,
      targetCpuUtilization: 50,
      targetMemoryUtilization: 70,
      scaleOutCooldown: 30,
      scaleInCooldown: 300,
      targetRequestCount: 200,
    },
    s3: {
      uploadRetentionDays: 1,
      processedRetentionDays: 7,
    },
    monitoring: {
      enableDetailedMonitoring: true,
      alarmEmail: 'alerts@company.com',
    },
    performance: {
      connectionPoolSize: 20,
      maxConcurrentProcessing: 100,
      processingTimeoutMs: 10000,
    },
  },
};

export function getEnvironmentConfig(env: string): EnvironmentConfig {
  const config = environments[env];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${env}`);
  }
  return config;
}