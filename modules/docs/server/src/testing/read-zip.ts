import { crc32, inflateRawSync } from 'node:zlib';

/**
 * Reads an archive back through its central directory, as any unzip tool does, checking
 * every entry's checksum. For tests of the export zip; throws on anything malformed.
 */
export function readZip(zip: Buffer): Record<string, string> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('No end of central directory');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i += 1) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error(`Entry ${i} is not a central header`);
    const crc = zip.readUInt32LE(at + 16);
    const packedSize = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = inflateRawSync(zip.subarray(dataStart, dataStart + packedSize));
    if (crc32(data) !== crc) throw new Error(`${name} fails its checksum`);
    files[name] = data.toString('utf8');
    at += 46 + nameLength;
  }
  return files;
}
