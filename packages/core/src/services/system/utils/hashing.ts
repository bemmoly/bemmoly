import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { PassThrough, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface Digest {
  sizeBytes: number;
  sha256: string;
}

/** A pass-through that counts bytes and hashes them; read `digest()` after the stream ends. */
export function createDigestStream(): Transform & { digest(): Digest } {
  const hash = createHash('sha256');
  let size = 0;
  let result: Digest | undefined;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    },
    flush(callback: TransformCallback) {
      result = { sizeBytes: size, sha256: hash.digest('hex') };
      callback();
    },
  });
  return Object.assign(stream, {
    digest(): Digest {
      if (!result) throw new Error('The digest is read before the stream finished');
      return result;
    },
  });
}

export async function digestFile(file: string): Promise<Digest> {
  const digest = createDigestStream();
  await pipeline(createReadStream(file), digest, new PassThrough().resume());
  return digest.digest();
}
