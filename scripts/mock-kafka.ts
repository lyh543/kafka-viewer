import { Buffer } from 'node:buffer';
import process from 'node:process';
import { Command } from 'commander';
import {
  Kafka,
  type Admin,
  type ITopicConfig,
  logLevel,
  type Message,
} from 'kafkajs';

type TopicSeed = {
  topic: string;
  messages: Message[];
};

type ConsumptionResult = {
  groupId: string;
  mode: 'full' | 'partial' | 'idle';
  consumedCount: number;
  topics: string[];
};

type TopicSeedDecision = {
  topic: string;
  existingCount: number;
  expectedCount: number;
  shouldSeed: boolean;
  reason: string;
};

type CliOptions = {
  broker: string;
  prefix: string;
  force: boolean;
};

const LARGE_TOPIC_MESSAGE_COUNT = 100_000;
const PRODUCE_BATCH_SIZE = 1_000;

const options = parseCliOptions();
const brokerValue = options.broker;
const brokers = brokerValue
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const prefix = options.prefix;
const clientId = `${prefix}-seed-client`;

if (brokers.length === 0) {
  throw new Error('At least one Kafka broker is required. Use --broker=host:port.');
}

const topicSeeds = buildTopicSeeds(prefix);

function parseCliOptions(): CliOptions {
  const program = new Command();

  program
    .name('mock-kafka')
    .description('Seed Kafka topics with mock messages and create consumer group states.')
    .requiredOption(
      '--broker <brokers>',
      'Kafka broker list, comma separated',
    )
    .option(
      '--prefix <prefix>',
      'Prefix applied to generated topic and consumer group names',
      process.env.KAFKA_MOCK_PREFIX ?? 'mock',
    )
    .option('--force', 'Force reseeding even when matching topics or consumer groups already exist')
    .showHelpAfterError('(run with --help to see available options)');

  if (process.argv.length <= 2) {
    program.help({ error: false });
  }

  program.parse(process.argv);

  const parsed = program.opts<CliOptions>();
  return {
    broker: parsed.broker,
    prefix: parsed.prefix,
    force: Boolean(parsed.force),
  };
}

async function main(): Promise<void> {
  logInfo(
    `Starting Kafka mock seed. brokers=${brokers.join(', ')} prefix=${prefix} force=${options.force}`,
  );

  const kafka = new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.NOTHING,
  });
  const admin = kafka.admin();
  const producer = kafka.producer();
  const regularTopicSeeds = topicSeeds.slice(0, 3);

  try {
    logStep('Connecting Kafka admin client...');
    await admin.connect();
    logSuccess('Kafka admin client connected.');

    logStep('Connecting Kafka producer...');
    await producer.connect();
    logSuccess('Kafka producer connected.');

    logStep('Ensuring seed topics exist...');
    await ensureTopics(admin, topicSeeds);
    logSuccess('Topic existence check completed.');

    logStep('Inspecting topic state for idempotent seeding...');
    const seedPlan = await planTopicSeeding(admin, topicSeeds, options.force);
    logTopicSeedPlan(seedPlan);

    logStep('Producing topic messages...');
    await seedTopics(producer, topicSeeds, seedPlan);
    logSuccess('Topic message production step completed.');

    logStep('Inspecting existing consumer groups...');
    const existingGroups = await listGroupIds(admin);
    logInfo(`Detected ${existingGroups.size} existing consumer groups.`);

    const fullResult = await maybeConsumeWithLimit(
      kafka,
      existingGroups,
      `${prefix}-full-consumer-group`,
      regularTopicSeeds.map((item) => item.topic),
      regularTopicSeeds.reduce((total, item) => total + item.messages.length, 0),
      'full',
      options.force,
    );

    const partialResult = await maybeConsumeWithLimit(
      kafka,
      existingGroups,
      `${prefix}-partial-consumer-group`,
      [topicSeeds[3].topic],
      2,
      'partial',
      options.force,
    );

    const idleResult = await maybeCreateIdleConsumerGroup(
      kafka,
      admin,
      existingGroups,
      `${prefix}-idle-consumer-group`,
      topicSeeds[0].topic,
      options.force,
    );

    logSuccess('All seeding steps completed.');
    printSummary(topicSeeds, [fullResult, partialResult, idleResult]);
  } finally {
    logStep('Disconnecting Kafka clients...');
    await Promise.allSettled([producer.disconnect(), admin.disconnect()]);
    logSuccess('Kafka clients disconnected.');
  }
}

