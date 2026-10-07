/**
 * Binary Serialization Utilities for AI City
 * Low-level read/write operations for deterministic binary save format
 */

import { SaveHeader, SaveChunk, SaveChunkType } from './types';

/** Magic bytes for AI City save files: "AICITY" */
export const SAVE_MAGIC = new Uint8Array([0x41, 0x49, 0x43, 0x49, 0x54, 0x59]);
export const SAVE_VERSION = 1;

/** Current save format version */
export const CURRENT_SAVE_VERSION = 1;

/** Supported save versions (for migration) */
export const SUPPORTED_VERSIONS = [1];

/** Size constants */
export const HEADER_SIZE = 6 + 4 + 4 + 8 + 4 + 16; // magic + version + seed + tick + timestamp + checksum
export const CHUNK_HEADER_SIZE = 1 + 4 + 4 + 4; // type + offset + length + checksum

/**
 * Binary writer for constructing save files
 */
export class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;
  private chunks: SaveChunk[] = [];

  constructor(initialCapacity = 1024 * 1024) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer);
  }

  /** Get current buffer as Uint8Array */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  /** Get chunks for index */
  getChunks(): readonly SaveChunk[] {
    return this.chunks;
  }

  /** Ensure capacity */
  private ensureCapacity(additional: number): void {
    if (this.offset + additional > this.buffer.byteLength) {
      const newCapacity = Math.max(
        this.buffer.byteLength * 2,
        this.offset + additional
      );
      const newBuffer = new ArrayBuffer(newCapacity);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer, 0, this.offset));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }

  /** Write raw bytes */
  writeBytes(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    new Uint8Array(this.buffer, this.offset, data.length).set(data);
    this.offset += data.length;
  }

  /** Write string (length-prefixed UTF-8) */
  writeString(str: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    this.writeUint32(bytes.length);
    this.writeBytes(bytes);
  }

  /** Write fixed-length string (padded/truncated) */
  writeFixedString(str: string, length: number): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    this.ensureCapacity(length);
    const view = new Uint8Array(this.buffer, this.offset, length);
    view.set(bytes.subarray(0, length));
    this.offset += length;
  }

  // Integer writes
  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeInt8(value: number): void {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true); // little-endian
    this.offset += 2;
  }

  writeInt16(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeUint64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.offset, value, true);
    this.offset += 8;
  }

  writeInt64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigInt64(this.offset, value, true);
    this.offset += 8;
  }

  // Float writes
  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat64(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, true);
    this.offset += 8;
  }

  // Boolean
  writeBool(value: boolean): void {
    this.writeUint8(value ? 1 : 0);
  }

  /** Start a new chunk - returns chunk index */
  startChunk(type: SaveChunkType): number {
    const chunkIndex = this.chunks.length;
    const chunkStart = this.offset;

    // Reserve space for chunk header (will be filled in endChunk)
    this.writeUint8(type as number); // type
    this.writeUint32(0); // offset (placeholder)
    this.writeUint32(0); // length (placeholder)
    this.writeUint32(0); // checksum (placeholder)

    this.chunks.push({
      type,
      offset: chunkStart,
      length: 0,
      checksum: 0,
    });

    return chunkIndex;
  }

  /** End current chunk and compute checksum */
  endChunk(chunkIndex: number): void {
    const chunk = this.chunks[chunkIndex];
    const chunkEnd = this.offset;
    const chunkData = new Uint8Array(this.buffer, chunk.offset + CHUNK_HEADER_SIZE, chunkEnd - chunk.offset - CHUNK_HEADER_SIZE);

    // Compute checksum (simple CRC32-like)
    let checksum = 0;
    for (let i = 0; i < chunkData.length; i++) {
      checksum = (checksum << 5) - checksum + chunkData[i];
      checksum |= 0; // Convert to 32-bit integer
    }

    // Update chunk header
    const headerOffset = chunk.offset;
    this.view.setUint32(headerOffset + 1, chunkEnd - chunk.offset - CHUNK_HEADER_SIZE, true); // length
    this.view.setUint32(headerOffset + 5, chunkEnd, true); // offset (absolute)
    this.view.setUint32(headerOffset + 9, checksum, true); // checksum

    // Update chunk record
    this.chunks[chunkIndex] = {
      ...chunk,
      offset: chunkEnd - chunkData.length - CHUNK_HEADER_SIZE,
      length: chunkData.length,
      checksum,
    };
  }

  /** Write header */
  writeHeader(header: SaveHeader): void {
    this.writeBytes(SAVE_MAGIC);
    this.writeUint32(header.version);
    this.writeUint32(header.seed);
    this.writeUint64(BigInt(header.tick));
    this.writeUint64(BigInt(header.timestamp));
    this.writeBytes(new Uint8Array(header.checksum.buffer));
  }
}

/**
 * Binary reader for parsing save files
 */
export class BinaryReader {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number = 0;

