export class DNSAnswer {
    name: string;
    type: number;
    classCode: number;
    ttl: number;
    data: string;

    constructor(
        name = "",
        type = 1,
        classCode = 1,
        ttl = 300,
        data = ""
    ) {
        this.name = name;
        this.type = type;
        this.classCode = classCode;
        this.ttl = ttl;
        this.data = data;
    }
}