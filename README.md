# DNS Server

<p align="center">
  <img src="docs/dns-server-banner.png" alt="DNS Server" width="100%">
</p>

<p align="center">
  <strong>TypeScript • Bun • UDP • Redis • Docker</strong>
</p>

<p align="center">
  A DNS server built from scratch at the protocol level to understand how DNS works internally.
</p>

<p align="center">
  <a href="https://github.com/apoorva9-sudo/dns-server">GitHub Repository</a>
</p>

---

##  Overview

This project is a DNS server implemented from scratch using **TypeScript, Bun, UDP, and Redis**.

Instead of relying on a high-level DNS library, the project works directly with DNS packets and implements the core mechanisms involved in DNS communication, including:

- DNS packet parsing and construction
- DNS header handling
- DNS question and answer sections
- Domain-name encoding and decoding
- DNS compression pointers
- Multi-question DNS queries
- Upstream DNS forwarding
- Redis-based DNS response caching
- TTL-aware cache expiration
- UDP-based client-server communication
- Dockerized deployment
- Redis integration through Docker Compose

The main purpose of the project is to understand DNS at the **protocol and networking level**, including how DNS messages are structured, transmitted, parsed, cached, and reconstructed.

---

##  Features

### DNS Protocol

- Raw DNS packet parsing
- Raw DNS packet construction
- DNS header parsing and construction
- DNS question parsing and construction
- DNS resource-record parsing
- DNS response construction
- DNS flags handling
- Response-code handling
- Support for DNS sections:
  - Header
  - Question
  - Answer
  - Authority
  - Additional

### Domain Name Handling

- Domain-name encoding
- Domain-name decoding
- DNS compression pointers
- Reuse of previously encoded domain-name suffixes
- Protection against excessive compression-pointer jumps
- RFC 1035-style message compression

### DNS Query Handling

- UDP DNS communication
- Single-question queries
- Multi-question DNS queries
- Configurable upstream DNS resolver
- Upstream response parsing
- Response reconstruction
- NXDOMAIN handling
- Authority-section handling

### DNS Record Types

The implementation supports commonly used DNS record types including:

- `A`
- `AAAA`
- `CNAME`
- `NS`
- `TXT`

### Redis Caching

- DNS response caching
- Cache HIT/MISS handling
- Query-based cache keys
- TTL-aware expiration
- Reduced dependency on repeated upstream lookups
- Redis integration through Docker Compose

### Deployment

- Bun-based local development
- Docker support
- Docker Compose support
- Redis container integration
- Configurable environment variables

---

#  Architecture

The DNS server follows a modular architecture where incoming DNS packets are received through UDP, parsed into structured DNS objects, checked against Redis, and forwarded to an upstream resolver when required.

<p align="center">
  <img src="docs/architecture.png" alt="DNS Server Architecture" width="90%">
</p>

### High-Level Flow

```text
                     DNS Client
                         │
                         │ UDP
                         ▼
              ┌─────────────────────┐
              │     DNS Server      │
              │      :2053          │
              └──────────┬──────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
          DNS Parser   Redis     Upstream
                       Cache      Resolver
              │          │          │
              │      HIT / MISS     │
              │          │          │
              └──────────┼──────────┘
                         │
                         ▼
                Response Builder
                         │
                         ▼
                    DNS Client
```

---

##  Project Structure

```text
dns-server/
│
├── app/
│   └── main.ts
│
├── classes/
│   ├── headers.class.ts
│   ├── questions.class.ts
│   └── answers.class.ts
│
├── lib/
│   ├── redis/
│   │   └── ...
│   │
│   └── utils/
│       ├── cache.utils.ts
│       ├── questions.utils.ts
│       ├── packet.utils.ts
│       ├── flags.utils.ts
│       └── ...
│
├── docs/
│   ├── dns-server-banner.png
│   ├── architecture.png
│   └── ...
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── bun.lock
├── tsconfig.json
└── README.md
```

### Important Components

| Component | Responsibility |
|---|---|
| `app/main.ts` | UDP server entry point and DNS query orchestration |
| `classes/` | DNS header, question and answer representations |
| `lib/utils/` | DNS parsing, construction, compression and cache utilities |
| `lib/redis/` | Redis connection and cache integration |
| `Dockerfile` | Container image for the DNS server |
| `docker-compose.yml` | Runs DNS server and Redis together |
| `docs/` | Project architecture and documentation images |

---

#  How DNS Resolution Works

When a client sends a DNS query, the request follows this general process:

