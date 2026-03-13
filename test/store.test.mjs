import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createLocalTemplate, getStorePaths, readStore, writeStore } from '../src/store.mjs';

function makeTempCwd() {
  return mkdtempSync(join(tmpdir(), 'dotlink-test-'));
}

const localScope = { scope: 'local' };

test('readStore should initialize empty store', () => {
  const cwd = makeTempCwd();
  const state = readStore(cwd, localScope);
  assert.deepEqual(state.data, { module: {} });
});

test('writeStore dry-run should not change file', async () => {
  const cwd = makeTempCwd();
  const { data } = readStore(cwd, localScope);
  data.module.test = { links: [{ src: 'a', dst: 'b' }] };

  const result = await writeStore(data, { cwd, dryRun: true, ...localScope });
  assert.equal(result.changed, true);

  const after = readStore(cwd, localScope);
  assert.deepEqual(after.data, { module: {} });
});

test('writeStore should persist and backup old content', async () => {
  const cwd = makeTempCwd();
  const initial = { module: { alpha: { links: [{ src: 'a', dst: 'b' }] } } };
  const first = await writeStore(initial, { cwd, ...localScope });
  assert.equal(first.changed, true);
  assert.equal(first.backupPath, null);

  const secondData = readStore(cwd, localScope).data;
  secondData.module.alpha.links.push({ src: 'c', dst: 'd' });
  const second = await writeStore(secondData, { cwd, ...localScope });
  assert.equal(second.changed, true);
  assert.ok(second.backupPath);

  const linksRaw = readFileSync(join(cwd, 'local.symlinks.toml'), 'utf-8');
  assert.match(linksRaw, /src = "c"/);
});

test('readStore should migrate legacy links.toml to symlinks.toml', () => {
  const cwd = makeTempCwd();
  writeFileSync(
    join(cwd, 'links.toml'),
    `[module.legacy]\nlinks = [\n  { src = "a", dst = "b" },\n]\n`,
    'utf-8',
  );

  const state = readStore(cwd, { filePath: join(cwd, 'symlinks.toml') });
  assert.equal(state.filePath.endsWith('symlinks.toml'), true);
  assert.equal(state.data.module.legacy.links.length, 1);
});

test('createLocalTemplate should create local.symlinks.toml', () => {
  const cwd = makeTempCwd();
  const result = createLocalTemplate(cwd);
  assert.equal(result.created, true);
  const paths = getStorePaths(cwd);
  const raw = readFileSync(paths.local, 'utf-8');
  assert.match(raw, /module\.sample/);
});
