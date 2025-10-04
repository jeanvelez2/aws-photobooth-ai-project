import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cloudfront = new CloudFrontClient({ region: 'us-east-1' });

export async function invalidateCache(distributionId: string) {
  if (!distributionId) {
    throw new Error('Distribution ID is required');
  }

  try {
    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: 2,
          Items: ['/*', '/index.html']
        },
        CallerReference: `invalidation-${Date.now()}`
      }
    });

    const result = await cloudfront.send(command);
    return result.Invalidation?.Id;
  } catch (error) {
    throw new Error(`Failed to invalidate cache: ${error}`);
  }
}