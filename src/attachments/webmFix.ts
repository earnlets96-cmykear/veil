/**
 * WebM Seekability & Duration Metadata Injector for VEIL.
 *
 * Chromium-based browsers (Desktop Chrome, Android WebView) record WebM audio
 * using MediaRecorder in "live streaming" mode, omitting the essential EBML
 * Duration element and Cues (seek index table).
 *
 * This causes two catastrophic playback failures:
 * 1. Android ExoPlayer (MatroskaExtractor) treats the stream as unseekable.
 *    Any seekTo() command fails and resets playback position to 0ms.
 * 2. Web HTMLAudioElement sets duration = Infinity. Seeking is rejected or
 *    resets to 0.
 *
 * This module parses the WebM container, extracts all Cluster timestamps and byte
 * offsets, injects Duration and TimecodeScale into Info, creates an indexed Cues
 * table, and prepends a SeekHead so both ExoPlayer and HTML5 Audio can seek
 * accurately to any millisecond.
 */

// Canonical EBML element identifiers (RFC 8794 / Matroska Spec)
const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_SEEKHEAD = 0x114d9b74;
const ID_SEEK = 0x4dbb;
const ID_SEEK_ID = 0x53ab;
const ID_SEEK_POSITION = 0x53ac;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_TRACKS = 0x1654ae6b;
const ID_CUES = 0x1c53bb6b;
const ID_CUE_POINT = 0xbb;
const ID_CUE_TIME = 0xb3;
const ID_CUE_TRACK_POSITIONS = 0xb7;
const ID_CUE_TRACK = 0xf7;
const ID_CUE_CLUSTER_POSITION = 0xf1;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMECODE = 0xe7;

interface ClusterEntry {
  timecodeMs: number;
  offset: number; // Offset relative to segment content start
}

/**
 * Reads a Variable-size Integer (VINT) from a buffer starting at offset.
 * Returns { value, length } where value is the decoded integer (marker bit stripped).
 */
function readVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  if (firstByte === 0) return null; // Vint must have at least one leading bit set

  let mask = 0x80;
  let length = 1;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }

  if (offset + length > buf.length) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = value * 256 + buf[offset + i];
  }

  return { value, length };
}

/**
 * Reads an EBML element ID (VINT with marker bit PRESERVED).
 */
function readElementId(buf: Uint8Array, offset: number): { id: number; length: number } | null {
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
  for (let i = 0; i < length; i++) {
    id = (id << 8) | buf[offset + i];
  }

  return { id: id >>> 0, length };
}

/**
 * Writes an integer as an EBML VINT.
 */
function encodeVint(val: number): Uint8Array {
  if (val < 0) throw new Error('VINT cannot be negative');
  let length = 1;
  let max = 127;
  while (val >= max && length < 8) {
    length++;
    max = (max << 7) | 127;
  }

  const out = new Uint8Array(length);
  let v = val;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  // Set the marker bit on the first byte
  out[0] |= 1 << (8 - length);
  return out;
}

/**
 * Encodes an element ID as raw bytes.
 */
function encodeId(id: number): Uint8Array {
  let len = 4;
  if ((id & 0xffffff00) === 0) len = 1;
  else if ((id & 0xffff0000) === 0) len = 2;
  else if ((id & 0xff000000) === 0) len = 3;

  const bytes = new Uint8Array(len);
  for (let i = len - 1; i >= 0; i--) {
    bytes[i] = id & 0xff;
    id >>>= 8;
  }
  return bytes;
}

/**
 * Wraps payload with EBML ID and length VINT.
 */
function wrapElement(id: number, payload: Uint8Array): Uint8Array {
  const idBytes = encodeId(id);
  const lenBytes = encodeVint(payload.length);
  const result = new Uint8Array(idBytes.length + lenBytes.length + payload.length);
  result.set(idBytes, 0);
  result.set(lenBytes, idBytes.length);
  result.set(payload, idBytes.length + lenBytes.length);
  return result;
}

/**
 * Encodes a number as a Big-Endian unsigned integer.
 */
