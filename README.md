# Qubetics Indexer Service

Backend indexer for the Qubetics blockchain explorer. It follows the Qubetics EVM/Tendermint node and stores blocks, transactions, internal transactions, contracts, tokens, holders, validators and network statistics in PostgreSQL. It also pushes live updates to explorer clients over Socket.IO.

> **Branch:** `feature/cicd`. This README describes the configuration, jobs and queues as implemented on this branch.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [Docker](#docker)
- [Database & Migrations](#database--migrations)
- [Background Jobs & Queues](#background-jobs--queues)
- [API & Real-time Events](#api--real-time-events)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Security](#security)
- [License](#license)

## Architecture

```
                 ┌──────────────────────────┐
                 │  Qubetics Node (EVM/TM)  │
                 │   HTTP RPC  ·  WebSocket │
                 └────────────┬─────────────┘
                              │ new blocks / RPC / debug_trace
                              ▼
┌─────────────┐   ┌──────────────────────────┐   ┌──────────────┐
│  RabbitMQ   │◄─►│  Qubetics Indexer Service │◄─►│    Redis     │
│ (job queues)│   │  Cron · Consumers · WS    │   │ (cache/state)│
└─────────────┘   └────────────┬─────────────┘   └──────────────┘
                               │ Prisma ORM
                               ▼
                       ┌──────────────┐        Socket.IO
                       │  PostgreSQL  │   ───────────────►  Explorer UI
                       └──────────────┘
```

**How a block is indexed**

1. The service subscribes to new block headers over the node WebSocket (`EVM_TENDERMINT_NODE_WS_URL`).
2. Block numbers are published to RabbitMQ queues (`BLOCKS_*`, `TRANSACTIONS`, `CONTRACT_AND_TOKENS` and others).
3. Consumers fetch the full block and transaction data over RPC, decode logs, contracts and tokens, then save the results through Prisma.
4. Downtime blocks are reprocessed on startup, and cron jobs run the scheduled tasks listed under [Background Jobs & Queues](#background-jobs--queues).
5. Aggregated stats are cached in Redis and broadcast to connected clients over Socket.IO.

## Tech Stack

| Concern         | Technology                                    |
| --------------- | --------------------------------------------- |
| Runtime         | Node.js 18, TypeScript 5                      |
| HTTP / Realtime | Express 4, Socket.IO 4, Helmet, CORS          |
| Blockchain      | web3.js 1.x, bech32 (Cosmos addresses) |
| Persistence     | PostgreSQL + Prisma 5 (with read replicas extension) |
| Messaging       | RabbitMQ (`amqplib`)                          |
| Caching         | Redis 4                                       |
| Scheduling      | `cron`                                        |
| Logging         | Winston                                       |
| Quality         | ESLint (Airbnb), Prettier, Husky, Jest        |

## Prerequisites

- **Node.js** 18.x and **npm**
- **PostgreSQL** 13 or later
- **Redis** 6 or later
- **RabbitMQ** 3.x
- Access to a **Qubetics node** exposing:
  - EVM JSON-RPC over HTTP, with the `debug` namespace enabled for internal transactions
  - A WebSocket endpoint for new block subscriptions
  - The Cosmos/Tendermint REST API, for validators and staking data

## Getting Started

```bash
# 1. Clone
git clone https://github.com/Qubetics/qubetics-indexer-service.git
cd qubetics-indexer-service

# 2. Install dependencies
npm install

# 3. Configure the environment
cp .env.example .env
# edit .env (see Configuration below)

# 4. Generate the Prisma client and apply migrations
npm run generate:prisma
npm run migrate:dev

# 5. Start in development mode (hot reload)
npm run dev
```

On success, the service logs `Listening on ...:<PORT>`. You can check it is up with:

```bash
curl http://localhost:<PORT>/qubetics/status
# {"message":"success"}
```

## Configuration

The env file is chosen from `NODE_ENV`:

| `NODE_ENV`             | File loaded  | Notes                                       |
| ---------------------- | ------------ | ------------------------------------------- |
| `local` / unset / other | `.env`       | Required. Startup fails if it is missing.   |
| `test`                 | `.env.test`  | Required.                                   |
| `staging`              | `.env.stag`  | Required.                                   |
| `production`           | `.env.prod`  | Optional. Falls back to process environment variables. |

### Environment Variables

| Variable                     | Required | Default      | Description                                                        |
| ---------------------------- | :------: | ------------ | ------------------------------------------------------------------ |
| `NODE_ENV`                   |          | `dev`        | Runtime environment (see table above).                             |
| `PORT`                       |          | `3146`       | HTTP and Socket.IO port.                                           |
| `DATABASE_URL`               |    ✅    |              | PostgreSQL connection string used by Prisma.                       |
| `DATABASE_REPLICA_URL`       |          |              | Read-replica connection string, if one is used.                   |
| `REDIS_HOST`                 |    ✅    |              | Redis host.                                                        |
| `REDIS_PORT`                 |    ✅    |              | Redis port.                                                        |
| `RABITMQ_URL`                |    ✅    |              | RabbitMQ AMQP URL, e.g. `amqp://guest:guest@localhost`.            |
| `CLUSTER`                    |    ✅    |              | `true` or `false`. Parsed with `JSON.parse`; startup fails if unset. |
| `EVM_TENDERMENT_HTTP_HOST`   |    ✅    |              | Node EVM JSON-RPC HTTP endpoint.                                   |
| `EVM_TENDERMINT_NODE_WS_URL` |    ✅    |              | Node WebSocket endpoint for block subscriptions.                   |
| `SWAGGER_HTTP_HOST`          |    ✅    |              | Cosmos/Tendermint REST (LCD) base URL.                             |
| `ADDRESS_PREFIX`             |    ✅    |              | Bech32 account address prefix.                                     |
| `PROJECT_NAME`               |          | `qubetics`   | Project identifier used in keys and labels.                        |
| `TOKEN_SYMBOL`               |    ✅    |              | Native token symbol.                                               |
| `TOKEN_CURRENCY`             |    ✅    |              | Fiat currency for price conversion, e.g. `USD`.                    |
| `COIN_MARKET_API_PATH`       |          |              | CoinMarketCap API base URL.                                        |
| `COIN_MARKET_API_KEY`        |          |              | CoinMarketCap API key.                                             |
| `BYTE_DIRECTORY`             |          |              | Directory used for contract bytecode and verification artifacts.   |
| `SECRET_KEY`                 |          |              | Application secret.                                                |
| `SALT_VALUE`                 |          | `10`         | Hashing salt rounds.                                               |

> **Never commit real `.env*` files.** Keep secrets in your deployment platform's secret manager.

## Running the Service

| Command                    | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `npm run dev`              | Run from TypeScript sources with hot reload (nodemon + ts-node). |
| `npm run start:local`      | Lint, then run with `NODE_ENV=local` and hot reload.           |
| `npm start`                | Run once with ts-node (no build step).                         |
| `npm run build:prod`       | Compile TypeScript to `build/`.                                |
| `npm run build:test`       | Lint, compile, and copy `.env` and `.env.test` into `build/`.  |
| `npm run build:stag`       | Lint, compile, and copy `.env` and `.env.stag` into `build/`.  |
| `npm run start:production` | Run the compiled build with `NODE_ENV=production`.             |
| `npm run start:staging`    | Run the compiled build with `NODE_ENV=staging`.                |
| `npm run start:test`       | Run the compiled build with `NODE_ENV=test`.                   |

**Production build**

```bash
npm ci
npm run generate:prisma
npm run build:prod
NODE_ENV=production node build/server.js   # or: npm run start:production
```

## Docker

The image runs on `node:18-alpine`, generates the Prisma client, compiles the service and starts it with `npm run start:production` as the non-root `node` user. It exposes port **7300**, so set `PORT=7300`, or map ports to match.

```bash
docker build -t qubetics-indexer-service .

docker run -d --name qubetics-indexer \
  --env-file .env.prod \
  -e NODE_ENV=production \
  -e PORT=7300 \
  -p 7300:7300 \
  qubetics-indexer-service
```

PostgreSQL, Redis, RabbitMQ and the Qubetics node must be reachable from inside the container. Apply database migrations before the first start (see below).

## Database & Migrations

The schema is in [`prisma/schema.prisma`](prisma/schema.prisma). Main models: `Users`, `Blocks`, `Transactions`, `CoinTransaferTx`, `Contracts`, `Tokens`, `Holders`, `ContractLogs`, `CoinmarketInfo`, `TxFee`, `Validator`, `DecodedLogs`, `ContractVerification`.

| Command                          | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| `npm run generate:prisma`        | Generate the Prisma client.                           |
| `npm run migrate:dev`            | Create and apply migrations (development).            |
| `npm run migrate:create`         | Create a migration without applying it.               |
| `npx prisma migrate deploy`      | Apply pending migrations (staging and production).    |
| `npm run db:studio`              | Open Prisma Studio to inspect data.                   |

## Background Jobs & Queues

**RabbitMQ queues:** `BLOCKS` (plus sharded `BLOCKS_<n>`), `USERS`, `ERROR_BLOCK`, `TRANSACTIONS`, `MISSING_BLOCK`, `DOWNTIME_BLOCK`, `VALIDATOR_DETAIL`, `CONTRACT_AND_TOKENS`, `STATS_UPDATE`.

**Scheduled jobs.** Started at boot from [`src/server.ts`](src/server.ts) (implementations in [`src/cron/index.ts`](src/cron/index.ts)):

- Statistics updater (`StatsUpdater`)
- Live block subscription over WebSocket (`subscribeBlocksWs`)
- Downtime block processing (`ProcessDowntimeBlock`)
- Token price snapshot (`saveTokenPrice`)
- Validator set refresh (`checkValidators`)
- Graph updates (`updateGraph`)
- Pending transaction reconciliation (`checkPendingTransaction`)

The service is stateful: it consumes queues and runs cron jobs. If you run more than one instance, make sure only one of them runs the scheduled jobs, or the work will be duplicated.

## API & Real-time Events

**HTTP**

| Method | Path               | Description   |
| ------ | ------------------ | ------------- |
| GET    | `/`                | Base path     |
| GET    | `/qubetics/status` | Health check  |

**Socket.IO** (same host and port), events emitted to clients:

`LATEST_BLOCK`, `LATEST_TRANSACTION`, `TX_SUMMARY`, `ANALYTICS`, `CONTRACT_DEPLOYED_GRAPH`, `COIN_TRANSFER_GRAPH`, `ALL_TRANSACTIONS_GRAPH`, `ACCOUNT_TX_GRAPH`, `TOKEN_TX_GRAPH`, `VALIDATOR_WIDGET`.

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:7300');
socket.on('LATEST_BLOCK', (block) => console.log(block));
```

## Project Structure

```
.
├── prisma/                 # Prisma schema and SQL migrations
├── src/
│   ├── server.ts           # Entry point: HTTP, Socket.IO, WS subscription, cron bootstrap
│   ├── App.ts              # Express app and middleware
│   ├── routes.ts           # HTTP routes
│   ├── global.ts           # Global environment binding
│   ├── environments/       # Env loading and typed configuration
│   ├── constant/           # ABIs, constants, queue and event names
│   ├── cron/               # Scheduled jobs
│   ├── service/            # RabbitMQ, Redis, Socket.IO and stats services
│   ├── helper/             # Web3, Cosmos, explorer, validator, caching and processing logic
│   ├── lib/                # DB client, logger and utilities
│   └── interface/          # Shared types
├── Dockerfile
├── LICENSE
├── deployment.yaml       # Kubernetes deployment manifest
├── nodemon.json
└── tsconfig.json
```

## Development Workflow

```bash
npm run lint        # ESLint
npm run lint-fix    # ESLint with auto-fix
npm run pretty      # Prettier formatting
npm test            # Jest with coverage (NODE_ENV=test)
```

Husky git hooks run lint and format checks before commits and pushes. Branches: `master` (main), with environment branches such as `testnet`.

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities. Do not open public issues for security problems.

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Qubetics
