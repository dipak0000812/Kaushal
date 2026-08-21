import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { seed } from '../../src/db/seed/seed.js';
import { verifySeed } from '../../src/db/seed/verifySeed.js';

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_seed_integration' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Database Seed & Verification Pipeline', () => {
  it('runs seed() and completes without error', async () => {
    await seed({ skipConnect: true, skipDisconnect: true });
  });

  it('runs verifySeed() and passes all checks including department isolation and real DB document queries', async () => {
    const passed = await verifySeed({ skipConnect: true, skipDisconnect: true });
    assert.equal(passed, true, 'verifySeed must return true and pass all verification checks');
  });
});
