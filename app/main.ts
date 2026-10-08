import dgram from "node:dgram";

import {
    getCacheTTL
} from "../lib/utils/cache.utils.ts";
import { DNSHeader } from "../classes/headers.class.ts";
import { DNSQuestion } from "../classes/questions.class.ts";
import { DNSAnswer } from "../classes/answers.class.ts";
import {
    parseDNSFlags
} from "../lib/utils/flags.utils.ts";
import { parseDNSHeader } from "../lib/utils/headers.utils.ts";

import {
    parseDNSQuestion
} from "../lib/utils/questions.utils.ts";

import {
    parseDNSAnswers,
    parseDNSRecords
} from "../lib/utils/answers.utils.ts";

import {
    isValidDNSPacket,
    forwardQuery
} from "../lib/utils/common.utils.ts";

import redis from "../lib/redis/client.redis.ts";

import {
    buildDNSPacket,
    buildSingleQuestionPacket
} from "../lib/utils/packet.utils.ts";


// ============================================================
// SERVER CONFIGURATION
// ============================================================

const PORT = 2053;
const HOST = "0.0.0.0";

const CACHE_TTL = 3600;


// ============================================================
// RESOLVER CONFIGURATION
// ============================================================

function getResolver(): {
    host: string;
    port: number;
} {

    const args = process.argv;

    const resolverIndex =
        args.indexOf("--resolver");

    let resolver: string | undefined;


    // --------------------------------------------------------
    // COMMAND-LINE RESOLVER
    // Example:
    // bun run app/main.ts --resolver 8.8.8.8:53
    // --------------------------------------------------------

    if (resolverIndex !== -1) {

        resolver =
            args[resolverIndex + 1];

        if (!resolver) {

            throw new Error(
                "Missing resolver value. Use --resolver <host>:<port>"
            );
        }
    }


    // --------------------------------------------------------
    // ENVIRONMENT VARIABLE
    // Example:
    // RESOLVER=8.8.8.8:53
    // --------------------------------------------------------

    if (!resolver) {

        resolver =
            process.env.RESOLVER;
    }


    // --------------------------------------------------------
    // DEFAULT RESOLVER
    // --------------------------------------------------------

    if (!resolver) {

        resolver =
            "1.1.1.1:53";
    }


    // --------------------------------------------------------
    // PARSE RESOLVER
    // --------------------------------------------------------

    const separatorIndex =
        resolver.lastIndexOf(":");

    if (separatorIndex === -1) {

        throw new Error(
            `Invalid resolver: ${resolver}`
        );
    }


    const host =
        resolver.substring(
            0,
            separatorIndex
        );

    const portString =
        resolver.substring(
            separatorIndex + 1
        );

    const port =
        Number(portString);


    // --------------------------------------------------------
    // VALIDATE RESOLVER
    // --------------------------------------------------------

    if (
        !host ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {

        throw new Error(
            `Invalid resolver: ${resolver}`
        );
    }


    return {
        host,
        port
    };
}


const {
    host: RESOLVER_HOST,
    port: RESOLVER_PORT
} = getResolver();


// ============================================================
// CREATE UDP SERVER
// ============================================================

const server =
    dgram.createSocket("udp4");


// ============================================================
// DNS MESSAGE HANDLER
// ============================================================

server.on(
    "message",
    async (message, remote) => {

        console.log(
            `\nReceived ${message.length} bytes from ${remote.address}:${remote.port}`
        );


        try {

            // ==================================================
            // VALIDATE DNS PACKET
            // ==================================================

            if (!isValidDNSPacket(message)) {

                console.error(
                    "Invalid DNS packet: packet is smaller than 12 bytes"
                );

                return;
            }


            // ==================================================
            // PARSE CLIENT HEADER
            // ==================================================

            const header =
                parseDNSHeader(message);


            console.log(
                "DNS Query:"
            );

            console.log(
                `  ID: ${header.id}`
            );

            console.log(
                `  Questions: ${header.qdCount}`
            );


            // ==================================================
            // VALIDATE QUESTION COUNT
            // ==================================================

            if (header.qdCount === 0) {

                console.error(
                    "DNS query contains no questions"
                );

                return;
            }


            // ==================================================
            // PARSE ALL CLIENT QUESTIONS
            // ==================================================

            let questionOffset = 12;

            const clientQuestions: DNSQuestion[] = [];

            const cacheParts: string[] = [];


            for (
                let i = 0;
                i < header.qdCount;
                i++
            ) {

                const result =
                    parseDNSQuestion(
                        message,
                        questionOffset
                    );


                clientQuestions.push(
                    result.question
                );


                cacheParts.push(
                    `${result.question.name.toLowerCase()}:${result.question.type}:${result.question.classCode}`
                );


                questionOffset =
                    result.offset;
            }


            // ==================================================
            // CREATE CACHE KEY
            // ==================================================

            const cacheKey =
                `dns:${cacheParts.join("|")}`;


            console.log(
                `Cache key: ${cacheKey}`
            );


            // ==================================================
            // REDIS CACHE LOOKUP
            // ==================================================

            const cachedResponse =
                await redis.get(cacheKey);


            if (cachedResponse) {

                console.log(
                    "Redis cache HIT"
                );


                // ----------------------------------------------
                // CREATE NEW BUFFER FROM CACHE
                // ----------------------------------------------

                const responseBuffer =
                    Buffer.from(
                        cachedResponse,
                        "base64"
                    );


                // ----------------------------------------------
                // RESTORE CLIENT TRANSACTION ID
                // ----------------------------------------------

                responseBuffer.writeUInt16BE(
                    header.id,
                    0
                );


                // ----------------------------------------------
                // SEND CACHED RESPONSE
                // ----------------------------------------------

                server.send(
                    responseBuffer,
                    remote.port,
                    remote.address,
                    (error) => {

                        if (error) {

                            console.error(
                                "Failed to send cached DNS response:",
                                error
                            );

                            return;
                        }


                        console.log(
                            `Cached DNS response sent to ${remote.address}:${remote.port}`
                        );
                    }
                );


                return;
            }


            // ==================================================
            // CACHE MISS
            // ==================================================

            console.log(
                "Redis cache MISS"
            );


            // ==================================================
            // ARRAY TO STORE UPSTREAM RESPONSES
            // ==================================================

            const upstreamResponses: Buffer[] = [];


            // ==================================================
            // SINGLE QUESTION
            // ==================================================

            if (clientQuestions.length === 1) {

                console.log(
                    `Forwarding query to ${RESOLVER_HOST}:${RESOLVER_PORT}`
                );


                const upstreamResponse =
                    await forwardQuery(
                        message,
                        RESOLVER_HOST,
                        RESOLVER_PORT
                    );


                upstreamResponses.push(
                    upstreamResponse
                );
            }


            // ==================================================
            // MULTIPLE QUESTIONS
            // ==================================================

            else {

                console.log(
                    `Multiple questions detected: ${clientQuestions.length}`
                );


                for (
                    let i = 0;
                    i < clientQuestions.length;
                    i++
                ) {

                    // ------------------------------------------------
                    // Explicitly check for undefined.
                    // This satisfies TypeScript strict checking.
                    // ------------------------------------------------

                    const question =
                        clientQuestions[i];


                    if (!question) {

                        throw new Error(
                            `Question ${i + 1} is missing`
                        );
                    }


                    console.log(
                        `Forwarding question ${i + 1}: ${question.name}`
                    );


                    // ------------------------------------------------
                    // BUILD ONE-QUESTION DNS PACKET
                    // ------------------------------------------------

                    const singleQuestionPacket =
                        buildSingleQuestionPacket(
                            header,
                            question
                        );


                    console.log(
                        `  Single-question packet size: ${singleQuestionPacket.length} bytes`
                    );


                    // ------------------------------------------------
                    // SEND TO UPSTREAM RESOLVER
                    // ------------------------------------------------

                    const upstreamResponse =
                        await forwardQuery(
                            singleQuestionPacket,
                            RESOLVER_HOST,
                            RESOLVER_PORT
                        );


                    upstreamResponses.push(
                        upstreamResponse
                    );
                }
            }


            // ==================================================
            // PARSE AND MERGE UPSTREAM RESPONSES
            // ==================================================

            /*
             * IMPORTANT:
             *
             * The final response uses the ORIGINAL CLIENT
             * questions.
             *
             * We do NOT rely on the upstream resolver's QDCOUNT
             * because some resolvers return only one question
             * even when we originally received multiple questions.
             */

            const mergedQuestions: DNSQuestion[] = [...clientQuestions];

            const mergedAnswers: DNSAnswer[] = [];

            const mergedAuthorities: DNSAnswer[] = [];

            const mergedAdditionals: DNSAnswer[] = [];

            let responseFlags = 0;


            // ==================================================
            // PROCESS EACH UPSTREAM RESPONSE
            // ==================================================

            for (
                let i = 0;
                i < upstreamResponses.length;
                i++
            ) {

                const response =
                    upstreamResponses[i];


                if (!response) {

                    continue;
                }


                console.log(
                    `Received ${response.length} bytes from upstream resolver`
                );


                // ------------------------------------------------
                // PARSE UPSTREAM HEADER
                // ------------------------------------------------

                const responseHeader =
                    parseDNSHeader(
                        response
                    );


                console.log(
                    "DNS Response:"
                );

                console.log(
                    `  ID: ${responseHeader.id}`
                );

                console.log(
                    `  Questions: ${responseHeader.qdCount}`
                );

                console.log(
                    `  Answers: ${responseHeader.anCount}`
                );

                console.log(
                    `  Authority: ${responseHeader.nsCount}`
                );

                console.log(
                    `  Additional: ${responseHeader.arCount}`
                );


                // ------------------------------------------------
                // USE FLAGS FROM FIRST RESPONSE
                // ------------------------------------------------

                if (i === 0) {

                    responseFlags =
                        responseHeader.flags;
                }


                // ------------------------------------------------
                // FIND ANSWER SECTION
                //
                // We must parse the upstream questions first
                // because answers begin after the question section.
                // ------------------------------------------------

                let responseOffset = 12;


                for (
                    let q = 0;
                    q < responseHeader.qdCount;
                    q++
                ) {

                    const questionResult =
                        parseDNSQuestion(
                            response,
                            responseOffset
                        );


                    responseOffset =
                        questionResult.offset;
                }


                // ------------------------------------------------
                // PARSE UPSTREAM ANSWERS
                // ------------------------------------------------

                const answerResult =
                    parseDNSAnswers(
                        response,
                        responseOffset,
                        responseHeader.anCount
                    );


                // ------------------------------------------------
                // ADD ANSWERS TO MERGED RESPONSE
                // ------------------------------------------------

                for (let i = 0; i < upstreamResponses.length; i++) {

                    const response = upstreamResponses[i];

                    if (!response) {
                        continue;
                    }

                    const responseHeader = parseDNSHeader(response);

                    if (i === 0) {

                        responseFlags = responseHeader.flags;

                        const flags = parseDNSFlags(
                            responseHeader.flags
                        );

                        console.log("DNS Flags:");
                        console.log(`  QR: ${flags.qr}`);
                        console.log(`  Opcode: ${flags.opcode}`);
                        console.log(`  AA: ${flags.aa}`);
                        console.log(`  TC: ${flags.tc}`);
                        console.log(`  RD: ${flags.rd}`);
                        console.log(`  RA: ${flags.ra}`);
                        console.log(`  AD: ${flags.ad}`);
                        console.log(`  CD: ${flags.cd}`);
                        console.log(`  RCODE: ${flags.rcode}`);
                    }

                    let responseOffset = 12;

                    // -------------------------
                    // Skip upstream questions
                    // -------------------------

                    for (
                        let q = 0;
                        q < responseHeader.qdCount;
                        q++
                    ) {

                        const questionResult = parseDNSQuestion(
                            response,
                            responseOffset
                        );

                        responseOffset = questionResult.offset;
                    }

                    // -------------------------
                    // Answer section
                    // -------------------------

                    const answerResult = parseDNSRecords(
                        response,
                        responseOffset,
                        responseHeader.anCount
                    );

                    for (const answer of answerResult.records) {

                        mergedAnswers.push(answer);
                    }

                    responseOffset = answerResult.offset;

                    // -------------------------
                    // Authority section
                    // -------------------------

                    const authorityResult = parseDNSRecords(
                        response,
                        responseOffset,
                        responseHeader.nsCount
                    );

                    for (const authority of authorityResult.records) {

                        mergedAuthorities.push(authority);
                    }

                    responseOffset = authorityResult.offset;

                    // -------------------------
                    // Additional section
                    // -------------------------

                    const additionalResult = parseDNSRecords(
                        response,
                        responseOffset,
                        responseHeader.arCount
                    );

                    for (const additional of additionalResult.records) {

                        mergedAdditionals.push(additional);
                    }
                }


                // ==================================================
                // BUILD FINAL RESPONSE HEADER
                // ==================================================

                const responseHeaderForClient = new DNSHeader(
                    header.id,
                    responseFlags,
                    mergedQuestions.length,
                    mergedAnswers.length,
                    mergedAuthorities.length,
                    mergedAdditionals.length
                );


                // ==================================================
                // BUILD FINAL DNS PACKET
                // ==================================================

                const rebuiltResponse = buildDNSPacket(
                    responseHeaderForClient,
                    mergedQuestions,
                    mergedAnswers,
                    mergedAuthorities,
                    mergedAdditionals
                );


                console.log(
                    `Rebuilt DNS response: ${rebuiltResponse.length} bytes`
                );
                const cacheTTL = getCacheTTL(
                    mergedAnswers,
                    mergedAuthorities,
                    mergedAdditionals
                );

                console.log(
                    `Calculated cache TTL: ${cacheTTL} seconds`
                );


                // ==================================================
                // CACHE FINAL RESPONSE
                // ==================================================

                await redis.set(
                    cacheKey,
                    rebuiltResponse.toString("base64"),
                    "EX",
                    cacheTTL
                );

                console.log(
                    `DNS response cached for ${cacheTTL} seconds`
                );


                // ==================================================
                // SEND RESPONSE TO CLIENT
                // ==================================================

                server.send(
                    rebuiltResponse,
                    remote.port,
                    remote.address,
                    (error) => {

                        if (error) {

                            console.error(
                                "Failed to send DNS response:",
                                error
                            );

                            return;
                        }


                        console.log(
                            `DNS response sent to ${remote.address}:${remote.port}`
                        );
                    }
                );

            }


            // ==================================================
            // REQUEST PROCESSING ERROR
            // ==================================================
        }
        catch (error) {

            console.error(
                "Failed to process DNS query:",
                error
            );
        }
    }
);



// ============================================================
// SERVER ERROR
// ============================================================

server.on(
    "error",
    (error) => {

        console.error(
            "DNS server error:",
            error
        );
    }
);


// ============================================================
// SERVER LISTENING
// ============================================================

server.on(
    "listening",
    () => {

        const address =
            server.address();


        if (
            typeof address === "object" &&
            address !== null
        ) {

            console.log(
                `DNS server listening on ${address.address}:${address.port}`
            );
        }
    }
);


// ============================================================
// START SERVER
// ============================================================

server.bind(
    PORT,
    HOST
);