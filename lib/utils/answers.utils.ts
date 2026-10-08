import { DNSAnswer } from "../../classes/answers.class.ts";
import {
    buildCompressedDomainName,
    parseDomainName
} from "./questions.utils.ts";

import type { DNSNameMap } from "./questions.utils.ts";
const TYPE_A = 1;
const TYPE_NS = 2;
const TYPE_CNAME = 5;
const TYPE_TXT = 16;
const TYPE_AAAA = 28;

function encodeIPv4(address: string): Buffer {
    const parts = address.split(".");

    if (parts.length !== 4) {
        throw new Error(`Invalid IPv4 address: ${address}`);
    }

    const bytes = parts.map((part) => Number(part));

    if (
        bytes.some(
            (byte) =>
                !Number.isInteger(byte) ||
                byte < 0 ||
                byte > 255
        )
    ) {
        throw new Error(`Invalid IPv4 address: ${address}`);
    }

    return Buffer.from(bytes);
}
function encodeIPv6(address: string): Buffer {
    const parts = address.split("::");

    if (parts.length > 2) {
        throw new Error(`Invalid IPv6 address: ${address}`);
    }

    let groups: string[] = [];

    if (parts.length === 1) {
        groups = parts[0]!.split(":");

        if (groups.length !== 8) {
            throw new Error(`Invalid IPv6 address: ${address}`);
        }
    } else {
        const left = parts[0] === ""
            ? []
            : parts[0]!.split(":");

        const right = parts[1] === ""
            ? []
            : parts[1]!.split(":");

        const missingGroups = 8 - left.length - right.length;

        if (missingGroups <= 0) {
            throw new Error(`Invalid IPv6 address: ${address}`);
        }

        groups = [
            ...left,
            ...Array(missingGroups).fill("0"),
            ...right
        ];
    }

    if (groups.length !== 8) {
        throw new Error(`Invalid IPv6 address: ${address}`);
    }

    const buffer = Buffer.alloc(16);

    for (let i = 0; i < 8; i++) {
        const group = groups[i]!;

        if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
            throw new Error(`Invalid IPv6 address: ${address}`);
        }

        const value = parseInt(group, 16);

        buffer.writeUInt16BE(value, i * 2);
    }

    return buffer;
}

