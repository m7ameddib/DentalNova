/**
 * Live Cloudflare R2 integration test for bucket dentalnova-files.
 * Never prints secret values. Exits 0 with SKIP when credentials are absent.
 *
 * Required:
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_ACCOUNT_ID  (or R2_ENDPOINT)
 *
 * Optional:
 *   R2_BUCKET   (default dentalnova-files)
 *   R2_ENDPOINT (default https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com)
 *   R2_REGION   (default auto)
 *   R2_PREFIX
 */
const REQUIRED = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

function missingEnv() {
  const missing = [];
  for (const name of REQUIRED) {
    if (!String(process.env[name] || '').trim()) missing.push(name);
  }
  if (!String(process.env.R2_ACCOUNT_ID || '').trim() && !String(process.env.R2_ENDPOINT || '').trim()) {
    missing.push('R2_ACCOUNT_ID or R2_ENDPOINT');
  }
  return missing;
}

async function main() {
  const missing = missingEnv();
  if (missing.length) {
    console.log('SKIP: live R2 test — credentials not available in this environment.');
    console.log('Required env vars:');
    console.log('  R2_ACCESS_KEY_ID');
    console.log('  R2_SECRET_ACCESS_KEY');
    console.log('  R2_ACCOUNT_ID  (or R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com)');
    console.log('Optional:');
    console.log('  R2_BUCKET   (default dentalnova-files)');
    console.log('  R2_REGION   (default auto)');
    console.log('  R2_PREFIX');
    console.log(`Missing: ${missing.join(', ')}`);
    return;
  }

  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const endpoint =
    String(process.env.R2_ENDPOINT || '').trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  const bucket = String(process.env.R2_BUCKET || 'dentalnova-files').trim();
  const prefix = String(process.env.R2_PREFIX || '').replace(/\/+$/, '');
  const client = new S3Client({
    region: String(process.env.R2_REGION || 'auto').trim() || 'auto',
    endpoint,
    credentials: {
      accessKeyId: String(process.env.R2_ACCESS_KEY_ID).trim(),
      secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY).trim(),
    },
    forcePathStyle: true,
  });

  const stamp = Date.now();
  const keyA = `${prefix ? `${prefix}/` : ''}clinic-a/r2-live-${stamp}.txt`;
  const keyB = `${prefix ? `${prefix}/` : ''}clinic-b/r2-live-${stamp}.txt`;
  const bodyA = Buffer.from(`clinic-a-${stamp}`);
  const bodyB = Buffer.from(`clinic-b-${stamp}`);

  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: keyA, Body: bodyA, ContentType: 'text/plain' }));
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: keyB, Body: bodyB, ContentType: 'text/plain' }));

    const gotA = await client.send(new GetObjectCommand({ Bucket: bucket, Key: keyA }));
    const bytesA = Buffer.from(await gotA.Body.transformToByteArray());
    if (bytesA.toString() !== bodyA.toString()) throw new Error('GET clinic-a payload mismatch');

    const gotB = await client.send(new GetObjectCommand({ Bucket: bucket, Key: keyB }));
    const bytesB = Buffer.from(await gotB.Body.transformToByteArray());
    if (bytesB.toString() !== bodyB.toString()) throw new Error('GET clinic-b payload mismatch');
    if (bytesA.equals(bytesB)) throw new Error('clinic isolation failed: payloads collided');

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyA }));
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyB }));
    console.log(`PASS: live R2 put/get/delete + tenant key isolation on bucket ${bucket}`);
  } catch (err) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyA }));
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyB }));
    } catch {
      /* ignore cleanup */
    }
    throw err;
  }
}

main().catch((err) => {
  console.error('FAIL: live R2', err.message);
  process.exit(1);
});
