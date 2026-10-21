# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


## Development

### Run a local Kafka Server
```
docker run -d \
  --name kafka-test \
  -p 9092:9092 -p 9093:9093 \
  --restart unless-stopped \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES='broker,controller' \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP='CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT' \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS='1@localhost:9093' \
  -e KAFKA_LISTENERS='PLAINTEXT://:9092,CONTROLLER://:9093' \
  -e KAFKA_ADVERTISED_LISTENERS='PLAINTEXT://localhost:9092' \
  -e KAFKA_CONTROLLER_LISTENER_NAMES='CONTROLLER' \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 \
  -e KAFKA_HEAP_OPTS="-Xmx512M -Xms512M" \
  apache/kafka:4.3.0-rc1
```

### Seed mock Kafka data
Install the script dependencies first:

```bash
pnpm add kafkajs
pnpm add -D tsx @types/node
```

Run the seeding script and pass the target broker explicitly:

```bash
pnpm mock:kafka -- --broker=server:9002
```

Or specify a different broker and topic prefix:

```bash
pnpm mock:kafka -- --broker=localhost:9092 --prefix=demo
```

Force reseeding even when the topics already contain matching data or the consumer groups already exist:

```bash
pnpm mock:kafka -- --broker=localhost:9092 --prefix=demo --force
```

The script will:

- create `*-json-topic`, `*-string-topic`, and `*-mixed-topic`
- write JSON strings, plain strings, and binary buffer payloads
- create `*-huge-string-topic` and write 100000 messages in batches
- create three consumer groups for full consumption, partial consumption, and idle/no-consumption scenarios
- skip reseeding existing topics or consumer groups unless `--force` is provided

## Testing

### End-to-end tests

E2E tests use [Playwright](https://playwright.dev/) and live in `e2e/`.

```bash
pnpm test:e2e
```

Interactive UI mode:

```bash
pnpm exec playwright test --ui
```

`playwright.config.ts` starts `pnpm web:dev` (http://localhost:1420) automatically
and reuses an already running dev server outside CI.

#### Browser

By default the locally installed Google Chrome is used (`channel: 'chrome'`)
because the bundled Chromium download is not always reachable. Override it with
`PLAYWRIGHT_BROWSER_CHANNEL`, or use the bundled build:

```bash
pnpm exec playwright install chromium
PLAYWRIGHT_BROWSER_CHANNEL= pnpm test:e2e
```
