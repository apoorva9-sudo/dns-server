export class DNSHeader {
    id: number;
    flags: number;
    qdCount: number;
    anCount: number;
    nsCount: number;
    arCount: number;

    constructor(
        id = 0,
        flags = 0,
        qdCount = 0,
        anCount = 0,
        nsCount = 0,
        arCount = 0
    ) {
        this.id = id;
        this.flags = flags;
        this.qdCount = qdCount;
        this.anCount = anCount;
        this.nsCount = nsCount;
        this.arCount = arCount;
    }
}