```text
Client
  │
  │ DNS Query
  ▼
DNS Server
  │
  ▼
Parse DNS Packet
  │
  ▼
Generate Cache Key
  │
  ▼
Check Redis
  │
  ├─────────────── HIT ───────────────► Cached Response
  │                                      │
  │                                      ▼
  │                                Return Response
  │
  └─────────────── MISS
                    │
                    ▼
              Upstream DNS
                    │
                    ▼
              Parse Response
                    │
                    ▼
             Store in Redis
                    │
                    ▼
             Return Response
```

This allows the server to avoid unnecessary upstream DNS requests when a valid response is already available in the cache.

---

#  DNS Packet Structure

DNS messages are structured according to the DNS wire format defined by **RFC 1035**.

A DNS packet contains several sections:

```text
+-----------------------------+
|           Header            |
+-----------------------------+
|          Question           |
+-----------------------------+
|           Answer            |
+-----------------------------+
|         Authority           |
+-----------------------------+
|         Additional          |
+-----------------------------+
```

---

## Header

The DNS header occupies **12 bytes** and contains information such as:

```text
+---------------------+
|         ID          |
+---------------------+
|       FLAGS         |
+---------------------+
|      QDCOUNT        |
+---------------------+
|      ANCOUNT        |
+---------------------+
|      NSCOUNT        |
+---------------------+
|      ARCOUNT        |
+---------------------+
```

The implementation handles fields including:

- Transaction ID
- Query/Response flag
- Opcode
- Authoritative Answer
- Truncation
- Recursion Desired
- Recursion Available
- Response Code
- Question count
- Answer count
- Authority count
- Additional-record count

---

#  DNS Question Section

A DNS question contains:

```text
DOMAIN NAME
TYPE
CLASS
```

For example:

```text
google.com
TYPE  = A
CLASS = IN
```

The server parses these values directly from the DNS packet and uses them to determine how the request should be processed.

---

#  DNS Resource Records

DNS answers are represented using resource records containing:

```text
NAME
TYPE
CLASS
TTL
RDLENGTH
RDATA
```

For example, an `A` record can contain:

```text
google.com
TYPE = A
TTL  = 300
RDATA = IPv4 address
```

The server parses and reconstructs these fields using low-level buffer operations.

---

#  DNS Domain Name Compression

DNS supports message compression to reduce the size of DNS packets.

Instead of transmitting the same domain name repeatedly, a DNS packet can reference a previously encoded domain name using a compression pointer.

For example:

```text
google.com
```

can be referenced later through a pointer rather than being encoded again.

The implementation supports:

- Domain-name encoding
- Domain-name decoding
- Compression pointers
- Domain-name suffix reuse
- Compression-pointer protection

The compression logic is primarily handled through the utilities responsible for DNS question and packet processing.

---

## Compression Example

```text
First occurrence:

google.com
   │
   ▼
Encoded into packet

Later occurrence:

      ┌──────────────┐
      │ DNS Pointer  │
      └──────┬───────┘
             │
             ▼
       google.com
```

This reduces packet size and follows the compression mechanism used by DNS messages.

---

#  Multi-Question DNS Queries

The server supports DNS requests containing multiple questions in a single packet.

For example:

```text
Question 1:
google.com A

Question 2:
google.com AAAA

Question 3:
example.com A
```

The server processes the individual questions and communicates with the upstream resolver as required.

The responses are then parsed and combined into the final DNS response sent back to the client.

```text
                  DNS Client
                      │
                      ▼
              Multiple Questions
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      google.com   google.com  example.com
          A           AAAA          A
          │           │             │
          └───────────┼─────────────┘
                      ▼
               Upstream Resolver
                      │
                      ▼
                Parse Responses
                      │
                      ▼
              Build DNS Response
                      │
                      ▼
                  DNS Client
```

---

#  Redis DNS Caching

Redis is used to cache completed DNS responses.

A cache key is generated from the DNS question.

For example:

```text
dns:<domain>:<type>:<class>
```

A query for:

```text
google.com A IN
```

can produce a key similar to:

```text
dns:google.com:1:1
```

For multiple questions, the key represents the complete set of questions.

Example:

```text
dns:google.com:1:1|google.com:28:1
```

---

## Cache HIT / MISS

```text
                 DNS Query
                     │
                     ▼
               Generate Key
                     │
                     ▼
                Redis Cache
                  /     \
                 /       \
              HIT         MISS
               │            │
               │            ▼
               │       Upstream DNS
               │            │
               │            ▼
               │       Build Response
               │            │
               └──────┬─────┘
                      ▼
                Send Response
```

