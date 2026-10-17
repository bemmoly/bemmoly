export type OutputStream = 'stdout' | 'stderr';

const HEADER_BYTES = 8;

/**
 * Splits Docker's multiplexed log stream. Without a TTY every frame starts with an 8-byte
 * header: the stream (1 stdout, 2 stderr), three zero bytes, then the payload size as a
 * big-endian uint32. Frames arrive cut at arbitrary places, so bytes wait until a frame is whole.
 */
export class FrameDemuxer {
  private buffer: Buffer = Buffer.alloc(0);

  private readonly onFrame: (stream: OutputStream, payload: Buffer) => void;

  constructor(onFrame: (stream: OutputStream, payload: Buffer) => void) {
    this.onFrame = onFrame;
  }

  push(chunk: Buffer): void {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= HEADER_BYTES) {
      const size = this.buffer.readUInt32BE(4);
      if (this.buffer.length < HEADER_BYTES + size) return;
      const stream: OutputStream = this.buffer[0] === 1 ? 'stdout' : 'stderr';
      this.onFrame(stream, this.buffer.subarray(HEADER_BYTES, HEADER_BYTES + size));
      this.buffer = this.buffer.subarray(HEADER_BYTES + size);
    }
  }

  /** Bytes left over when the stream ended: a frame cut short. */
  get pendingBytes(): number {
    return this.buffer.length;
  }
}

/** Builds one frame; the inverse of FrameDemuxer, for tests and fakes. */
export function encodeFrame(stream: OutputStream, payload: string | Buffer): Buffer {
  const body = typeof payload === 'string' ? Buffer.from(payload) : payload;
  const header = Buffer.alloc(HEADER_BYTES);
  header[0] = stream === 'stdout' ? 1 : 2;
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}
