#!/usr/bin/env node

/**
 * Test Upload Functionality
 * 
 * This script tests the upload service to ensure S3 uploads are working correctly.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const TEST_IMAGE_PATH = process.env.TEST_IMAGE_PATH || path.join(__dirname, 'test-image.jpg');

/**
 * Create a simple test image if it doesn't exist
 */
function createTestImage() {
  if (fs.existsSync(TEST_IMAGE_PATH)) {
    return;
  }

  // Create a simple 1x1 pixel JPEG
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
    0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00, 0xFF, 0xD9
  ]);

  fs.writeFileSync(TEST_IMAGE_PATH, jpegHeader);
  console.log(`Created test image: ${TEST_IMAGE_PATH}`);
}

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Test presigned URL generation
 */
async function testPresignedUrl() {
  console.log('🔍 Testing presigned URL generation...');
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/upload/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024
      })
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Presigned URL generated successfully');
      console.log('  Upload URL:', response.data.data.uploadUrl.substring(0, 100) + '...');
      console.log('  Key:', response.data.data.key);
      console.log('  Photo ID:', response.data.data.photoId);
      return response.data.data;
    } else {
      console.log('❌ Failed to generate presigned URL');
      console.log('  Status:', response.statusCode);
      console.log('  Response:', response.data);
      return null;
    }
    
  } catch (error) {
    console.log('❌ Error generating presigned URL:', error.message);
    return null;
  }
}

/**
 * Test S3 upload
 */
async function testS3Upload(uploadUrl) {
  console.log('🔍 Testing S3 upload...');
  
  try {
    createTestImage();
    const imageData = fs.readFileSync(TEST_IMAGE_PATH);
    
    const response = await makeRequest(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': imageData.length
      },
      body: imageData
    });
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('✅ S3 upload successful');
      console.log('  Status:', response.statusCode);
      return true;
    } else {
      console.log('❌ S3 upload failed');
      console.log('  Status:', response.statusCode);
      console.log('  Response:', response.data);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error uploading to S3:', error.message);
    return false;
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/health`);
    
    if (response.statusCode === 200) {
      console.log('✅ Health endpoint working');
      console.log('  Status:', response.data.status);
      console.log('  Uptime:', Math.round(response.data.uptime), 'seconds');
      return true;
    } else {
      console.log('❌ Health endpoint failed');
      console.log('  Status:', response.statusCode);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error checking health:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 AI Photobooth Upload Test');
  console.log('============================');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log('');
  
  let allTestsPassed = true;
  
  // Test 1: Health endpoint
  const healthOk = await testHealthEndpoint();
  allTestsPassed = allTestsPassed && healthOk;
  console.log('');
  
  // Test 2: Presigned URL generation
  const presignedData = await testPresignedUrl();
  allTestsPassed = allTestsPassed && (presignedData !== null);
  console.log('');
  
  // Test 3: S3 upload (if presigned URL was generated)
  if (presignedData) {
    const uploadOk = await testS3Upload(presignedData.uploadUrl);
    allTestsPassed = allTestsPassed && uploadOk;
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Summary');
  console.log('===============');
  if (allTestsPassed) {
    console.log('✅ All tests passed! Upload functionality is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the logs above for details.');
    console.log('');
    console.log('Common issues:');
    console.log('1. Backend not running or not accessible');
    console.log('2. AWS credentials not configured');
    console.log('3. S3 bucket permissions incorrect');
    console.log('4. Environment variables not set');
  }
  
  // Cleanup
  if (fs.existsSync(TEST_IMAGE_PATH)) {
    fs.unlinkSync(TEST_IMAGE_PATH);
  }
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testPresignedUrl,
  testS3Upload,
  testHealthEndpoint,
  runTests
};