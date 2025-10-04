import { Construct } from 'constructs';
import { Distribution, OriginAccessIdentity, ViewerProtocolPolicy, CachePolicy, OriginRequestPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin, HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Duration } from 'aws-cdk-lib';

export interface CDNProps {
  bucket: Bucket;
  apiDomain: string;
  environment: string;
}

export class CDN extends Construct {
  public readonly distribution: Distribution;
  public readonly oai: OriginAccessIdentity;

  constructor(scope: Construct, id: string, props: CDNProps) {
    super(scope, id);

    // Origin Access Identity for S3
    this.oai = new OriginAccessIdentity(this, 'OAI', {
      comment: `AI Photobooth OAI - ${props.environment}`
    });

    // Custom cache policies
    const staticCachePolicy = new CachePolicy(this, 'StaticCachePolicy', {
      cachePolicyName: `ai-photobooth-static-${props.environment}`,
      defaultTtl: Duration.days(30),
      maxTtl: Duration.days(365),
      minTtl: Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true
    });

    const apiCachePolicy = new CachePolicy(this, 'APICachePolicy', {
      cachePolicyName: `ai-photobooth-api-${props.environment}`,
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(1),
      minTtl: Duration.seconds(0),
      enableAcceptEncodingGzip: true
    });

    // CloudFront Distribution
    this.distribution = new Distribution(this, 'Distribution', {
      comment: `AI Photobooth CDN - ${props.environment}`,
      defaultBehavior: {
        origin: new S3Origin(props.bucket, {
          originAccessIdentity: this.oai
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: staticCachePolicy,
        compress: true
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(props.apiDomain),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
          compress: true
        },
        '/themes/*': {
          origin: new S3Origin(props.bucket, {
            originAccessIdentity: this.oai
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticCachePolicy,
          compress: true
        }
      },
      priceClass: undefined, // Use default price class
      enableIpv6: true
    });

    // Grant S3 access to OAI
    props.bucket.grantRead(this.oai);
  }
}