  constructor(data: Uint8Array | ArrayBuffer) {
    if (data instanceof Uint8Array) {
      this.buffer = data;
    } else {
      this.buffer = new Uint8Array(data);
    }
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  /** Get remaining bytes */
  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  /** Check if at end */
  get eof(): boolean {
    return this.offset >= this.buffer.length;
  }

  /** Peek at next byte */
  peekUint8(): number {
    if (this.offset >= this.buffer.length) throw new Error('Unexpected EOF');
    return this.buffer[this.offset];
  }

  // Integer reads
  readUint8(): number {
    if (this.offset + 1 > this.buffer.length) throw new Error('Unexpected EOF');
    return this.buffer[this.offset++];
  }

  readInt8(): number {
    if (this.offset + 1 > this.buffer.length) throw new Error('Unexpected EOF');
    return this.view.getInt8(this.offset++);
  }

  readUint16(): number {
    if (this.offset + 2 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readInt16(): number {
    if (this.offset + 2 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readUint32(): number {
    if (this.offset + 4 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readInt32(): number {
    if (this.offset + 4 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readUint64(): bigint {
    if (this.offset + 8 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return val;
  }

  readInt64(): bigint {
    if (this.offset + 8 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return val;
  }

  // Float reads
  readFloat32(): number {
    if (this.offset + 4 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFloat64(): number {
    if (this.offset + 8 > this.buffer.length) throw new Error('Unexpected EOF');
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  // Boolean
  readBool(): boolean {
    return this.readUint8() !== 0;
  }

  // String reads
  readString(): string {
    const length = this.readUint32();
    if (this.offset + length > this.buffer.length) throw new Error('Unexpected EOF');
    const decoder = new TextDecoder();
    const str = decoder.decode(this.buffer.subarray(this.offset, this.offset + length));
    this.offset += length;
    return str;
  }

  readFixedString(length: number): string {
    if (this.offset + length > this.buffer.length) throw new Error('Unexpected EOF');
    const decoder = new TextDecoder();
    const str = decoder.decode(this.buffer.subarray(this.offset, this.offset + length));
    this.offset += length;
    // Trim null padding
    return str.replace(/\0+$/, '');
  }

  /** Read exact bytes */
  readBytes(length: number): Uint8Array {
    if (this.offset + length > this.buffer.length) throw new Error('Unexpected EOF');
    const result = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  /** Read save header */
  readHeader(): SaveHeader {
    const magic = this.readBytes(6);
    if (!arraysEqual(magic, SAVE_MAGIC)) {
      throw new Error('Invalid save file magic bytes');
    }

    const version = this.readUint32();
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new Error(`Unsupported save version: ${version}`);
    }

    const seed = this.readUint32();
    const tick = Number(this.readUint64());
    const timestamp = Number(this.readUint64());
    const checksumBytes = this.readBytes(16);
    const checksum = new Uint32Array(checksumBytes.buffer);

    return { version, seed, tick: tick as any, timestamp, checksum };
  }

  /** Read chunk header */
  readChunkHeader(): { type: SaveChunkType; offset: number; length: number; checksum: number } {
    const type = this.readUint8() as SaveChunkType;
    const offset = this.readUint32();
    const length = this.readUint32();
    const checksum = this.readUint32();
    return { type, offset, length, checksum };
  }

  /** Seek to absolute position */
  seek(pos: number): void {
    if (pos < 0 || pos > this.buffer.length) throw new Error('Invalid seek position');
    this.offset = pos;
  }

  /** Skip bytes */
  skip(bytes: number): void {
    this.seek(this.offset + bytes);
  }
}

/**
 * CRC32 checksum utility
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Compute checksum for save header
 */
export function computeHeaderChecksum(header: Omit<SaveHeader, 'checksum'>): Uint32Array {
  const writer = new BinaryWriter(128);
  writer.writeBytes(SAVE_MAGIC);
  writer.writeUint32(header.version);
  writer.writeUint32(header.seed);
  writer.writeUint64(BigInt(header.tick));
  writer.writeUint64(BigInt(header.timestamp));
  const data = writer.toUint8Array();
  const checksum = crc32(data);
  return new Uint32Array([checksum, 0, 0, 0]); // 16 bytes = 4 x Uint32
}

/**
 * Verify save file integrity
 */
export function verifySaveIntegrity(data: Uint8Array): { valid: boolean; error?: string } {
  try {
    const reader = new BinaryReader(data);
    const header = reader.readHeader();

    // Verify chunks
    while (!reader.eof) {
      const chunkHeader = reader.readChunkHeader();
      const chunkData = reader.readBytes(chunkHeader.length);
      const computedChecksum = crc32(chunkData);
      if (computedChecksum !== chunkHeader.checksum) {
        return { valid: false, error: `Chunk ${chunkHeader.type} checksum mismatch` };
      }
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/** Helper to compare Uint8Arrays */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}