import dgram from "node:dgram";

export function isValidDNSPacket(buffer: Buffer): boolean {
    return buffer.length >= 12;
}

export function forwardQuery(
    query: Buffer,
    resolverHost: string,
    resolverPort: number
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");

        const timeout = setTimeout(() => {
            socket.close();
            reject(new Error("DNS resolver timeout"));
        }, 5000);

        socket.on("message", (response) => {
            clearTimeout(timeout);
            socket.close();

            resolve(response);
        });

        socket.on("error", (error) => {
            clearTimeout(timeout);
            socket.close();

            reject(error);
        });

        socket.send(
            query,
            resolverPort,
            resolverHost,
            (error) => {
                if (error) {
                    clearTimeout(timeout);
                    socket.close();

                    reject(error);
                }
            }
        );
    });
}