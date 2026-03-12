import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readStore, writeStore } from '../src/store.mjs';

function makeTempCwd() {
  return mkdtempSync(join(tmpdir(), 'dotlink-test-'));
}

test('readStore should initialize empty store', () => {
  const cwd = makeTempCwd();
  const state = readStore(cwd);
  assert.deepEqual(state.data, { module: {} });
});

test('writeStore dry-run should not change file', async () => {
  const cwd = makeTempCwd();
  const { data } = readStore(cwd);
  data.module.test = { links: [{ src: 'a', dst: 'b' }] };

  const result = await writeStore(data, { cwd, dryRun: true });
  assert.equal(result.changed, true);

  const after = readStore(cwd);
  assert.deepEqual(after.data, { module: {} });
});

test('writeStore should persist and backup old content', async () => {
  const cwd = makeTempCwd();
  const initial = { module: { alpha: { links: [{ src: 'a', dst: 'b' }] } } };
  const first = await writeStore(initial, { cwd });
  assert.equal(first.changed, true);
  assert.equal(first.backupPath, null);

  const secondData = readStore(cwd).data;
  secondData.module.alpha.links.push({ src: 'c', dst: 'd' });
  const second = await writeStore(secondData, { cwd });
  assert.equal(second.changed, true);
  assert.ok(second.backupPath);

  const linksRaw = readFileSync(join(cwd, 'links.toml'), 'utf-8');
  assert.match(linksRaw, /src = "c"/);
});
