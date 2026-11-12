const MAX_JPEG_PIXELS = 40_000_000;

export type SanitizedJpeg = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

function invalidJpeg(): never {
  throw new Error('The selected photo is not a supported, complete JPEG.');
}

function isApplicationOrCommentMarker(marker: number): boolean {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
}

function isSupportedFrameMarker(marker: number): boolean {
  return marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
}

function isSupportedSegmentMarker(marker: number): boolean {
  return isSupportedFrameMarker(marker) ||
    marker === 0xc4 || // Huffman tables
    marker === 0xdb || // Quantization tables
    marker === 0xda || // Start of scan
    marker === 0xdd; // Restart interval
}

function concatenate(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const output = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return output;
}

/**
 * Strip all JPEG application/comment segments without decoding or changing
 * image pixels. Reject unknown marker formats so metadata cannot pass through
 * an unrecognized segment.
 */
export function sanitizePublicJpeg(
  input: Uint8Array,
  maxBytes: number,
): SanitizedJpeg {
  if (
    input.length < 4 || input.length > maxBytes ||
    input[0] !== 0xff || input[1] !== 0xd8
  ) {
    return invalidJpeg();
  }

  const chunks: Uint8Array[] = [input.subarray(0, 2)];
  let totalLength = 2;
  let offset = 2;
  let insideScan = false;
  let foundFrame = false;
  let foundScan = false;
  let foundEnd = false;
  let width = 0;
  let height = 0;

  const append = (chunk: Uint8Array) => {
    if (chunk.length === 0) return;
    chunks.push(chunk);
    totalLength += chunk.length;
  };

  while (offset < input.length) {
    if (insideScan) {
      const scanDataStart = offset;
      let foundScanBoundary = false;
      while (offset < input.length) {
        if (input[offset] !== 0xff) {
          offset += 1;
          continue;
        }

        const markerStart = offset;
        offset += 1;
        while (offset < input.length && input[offset] === 0xff) offset += 1;
        if (offset >= input.length) return invalidJpeg();

        const marker = input[offset];
        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 1;
          continue;
        }

        if (marker === 0xd9) {
          append(input.subarray(scanDataStart, offset + 1));
          offset += 1;
          foundEnd = true;
          foundScanBoundary = true;
          break;
        }

        // Any other marker closes this scan. The normal marker parser below
        // handles metadata removal and progressive JPEG scan tables.
        append(input.subarray(scanDataStart, markerStart));
        offset = markerStart;
        insideScan = false;
        foundScanBoundary = true;
        break;
      }

      if (!foundScanBoundary) return invalidJpeg();
      if (foundEnd) break;
      continue;
    }

    const markerStart = offset;
    if (input[offset] !== 0xff) return invalidJpeg();
    offset += 1;
    while (offset < input.length && input[offset] === 0xff) offset += 1;
    if (offset >= input.length) return invalidJpeg();

    const marker = input[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      return invalidJpeg();
    }

    if (marker === 0xd9) {
      append(input.subarray(markerStart, offset));
      foundEnd = true;
      break;
    }

    if (!isApplicationOrCommentMarker(marker) && !isSupportedSegmentMarker(marker)) {
      return invalidJpeg();
    }

    if (offset + 2 > input.length) return invalidJpeg();
    const segmentLength = (input[offset] << 8) | input[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > input.length) {
      return invalidJpeg();
    }
    const segmentEnd = offset + segmentLength;

    if (isSupportedFrameMarker(marker)) {
      if (foundFrame || segmentLength < 11) return invalidJpeg();
      const componentCount = input[offset + 7];
      if (componentCount < 1 || segmentLength !== 8 + componentCount * 3) {
        return invalidJpeg();
      }
      height = (input[offset + 3] << 8) | input[offset + 4];
      width = (input[offset + 5] << 8) | input[offset + 6];
      if (
        width < 1 || height < 1 || width > 20_000 || height > 20_000 ||
        width * height > MAX_JPEG_PIXELS
      ) {
        return invalidJpeg();
      }
      foundFrame = true;
    }

    if (marker === 0xda) {
      if (!foundFrame || segmentLength < 8) return invalidJpeg();
      const scanComponentCount = input[offset + 2];
      if (scanComponentCount < 1 || segmentLength !== 6 + scanComponentCount * 2) {
        return invalidJpeg();
      }
      foundScan = true;
      insideScan = true;
    }

    if (!isApplicationOrCommentMarker(marker)) {
      append(input.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  if (!foundEnd || !foundFrame || !foundScan || offset !== input.length) {
    return invalidJpeg();
  }

  return { bytes: concatenate(chunks, totalLength), width, height };
}
