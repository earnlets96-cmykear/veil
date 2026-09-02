/**
 * Robust MIME Type Inference & Normalization for VEIL.
 *
 * Implements multi-tier detection across browser MIME strings,
 * Android ContentResolver types, file extensions, and magic byte signatures.
 */

export function inferMediaMime(
  file: { name?: string; type?: string },
  headerBytes?: Uint8Array
): string {
  const rawType = (file.type || '').split(';')[0].trim().toLowerCase();

  // 1. If explicit specific MIME type is present and not generic
  if (
    rawType &&
    rawType !== 'application/octet-stream' &&
    rawType !== 'binary/octet-stream' &&
    rawType !== 'application/x-binary' &&
    rawType !== ''
  ) {
    if (rawType === 'video/m4v') return 'video/mp4';
    return rawType;
  }

  // 2. Extension check from filename
  const filename = file.name || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const vExts: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    ts: 'video/mp2t',
  };
  if (vExts[ext]) return vExts[ext];

  const imgExts: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  if (imgExts[ext]) return imgExts[ext];

  const audioExts: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/opus',
    weba: 'audio/webm',
  };
  if (audioExts[ext]) return audioExts[ext];

  // 3. Magic byte signature sniffing fallback
  if (headerBytes && headerBytes.length >= 12) {
    // MP4 / QuickTime: bytes 4-8 are 'ftyp'
    const ftyp = String.fromCharCode(...headerBytes.subarray(4, 8));
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(...headerBytes.subarray(8, 12));
      if (brand.startsWith('qt')) {
        return 'video/quicktime';
      }
      return 'video/mp4';
    }

    // WebM / Matroska: bytes 0-3 are 0x1A 0x45 0xDF 0xA3
    if (
      headerBytes[0] === 0x1a &&
      headerBytes[1] === 0x45 &&
      headerBytes[2] === 0xdf &&
      headerBytes[3] === 0xa3
    ) {
      return 'video/webm';
    }

    // AVI: 'RIFF' .... 'AVI '
    const riff = String.fromCharCode(...headerBytes.subarray(0, 4));
    const avi = String.fromCharCode(...headerBytes.subarray(8, 12));
    if (riff === 'RIFF' && avi === 'AVI ') {
      return 'video/x-msvideo';
    }

    // JPEG: 0xFF 0xD8 0xFF
    if (headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 0x89 0x50 0x4E 0x47
    if (
      headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47
    ) {
      return 'image/png';
    }

    // GIF: 'GIF87a' or 'GIF89a'
    const gif = String.fromCharCode(...headerBytes.subarray(0, 3));
    if (gif === 'GIF') {
      return 'image/gif';
    }
  }

  return rawType || 'application/octet-stream';
}
