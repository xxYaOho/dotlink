import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompletion } from '../src/completions.mjs';

test('renderCompletion should support bash/zsh/fish', () => {
  const bash = renderCompletion('bash');
  const zsh = renderCompletion('zsh');
  const fish = renderCompletion('fish');

  assert.match(bash, /complete -F _dotlink_completions dotlink/);
  assert.match(zsh, /#compdef dotlink/);
  assert.match(fish, /complete -c dotlink/);
});

test('renderCompletion should reject unsupported shell', () => {
  assert.throws(() => renderCompletion('pwsh'), /不支持的 shell/);
});
