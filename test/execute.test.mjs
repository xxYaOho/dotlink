import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeStore } from '../src/store.mjs';
import { runApply, runPlan } from '../src/execute.mjs';

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dotlink-exec-'));
  mkdirSync(join(root, 'srcfiles'), { recursive: true });
  writeFileSync(join(root, 'srcfiles', 'a.txt'), 'a', 'utf-8');
  return root;
}

test('runPlan should mark missing dst as link', async () => {
  const repoRoot = makeRepo();
  await writeStore(
    {
      module: {
        alpha: {
          links: [{ src: 'srcfiles/a.txt', dst: `${repoRoot}/out/a.txt` }],
        },
      },
    },
    { cwd: repoRoot },
  );

  const result = await runPlan({ repoRoot });
  assert.equal(result.summary.link, 1);
});

test('runApply should create symlink for missing dst', async () => {
  const repoRoot = makeRepo();
  const dst = `${repoRoot}/out/a.txt`;
  await writeStore(
    {
      module: {
        alpha: {
          links: [{ src: 'srcfiles/a.txt', dst }],
        },
      },
    },
    { cwd: repoRoot },
  );

  await runApply({ repoRoot });
  assert.equal(existsSync(dst), true);
});

test('runPlan should mark occupied dst as conflict in update mode', async () => {
  const repoRoot = makeRepo();
  const dst = `${repoRoot}/out/occupied.txt`;
  mkdirSync(join(repoRoot, 'out'), { recursive: true });
  writeFileSync(dst, 'occupied', 'utf-8');

  await writeStore(
    {
      module: {
        alpha: {
          links: [{ src: 'srcfiles/a.txt', dst }],
        },
      },
    },
    { cwd: repoRoot },
  );

  const result = await runPlan({ repoRoot, mode: 'update' });
  assert.equal(result.summary.conflict, 1);
});

test('runPlan should mark wrong_target as replace in update mode', async () => {
  const repoRoot = makeRepo();
  writeFileSync(join(repoRoot, 'srcfiles', 'b.txt'), 'b', 'utf-8');
  const dst = `${repoRoot}/out/a.txt`;
  mkdirSync(join(repoRoot, 'out'), { recursive: true });
  symlinkSync(join(repoRoot, 'srcfiles', 'b.txt'), dst);

  await writeStore(
    {
      module: {
        alpha: {
          links: [{ src: 'srcfiles/a.txt', dst }],
        },
      },
    },
    { cwd: repoRoot },
  );

  const result = await runPlan({ repoRoot, mode: 'update' });
  assert.equal(result.summary.replace, 1);
});