function buildTopicSeeds(seedPrefix: string): TopicSeed[] {
  return [
    {
      topic: `${seedPrefix}-json-topic`,
      messages: [
        jsonMessage('user.created', { id: 1, name: 'Ada', region: 'cn-north-1' }),
        jsonMessage('order.paid', { orderId: 'A-1001', amount: 188.5, currency: 'CNY' }),
        jsonMessage('feature.flag', { key: 'beta-dashboard', enabled: true }),
        jsonMessage('inventory.low', { sku: 'coffee-beans', remain: 7 }),
      ],
    },
    {
      topic: `${seedPrefix}-string-topic`,
      messages: [
        stringMessage('INFO: api gateway started'),
        stringMessage('WARN: consumer lag increased to 120'),
        stringMessage('ERROR: payment callback timeout'),
        stringMessage('DEBUG: rebalance completed'),
      ],
    },
    {
      topic: `${seedPrefix}-mixed-topic`,
      messages: [
        jsonMessage('audit.login', { user: 'tom', success: true }),
        stringMessage('plain-text payload for smoke test'),
        bufferMessage({ source: 'etl-job', chunk: 1, size: 2048 }),
        stringMessage('csv-like,row,with,comma'),
        bufferMessage({ source: 'etl-job', chunk: 2, size: 4096 }),
      ],
    },
    {
      topic: `${seedPrefix}-huge-string-topic`,
      messages: buildLargeTopicMessages(),
    },
  ];
}

function buildLargeTopicMessages(): Message[] {
  return Array.from({ length: LARGE_TOPIC_MESSAGE_COUNT }, (_, index) =>
    stringMessage(
      `bulk-log-${String(index + 1).padStart(6, '0')}|source=mock-kafka|level=${index % 15 === 0 ? 'WARN' : 'INFO'}|payload=${JSON.stringify({
        batch: Math.floor(index / PRODUCE_BATCH_SIZE) + 1,
        sequence: index + 1,
        shard: index % 12,
      })}`,
    ),
  );
}

function jsonMessage(type: string, payload: Record<string, unknown>): Message {
  return {
    key: type,
    headers: { 'content-type': 'application/json' },
    value: JSON.stringify({ type, payload, createdAt: new Date().toISOString() }),
  };
}

function stringMessage(text: string): Message {
  return {
    headers: { 'content-type': 'text/plain' },
    value: text,
  };
}

function bufferMessage(payload: Record<string, unknown>): Message {
  return {
    headers: { 'content-type': 'application/octet-stream' },
    value: Buffer.from(JSON.stringify(payload), 'utf8'),
  };
}

async function ensureTopics(admin: Admin, seeds: TopicSeed[]): Promise<void> {
  const existingTopics = new Set(await admin.listTopics());
  const topics: ITopicConfig[] = seeds
    .filter((seed) => !existingTopics.has(seed.topic))
    .map((seed) => ({
    topic: seed.topic,
    numPartitions: 1,
    replicationFactor: 1,
    }));

  if (topics.length === 0) {
    logInfo('All seed topics already exist.');
    return;
  }

  logInfo(`Creating ${topics.length} missing topics: ${topics.map((topic) => topic.topic).join(', ')}`);

  await admin.createTopics({
    waitForLeaders: true,
    topics,
  });
}

async function planTopicSeeding(
  admin: Admin,
  seeds: TopicSeed[],
  force: boolean,
): Promise<TopicSeedDecision[]> {
  const decisions: TopicSeedDecision[] = [];

  for (const seed of seeds) {
    const existingCount = await getTopicMessageCount(admin, seed.topic);
    const expectedCount = seed.messages.length;

    if (force) {
      decisions.push({
        topic: seed.topic,
        existingCount,
        expectedCount,
        shouldSeed: true,
        reason: 'force mode enabled',
      });
      continue;
    }

    if (existingCount >= expectedCount) {
      decisions.push({
        topic: seed.topic,
        existingCount,
        expectedCount,
        shouldSeed: false,
        reason: `already contains ${existingCount} messages, expected ${expectedCount}`,
      });
      continue;
    }

    if (existingCount > 0) {
      decisions.push({
        topic: seed.topic,
        existingCount,
        expectedCount,
        shouldSeed: false,
        reason: `already contains ${existingCount} messages; skipping to avoid duplicate seed data`,
      });
      continue;
    }

    decisions.push({
      topic: seed.topic,
      existingCount,
      expectedCount,
      shouldSeed: true,
      reason: 'topic is empty',
    });
  }

  return decisions;
}

