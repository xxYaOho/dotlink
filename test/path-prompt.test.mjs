import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { listPathCandidates } from '../src/path-prompt.mjs';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'dotlink-path-'));
  mkdirSync(join(root, 'config'));
  mkdirSync(join(root, 'config', 'opencode'));
  writeFileSync(join(root, 'config', 'opencode', 'AGENTS.md'), '# AGENTS\n', 'utf-8');
  writeFileSync(join(root, 'README.md'), '# dotlink\n', 'utf-8');
  return root;
}

test('listPathCandidates should list directory children with prefix', () => {
  const cwd = makeFixture();
  const values = listPathCandidates('config/op', { cwd });
  assert.ok(values.includes('config/opencode/'));
});

test('listPathCandidates should support fuzzy match', () => {
  const cwd = makeFixture();
  const values = listPathCandidates('config/opn', { cwd });
  assert.ok(values.includes('config/opencode/'));
});
