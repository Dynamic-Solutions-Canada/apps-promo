/** Pixel size of a PNG image, read from its header. */
export interface PngSize {
  width: number
  height: number
}

/** The eight bytes every PNG file starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Read a PNG's width and height from its IHDR chunk, without decoding the image.
 * `refresh-catalog.ps1` reads the same two fields the same way.
 *
 * @param bytes The whole file, or at least its first 24 bytes.
 * @returns The size, or `undefined` when the bytes are not a PNG.
 */
export function readPngSize(bytes: Uint8Array): PngSize | undefined {
  // Signature (8 bytes), then the IHDR chunk: length (4), type (4), width (4), height (4).
  if (bytes.length < 24) {
    return undefined
  }
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    return undefined
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunkType = String.fromCharCode(...bytes.subarray(12, 16))
  if (chunkType !== 'IHDR') {
    return undefined
  }

  // PNG stores integers big-endian, which is DataView's default.
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
