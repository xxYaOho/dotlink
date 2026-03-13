import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPseudoProgressPercent, listPathCandidates } from '../src/path-prompt.mjs';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'dotlink-path-'));
  mkdirSync(join(root, 'config'));
  mkdirSync(join(root, 'config', 'opencode'));
  writeFileSync(join(root, 'config', 'opencode', 'AGENTS.md'), '# AGENTS\n', 'utf-8');
   mkdirSync(join(root, 'home'));
   mkdirSync(join(root, 'home', 'workspace'));
   writeFileSync(join(root, 'home', 'workspace', 'README.md'), '# readme\n', 'utf-8');
   writeFileSync(join(root, 'home', 'workspace', 'notes-here.md'), '# note\n', 'utf-8');
  writeFileSync(join(root, 'README.md'), '# dotlink\n', 'utf-8');
  return root;
}

test('listPathCandidates should list directory children with prefix', async () => {
  const cwd = makeFixture();
  const values = await listPathCandidates('config/op', { cwd });
  assert.ok(values.includes('config/opencode/'));
});

test('listPathCandidates should support contains match when no prefix match exists', async () => {
  const cwd = makeFixture();
  const values = await listPathCandidates('config/enc', { cwd });
  assert.ok(values.includes('config/opencode/'));
});

test('listPathCandidates should prefer prefix matches over contains matches', async () => {
  const cwd = makeFixture();
  const values = await listPathCandidates('~/workspace/RE', {
    cwd,
    allowHome: true,
    homeDir: join(cwd, 'home'),
  });

  assert.deepEqual(values, ['~/workspace/README.md']);
});

test('listPathCandidates should expand tilde paths when home paths are allowed', async () => {
  const cwd = makeFixture();
  const values = await listPathCandidates('~/workspace/', {
    cwd,
    allowHome: true,
    homeDir: join(cwd, 'home'),
  });

  assert.ok(values.includes('~/workspace/README.md'));
});

test('listPathCandidates should emit loading progress before uncached scans and cached state afterwards', async () => {
  const cwd = makeFixture();
  const homeDir = join(cwd, 'home');
  const firstEvents = [];
  const secondEvents = [];

  await listPathCandidates('~/workspace/RE', {
    cwd,
    allowHome: true,
    homeDir,
    onProgress: (event) => firstEvents.push(event),
  });

  await listPathCandidates('~/workspace/RE', {
    cwd,
    allowHome: true,
    homeDir,
    onProgress: (event) => secondEvents.push(event),
  });

  assert.equal(firstEvents[0]?.phase, 'loading');
  assert.equal(firstEvents[0]?.percent, 0);
  assert.equal(firstEvents.at(-1)?.percent, 100);
  assert.equal(secondEvents[0]?.fromCache, true);
  assert.equal(secondEvents[0]?.percent, 100);
});

test('getPseudoProgressPercent should slow down after 80 percent', () => {
  assert.equal(getPseudoProgressPercent(0), 0);
  assert.equal(getPseudoProgressPercent(1000), 80);
  assert.equal(getPseudoProgressPercent(11000), 90);
  assert.equal(getPseudoProgressPercent(60000), 100);
});