### Cache HIT

When a valid cached response exists:

```text
DNS Query
   │
   ▼
Redis
   │
  HIT
   │
   ▼
Cached DNS Response
   │
   ▼
Client
```

The server can respond without performing another upstream lookup.

### Cache MISS

When the response is not present:

```text
DNS Query
   │
   ▼
Redis
   │
  MISS
   │
   ▼
Upstream Resolver
   │
   ▼
DNS Response
   │
   ├──► Redis
   │
   ▼
Client
```

---

#  TTL-Aware Caching

DNS records contain a **TTL (Time To Live)** value that determines how long a response may be cached.

For example:

```text
A record
TTL = 300 seconds

AAAA record
TTL = 600 seconds
```

The cache expiration is calculated from the DNS response rather than using an arbitrary fixed expiration time.

For multiple records, the implementation uses the applicable lowest positive TTL to determine cache lifetime.

This helps the cache respect the intended lifetime of DNS responses.

---

#  Upstream DNS Resolver

When a DNS response is not available in Redis, the server forwards the query to an upstream DNS resolver.

The default resolver is:

```text
1.1.1.1:53
```

The resolver can be changed through configuration.

Example:

```text
8.8.8.8:53
```

This allows the server to work as a forwarding DNS server while still handling DNS packets locally.

---

#  Docker Architecture

The project can run as a complete containerized environment using Docker Compose.

```text
                 Docker Compose
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    DNS Server                  Redis
     UDP :2053                TCP :6379
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
                DNS Application
```

The DNS server communicates with Redis through the Docker Compose network.

Typical configuration:

```text
REDIS_HOST=redis
REDIS_PORT=6379
```

---

#  Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript** | Application and DNS protocol implementation |
| **Bun** | JavaScript/TypeScript runtime and package manager |
| **UDP** | DNS client-server communication |
| **Redis** | DNS response caching |
| **Docker** | Application containerization |
| **Docker Compose** | Multi-container development environment |
| **Git** | Version control |

---

#  Prerequisites

Before running the project, install:

- Git
- Bun
- Docker Desktop

Bun is required for running the application directly outside Docker.

Docker is required for the containerized setup.

---

#  Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/apoorva9-sudo/dns-server.git
```

Move into the project directory:

```bash
cd dns-server
```

---

## 2. Install Dependencies

Using Bun:

```bash
bun install
```

---

#  Run Locally

Start the DNS server using Bun:

```bash
bun run dev
```

The server listens on:

```text
0.0.0.0:2053
```

The default upstream resolver is:

```text
1.1.1.1:53
```

---

#  Build the Project

To create a production build:

```bash
bun run build
```

The generated output is placed in the `dist/` directory.

Example:

```text
dist/
└── main.js
```

---

#  Run with Docker Compose

To build and start the complete environment:

```bash
docker compose up --build
```

This starts:

```text
DNS Server → UDP 2053
Redis      → TCP 6379
```

---

## Run in Background

```bash
docker compose up -d
```

---

## Check Containers

```bash
docker compose ps
```

---

## View DNS Server Logs

```bash
docker compose logs -f dns-server
```

---

## Stop the Environment

```bash
docker compose down
```

---

#  Testing the DNS Server

The DNS server accepts queries on:

```text
127.0.0.1:2053
```

If `dig` is installed, you can test it with:

```bash
dig @127.0.0.1 -p 2053 example.com
```

For an `A` record:

```bash
dig @127.0.0.1 -p 2053 example.com A
```

For an `AAAA` record:

```bash
dig @127.0.0.1 -p 2053 example.com AAAA
```

For a CNAME record:

```bash
dig @127.0.0.1 -p 2053 www.example.com CNAME
```

---

#  Example DNS Query Flow

A request such as:

```bash
dig @127.0.0.1 -p 2053 example.com A
```

follows this flow:

```text
dig
 │
 │ UDP DNS Query
 ▼
DNS Server :2053
 │
 ▼
Parse Packet
 │
 ▼
Generate Cache Key
 │
 ▼
Redis
 │
 ├── HIT ──────────────► Return Cached Response
 │
 └── MISS
       │
       ▼
   Upstream DNS
       │
       ▼
   Parse Response
       │
       ▼
   Cache Response
       │
       ▼
   Build Packet
       │
       ▼
      dig