async function getTopicMessageCount(admin: Admin, topic: string): Promise<number> {
  const offsets = await admin.fetchTopicOffsets(topic);
  return offsets.reduce((total, partition) => total + Number(partition.high) - Number(partition.low), 0);
}

function logTopicSeedPlan(decisions: TopicSeedDecision[]): void {
  for (const decision of decisions) {
    const summary = `${decision.topic}: existing=${decision.existingCount}, expected=${decision.expectedCount}`;
    if (decision.shouldSeed) {
      logInfo(`Seed plan -> produce ${summary}; reason=${decision.reason}`);
    } else {
      logInfo(`Seed plan -> skip ${summary}; reason=${decision.reason}`);
    }
  }
}

async function seedTopics(
  producer: ReturnType<Kafka['producer']>,
  seeds: TopicSeed[],
  seedPlan: TopicSeedDecision[],
): Promise<void> {
  for (const seed of seeds) {
    const decision = seedPlan.find((item) => item.topic === seed.topic);
    if (!decision?.shouldSeed) {
      logInfo(`Skipping message production for ${seed.topic}. ${decision?.reason ?? 'No seed plan found.'}`);
      continue;
    }

    const totalBatches = Math.ceil(seed.messages.length / PRODUCE_BATCH_SIZE);
    logStep(`Producing ${seed.messages.length} messages to ${seed.topic} in ${totalBatches} batches...`);

    for (let start = 0; start < seed.messages.length; start += PRODUCE_BATCH_SIZE) {
      const batchIndex = Math.floor(start / PRODUCE_BATCH_SIZE) + 1;
      await producer.send({
        topic: seed.topic,
        messages: seed.messages.slice(start, start + PRODUCE_BATCH_SIZE),
      });

      if (totalBatches <= 10 || batchIndex === totalBatches || batchIndex % 10 === 0) {
        logInfo(
          `Produced batch ${batchIndex}/${totalBatches} for ${seed.topic} (${Math.min(start + PRODUCE_BATCH_SIZE, seed.messages.length)}/${seed.messages.length} messages).`,
        );
      }
    }

    logSuccess(`Finished producing ${seed.messages.length} messages to ${seed.topic}.`);
  }
}

async function listGroupIds(admin: Admin): Promise<Set<string>> {
  const result = await admin.listGroups();
  return new Set(result.groups.map((group) => group.groupId));
}

async function maybeConsumeWithLimit(
  kafka: Kafka,
  existingGroups: Set<string>,
  groupId: string,
  topics: string[],
  limit: number,
  mode: 'full' | 'partial',
  force: boolean,
): Promise<ConsumptionResult> {
  if (!force && existingGroups.has(groupId)) {
    logInfo(`Skipping ${groupId} (${mode}) because the consumer group already exists. Use --force to rerun.`);
    return {
      groupId,
      mode,
      consumedCount: 0,
      topics: topics.map((topic) => `${topic} (skipped: existing consumer group)`),
    };
  }

  logStep(`Running ${mode} consumer group ${groupId} for ${limit} messages across topics: ${topics.join(', ')}`);
  const result = await consumeWithLimit(kafka, groupId, topics, limit, mode);
  existingGroups.add(groupId);
  logSuccess(`Consumer group ${groupId} completed with ${result.consumedCount} consumed messages.`);
  return result;
}

