#!/usr/bin/env node

// Simple webhook test script
const https = require('https');
const http = require('http');

const CLOUDFLARE_URL =
  'https://chest-pirates-generations-tool.trycloudflare.com';
const LOCAL_URL = 'http://localhost:3000/api/webhooks/viva';

// Simple test payload
const testPayload = {
  test: 'hello from curl',
};

// Viva-like test payload
const vivaPayload = {
  Url: 'https://chest-pirates-generations-tool.trycloudflare.com/api/webhooks/viva',
  EventTypeId: 1796,
  EventName: 'Transaction Payment Created',
  Created: new Date().toISOString(),
  RetryCount: 0,
  EventData: {
    TransactionId: 'test-txn-123',
    OrderCode: 'test-ride-456',
    MerchantId: '100bae1e-394a-4657-bec3-0ce0ca2f7475',
    Amount: 2500,
    StatusId: 'F',
    CurrencyCode: '978',
    ResponseCode: '00',
  },
};

function makeRequest(url, payload) {
  const data = JSON.stringify(payload);
  const isHttps = url.startsWith('https');
  const urlObj = new URL(url);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function testWebhook() {
  console.log('🚀 Testing webhook endpoints...\n');

  // Test simple payload first
  console.log('📤 Testing simple payload...');
  try {
    const response = await makeRequest(LOCAL_URL, testPayload);
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📄 Response: ${response.body}\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  // Test Viva-like payload
  console.log('📤 Testing Viva-like payload...');
  try {
    const response = await makeRequest(LOCAL_URL, vivaPayload);
    console.log(`✅ Status: ${response.statusCode}`);
    console.log(`📄 Response: ${response.body}\n`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

// Run if called directly
if (require.main === module) {
  testWebhook().catch(console.error);
}

module.exports = { testWebhook, makeRequest };
