import { describe, expect, it } from 'vitest';
import { FrameDemuxer, encodeFrame, type OutputStream } from './frames.ts';

describe('docker frame parsing', () => {
  it('splits stdout and stderr frames, however the bytes arrive', () => {
    const stream = Buffer.concat([
      encodeFrame('stdout', 'hello\n'),
      encodeFrame('stderr', 'oops\n'),
      encodeFrame('stdout', 'bye'),
    ]);
    const frames: [OutputStream, string][] = [];
    const demuxer = new FrameDemuxer((which, payload) => frames.push([which, payload.toString()]));
    for (let i = 0; i < stream.length; i += 3) demuxer.push(stream.subarray(i, i + 3));
    expect(frames).toEqual([
      ['stdout', 'hello\n'],
      ['stderr', 'oops\n'],
      ['stdout', 'bye'],
    ]);
    expect(demuxer.pendingBytes).toBe(0);
  });

  it('waits for a frame cut short and reads an empty one', () => {
    const frames: string[] = [];
    const demuxer = new FrameDemuxer((_, payload) => frames.push(payload.toString()));
    const frame = encodeFrame('stdout', 'abcdef');
    demuxer.push(frame.subarray(0, 10));
    expect(frames).toEqual([]);
    expect(demuxer.pendingBytes).toBe(10);
    demuxer.push(Buffer.concat([frame.subarray(10), encodeFrame('stdout', '')]));
    expect(frames).toEqual(['abcdef', '']);
  });
});
