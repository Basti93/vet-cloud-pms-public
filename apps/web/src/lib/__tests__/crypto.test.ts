import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret } from '../crypto';

describe('crypto helpers', () => {
  const validKey = '0000000000000000000000000000000000000000000000000000000000000000';

  beforeEach(() => {
    process.env.SMTP_CREDENTIAL_KEY = validKey;
  });

  afterEach(() => {
    delete process.env.SMTP_CREDENTIAL_KEY;
  });

  it('round-trips a secret', () => {
    const plaintext = 'super-secret-password!@#$%';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
  });

  it('stores as iv:ciphertext:tag format', () => {
    const encrypted = encryptSecret('test');
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('throws when SMTP_CREDENTIAL_KEY is missing', () => {
    delete process.env.SMTP_CREDENTIAL_KEY;
    expect(() => encryptSecret('x')).toThrow('SMTP_CREDENTIAL_KEY');
    expect(() => decryptSecret('a:b:c')).toThrow('SMTP_CREDENTIAL_KEY');
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptSecret('original');
    const [iv, , tag] = encrypted.split(':');
    // replace ciphertext with all-zeros of same length
    const tampered = `${iv}:AAAAAAAAAAAAAAAAAAAAAA==:${tag}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
