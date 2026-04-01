import crypto from 'node:crypto';

/** SHA-256 hex digest for session token storage (never store raw tokens). */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** Random URL-safe token for session issuance. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

const IV_LEN = 12;
const TAG_LEN = 16;

/** AES-256-GCM envelope for dev / Sprint 01 encrypted exports. Key must be 32 bytes. */
export function encryptAes256Gcm(plaintext: string, key32: Buffer): string {
  if (key32.length !== 32) throw new Error('encryptAes256Gcm: key must be 32 bytes');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key32, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptAes256Gcm(blobBase64: string, key32: Buffer): string {
  if (key32.length !== 32) throw new Error('decryptAes256Gcm: key must be 32 bytes');
  const buf = Buffer.from(blobBase64, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key32, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

/** Derive 32-byte key from env `LIFE_OS_EXPORT_ENCRYPTION_KEY` (hex 64 chars) or dev-only fallback. */
export function resolveExportEncryptionKey(): Buffer {
  const hex = process.env.LIFE_OS_EXPORT_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LIFE_OS_EXPORT_ENCRYPTION_KEY must be set (64 hex chars) in production');
  }
  return crypto.createHash('sha256').update('life-os-dev-export-key-v1', 'utf8').digest();
}
