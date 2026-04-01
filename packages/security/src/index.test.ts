import { describe, expect, it } from 'vitest';
import { decryptAes256Gcm, encryptAes256Gcm, hashSessionToken } from './index.js';

describe('@life-os/security', () => {
  it('has stable session hash', () => {
    expect(hashSessionToken('a')).toBe(hashSessionToken('a'));
    expect(hashSessionToken('a')).not.toBe(hashSessionToken('b'));
  });

  it('roundtrips AES-GCM', () => {
    const key = Buffer.alloc(32, 7);
    const msg = '{"hello":true}';
    const enc = encryptAes256Gcm(msg, key);
    expect(decryptAes256Gcm(enc, key)).toBe(msg);
  });
});
