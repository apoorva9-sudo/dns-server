
// In a DNS message, each resource record (RR) has several fields. The ones you’re asking about are:

//  NAME
// The domain name being queried or answered.

// Example: example.com

//  TYPE
// Specifies the kind of record.

// Common values:

// 1 → A record (IPv4 address)

// 28 → AAAA record (IPv6 address)

// 2 → NS record (Name Server)

// 15 → MX record (Mail Exchange)

// So in your case:
// TYPE = 1 means the query is asking for an A record (IPv4 address of example.com).

//  CLASS
// Specifies the protocol family.

// Common values:

// 1 → IN (Internet — the one used almost everywhere)

// 3 → CH (Chaosnet, rarely used)

// 4 → HS (Hesiod, also rare)

// So:
// CLASS = 1 means the query is for the Internet class.

// ┌────┬─────────┬────┬─────┬────┐
// │ 07 │ example │ 03 │ com │ 00 │
// └────┴─────────┴────┴─────┴────┘

// This is called DNS label encoding.

export class DNSQuestion {
    name: string;
    type: number;
    classCode: number;

    constructor(
        name = "",
        type = 1,
        classCode = 1
    ) {
        this.name = name;
        this.type = type;
        this.classCode = classCode;
    }
}