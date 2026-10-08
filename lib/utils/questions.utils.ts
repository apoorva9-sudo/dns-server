import { DNSQuestion } from "../../classes/questions.class.ts";

const POINTER_MASK = 0xc0;
const POINTER_OFFSET_MASK = 0x3fff;
const MAX_JUMPS = 10;
export type DNSNameMap = Map<string, number>;

export function parseDomainName(
    buffer: Buffer,
    offset: number
): { name: string; offset: number } {
    const labels: string[] = [];

    let currentOffset = offset;
    let nextOffset = offset;
    let jumped = false;
    let jumps = 0;

    while (true) {
        if (currentOffset >= buffer.length) {
            throw new Error("DNS name exceeds packet boundary");
        }

        const length = buffer.readUInt8(currentOffset);

        // Compression pointer
        if ((length & POINTER_MASK) === POINTER_MASK) {
            if (currentOffset + 1 >= buffer.length) {
                throw new Error("Incomplete DNS compression pointer");
            }

            if (jumps >= MAX_JUMPS) {
                throw new Error("Too many DNS compression pointer jumps");
            }

            const secondByte = buffer.readUInt8(currentOffset + 1);

            const pointer =
                ((length & 0x3f) << 8) | secondByte;

            if (!jumped) {
                nextOffset = currentOffset + 2;
                jumped = true;
            }

            currentOffset = pointer;
            jumps++;

            continue;
        }

        // End of domain name
        if (length === 0) {
            if (!jumped) {
                nextOffset = currentOffset + 1;
            }

            break;
        }

        currentOffset++;

        if (currentOffset + length > buffer.length) {
            throw new Error("DNS label exceeds packet boundary");
        }

        const label = buffer
            .subarray(currentOffset, currentOffset + length)
            .toString("utf8");

        labels.push(label);

        currentOffset += length;
    }

    return {
        name: labels.join("."),
        offset: nextOffset
    };
}

export function parseDNSQuestion(
    buffer: Buffer,
    offset: number
): { question: DNSQuestion; offset: number } {
    const result = parseDomainName(buffer, offset);

    let currentOffset = result.offset;

    if (currentOffset + 4 > buffer.length) {
        throw new Error("Incomplete DNS question");
    }

    const type = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const classCode = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    return {
        question: new DNSQuestion(
            result.name,
            type,
            classCode
        ),
        offset: currentOffset
    };
}

export function buildDNSQuestion(
    question: DNSQuestion,
    nameMap?: DNSNameMap,
    currentOffset = 0
): Buffer {
    const parts: Buffer[] = [];

    if (nameMap) {
        const nameBuffer = buildCompressedDomainName(
            question.name,
            nameMap,
            currentOffset
        );

        parts.push(nameBuffer);
    } else {
        const labels = question.name.split(".");

        for (const label of labels) {
            const labelBuffer = Buffer.from(
                label,
                "utf8"
            );

            if (labelBuffer.length > 63) {
                throw new Error(
                    "DNS label cannot exceed 63 bytes"
                );
            }

            parts.push(
                Buffer.from([labelBuffer.length])
            );

            parts.push(labelBuffer);
        }

        parts.push(Buffer.from([0]));
    }

    const typeBuffer = Buffer.alloc(2);
    typeBuffer.writeUInt16BE(
        question.type,
        0
    );

    const classBuffer = Buffer.alloc(2);
    classBuffer.writeUInt16BE(
        question.classCode,
        0
    );

    parts.push(typeBuffer);
    parts.push(classBuffer);

    return Buffer.concat(parts);
}

export function buildCompressedDomainName(
    name: string,
    nameMap: DNSNameMap,
    currentOffset: number
): Buffer {
    const labels = name.split(".");
    const parts: Buffer[] = [];

    let offset = currentOffset;

    for (let i = 0; i < labels.length; i++) {
        const suffix = labels
            .slice(i)
            .join(".")
            .toLowerCase();

        const existingOffset = nameMap.get(suffix);

        if (
            existingOffset !== undefined &&
            existingOffset <= 0x3fff
        ) {
            const pointer = 0xc000 | existingOffset;

            const pointerBuffer = Buffer.alloc(2);

            pointerBuffer.writeUInt16BE(
                pointer,
                0
            );

            parts.push(pointerBuffer);

            return Buffer.concat(parts);
        }

      const label = labels[i];

if (label === undefined) {
    throw new Error("Invalid DNS name");
}

const labelBuffer = Buffer.from(label, "utf8");

if (
    labelBuffer.length === 0 ||
    labelBuffer.length > 63
) {
    throw new Error(`Invalid DNS label: ${label}`);
}

        nameMap.set(
            suffix,
            offset
        );

        parts.push(
            Buffer.from([labelBuffer.length])
        );

        parts.push(labelBuffer);

        offset += 1 + labelBuffer.length;
    }

    parts.push(Buffer.from([0]));

    return Buffer.concat(parts);
}