function encodeUInt(val: number): Uint8Array {
  let v = Math.floor(val);
  const bytes: number[] = [];
  do {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  } while (v > 0);
  return new Uint8Array(bytes);
}

/**
 * Encodes a 64-bit IEEE 754 float in Big-Endian format.
 */
function encodeFloat64(val: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, val, false); // big-endian
  return new Uint8Array(buf);
}

/**
 * Concatenates multiple Uint8Arrays.
 */
function concatBuffers(arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const a of arrays) totalLength += a.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Scans a WebM buffer and strictly verifies if it contains an authoritative,
 * seekable Cues index and valid SeekHead pointers.
 *
 * Checks that:
 * 1. An EBML Header and Segment are present.
 * 2. SeekHead exists and its Cues pointer lands precisely on ID_CUES (0x1C53BB6B).
 * 3. Cues exists and its first CueClusterPosition lands precisely on ID_CLUSTER (0x1F43B675).
 */
export function hasValidWebmIndex(buffer: Uint8Array): boolean {
  if (buffer.length < 64) return false;
  const ebmlId = readElementId(buffer, 0);
  if (!ebmlId || ebmlId.id !== ID_EBML) return false;
  const ebmlLen = readVint(buffer, ebmlId.length);
  if (!ebmlLen) return false;
  const ebmlTotal = ebmlId.length + ebmlLen.length + ebmlLen.value;
  if (ebmlTotal >= buffer.length) return false;

  const segId = readElementId(buffer, ebmlTotal);
  if (!segId || segId.id !== ID_SEGMENT) return false;
  const segLen = readVint(buffer, ebmlTotal + segId.length);
  if (!segLen) return false;
  const segStart = ebmlTotal + segId.length + segLen.length;

  // Read first child inside Segment: must be SeekHead
  const shId = readElementId(buffer, segStart);
  if (!shId || shId.id !== ID_SEEKHEAD) return false;
  const shLen = readVint(buffer, segStart + shId.length);
  if (!shLen) return false;
  const shPayload = buffer.subarray(segStart + shId.length + shLen.length, segStart + shId.length + shLen.length + shLen.value);

  // Parse Seek entries in SeekHead
  let shOffset = 0;
  let cuesSeekPos = -1;
  while (shOffset < shPayload.length) {
    const sId = readElementId(shPayload, shOffset);
    if (!sId || sId.id !== ID_SEEK) break;
    const sLen = readVint(shPayload, shOffset + sId.length);
    if (!sLen) break;
    const sPayload = shPayload.subarray(shOffset + sId.length + sLen.length, shOffset + sId.length + sLen.length + sLen.value);
    let subOffset = 0;
    let targetId = 0;
    let targetPos = -1;
    while (subOffset < sPayload.length) {
      const subId = readElementId(sPayload, subOffset);
      if (!subId) break;
      const subLen = readVint(sPayload, subOffset + subId.length);
      if (!subLen) break;
      const subValBytes = sPayload.subarray(subOffset + subId.length + subLen.length, subOffset + subId.length + subLen.length + subLen.value);
      if (subId.id === ID_SEEK_ID) {
        let tid = 0;
        for (const b of subValBytes) tid = (tid << 8) | b;
        targetId = tid >>> 0;
      } else if (subId.id === ID_SEEK_POSITION) {
        let tpos = 0;
        for (const b of subValBytes) tpos = (tpos << 8) | b;
        targetPos = tpos;
      }
      subOffset += subId.length + subLen.length + subLen.value;
    }
    if (targetId === ID_CUES) cuesSeekPos = targetPos;
    shOffset += sId.length + sLen.length + sLen.value;
  }

  if (cuesSeekPos === -1) return false;

  // Validate that cuesSeekPos actually lands on ID_CUES
  const cuesFilePos = segStart + cuesSeekPos;
  const foundCuesId = readElementId(buffer, cuesFilePos);
  if (!foundCuesId || foundCuesId.id !== ID_CUES) return false;

  // Read first CuePoint in Cues
  const cuesLen = readVint(buffer, cuesFilePos + foundCuesId.length);
  if (!cuesLen) return false;
  const cuesPayload = buffer.subarray(cuesFilePos + foundCuesId.length + cuesLen.length, cuesFilePos + foundCuesId.length + cuesLen.length + cuesLen.value);
  const cpId = readElementId(cuesPayload, 0);
  if (!cpId || cpId.id !== ID_CUE_POINT) return false;
  const cpLen = readVint(cuesPayload, cpId.length);
  if (!cpLen) return false;
  const cpPayload = cuesPayload.subarray(cpId.length + cpLen.length, cpId.length + cpLen.length + cpLen.value);

  // Find CueClusterPosition in CuePoint
  let cpOffset = 0;
  let firstClusterPos = -1;
  while (cpOffset < cpPayload.length) {
    const elId = readElementId(cpPayload, cpOffset);
    if (!elId) break;
    const elLen = readVint(cpPayload, cpOffset + elId.length);
    if (!elLen) break;
    if (elId.id === ID_CUE_TRACK_POSITIONS) {
      const ctpPayload = cpPayload.subarray(cpOffset + elId.length + elLen.length, cpOffset + elId.length + elLen.length + elLen.value);
      let ctpOffset = 0;
      while (ctpOffset < ctpPayload.length) {
        const subId = readElementId(ctpPayload, ctpOffset);
        if (!subId) break;
        const subLen = readVint(ctpPayload, ctpOffset + subId.length);
        if (!subLen) break;
        if (subId.id === ID_CUE_CLUSTER_POSITION) {
          const valBytes = ctpPayload.subarray(ctpOffset + subId.length + subLen.length, ctpOffset + subId.length + subLen.length + subLen.value);
          let val = 0;
          for (const b of valBytes) val = (val << 8) | b;
          firstClusterPos = val;
          break;
        }
        ctpOffset += subId.length + subLen.length + subLen.value;
      }
    }
    cpOffset += elId.length + elLen.length + elLen.value;
  }

  if (firstClusterPos === -1) return false;

  // Validate that firstClusterPos lands EXACTLY on ID_CLUSTER
  const clusterFilePos = segStart + firstClusterPos;
  const foundClusterId = readElementId(buffer, clusterFilePos);
  if (!foundClusterId || foundClusterId.id !== ID_CLUSTER) return false;

  return true;
}