function encodeDomainName(name: string): Buffer {
    const labels = name.split(".");
    const parts: Buffer[] = [];

    for (const label of labels) {
        const labelBuffer = Buffer.from(label, "utf8");

        if (labelBuffer.length === 0 || labelBuffer.length > 63) {
            throw new Error(`Invalid DNS label: ${label}`);
        }

        parts.push(Buffer.from([labelBuffer.length]));
        parts.push(labelBuffer);
    }

    parts.push(Buffer.from([0]));

    return Buffer.concat(parts);
}
export function buildDNSAnswer(
    answer: DNSAnswer,
    nameMap?: DNSNameMap,
    currentOffset = 0
): Buffer {

    let nameBuffer: Buffer;

    if (nameMap) {
        nameBuffer = buildCompressedDomainName(
            answer.name,
            nameMap,
            currentOffset
        );
    } else {
        nameBuffer = encodeDomainName(answer.name);
    }

    const typeBuffer = Buffer.alloc(2);
    typeBuffer.writeUInt16BE(answer.type, 0);

    const classBuffer = Buffer.alloc(2);
    classBuffer.writeUInt16BE(answer.classCode, 0);

    const ttlBuffer = Buffer.alloc(4);
    ttlBuffer.writeUInt32BE(answer.ttl, 0);

    /*
     * The answer NAME + TYPE + CLASS + TTL
     * appear before RDLENGTH/RDATA.
     */
    const rdataOffset =
        currentOffset +
        nameBuffer.length +
        2 + // TYPE
        2 + // CLASS
        4 + // TTL
        2;  // RDLENGTH

    let rdata: Buffer;

    if (answer.type === TYPE_A) {

        rdata = encodeIPv4(answer.data);

    } else if (answer.type === TYPE_AAAA) {

        rdata = encodeIPv6(answer.data);

    } else if (
        answer.type === TYPE_CNAME ||
        answer.type === TYPE_NS
    ) {

        if (nameMap) {
            rdata = buildCompressedDomainName(
                answer.data,
                nameMap,
                rdataOffset
            );
        } else {
            rdata = encodeDomainName(answer.data);
        }

    } else if (answer.type === TYPE_TXT) {

        const textBuffer = Buffer.from(
            answer.data,
            "utf8"
        );

        if (textBuffer.length > 255) {
            throw new Error(
                "TXT record exceeds 255 bytes"
            );
        }

        rdata = Buffer.concat([
            Buffer.from([textBuffer.length]),
            textBuffer
        ]);

    } else {

        rdata = Buffer.from(
            answer.data,
            "utf8"
        );
    }

    if (rdata.length > 0xffff) {
        throw new Error(
            "DNS RDATA exceeds 65535 bytes"
        );
    }

    const rdLengthBuffer = Buffer.alloc(2);
    rdLengthBuffer.writeUInt16BE(
        rdata.length,
        0
    );

    return Buffer.concat([
        nameBuffer,
        typeBuffer,
        classBuffer,
        ttlBuffer,
        rdLengthBuffer,
        rdata
    ]);
}
export function parseDNSAnswer(
    buffer: Buffer,
    offset: number
): { answer: DNSAnswer; offset: number } {
    const nameResult = parseDomainName(buffer, offset);

    let currentOffset = nameResult.offset;

    if (currentOffset + 10 > buffer.length) {
        throw new Error("Incomplete DNS answer");
    }

    const type = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const classCode = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const ttl = buffer.readUInt32BE(currentOffset);
    currentOffset += 4;

    const rdLength = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    if (currentOffset + rdLength > buffer.length) {
        throw new Error("DNS answer RDATA exceeds packet boundary");
    }

    const rdata = buffer.subarray(
        currentOffset,
        currentOffset + rdLength
    );

  let data: string;

if (type === TYPE_A && rdLength === 4) {

    data = Array.from(rdata).join(".");

} else if (type === TYPE_AAAA && rdLength === 16) {

    const groups: string[] = [];

    for (let i = 0; i < 16; i += 2) {
        groups.push(
            rdata.readUInt16BE(i).toString(16)
        );
    }

    data = groups.join(":");

} else if (
    type === TYPE_CNAME ||
    type === TYPE_NS
) {

    const nameResult = parseDomainName(
        buffer,
        currentOffset
    );

    data = nameResult.name;

} else if (type === TYPE_TXT) {

    if (rdLength === 0) {
        data = "";
    } else {
        const textLength = rdata.readUInt8(0);

        if (textLength + 1 > rdLength) {
            throw new Error("Invalid TXT record");
        }

        data = rdata
            .subarray(1, 1 + textLength)
            .toString("utf8");
    }

} else {

    data = rdata.toString("hex");
}
    currentOffset += rdLength;

    return {
        answer: new DNSAnswer(
            nameResult.name,
            type,
            classCode,
            ttl,
            data
        ),
        offset: currentOffset
    };
}


export function parseDNSRecords(
    buffer: Buffer,
    offset: number,
    count: number
): { records: DNSAnswer[]; offset: number } {

    const records: DNSAnswer[] = [];

    let currentOffset = offset;

    for (let i = 0; i < count; i++) {

        const result = parseDNSAnswer(
            buffer,
            currentOffset
        );

        records.push(result.answer);

        currentOffset = result.offset;
    }

    return {
        records,
        offset: currentOffset
    };
}


export function parseDNSAnswers(
    buffer: Buffer,
    offset: number,
    count: number
): { answers: DNSAnswer[]; offset: number } {
    const answers: DNSAnswer[] = [];

    let currentOffset = offset;

    for (let i = 0; i < count; i++) {
        const result = parseDNSAnswer(
            buffer,
            currentOffset
        );

        answers.push(result.answer);
        currentOffset = result.offset;
    }

    return {
        answers,
        offset: currentOffset
    };
}

