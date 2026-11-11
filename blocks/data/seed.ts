// Fills a preview's empty Amplify Data tables with sample rows (Requirement 6.3).
// Runs in the Amplify build right after `npx ampx pipeline-deploy`:
//   - npx tsx blocks/data/seed.ts
// Never runs on `main`. A table that already has rows is left alone, so redeploys are safe.
//
// The agent writes the rows in amplify/data/seed.ts, keyed by model name:
//
//   import type { Seed } from '../../blocks/data/seed';
//   export default {
//     Contract: [{ title: 'Sample NDA', body: '...' }],
//   } satisfies Seed;
//
// `id`, `createdAt`, `updatedAt` and `__typename` are filled in when missing. Rows of an
// `allow.owner()` model are only visible to their owner: set `owner` in the row, or set
// RV_SEED_OWNER on the branch to give every row without one to that user.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BatchWriteItemCommand, DynamoDBClient, ScanCommand, type WriteRequest } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

export type Seed = Record<string, Record<string, unknown>[]>;

async function main(): Promise<void> {
  const branch = process.env.AWS_BRANCH ?? '';
  if (branch === 'main') return console.log('seed: skipped on main');

  const file = resolve('amplify/data/seed.ts');
  if (!existsSync(file)) return console.log('seed: no amplify/data/seed.ts');

  const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8')) as { custom?: { tables?: Record<string, string> } };
  const tables = outputs.custom?.tables ?? {};
  const seed = ((await import(pathToFileURL(file).href)) as { default?: Seed }).default ?? {};
  const owner = process.env.RV_SEED_OWNER?.trim();
  const ddb = new DynamoDBClient({});

  for (const [model, rows] of Object.entries(seed)) {
    const table = tables[model];
    if (!table) throw new Error(`seed: model ${model} has no table (is it in amplify/data/resource.ts?)`);
    const any = await ddb.send(new ScanCommand({ TableName: table, Limit: 1, Select: 'COUNT' }));
    if ((any.Count ?? 0) > 0 || any.LastEvaluatedKey) {
      console.log(`seed: ${model} already has rows`);
      continue;
    }

    const now = new Date().toISOString();
    const items: WriteRequest[] = rows.map((r) => ({
      PutRequest: {
        Item: marshall(
          { id: randomUUID(), createdAt: now, updatedAt: now, __typename: model, ...(owner ? { owner } : {}), ...r },
          { removeUndefinedValues: true, convertClassInstanceToMap: true },
        ),
      },
    }));

    for (let i = 0; i < items.length; i += 25) {
      let batch: WriteRequest[] = items.slice(i, i + 25);
      for (let tries = 0; batch.length; tries++) {
        if (tries > 8) throw new Error(`seed: ${model}: DynamoDB kept throttling`);
        if (tries) await new Promise((r) => setTimeout(r, 200 * 2 ** tries));
        const out = await ddb.send(new BatchWriteItemCommand({ RequestItems: { [table]: batch } }));
        batch = out.UnprocessedItems?.[table] ?? [];
      }
    }
    console.log(`seed: ${model} +${rows.length}`);
  }
}

// Only when run as a script, so `import type { Seed }` from the app has no side effects.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