/**
 * Backward-compatible helper checking for valid Cues index.
 */
export function hasWebmCues(buffer: Uint8Array): boolean {
  return hasValidWebmIndex(buffer);
}

/**
 * Makes a WebM buffer seekable by injecting Duration, Cues index, and SeekHead
 * with mathematically deterministic zero-error pointer precision.
 */
export function makeWebmSeekableSync(buffer: Uint8Array, durationMsFallback?: number): Uint8Array {
  // If buffer is too small or not EBML, return as is
  if (buffer.length < 32) return buffer;

  // 1. Verify EBML header
  const ebmlId = readElementId(buffer, 0);
  if (!ebmlId || ebmlId.id !== ID_EBML) return buffer;

  const ebmlLen = readVint(buffer, ebmlId.length);
  if (!ebmlLen) return buffer;

  const ebmlTotalLen = ebmlId.length + ebmlLen.length + ebmlLen.value;
  if (ebmlTotalLen >= buffer.length) return buffer;

  // 2. Locate Segment element
  const segmentId = readElementId(buffer, ebmlTotalLen);
  if (!segmentId || segmentId.id !== ID_SEGMENT) return buffer;

  const segmentLen = readVint(buffer, ebmlTotalLen + segmentId.length);
  if (!segmentLen) return buffer;

  const segmentContentStartPos = ebmlTotalLen + segmentId.length + segmentLen.length;

  // 3. Scan Segment children: Info, Tracks, and all Clusters
  // We ignore any existing/corrupted SeekHead or Cues in the input buffer
  let offset = segmentContentStartPos;
  let infoBuffer: Uint8Array | null = null;
  let tracksBuffer: Uint8Array | null = null;
  let firstClusterOffset = -1;
  let lastClusterEnd = -1;

  const clusters: { timecodeMs: number; originalFileOffset: number }[] = [];
  let maxTimecode = 0;

  while (offset < buffer.length) {
    const elId = readElementId(buffer, offset);
    if (!elId) break;

    const elLen = readVint(buffer, offset + elId.length);
    if (!elLen) break;

    const headerLen = elId.length + elLen.length;
    const isUnknownLength = elLen.value === 0x01ffffffffffffff || (elLen.length === 8 && elLen.value >= 0x00ffffffffffffff);
    const contentLen = isUnknownLength ? buffer.length - (offset + headerLen) : elLen.value;

    if (elId.id === ID_INFO && !infoBuffer) {
      infoBuffer = buffer.subarray(offset + headerLen, offset + headerLen + contentLen);
    } else if (elId.id === ID_TRACKS && !tracksBuffer) {
      tracksBuffer = buffer.subarray(offset + headerLen, offset + headerLen + contentLen);
    } else if (elId.id === ID_CLUSTER) {
      if (firstClusterOffset === -1) {
        firstClusterOffset = offset;
      }
      lastClusterEnd = offset + headerLen + contentLen;

      // Read Timecode inside cluster
      let clusterTimecode = 0;
      const clusterContent = buffer.subarray(offset + headerLen, offset + headerLen + contentLen);
      let cOffset = 0;
      while (cOffset < clusterContent.length) {
        const cId = readElementId(clusterContent, cOffset);
        if (!cId) break;
        const cLen = readVint(clusterContent, cOffset + cId.length);
        if (!cLen) break;

        if (cId.id === ID_CLUSTER_TIMECODE) {
          const tcBytes = clusterContent.subarray(cOffset + cId.length + cLen.length, cOffset + cId.length + cLen.length + cLen.value);
          let tc = 0;
          for (let b = 0; b < tcBytes.length; b++) tc = (tc << 8) | tcBytes[b];
          clusterTimecode = tc;
          if (tc > maxTimecode) maxTimecode = tc;
          break;
        }
        cOffset += cId.length + cLen.length + cLen.value;
      }

      clusters.push({
        timecodeMs: clusterTimecode,
        originalFileOffset: offset,
      });
    }

    if (isUnknownLength) break;
    offset += headerLen + contentLen;
  }

  // If no clusters were found or metadata is missing, return original buffer
  if (clusters.length === 0 || firstClusterOffset === -1) {
    return buffer;
  }

  // Determine final accurate duration
  const effectiveDuration = Math.max(maxTimecode, durationMsFallback && durationMsFallback > 0 ? durationMsFallback : maxTimecode);

  // 4. Build enhanced Info segment (Duration + TimecodeScale = 1,000,000ns)
  const timecodeScaleEl = wrapElement(ID_TIMECODE_SCALE, encodeUInt(1000000));
  const durationEl = wrapElement(ID_DURATION, encodeFloat64(effectiveDuration));

  // Re-use other Info elements if present (excluding previous Duration and TimecodeScale)
  const filteredInfoChildren: Uint8Array[] = [timecodeScaleEl, durationEl];
  if (infoBuffer) {
    let iOffset = 0;
    while (iOffset < infoBuffer.length) {
      const iId = readElementId(infoBuffer, iOffset);
      if (!iId) break;
      const iLen = readVint(infoBuffer, iOffset + iId.length);
      if (!iLen) break;
      const totalChildLen = iId.length + iLen.length + iLen.value;

      if (iId.id !== ID_DURATION && iId.id !== ID_TIMECODE_SCALE) {
        filteredInfoChildren.push(infoBuffer.subarray(iOffset, iOffset + totalChildLen));
      }
      iOffset += totalChildLen;
    }
  }

  const newInfoPayload = concatBuffers(filteredInfoChildren);
  const newInfoElement = wrapElement(ID_INFO, newInfoPayload);

  // Re-wrap Tracks
  const tracksElement = tracksBuffer ? wrapElement(ID_TRACKS, tracksBuffer) : new Uint8Array(0);

  // Clusters payload slice: contains strictly cluster data
  const clustersData = buffer.subarray(firstClusterOffset, lastClusterEnd !== -1 ? lastClusterEnd : buffer.length);
  const ebmlHeader = buffer.subarray(0, ebmlTotalLen);

  // 5. Construct Cues and SeekHead with 0-byte mathematical precision
  // Layout in new segment:
  // [SeekHead] -> [newInfoElement] -> [tracksElement] -> [finalCues] -> [clustersData]
  //
  // Where cluster0 starts at:
  // cluster0Pos = finalSeekHead.length + newInfoElement.length + tracksElement.length + finalCues.length
  // And cluster i starts at:
  // clusterIPos = cluster0Pos + (cl.originalFileOffset - firstClusterOffset)
  let cluster0Pos = 512; // Initial seed
  let finalSeekHead: Uint8Array = new Uint8Array(0);
  let finalCues: Uint8Array = new Uint8Array(0);

  for (let iter = 0; iter < 10; iter++) {
    // 5a. Build Cues table using current cluster0Pos
    const cuePoints: Uint8Array[] = [];
    for (const cl of clusters) {
      const clusterPos = cluster0Pos + (cl.originalFileOffset - firstClusterOffset);
      const cueTimeEl = wrapElement(ID_CUE_TIME, encodeUInt(cl.timecodeMs));
      const cueTrackEl = wrapElement(ID_CUE_TRACK, encodeUInt(1));
      const cuePosEl = wrapElement(ID_CUE_CLUSTER_POSITION, encodeUInt(clusterPos));
      const cueTrackPositionsEl = wrapElement(ID_CUE_TRACK_POSITIONS, concatBuffers([cueTrackEl, cuePosEl]));
      const cuePointEl = wrapElement(ID_CUE_POINT, concatBuffers([cueTimeEl, cueTrackPositionsEl]));
      cuePoints.push(cuePointEl);
    }
    finalCues = wrapElement(ID_CUES, concatBuffers(cuePoints));

    // 5b. Build SeekHead with exact offsets
    let seekHeadLen = 47;
    for (let sIter = 0; sIter < 5; sIter++) {
      const infoOffset = seekHeadLen;
      const tracksOffset = infoOffset + newInfoElement.length;
      const cuesOffset = tracksOffset + tracksElement.length;

      const buildSeekEntry = (targetId: number, targetPos: number) => {
        const seekIdEl = wrapElement(ID_SEEK_ID, encodeId(targetId));
        const seekPosEl = wrapElement(ID_SEEK_POSITION, encodeUInt(targetPos));
        return wrapElement(ID_SEEK, concatBuffers([seekIdEl, seekPosEl]));
      };

      const seekEntries = [
        buildSeekEntry(ID_INFO, infoOffset),
        buildSeekEntry(ID_TRACKS, tracksOffset),
        buildSeekEntry(ID_CUES, cuesOffset),
      ];
      finalSeekHead = wrapElement(ID_SEEKHEAD, concatBuffers(seekEntries));
      if (finalSeekHead.length === seekHeadLen) break;
      seekHeadLen = finalSeekHead.length;
    }

    // 5c. Check convergence
    const actualCluster0Pos = finalSeekHead.length + newInfoElement.length + tracksElement.length + finalCues.length;
    if (actualCluster0Pos === cluster0Pos) {
      break; // Exact 0-byte match!
    }
    cluster0Pos = actualCluster0Pos;
  }

  // 6. Assemble the seekable WebM file
  const segmentHeader = concatBuffers([
    encodeId(ID_SEGMENT),
    new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), // Unknown segment length (streaming standard)
  ]);

  return concatBuffers([
    ebmlHeader,
    segmentHeader,
    finalSeekHead,
    newInfoElement,
    tracksElement,
    finalCues,
    clustersData,
  ]);
}

/**
 * Asynchronous helper: converts a WebM Blob into a seekable WebM Blob.
 */
export async function makeWebmSeekable(blob: Blob, durationMsFallback?: number): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const fixedUint8 = makeWebmSeekableSync(uint8, durationMsFallback);
    return new Blob([fixedUint8], { type: blob.type || 'audio/webm' });
  } catch (_e) {
    // If fixing fails for any reason, return original blob gracefully
    return blob;
  }
}

