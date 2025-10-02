#!/bin/bash

# AI Photobooth Infrastructure Deployment Script

set -e

# Default values
ENVIRONMENT=${ENVIRONMENT:-dev}
REGION=${CDK_DEFAULT_REGION:-us-east-1}
ACCOUNT=${CDK_DEFAULT_ACCOUNT}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AI Photobooth Infrastructure Deployment${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Account: $ACCOUNT"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

if [ -z "$ACCOUNT" ]; then
    echo -e "${YELLOW}⚠️  CDK_DEFAULT_ACCOUNT not set, attempting to detect...${NC}"
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    export CDK_DEFAULT_ACCOUNT=$ACCOUNT
    echo "Detected account: $ACCOUNT"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

# Show diff
echo -e "${YELLOW}📋 Showing deployment diff...${NC}"
npm run diff

# Confirm deployment
echo ""
read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Deployment cancelled${NC}"
    exit 0
fi

# Deploy
echo -e "${GREEN}🚀 Deploying infrastructure...${NC}"
npm run deploy

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Update your application configuration with the output values"
echo "2. Build and push your Docker images to ECR"
echo "3. Update the ECS task definition with your image URIs"
echo "4. Deploy your application code"