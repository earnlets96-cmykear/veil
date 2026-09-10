import { describe, it, expect } from 'vitest';
import { hasWebmCues, makeWebmSeekableSync, makeWebmSeekable } from '../src/attachments/webmFix.ts';

// Helper to construct a minimal synthetic WebM binary buffer without Cues
function createSyntheticWebmBuffer(): Uint8Array {
  // EBML Header: ID 0x1A45DFA3, length 4, body [0x42, 0x86, 0x81, 0x01] (DocType 'webm')
  const ebmlHeader = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01,
  ]);

  // Segment Info: ID 0x1549A966, length 7, TimecodeScale 1,000,000ns (ID 0x2AD7B1, len 3, [0x0F, 0x42, 0x40])
  const info = new Uint8Array([
    0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
  ]);

  // Tracks: ID 0x1654AE6B, length 5, TrackEntry with TrackNumber 1
  const tracks = new Uint8Array([
    0x16, 0x54, 0xae, 0x6b, 0x85, 0xae, 0x83, 0xd7, 0x81, 0x01,
  ]);

  // Cluster 1: ID 0x1F43B675, len 7, Timecode 0ms (ID 0xE7, len 1, 0x00), SimpleBlock 4 bytes
  const cluster1 = new Uint8Array([
    0x1f, 0x43, 0xb6, 0x75, 0x87, 0xe7, 0x81, 0x00, 0xa3, 0x82, 0x81, 0x00,
  ]);

  // Cluster 2: ID 0x1F43B675, len 8, Timecode 1000ms (ID 0xE7, len 2, 0x03, 0xE8), SimpleBlock 4 bytes
  const cluster2 = new Uint8Array([
    0x1f, 0x43, 0xb6, 0x75, 0x88, 0xe7, 0x82, 0x03, 0xe8, 0xa3, 0x82, 0x81, 0x00,
  ]);

  // Segment payload
  const segmentPayload = new Uint8Array(info.length + tracks.length + cluster1.length + cluster2.length);
  let pos = 0;
  segmentPayload.set(info, pos); pos += info.length;
  segmentPayload.set(tracks, pos); pos += tracks.length;
  segmentPayload.set(cluster1, pos); pos += cluster1.length;
  segmentPayload.set(cluster2, pos);

  // Segment: ID 0x18538067, unknown size 0x01FFFFFFFFFFFFFF
  const segmentHeader = new Uint8Array([
    0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  ]);

  const full = new Uint8Array(ebmlHeader.length + segmentHeader.length + segmentPayload.length);
  full.set(ebmlHeader, 0);
  full.set(segmentHeader, ebmlHeader.length);
  full.set(segmentPayload, ebmlHeader.length + segmentHeader.length);
  return full;
}

describe('Phase 76: WebM Seekability and Cues Indexer', () => {
  it('correctly detects absence of Cues in raw streaming WebM', () => {
    const rawWebm = createSyntheticWebmBuffer();
    expect(hasWebmCues(rawWebm)).toBe(false);
  });

  it('injects Duration, TimecodeScale, SeekHead, and Cues table into WebM buffer', () => {
    const rawWebm = createSyntheticWebmBuffer();
    const seekableWebm = makeWebmSeekableSync(rawWebm, 2500);

    // 1. Must now report hasWebmCues === true
    expect(hasWebmCues(seekableWebm)).toBe(true);

    // 2. The output buffer should be larger due to injected SeekHead and Cues
    expect(seekableWebm.length).toBeGreaterThan(rawWebm.length);

    // 3. Must contain Cues element ID (0x1C53BB6B)
    let hasCuesId = false;
    for (let i = 0; i < seekableWebm.length - 4; i++) {
      if (
        seekableWebm[i] === 0x1c &&
        seekableWebm[i + 1] === 0x53 &&
        seekableWebm[i + 2] === 0xbb &&
        seekableWebm[i + 3] === 0x6b
      ) {
        hasCuesId = true;
        break;
      }
    }
    expect(hasCuesId).toBe(true);

    // 4. Must contain Duration element ID (0x4489)
    let hasDurationId = false;
    for (let i = 0; i < seekableWebm.length - 2; i++) {
      if (seekableWebm[i] === 0x44 && seekableWebm[i + 1] === 0x89) {
        hasDurationId = true;
        break;
      }
    }
    expect(hasDurationId).toBe(true);

    // 5. Must contain SeekHead element ID (0x114D9B74)
    let hasSeekHeadId = false;
    for (let i = 0; i < seekableWebm.length - 4; i++) {
      if (
        seekableWebm[i] === 0x11 &&
        seekableWebm[i + 1] === 0x4d &&
        seekableWebm[i + 2] === 0x9b &&
        seekableWebm[i + 3] === 0x74
      ) {
        hasSeekHeadId = true;
        break;
      }
    }
    expect(hasSeekHeadId).toBe(true);
  });

  it('asynchronous makeWebmSeekable works with Blob input', async () => {
    const rawWebm = createSyntheticWebmBuffer();
    const blob = new Blob([rawWebm], { type: 'audio/webm' });
    const fixedBlob = await makeWebmSeekable(blob, 3000);
    const fixedArray = new Uint8Array(await fixedBlob.arrayBuffer());

    expect(hasWebmCues(fixedArray)).toBe(true);
    expect(fixedBlob.type).toBe('audio/webm');
  });

  it('gracefully handles non-WebM or corrupted buffers without throwing', () => {
    const invalidBuf = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = makeWebmSeekableSync(invalidBuf);
    expect(result).toBe(invalidBuf);
  });
});
