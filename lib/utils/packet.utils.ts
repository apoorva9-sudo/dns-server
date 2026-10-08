import { DNSHeader } from "../../classes/headers.class.ts";
import { DNSQuestion } from "../../classes/questions.class.ts";
import { DNSAnswer } from "../../classes/answers.class.ts";

import {
    buildDNSHeader
} from "./headers.utils.ts";

import {
    buildDNSQuestion,
    type DNSNameMap
} from "./questions.utils.ts";

import {
    buildDNSAnswer
} from "./answers.utils.ts";



export function buildDNSPacket(
    header: DNSHeader,
    questions: DNSQuestion[],
    answers: DNSAnswer[] = [],
    authorities: DNSAnswer[] = [],
    additionals: DNSAnswer[] = []
): Buffer {

    const nameMap: DNSNameMap = new Map();

    const parts: Buffer[] = [];

    const headerBuffer = buildDNSHeader(header);

    parts.push(headerBuffer);

    let offset = headerBuffer.length;

    // -------------------------
    // Question section
    // -------------------------

    for (const question of questions) {

        const questionBuffer = buildDNSQuestion(
            question,
            nameMap,
            offset
        );

        parts.push(questionBuffer);

        offset += questionBuffer.length;
    }

    // -------------------------
    // Answer section
    // -------------------------

    for (const answer of answers) {

        const answerBuffer = buildDNSAnswer(
            answer,
            nameMap,
            offset
        );

        parts.push(answerBuffer);

        offset += answerBuffer.length;
    }

    // -------------------------
    // Authority section
    // -------------------------

    for (const authority of authorities) {

        const authorityBuffer = buildDNSAnswer(
            authority,
            nameMap,
            offset
        );

        parts.push(authorityBuffer);

        offset += authorityBuffer.length;
    }

    // -------------------------
    // Additional section
    // -------------------------

    for (const additional of additionals) {

        const additionalBuffer = buildDNSAnswer(
            additional,
            nameMap,
            offset
        );

        parts.push(additionalBuffer);

        offset += additionalBuffer.length;
    }

    return Buffer.concat(parts);
}
  

export function buildSingleQuestionPacket(
    originalHeader: DNSHeader,
    question: DNSQuestion
): Buffer {

    const header = new DNSHeader(
        originalHeader.id,
        originalHeader.flags,
        1,
        0,
        0,
        0
    );

    return buildDNSPacket(
        header,
        [question],
        []
    );
}