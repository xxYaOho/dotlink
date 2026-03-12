import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { migrateImport } from '../src/migrate.mjs';
import { readStore, writeStore } from '../src/store.mjs';

function makeTempRepo() {
  return mkdtempSync(join(tmpdir(), 'dotlink-migrate-'));
}

test('migrateImport should merge and dedupe by default', async () => {
  const cwd = makeTempRepo();
  await writeStore(
    {
      module: {
        alpha: {
          links: [{ src: 'a', dst: 'b' }],
        },
      },
    },
    { cwd },
  );

  const sourcePath = join(cwd, 'source.toml');
  writeFileSync(
    sourcePath,
    `[module.alpha]\nlinks = [\n  { src = "a", dst = "b" },\n  { src = "c", dst = "d" },\n]\n\n[module.beta]\nlinks = [\n  { src = "x", dst = "y" },\n]\n`,
    'utf-8',
  );

  await migrateImport({ from: sourcePath, cwd });
  const data = readStore(cwd).data;

  assert.equal(data.module.alpha.links.length, 2);
  assert.equal(data.module.beta.links.length, 1);
});

test('migrateImport should support dry-run', async () => {
  const cwd = makeTempRepo();
  const sourcePath = join(cwd, 'source.toml');
  writeFileSync(
    sourcePath,
    `[module.alpha]\nlinks = [\n  { src = "a", dst = "b" },\n]\n`,
    'utf-8',
  );

  const result = await migrateImport({ from: sourcePath, cwd, dryRun: true });
  assert.equal(result.dryRun, true);

  const data = readStore(cwd).data;
  assert.deepEqual(data.module, {});
});