async function consumeWithLimit(
  kafka: Kafka,
  groupId: string,
  topics: string[],
  limit: number,
  mode: 'full' | 'partial',
): Promise<ConsumptionResult> {
  const consumer = kafka.consumer({ groupId });
  let consumedCount = 0;
  let finished = false;

  const done = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out while waiting for ${groupId} to consume ${limit} messages.`));
    }, 30_000);

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      resolve();
    };

    void (async () => {
      try {
        await consumer.connect();
        for (const topic of topics) {
          await consumer.subscribe({ topic, fromBeginning: true });
        }

        await consumer.run({
          autoCommit: false,
          eachBatchAutoResolve: false,
          eachBatch: async ({ batch, heartbeat, isRunning, isStale, resolveOffset }) => {
            for (const message of batch.messages) {
              if (!isRunning() || isStale() || finished) {
                return;
              }

              consumedCount += 1;
              resolveOffset(message.offset);
              await consumer.commitOffsets([
                {
                  topic: batch.topic,
                  partition: batch.partition,
                  offset: `${Number(message.offset) + 1}`,
                },
              ]);
              await heartbeat();

              if (consumedCount >= limit) {
                finish();
                return;
              }
            }
          },
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    })();
  });

  try {
    await done;
  } finally {
    await Promise.allSettled([consumer.stop(), consumer.disconnect()]);
  }

  return {
    groupId,
    mode,
    consumedCount,
    topics,
  };
}

async function createIdleConsumerGroup(
  kafka: Kafka,
  admin: Admin,
  groupId: string,
  topic: string,
): Promise<ConsumptionResult> {
  const consumer = kafka.consumer({ groupId });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async ({ batch }) => {
        const firstMessage = batch.messages[0];
        if (!firstMessage) {
          return;
        }

        await consumer.commitOffsets([
          {
            topic: batch.topic,
            partition: batch.partition,
            offset: firstMessage.offset,
          },
        ]);
        throw new Error('__idle_group_ready__');
      },
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== '__idle_group_ready__') {
      throw error;
    }
  } finally {
    await Promise.allSettled([consumer.stop(), consumer.disconnect()]);
  }

  const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
  const committedOffsets = offsets
    .flatMap((entry) => entry.partitions.map((partition) => `${partition.partition}:${partition.offset}`))
    .join(', ');

  return {
    groupId,
    mode: 'idle',
    consumedCount: 0,
    topics: [`${topic} (committed offsets: ${committedOffsets})`],
  };
}

async function maybeCreateIdleConsumerGroup(
  kafka: Kafka,
  admin: Admin,
  existingGroups: Set<string>,
  groupId: string,
  topic: string,
  force: boolean,
): Promise<ConsumptionResult> {
  if (!force && existingGroups.has(groupId)) {
    logInfo(`Skipping ${groupId} (idle) because the consumer group already exists. Use --force to rerun.`);
    const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
    const committedOffsets = offsets
      .flatMap((entry) => entry.partitions.map((partition) => `${partition.partition}:${partition.offset}`))
      .join(', ');

    return {
      groupId,
      mode: 'idle',
      consumedCount: 0,
      topics: [`${topic} (skipped: existing consumer group, committed offsets: ${committedOffsets})`],
    };
  }

  logStep(`Creating idle consumer group ${groupId} on topic ${topic}...`);
  const result = await createIdleConsumerGroup(kafka, admin, groupId, topic);
  existingGroups.add(groupId);
  logSuccess(`Idle consumer group ${groupId} created.`);
  return result;
}

function printSummary(seeds: TopicSeed[], results: ConsumptionResult[]): void {
  console.log(`Kafka mock data written to brokers: ${brokers.join(', ')}`);
  console.log('');
  console.log('Topics');
  for (const seed of seeds) {
    console.log(`- ${seed.topic}: ${seed.messages.length} messages`);
  }
  console.log('');
  console.log('Consumer groups');
  for (const result of results) {
    console.log(
      `- ${result.groupId}: mode=${result.mode}, consumed=${result.consumedCount}, topics=${result.topics.join('; ')}`,
    );
  }
}

function logInfo(message: string): void {
  console.log(`[${new Date().toISOString()}] INFO ${message}`);
}

function logStep(message: string): void {
  console.log(`[${new Date().toISOString()}] STEP ${message}`);
}

function logSuccess(message: string): void {
  console.log(`[${new Date().toISOString()}] OK   ${message}`);
}

void main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[${new Date().toISOString()}] ERROR Kafka mock seed failed: ${reason}`);
  process.exitCode = 1;
});