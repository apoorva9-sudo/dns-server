//this file will have 2 jobs
// Buffer  ──parse──>  DNSHeader
// DNSHeader ──build──> Buffer

import {DNSHeader} from "../../classes/headers.class.ts";
export function parseDNSHeader(buffer: Buffer): DNSHeader {
    return new DNSHeader(
        buffer.readUInt16BE(0),
        buffer.readUInt16BE(2),
        buffer.readUInt16BE(4),
        buffer.readUInt16BE(6),
        buffer.readUInt16BE(8),
        buffer.readUInt16BE(10)
    );
}

export function buildDNSHeader(header: DNSHeader): Buffer {
    const buffer = Buffer.alloc(12);

    buffer.writeUInt16BE(header.id, 0);
    buffer.writeUInt16BE(header.flags, 2);
    buffer.writeUInt16BE(header.qdCount, 4);
    buffer.writeUInt16BE(header.anCount, 6);
    buffer.writeUInt16BE(header.nsCount, 8);
    buffer.writeUInt16BE(header.arCount, 10);

    return buffer;
}