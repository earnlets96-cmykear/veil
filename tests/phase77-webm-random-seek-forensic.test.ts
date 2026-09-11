import { describe, it, expect, vi } from 'vitest';
import {
  hasWebmCues,
  hasValidWebmIndex,
  makeWebmSeekableSync,
  makeWebmSeekable,
} from '../src/attachments/webmFix.ts';
import { VoicePlaybackManager } from '../src/attachments/voicePlayer.ts';
import { NativeMediaBridge } from '../src/media/NativeMediaBridge.ts';

// Helper to construct a multi-cluster synthetic WebM binary buffer
function createMultiClusterWebm(numClusters: number = 20, clusterPayloadSize: number = 32): Uint8Array {
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

  // Generate N clusters, each with timecode = index * 500ms
  const clusters: Uint8Array[] = [];
  for (let i = 0; i < numClusters; i++) {
    const timeMs = i * 500;
    // Timecode element: 0xE7
    let tcBytes: number[];
    if (timeMs === 0) {
      tcBytes = [0xe7, 0x81, 0x00];
    } else if (timeMs < 256) {
      tcBytes = [0xe7, 0x81, timeMs];
    } else {
      tcBytes = [0xe7, 0x82, (timeMs >> 8) & 0xff, timeMs & 0xff];
    }

    const payload = new Uint8Array(clusterPayloadSize);
    payload.fill(0x55);
    const clusterBodyLen = tcBytes.length + payload.length;

    // Cluster ID 0x1F43B675 + vint length + tcBytes + payload
    const cluster = new Uint8Array(4 + 1 + clusterBodyLen);
    cluster[0] = 0x1f;
    cluster[1] = 0x43;
    cluster[2] = 0xb6;
    cluster[3] = 0x75;
    cluster[4] = 0x80 | clusterBodyLen;
    cluster.set(tcBytes, 5);
    cluster.set(payload, 5 + tcBytes.length);
    clusters.push(cluster);
  }

  const clustersTotalLen = clusters.reduce((acc, c) => acc + c.length, 0);
  const segmentPayload = new Uint8Array(info.length + tracks.length + clustersTotalLen);
  let pos = 0;
  segmentPayload.set(info, pos); pos += info.length;
  segmentPayload.set(tracks, pos); pos += tracks.length;
  for (const cl of clusters) {
    segmentPayload.set(cl, pos);
    pos += cl.length;
  }

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

// Minimal EBML parser helpers for test assertions
function parseElementId(buf: Uint8Array, offset: number): { id: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  if (firstByte === 0) return null;
  let mask = 0x80;
  let length = 1;
  while ((firstByte & mask) === 0 && length <= 4) {
    mask >>= 1;
    length++;
  }
  if (offset + length > buf.length) return null;
  let id = 0;
  for (let i = 0; i < length; i++) id = (id << 8) | buf[offset + i];
  return { id: id >>> 0, length };
}

function parseVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  if (firstByte === 0) return null;
  let mask = 0x80;
  let length = 1;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }
  if (offset + length > buf.length) return null;
  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) value = value * 256 + buf[offset + i];
  return { value, length };
}

