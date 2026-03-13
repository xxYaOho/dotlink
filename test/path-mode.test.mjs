import test from 'node:test';
import assert from 'node:assert/strict';
import { getPathPromptOptions } from '../src/path-mode.mjs';

test('getPathPromptOptions should use project-relative src mode for local scope', () => {
  const result = getPathPromptOptions('local');

  assert.equal(result.src.allowHome, false);
  assert.equal(result.src.message, 'src（项目内相对路径，支持 Tab 补全）');
  assert.equal(result.dst.allowHome, true);
  assert.equal(result.dst.message, 'dst（支持 ~/ / 绝对路径，支持 Tab 补全）');
});

test('getPathPromptOptions should use filesystem src mode for global scope', () => {
  const result = getPathPromptOptions('global');

  assert.equal(result.src.allowHome, true);
  assert.equal(result.src.message, 'src（支持 ~/ / 绝对路径，支持 Tab 补全）');
  assert.equal(result.dst.allowHome, true);
});
