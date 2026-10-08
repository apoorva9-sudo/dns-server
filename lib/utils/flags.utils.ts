const QR_MASK = 0x8000;
const OPCODE_MASK = 0x7800;
const AA_MASK = 0x0400;
const TC_MASK = 0x0200;
const RD_MASK = 0x0100;
const RA_MASK = 0x0080;

const Z_MASK = 0x0040;
const AD_MASK = 0x0020;
const CD_MASK = 0x0010;

const RCODE_MASK = 0x000f;
export const RCODE_NOERROR = 0;
export const RCODE_FORMERR = 1;
export const RCODE_SERVFAIL = 2;
export const RCODE_NXDOMAIN = 3;
export const RCODE_NOTIMP = 4;
export const RCODE_REFUSED = 5;

export interface DNSFlags {
    qr: boolean;
    opcode: number;
    aa: boolean;
    tc: boolean;
    rd: boolean;
    ra: boolean;
    z: number;
    ad: boolean;
    cd: boolean;
    rcode: number;
}

export function parseDNSFlags(flags: number): DNSFlags {

    return {
        qr: (flags & QR_MASK) !== 0,

        opcode:
            (flags & OPCODE_MASK) >>> 11,

        aa:
            (flags & AA_MASK) !== 0,

        tc:
            (flags & TC_MASK) !== 0,

        rd:
            (flags & RD_MASK) !== 0,

        ra:
            (flags & RA_MASK) !== 0,

        z:
            (flags & Z_MASK) >>> 6,

        ad:
            (flags & AD_MASK) !== 0,

        cd:
            (flags & CD_MASK) !== 0,

        rcode:
            flags & RCODE_MASK
    };
}



export function buildDNSFlags(flags: DNSFlags): number {

    let value = 0;

    if (flags.qr) {
        value |= QR_MASK;
    }

    value |=
        (flags.opcode & 0x0f) << 11;

    if (flags.aa) {
        value |= AA_MASK;
    }

    if (flags.tc) {
        value |= TC_MASK;
    }

    if (flags.rd) {
        value |= RD_MASK;
    }

    if (flags.ra) {
        value |= RA_MASK;
    }

    value |=
        (flags.z & 0x01) << 6;

    if (flags.ad) {
        value |= AD_MASK;
    }

    if (flags.cd) {
        value |= CD_MASK;
    }

    value |=
        flags.rcode & RCODE_MASK;

    return value;
}