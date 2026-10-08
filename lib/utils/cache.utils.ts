import { DNSAnswer } from "../../classes/answers.class.ts";

const DEFAULT_CACHE_TTL = 300;
const MIN_CACHE_TTL = 1;
const MAX_CACHE_TTL = 86400;

export function getCacheTTL(
    answers: DNSAnswer[],
    authorities: DNSAnswer[],
    additionals: DNSAnswer[]
): number {

    const records = [
        ...answers,
        ...authorities,
        ...additionals
    ];

    if (records.length === 0) {
        return DEFAULT_CACHE_TTL;
    }

    const ttls = records
        .map((record) => record.ttl)
        .filter(
            (ttl) =>
                Number.isInteger(ttl) &&
                ttl > 0
        );

    if (ttls.length === 0) {
        return DEFAULT_CACHE_TTL;
    }

    const minimumTTL = Math.min(...ttls);

    return Math.min(
        Math.max(
            minimumTTL,
            MIN_CACHE_TTL
        ),
        MAX_CACHE_TTL
    );
}