import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

/**
 * Backup encryption: AES-256-GCM over 1 MiB chunks (the STREAM construction), so a
 * multi-gigabyte dump never needs one nonce for the whole file and a restore never
 * acts on unauthenticated bytes. Layout:
 *
 *   header  "BMBK" | version 1 | salt 16 | nonce prefix 8 | chunk size u32
 *   chunk   length u32 (high bit = final) | ciphertext | tag 16
 *
 * The nonce is prefix ‖ chunk counter; the header and the final flag are bound in as
 * associated data, so truncation, reordering and header edits all fail authentication.
 */
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm-stream-v1';

const MAGIC = Buffer.from('BMBK');
const VERSION = 1;
const SALT_BYTES = 16;
const PREFIX_BYTES = 8;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + SALT_BYTES + PREFIX_BYTES + 4;
const FINAL_FLAG = 0x8000_0000;
export const DEFAULT_CHUNK_BYTES = 1024 * 1024;
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export class BackupDecryptionError extends Error {
  override readonly name = 'BackupDecryptionError';
}

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(passphrase, salt, 32, SCRYPT, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function nonce(prefix: Buffer, counter: number): Buffer {
  const value = Buffer.alloc(12);
  prefix.copy(value, 0);
  value.writeUInt32BE(counter, PREFIX_BYTES);
  return value;
}

function aad(header: Buffer, final: boolean): Buffer {
  return Buffer.concat([header, Buffer.from([final ? 1 : 0])]);
}

function sealChunk(
  key: Buffer,
  header: Buffer,
  prefix: Buffer,
  counter: number,
  plain: Buffer,
  final: boolean,
) {
  const cipher = createCipheriv('aes-256-gcm', key, nonce(prefix, counter));
  cipher.setAAD(aad(header, final));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(((final ? FINAL_FLAG : 0) | plain.length) >>> 0);
  return Buffer.concat([length, body, cipher.getAuthTag()]);
}

/** Encrypts a stream with a key derived from the backup passphrase. */
export function createEncryptStream(
  passphrase: string,
  chunkBytes = DEFAULT_CHUNK_BYTES,
): Transform {
  const salt = randomBytes(SALT_BYTES);
  const prefix = randomBytes(PREFIX_BYTES);
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header.writeUInt8(VERSION, 4);
  salt.copy(header, 5);
  prefix.copy(header, 5 + SALT_BYTES);
  header.writeUInt32BE(chunkBytes, 5 + SALT_BYTES + PREFIX_BYTES);
  const keyPromise = deriveKey(passphrase, salt);
  let pending = Buffer.alloc(0);
  let counter = 0;
  let headerSent = false;

  const emit = async (stream: Transform, flush: boolean) => {
    const key = await keyPromise;
    if (!headerSent) {
      stream.push(header);
      headerSent = true;
    }
    while (pending.length > chunkBytes || (!flush && pending.length === chunkBytes)) {
      stream.push(
        sealChunk(key, header, prefix, counter++, pending.subarray(0, chunkBytes), false),
      );
      pending = pending.subarray(chunkBytes);
    }
    if (flush) stream.push(sealChunk(key, header, prefix, counter++, pending, true));
  };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      pending = Buffer.concat([pending, chunk]);
      emit(this, false).then(() => callback(), callback);
    },
    flush(callback: TransformCallback) {
      emit(this, true).then(() => callback(), callback);
    },
  });
}

/** Decrypts what createEncryptStream wrote; fails on any tampering or truncation. */
export function createDecryptStream(passphrase: string): Transform {
  let buffered = Buffer.alloc(0);
  let header: Buffer | undefined;
  let key: Buffer | undefined;
  let prefix: Buffer | undefined;
  let chunkBytes = 0;
  let counter = 0;
  let finished = false;

  const readHeader = async () => {
    if (header || buffered.length < HEADER_BYTES) return;
    const candidate = buffered.subarray(0, HEADER_BYTES);
    if (!candidate.subarray(0, 4).equals(MAGIC) || candidate.readUInt8(4) !== VERSION) {
      throw new BackupDecryptionError('Not an encrypted Bemmoly backup, or an unknown version');
    }
    chunkBytes = candidate.readUInt32BE(5 + SALT_BYTES + PREFIX_BYTES);
    if (chunkBytes === 0 || chunkBytes > MAX_CHUNK_BYTES) {
      throw new BackupDecryptionError('The encryption header is damaged');
    }
    header = Buffer.from(candidate);
    prefix = header.subarray(5 + SALT_BYTES, 5 + SALT_BYTES + PREFIX_BYTES);
    key = await deriveKey(passphrase, header.subarray(5, 5 + SALT_BYTES));
    buffered = buffered.subarray(HEADER_BYTES);
  };

  const openChunks = (stream: Transform) => {
    while (header && key && prefix && buffered.length >= 4) {
      if (finished) throw new BackupDecryptionError('Data found after the final chunk');
      const word = buffered.readUInt32BE(0);
      const final = (word & FINAL_FLAG) !== 0;
      const length = word & ~FINAL_FLAG;
      if (length > chunkBytes) throw new BackupDecryptionError('A chunk is larger than declared');
      if (buffered.length < 4 + length + TAG_BYTES) return;
      const body = buffered.subarray(4, 4 + length);
      const tag = buffered.subarray(4 + length, 4 + length + TAG_BYTES);
      const decipher = createDecipheriv('aes-256-gcm', key, nonce(prefix, counter++));
      decipher.setAAD(aad(header, final));
      decipher.setAuthTag(tag);
      try {
        stream.push(Buffer.concat([decipher.update(body), decipher.final()]));
      } catch {
        throw new BackupDecryptionError('Wrong passphrase, or the backup was modified');
      }
      buffered = buffered.subarray(4 + length + TAG_BYTES);
      finished = final;
    }
  };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      buffered = Buffer.concat([buffered, chunk]);
      readHeader()
        .then(() => openChunks(this))
        .then(() => callback(), callback);
    },
    flush(callback: TransformCallback) {
      readHeader()
        .then(() => openChunks(this))
        .then(() => {
          if (!finished || buffered.length > 0) {
            throw new BackupDecryptionError('The backup is truncated');
          }
        })
        .then(() => callback(), callback);
    },
  });
}
