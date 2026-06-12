const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhook/test-results';
const PAYLOAD_PATH = process.env.PAYLOAD_PATH || 'test-results-payload.json';
const MAX_RETRIES = Number(process.env.WEBHOOK_MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.WEBHOOK_RETRY_DELAY_MS || 5000);

function readPayload() {
  if (!fs.existsSync(PAYLOAD_PATH)) {
    throw new Error(`Payload file not found at ${PAYLOAD_PATH}`);
  }

  try {
    return JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse payload JSON: ${error.message}`);
  }
}

function validatePayload(payload) {
  if (!payload?.pipeline?.pipeline_id) {
    throw new Error('Payload is missing pipeline.pipeline_id');
  }
  if (!Array.isArray(payload.jobs)) {
    throw new Error('Payload is missing jobs array');
  }
}

function sendWebhook(payload, attempt = 0) {
  const target = new URL(WEBHOOK_URL);
  const body = JSON.stringify(payload);
  const client = target.protocol === 'https:' ? https : http;

  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Webhook-Secret': process.env.WEBHOOK_SECRET || '',
      'X-Pipeline-ID': String(payload.pipeline.pipeline_id),
    },
  };

  console.log(`Sending payload to ${WEBHOOK_URL}`);
  console.log(`   Pipeline: ${payload.pipeline.pipeline_name}`);
  console.log(`   Status: ${payload.pipeline.status}`);
  console.log(`   Jobs: ${payload.jobs.length}`);

  const req = client.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Webhook sent successfully (HTTP ${res.statusCode})`);
        if (data) {
          console.log(`   Response: ${data}`);
        }
        process.exit(0);
        return;
      }

      console.error(`Webhook failed (HTTP ${res.statusCode}): ${data || 'No response body'}`);
      retryOrExit(payload, attempt);
    });
  });

  req.on('error', (error) => {
    console.error(`Request error: ${error.message}`);
    retryOrExit(payload, attempt);
  });

  req.write(body);
  req.end();
}

function retryOrExit(payload, attempt) {
  if (attempt < MAX_RETRIES) {
    const nextAttempt = attempt + 1;
    console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${nextAttempt}/${MAX_RETRIES})`);
    setTimeout(() => sendWebhook(payload, nextAttempt), RETRY_DELAY_MS);
    return;
  }

  console.error('Max retries reached. Giving up.');
  process.exit(1);
}

function main() {
  let payload;
  try {
    payload = readPayload();
    validatePayload(payload);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  sendWebhook(payload, 0);
}

main();