describe('Phase 77: EBML Zero-Error Seek Forensic & Alignment Suite', () => {
  it('accurately identifies raw WebM, corrupt WebM, and validly indexed WebM via hasValidWebmIndex', () => {
    const raw = createMultiClusterWebm(5);
    expect(hasWebmCues(raw)).toBe(false);
    expect(hasValidWebmIndex(raw)).toBe(false);

    // Fix index
    const fixed = makeWebmSeekableSync(raw, 2500);
    expect(hasValidWebmIndex(fixed)).toBe(true);

    // Corrupt the Cues pointer inside SeekHead by +5 bytes
    const corrupted = new Uint8Array(fixed);
    for (let i = 0; i < corrupted.length - 8; i++) {
      if (
        corrupted[i] === 0x1c &&
        corrupted[i + 1] === 0x53 &&
        corrupted[i + 2] === 0xbb &&
        corrupted[i + 3] === 0x6b
      ) {
        // Find 0x53AC (ID_SEEK_POSITION) right after
        for (let j = i + 4; j < i + 12; j++) {
          if (corrupted[j] === 0x53 && corrupted[j + 1] === 0xac) {
            const valLen = corrupted[j + 2] & 0x7f;
            corrupted[j + 2 + valLen] += 5; // corrupt Cues pointer!
            break;
          }
        }
        break;
      }
    }
    // Now hasValidWebmIndex MUST strictly reject it!
    expect(hasValidWebmIndex(corrupted)).toBe(false);
  });

  it('guarantees 0-byte drift for all cluster offsets across 1, 5, 20, and 50 clusters', () => {
    for (const clusterCount of [1, 5, 20, 50]) {
      const raw = createMultiClusterWebm(clusterCount);
      const fixed = makeWebmSeekableSync(raw, clusterCount * 500);

      expect(hasValidWebmIndex(fixed)).toBe(true);

      // Locate Segment Data start (after 0x18538067 + vint)
      let segmentDataStart = -1;
      for (let i = 0; i < fixed.length - 12; i++) {
        if (
          fixed[i] === 0x18 &&
          fixed[i + 1] === 0x53 &&
          fixed[i + 2] === 0x80 &&
          fixed[i + 3] === 0x67
        ) {
          const firstByte = fixed[i + 4];
          let mask = 0x80;
          let vLen = 1;
          while (vLen <= 8 && !(firstByte & mask)) {
            mask >>= 1;
            vLen++;
          }
          segmentDataStart = i + 4 + vLen;
          break;
        }
      }
      expect(segmentDataStart).toBeGreaterThan(0);

      // Locate Cues element strictly within Segment children
      let off = segmentDataStart;
      let cuesPayloadOffset = -1;
      let cuesPayloadLen = -1;
      while (off < fixed.length) {
        const elId = parseElementId(fixed, off);
        if (!elId) break;
        const elLen = parseVint(fixed, off + elId.length);
        if (!elLen) break;
        const headerLen = elId.length + elLen.length;
        if (elId.id === 0x1c53bb6b) { // ID_CUES
          cuesPayloadOffset = off + headerLen;
          cuesPayloadLen = elLen.value;
          break;
        }
        off += headerLen + elLen.value;
      }
      expect(cuesPayloadOffset).toBeGreaterThan(0);

      // Parse every CuePoint in Cues
      let foundCuePositions = 0;
      let cpOffset = cuesPayloadOffset;
      const cuesEnd = cuesPayloadOffset + cuesPayloadLen;
      while (cpOffset < cuesEnd) {
        const cpId = parseElementId(fixed, cpOffset);
        if (!cpId || cpId.id !== 0xbb) break; // ID_CUE_POINT
        const cpLen = parseVint(fixed, cpOffset + cpId.length);
        if (!cpLen) break;
        const cpPayload = fixed.subarray(cpOffset + cpId.length + cpLen.length, cpOffset + cpId.length + cpLen.length + cpLen.value);

        let cueClusterPos = -1;
        let subOff = 0;
        while (subOff < cpPayload.length) {
          const subId = parseElementId(cpPayload, subOff);
          if (!subId) break;
          const subLen = parseVint(cpPayload, subOff + subId.length);
          if (!subLen) break;
          if (subId.id === 0xb7) { // ID_CUE_TRACK_POSITIONS
            const ctpPayload = cpPayload.subarray(subOff + subId.length + subLen.length, subOff + subId.length + subLen.length + subLen.value);
            let ctpOff = 0;
            while (ctpOff < ctpPayload.length) {
              const elId = parseElementId(ctpPayload, ctpOff);
              if (!elId) break;
              const elLen = parseVint(ctpPayload, ctpOff + elId.length);
              if (!elLen) break;
              if (elId.id === 0xf1) { // ID_CUE_CLUSTER_POSITION
                const valBytes = ctpPayload.subarray(ctpOff + elId.length + elLen.length, ctpOff + elId.length + elLen.length + elLen.value);
                let p = 0;
                for (const b of valBytes) p = (p * 256) + b;
                cueClusterPos = p;
                break;
              }
              ctpOff += elId.length + elLen.length + elLen.value;
            }
          }
          subOff += subId.length + subLen.length + subLen.value;
        }

        expect(cueClusterPos).toBeGreaterThanOrEqual(0);
        // Compute absolute file offset
        const absoluteOffset = segmentDataStart + cueClusterPos;
        expect(absoluteOffset).toBeLessThan(fixed.length);

        // VERIFY EXACT 4-BYTE CLUSTER ID: [0x1F, 0x43, 0xB6, 0x75]
        expect(fixed[absoluteOffset]).toBe(0x1f);
        expect(fixed[absoluteOffset + 1]).toBe(0x43);
        expect(fixed[absoluteOffset + 2]).toBe(0xb6);
        expect(fixed[absoluteOffset + 3]).toBe(0x75);

        foundCuePositions++;
        cpOffset += cpId.length + cpLen.length + cpLen.value;
      }

      expect(foundCuePositions).toBe(clusterCount);
    }
  });

  it('verifies simulated ExoPlayer HTTP Range requests for 50 random seek targets always hit Cluster ID', () => {
    const clusterCount = 30;
    const durationMs = clusterCount * 500;
    const raw = createMultiClusterWebm(clusterCount);
    const fixed = makeWebmSeekableSync(raw, durationMs);

    // Locate Segment Data start
    let segmentDataStart = -1;
    for (let i = 0; i < fixed.length - 12; i++) {
      if (
        fixed[i] === 0x18 &&
        fixed[i + 1] === 0x53 &&
        fixed[i + 2] === 0x80 &&
        fixed[i + 3] === 0x67
      ) {
        const firstByte = fixed[i + 4];
        let mask = 0x80;
        let vLen = 1;
        while (vLen <= 8 && !(firstByte & mask)) {
          mask >>= 1;
          vLen++;
        }
        segmentDataStart = i + 4 + vLen;
        break;
      }
    }

    // Locate Cues
    let off = segmentDataStart;
    let cuesPayloadOffset = -1;
    let cuesPayloadLen = -1;
    while (off < fixed.length) {
      const elId = parseElementId(fixed, off);
      if (!elId) break;
      const elLen = parseVint(fixed, off + elId.length);
      if (!elLen) break;
      const headerLen = elId.length + elLen.length;
      if (elId.id === 0x1c53bb6b) {
        cuesPayloadOffset = off + headerLen;
        cuesPayloadLen = elLen.value;
        break;
      }
      off += headerLen + elLen.value;
    }

    // Parse Cues index table into [{ timeMs, clusterPos }]
    const cueEntries: { timeMs: number; clusterPos: number }[] = [];
    let cpOffset = cuesPayloadOffset;
    const cuesEnd = cuesPayloadOffset + cuesPayloadLen;
    while (cpOffset < cuesEnd) {
      const cpId = parseElementId(fixed, cpOffset);
      if (!cpId || cpId.id !== 0xbb) break;
      const cpLen = parseVint(fixed, cpOffset + cpId.length);
      if (!cpLen) break;
      const cpPayload = fixed.subarray(cpOffset + cpId.length + cpLen.length, cpOffset + cpId.length + cpLen.length + cpLen.value);

      let cueTime = -1;
      let cueClusterPos = -1;
      let subOff = 0;
      while (subOff < cpPayload.length) {
        const subId = parseElementId(cpPayload, subOff);
        if (!subId) break;
        const subLen = parseVint(cpPayload, subOff + subId.length);
        if (!subLen) break;
        if (subId.id === 0xb3) { // CueTime
          const valBytes = cpPayload.subarray(subOff + subId.length + subLen.length, subOff + subId.length + subLen.length + subLen.value);
          let t = 0;
          for (const b of valBytes) t = (t * 256) + b;
          cueTime = t;
        } else if (subId.id === 0xb7) { // CueTrackPositions
          const ctpPayload = cpPayload.subarray(subOff + subId.length + subLen.length, subOff + subId.length + subLen.length + subLen.value);
          let ctpOff = 0;
          while (ctpOff < ctpPayload.length) {
            const elId = parseElementId(ctpPayload, ctpOff);
            if (!elId) break;
            const elLen = parseVint(ctpPayload, ctpOff + elId.length);
            if (!elLen) break;
            if (elId.id === 0xf1) {
              const valBytes = ctpPayload.subarray(ctpOff + elId.length + elLen.length, ctpOff + elId.length + elLen.length + elLen.value);
              let p = 0;
              for (const b of valBytes) p = (p * 256) + b;
              cueClusterPos = p;
              break;
            }
            ctpOff += elId.length + elLen.length + elLen.value;
          }
        }
        subOff += subId.length + subLen.length + subLen.value;
      }

      if (cueTime >= 0 && cueClusterPos >= 0) {
        cueEntries.push({ timeMs: cueTime, clusterPos: cueClusterPos });
      }
      cpOffset += cpId.length + cpLen.length + cpLen.value;
    }

    expect(cueEntries.length).toBe(clusterCount);

    // Simulate 50 random seeks
    for (let s = 0; s < 50; s++) {
      const seekPercent = Math.random() * 100;
      const targetTimeMs = (seekPercent / 100) * durationMs;

      // ExoPlayer binary search for largest cue time <= targetTimeMs
      let bestEntry = cueEntries[0];
      for (const entry of cueEntries) {
        if (entry.timeMs <= targetTimeMs) {
          bestEntry = entry;
        } else {
          break;
        }
      }

      // ExoPlayer Range request offset: segmentDataStart + bestEntry.clusterPos
      const streamStartOffset = segmentDataStart + bestEntry.clusterPos;

      // Verify that ExoPlayer begins parsing at 0x1F43B675 without throwing MatroskaExtractor ParserException!
      const first4Bytes = [
        fixed[streamStartOffset],
        fixed[streamStartOffset + 1],
        fixed[streamStartOffset + 2],
        fixed[streamStartOffset + 3],
      ];
      expect(first4Bytes).toEqual([0x1f, 0x43, 0xb6, 0x75]);
    }
  });

  it('re-indexes already-indexed WebM idempotently without duplicating SeekHead or Cues', () => {
    const raw = createMultiClusterWebm(8);
    const fixedOnce = makeWebmSeekableSync(raw, 4000);
    expect(hasValidWebmIndex(fixedOnce)).toBe(true);

    // Re-index the already fixed WebM
    const fixedTwice = makeWebmSeekableSync(fixedOnce, 4000);
    expect(hasValidWebmIndex(fixedTwice)).toBe(true);

    // Locate Segment start
    let segmentDataStart = -1;
    for (let i = 0; i < fixedTwice.length - 12; i++) {
      if (
        fixedTwice[i] === 0x18 &&
        fixedTwice[i + 1] === 0x53 &&
        fixedTwice[i + 2] === 0x80 &&
        fixedTwice[i + 3] === 0x67
      ) {
        const firstByte = fixedTwice[i + 4];
        let mask = 0x80;
        let vLen = 1;
        while (vLen <= 8 && !(firstByte & mask)) {
          mask >>= 1;
          vLen++;
        }
        segmentDataStart = i + 4 + vLen;
        break;
      }
    }

    // Inspect Segment children
    let off = segmentDataStart;
    let seekHeadCount = 0;
    let infoCount = 0;
    let tracksCount = 0;
    let cuesCount = 0;

    while (off < fixedTwice.length) {
      const elId = parseElementId(fixedTwice, off);
      if (!elId) break;
      const elLen = parseVint(fixedTwice, off + elId.length);
      if (!elLen) break;

      if (elId.id === 0x114d9b74) seekHeadCount++;
      else if (elId.id === 0x1549a966) infoCount++;
      else if (elId.id === 0x1654ae6b) tracksCount++;
      else if (elId.id === 0x1c53bb6b) cuesCount++;

      const isUnknownLength = elLen.value === 0x01ffffffffffffff;
      if (isUnknownLength) break;
      off += elId.length + elLen.length + elLen.value;
    }

    expect(seekHeadCount).toBe(1);
    expect(infoCount).toBe(1);
    expect(tracksCount).toBe(1);
    expect(cuesCount).toBe(1);
  });

  it('handles async makeWebmSeekable through Blob interface with perfect fidelity', async () => {
    const raw = createMultiClusterWebm(6);
    const rawBlob = new Blob([raw], { type: 'audio/webm;codecs=opus' });
    const fixedBlob = await makeWebmSeekable(rawBlob, 3000);

    const buffer = new Uint8Array(await fixedBlob.arrayBuffer());
    expect(hasValidWebmIndex(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(raw.length);
  });

  it('transparently recovers playback via Web Audio fallback when native player reports an error', async () => {
    const manager = new VoicePlaybackManager();
    const bridge = NativeMediaBridge.getInstance();

    (manager as any).isNative = true;

    const mockSession = {} as any;
    const mockCloudClient = {
      getBaseUrl: () => 'http://localhost:8080',
      getSessionToken: () => 'test-token',
    } as any;
    const mockMeta = {
      objectId: 'obj-forensic-test',
      durationSeconds: 15,
      mimeType: 'audio/webm;codecs=opus',
    };
    const messageId = 'msg-forensic-99';

    // Capture error handler when setupNativeBridge attaches it
    let registeredErrorHandler: ((e: any) => Promise<void>) | null = null;
    vi.spyOn(bridge, 'onError').mockImplementation(async (cb: any) => {
      registeredErrorHandler = cb;
      return null;
    });

    vi.spyOn(bridge, 'playAudio').mockResolvedValue(true);
    const stopAudioSpy = vi.spyOn(bridge, 'stopAudio').mockResolvedValue(true);

    // Call playVoiceNote
    await manager.playVoiceNote(mockSession, mockCloudClient, mockMeta, messageId);
    expect(manager.isPlaying(messageId)).toBe(true);
    expect(registeredErrorHandler).toBeDefined();

    // Spy on web audio fallback path
    let fallbackCalled = false;
    const originalPlayVoiceNote = manager.playVoiceNote.bind(manager);
    manager.playVoiceNote = async (...args) => {
      fallbackCalled = true;
      return originalPlayVoiceNote(...args);
    };

    // Trigger native error (e.g. ExoPlayer TYPE_SOURCE)
    await registeredErrorHandler!({ message: 'PlaybackException: Source error (ParserException)' });

    // Verify fallback executed
    expect(stopAudioSpy).toHaveBeenCalled();
    expect(fallbackCalled).toBe(true);
  });
});