```

---

#  What This Project Demonstrates

This project provides practical experience with several important systems and networking concepts:

### Networking

- UDP communication
- Client-server architecture
- DNS protocol
- Network packet processing
- Binary data manipulation
- Ports and sockets

### Systems Programming Concepts

- Byte-level packet parsing
- Buffer manipulation
- Binary encoding/decoding
- Protocol implementation
- State handling
- Error handling

### Distributed Systems Concepts

- Caching
- Cache invalidation through TTL
- Upstream forwarding
- External service communication
- Multi-container architecture

### Backend Engineering

- Modular TypeScript architecture
- Configuration management
- Redis integration
- Dockerization
- Service orchestration

---

#  DNS Concepts Covered

Through this project, the following DNS concepts are implemented or explored:

```text
DNS
│
├── DNS Message
│   ├── Header
│   ├── Question
│   ├── Answer
│   ├── Authority
│   └── Additional
│
├── DNS Records
│   ├── A
│   ├── AAAA
│   ├── CNAME
│   ├── NS
│   └── TXT
│
├── DNS Transport
│   └── UDP
│
├── DNS Resolution
│   └── Upstream Resolver
│
├── DNS Compression
│   └── Compression Pointers
│
└── DNS Caching
    ├── Redis
    └── TTL
```

---

#  Documentation & Architecture

Project diagrams and supporting documentation are available in the `docs/` directory.

### Architecture

<p align="center">
  <img src="docs/architecture.png" alt="DNS Server Architecture" width="90%">
</p>

### DNS Packet Structure

<p align="center">
  <img src="docs/dns-packet.png" alt="DNS Packet Structure" width="90%">
</p>

### Redis Cache Flow

<p align="center">
  <img src="docs/redis-cache.png" alt="Redis DNS Cache Flow" width="90%">
</p>

> **Note:** If your actual filenames are different, update the image paths above to match the files inside `docs/`.

---

#  Configuration

The DNS server supports configurable upstream DNS resolution and Redis connectivity.

Typical configuration values include:

```text
RESOLVER=1.1.1.1:53

REDIS_HOST=localhost
REDIS_PORT=6379
```

When using Docker Compose, Redis can be accessed through:

```text
REDIS_HOST=redis
REDIS_PORT=6379
```

---

#  Future Improvements

Possible future extensions include:

- TCP-based DNS support
- DNSSEC support
- Additional DNS record types
- Negative caching improvements
- DNS query metrics
- Structured logging
- Rate limiting
- Health checks
- Cache statistics
- Prometheus metrics
- Graceful shutdown handling
- Improved automated testing
- DNS-over-HTTPS
- DNS-over-TLS
- Recursive DNS resolution
- Configuration through environment variables
- Performance benchmarking

---

#  Learning Objectives

The project was developed with the following goals:

1. Understand how DNS works internally.
2. Learn how DNS packets are structured.
3. Implement packet parsing without relying on a high-level DNS library.
4. Understand UDP-based networking.
5. Implement DNS domain-name compression.
6. Understand upstream DNS resolution.
7. Implement a real caching layer using Redis.
8. Understand TTL-based cache expiration.
9. Learn Docker-based service deployment.
10. Build a modular protocol-level networking application.

---

#  Project Status

The core DNS server functionality is implemented and the project can be run locally using Bun or through Docker Compose.

Current functionality includes:

-   DNS packet parsing
-   DNS packet construction
-   DNS header handling
-   DNS question handling
-   DNS answer handling
-   Domain-name compression
-   Multi-question queries
-   UDP DNS communication
-   Upstream DNS forwarding
-   Redis caching
-   TTL-aware caching
-   Docker support
-   Docker Compose integration
-   Common DNS record types

---

#  Contributing

Contributions, suggestions, and improvements are welcome.

To contribute:

```bash
git clone https://github.com/apoorva9-sudo/dns-server.git
cd dns-server
bun install
```

Create a feature branch:

```bash
git checkout -b feature/your-feature
```

Make your changes, test them, and create a pull request.

---

#  License

This project is open source and available under the **MIT License**.

See the `LICENSE` file for more information.

---

#  Author

**Apoorva R**

GitHub:

https://github.com/apoorva9-sudo

Project:

https://github.com/apoorva9-sudo/dns-server

---

##  Support

If you found this project useful for learning DNS, networking, backend engineering, or systems programming, consider giving the repository a  on GitHub.

---

<p align="center">
  Built to understand DNS from the packet level up.
</p>