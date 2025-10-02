# AI Photobooth Infrastructure Deployment Script for Windows

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1",
    [switch]$SkipTests = $false
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"

Write-Host "🚀 AI Photobooth Infrastructure Deployment" -ForegroundColor $Green
Write-Host "Environment: $Environment"
Write-Host "Region: $Region"
Write-Host ""

# Check prerequisites
if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI is not installed" -ForegroundColor $Red
    exit 1
}

if (!(Get-Command cdk -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CDK is not installed" -ForegroundColor $Red
    Write-Host "Install with: npm install -g aws-cdk"
    exit 1
}

# Set environment variables
$env:ENVIRONMENT = $Environment
$env:CDK_DEFAULT_REGION = $Region

if (!$env:CDK_DEFAULT_ACCOUNT) {
    Write-Host "⚠️  CDK_DEFAULT_ACCOUNT not set, attempting to detect..." -ForegroundColor $Yellow
    $Account = aws sts get-caller-identity --query Account --output text
    $env:CDK_DEFAULT_ACCOUNT = $Account
    Write-Host "Detected account: $Account"
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor $Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor $Red
    exit 1
}

# Build TypeScript
Write-Host "🔨 Building TypeScript..." -ForegroundColor $Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build TypeScript" -ForegroundColor $Red
    exit 1
}

# Run tests
if (!$SkipTests) {
    Write-Host "🧪 Running tests..." -ForegroundColor $Yellow
    npm test

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed" -ForegroundColor $Red
        exit 1
    }
}

# Show diff
Write-Host "📋 Showing deployment diff..." -ForegroundColor $Yellow
npm run diff

# Confirm deployment
$confirmation = Read-Host "Do you want to proceed with deployment? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Deployment cancelled" -ForegroundColor $Yellow
    exit 0
}

# Deploy
Write-Host "🚀 Deploying infrastructure..." -ForegroundColor $Green
npm run deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Update your application configuration with the output values"
    Write-Host "2. Build and push your Docker images to ECR"
    Write-Host "3. Update the ECS task definition with your image URIs"
    Write-Host "4. Deploy your application code"
} else {
    Write-Host "❌ Deployment failed" -ForegroundColor $Red
    exit 1
}