#!/bin/bash

echo "=== DEBUGGING API ENDPOINTS ==="

# Test CloudFront endpoints
echo "1. Testing CloudFront health:"
curl -v "https://d1sb1uvkfiy4hq.cloudfront.net/api/health" 2>&1 | head -20

echo -e "\n2. Testing CloudFront themes:"
curl -v "https://d1sb1uvkfiy4hq.cloudfront.net/api/themes" 2>&1 | head -20

echo -e "\n3. Testing CloudFront process (should fail with 426):"
curl -v -X POST "https://d1sb1uvkfiy4hq.cloudfront.net/api/process" \
  -H "Content-Type: application/json" \
  -d '{"photoId":"test","themeId":"barbarian","originalImageUrl":"test"}' 2>&1 | head -20

echo -e "\n4. Testing theme image URL:"
curl -I "https://d1sb1uvkfiy4hq.cloudfront.net/themes/barbarian-thumb.svg" 2>&1 | head -10

echo -e "\n=== END DEBUG ==="