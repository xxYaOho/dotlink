import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  formatCandidatePreview,
  getCommonPrefix,
  getDot3Frame,
  getPseudoProgressPercent,
  listPathCandidates,
  shouldListCandidatesImmediately,
  shouldShowLoading,
} from '../src/path-prompt.mjs';

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
  const firstEvents = [];
  const secondEvents = [];
  let resolveRead;
  let readCount = 0;

  const readDir = () => {
    readCount += 1;
    return new Promise((resolve) => {
      resolveRead = () => resolve([
        { name: 'README.md', isDirectory: () => false },
      ]);
    });
  };
  let sleepCount = 0;

  await listPathCandidates('docs/RE', {
    cwd: '/tmp',
    readDir,
    sleep: async () => {
      sleepCount += 1;
      if (sleepCount === 2) resolveRead();
    },
    onProgress: (event) => firstEvents.push(event),
  });

  await listPathCandidates('docs/RE', {
    cwd: '/tmp',
    readDir,
    onProgress: (event) => secondEvents.push(event),
  });

  assert.equal(firstEvents[0]?.phase, 'loading');
  assert.equal(firstEvents.at(-1)?.percent, 100);
  assert.equal(secondEvents[0]?.fromCache, true);
  assert.equal(secondEvents[0]?.percent, 100);
  assert.equal(readCount, 1);
});

test('listPathCandidates should report unsupported home paths when home expansion is disabled', async () => {
  const cwd = makeFixture();
  const events = [];

  const values = await listPathCandidates('~/workspace/', {
    cwd,
    allowHome: false,
    onProgress: (event) => events.push(event),
  });

  assert.deepEqual(values, []);
  assert.equal(events[0]?.phase, 'unsupported_home');
});

test('listPathCandidates should skip loading updates for scans faster than 300ms', async () => {
  const cwd = makeFixture();
  const events = [];

  await listPathCandidates('config/op', {
    cwd,
    now: (() => {
      const values = [0, 100];
      return () => values.shift() ?? 100;
    })(),
    onProgress: (event) => events.push(event),
  });

  assert.ok(!events.some((event) => event.phase === 'loading'));
});

test('listPathCandidates should use dot3 frames while slow async scans are pending', async () => {
  const events = [];
  let resolveRead;
  let sleepCount = 0;

  await listPathCandidates('docs/RE', {
    cwd: '/tmp',
    readDir: () => new Promise((resolve) => {
      resolveRead = () => resolve([
        { name: 'README.md', isDirectory: () => false },
      ]);
    }),
    sleep: async () => {
      sleepCount += 1;
      if (sleepCount === 4) resolveRead();
    },
    onProgress: (event) => events.push(event),
  });

  const frames = events.filter((event) => event.phase === 'loading').map((event) => event.frame);
  assert.ok(frames.length >= 1);
  assert.ok(frames.every((frame) => ['.  ', '.. ', '...'].includes(frame)));
});

test('listPathCandidates should emit loading before slow async scans finish', async () => {
  const events = [];
  let resolveRead;
  const readDir = () => new Promise((resolve) => {
    resolveRead = () => resolve([
      { name: 'README.md', isDirectory: () => false },
    ]);
  });
  let sleepCount = 0;

  const valuesPromise = listPathCandidates('docs/RE', {
    cwd: '/tmp',
    readDir,
    sleep: async () => {
      sleepCount += 1;
      if (sleepCount === 2) resolveRead();
    },
    onProgress: (event) => events.push(event),
  });

  const values = await valuesPromise;

  assert.ok(events.some((event) => event.phase === 'loading'));
  assert.deepEqual(values, ['docs/README.md']);
});

test('getPseudoProgressPercent should slow down after 80 percent', () => {
  assert.equal(getPseudoProgressPercent(0), 0);
  assert.equal(getPseudoProgressPercent(1000), 80);
  assert.equal(getPseudoProgressPercent(11000), 90);
  assert.equal(getPseudoProgressPercent(60000), 100);
});

test('shouldShowLoading should require at least 300ms', () => {
  assert.equal(shouldShowLoading(299), false);
  assert.equal(shouldShowLoading(300), true);
});

test('getDot3Frame should cycle one to three dots', () => {
  assert.equal(getDot3Frame(0), '.  ');
  assert.equal(getDot3Frame(1), '.. ');
  assert.equal(getDot3Frame(2), '...');
  assert.equal(getDot3Frame(3), '.  ');
});

test('getCommonPrefix should return shared completion prefix', () => {
  assert.equal(getCommonPrefix(['docs/README.md', 'docs/RELEASE.md']), 'docs/RE');
  assert.equal(getCommonPrefix(['alpha', 'beta']), '');
});

test('shouldListCandidatesImmediately should return true when first tab cannot extend the prefix', () => {
  assert.equal(shouldListCandidatesImmediately(['alpha', 'beta'], ''), true);
  assert.equal(shouldListCandidatesImmediately(['docs/README.md', 'docs/RELEASE.md'], 'docs/R'), false);
  assert.equal(shouldListCandidatesImmediately(['docs/README.md'], 'docs/R'), false);
});

test('formatCandidatePreview should print one candidate per line', () => {
  assert.equal(formatCandidatePreview(['alpha', 'beta']), 'alpha\nbeta');
});
