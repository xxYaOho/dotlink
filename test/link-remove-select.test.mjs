import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupedRemoveOptions, formatRemoveOptionLabel } from '../src/link-remove-select.mjs';
import { formatDoctorLine, formatLinkHealthLabel, mapLinkStatusToHealth } from '../src/link-health-display.mjs';

test('mapLinkStatusToHealth should collapse runtime statuses into three display states', () => {
  assert.equal(mapLinkStatusToHealth('ok'), 'running');
  assert.equal(mapLinkStatusToHealth('missing'), 'standby');
  assert.equal(mapLinkStatusToHealth('broken'), 'invalid');
  assert.equal(mapLinkStatusToHealth('wrong_target'), 'invalid');
});

test('formatRemoveOptionLabel should render concise badge and arrow', () => {
  assert.equal(
    formatRemoveOptionLabel({ health: 'running', src: 'config/a', dst: '~/.a' }),
    '🟢 config/a --> ~/.a',
  );
});

test('formatDoctorLine should use same health style without brackets', () => {
  assert.equal(
    formatDoctorLine({ module: 'alpha', status: 'missing', srcRaw: 'config/a', dstRaw: '~/.a' }),
    '🟡 [alpha] config/a --> ~/.a',
  );
});

test('formatLinkHealthLabel should render shared health style', () => {
  assert.equal(formatLinkHealthLabel({ status: 'wrong_target', src: 'a', dst: 'b' }), '🔴 a --> b');
});

test('buildGroupedRemoveOptions should group links by module and keep stable order', () => {
  const grouped = buildGroupedRemoveOptions([
    { module: 'beta', index: 2, srcRaw: 'b', dstRaw: '~/.b', status: 'missing' },
    { module: 'alpha', index: 2, srcRaw: 'a2', dstRaw: '~/.a2', status: 'ok' },
    { module: 'alpha', index: 1, srcRaw: 'a1', dstRaw: '~/.a1', status: 'wrong_target' },
  ]);

  assert.deepEqual(Object.keys(grouped), ['alpha', 'beta']);
  assert.equal(grouped.alpha[0].label, '🔴 a1 --> ~/.a1');
  assert.deepEqual(grouped.alpha[0].value, { module: 'alpha', index: 1 });
  assert.equal(grouped.alpha[1].label, '🟢 a2 --> ~/.a2');
  assert.equal(grouped.beta[0].label, '🟡 b --> ~/.b');
});

test('buildGroupedRemoveOptions should merge expanded runtime entries by module and index', () => {
  const grouped = buildGroupedRemoveOptions([
    { module: 'alpha', index: 1, srcRaw: 'config/*.md', dstRaw: '~/.config/app', status: 'ok' },
    { module: 'alpha', index: 1, srcRaw: 'config/*.md', dstRaw: '~/.config/app', status: 'missing' },
  ]);

  assert.equal(grouped.alpha.length, 1);
  assert.equal(grouped.alpha[0].label, '🟡 config/*.md --> ~/.config/app');
});
