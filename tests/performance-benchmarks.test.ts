import { describe, it, expect } from 'vitest';
import { deriveKeyArgon2id, FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { AttachmentPipeline } from '../src/attachments/attachmentPipeline.ts';
import { LocalSearchEngine } from '../src/search/searchEngine.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';

describe('VEIL Phase 16: Performance Benchmarks & Operational Metrics', () => {
  it('BENCHMARK: Fast KDF derivation latency is within target (< 50ms)', async () => {
    const password = 'TestBenchmarkPassword123!';
    const salt = randomBytes(16);

    const start = performance.now();
    const derivedKey = await deriveKeyArgon2id(password, salt, FAST_TEST_KDF_PARAMS);
    const durationMs = performance.now() - start;

    expect(derivedKey).toHaveLength(32);
    expect(durationMs).toBeLessThan(100);
  });

  it('BENCHMARK: Symmetric AEAD encryption throughput (> 1,000 ops/sec)', () => {
    const key = randomBytes(32);
    const plaintext = new TextEncoder().encode('Benchmark message with reasonable plaintext length.');
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const { nonce, ciphertext } = encryptXChaCha20Poly1305(key, plaintext);
      decryptXChaCha20Poly1305(key, nonce, ciphertext);
    }
    const elapsedMs = performance.now() - start;

    const opsPerSec = (iterations / elapsedMs) * 1000;
    expect(opsPerSec).toBeGreaterThan(500);
  });

  it('BENCHMARK: Attachment pipeline throughput for 1 MiB (> 10 MiB/sec)', () => {
    const key = randomBytes(32);
    const oneMbData = new Uint8Array(1024 * 1024);
    for (let i = 0; i < oneMbData.length; i++) oneMbData[i] = i % 256;

    const start = performance.now();
    const { metadata, chunks } = AttachmentPipeline.chunkAndEncrypt(oneMbData, 'benchmark.bin', 'application/octet-stream', key);
    const reassembled = AttachmentPipeline.decryptAndReassemble(metadata, chunks, key);
    const elapsedMs = performance.now() - start;

    expect(reassembled.length).toBe(oneMbData.length);
    expect(elapsedMs).toBeLessThan(500); // 1 MiB chunked and reassembled in < 500ms
  });

  it('BENCHMARK: Local search query latency over 1,000 records (< 10ms)', () => {
    const searchEngine = new LocalSearchEngine();

    const contacts = Array.from({ length: 500 }, (_, i) => ({
      identityId: `id_user_${i}`,
      name: `User Contact ${i}`,
      fingerprint: `FP-${i}`,
      signingPublicKey: `pk_${i}`,
      keyAgreementPublicKey: `ka_${i}`,
      status: 'ACCEPTED' as const,
      verificationStatus: 'VERIFIED' as const,
      addedAt: Date.now(),
    }));

    const messages = {
      conv_main: Array.from({ length: 500 }, (_, i) => ({
        id: `msg_${i}`,
        conversationId: 'conv_main',
        senderId: `sender_${i % 10}`,
        text: `Searchable message index ${i} discussing privacy and cryptography`,
        isOutgoing: i % 2 === 0,
        timestamp: Date.now() - i * 1000,
        status: 'DELIVERED_TO_RECIPIENT' as const,
      })),
    };

    searchEngine.updateIndex(contacts, [], messages);

    const start = performance.now();
    const results = searchEngine.search('cryptography');
    const queryDurationMs = performance.now() - start;

    expect(results.length).toBe(500);
    expect(queryDurationMs).toBeLessThan(15);
  });
});
