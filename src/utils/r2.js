const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

async function uploadToR2(file, folder = 'uploads') {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `${PUBLIC_URL}/${key}`;
}

async function deleteFromR2(url) {
  if (!url || !PUBLIC_URL) return;
  if (!url.startsWith(PUBLIC_URL)) {
    console.warn('[R2] Skipping delete — URL does not match PUBLIC_URL:', url);
    return;
  }
  const key = url.replace(`${PUBLIC_URL}/`, '');
  console.log('[R2] Deleting key:', key);
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadToR2, deleteFromR2 };
