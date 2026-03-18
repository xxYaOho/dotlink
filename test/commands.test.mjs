import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, symlinkSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readStore, writeStore } from '../src/store.mjs';
import { removeLinks, unlinkLinks } from '../src/commands.mjs';

function makeTempCwd() {
  return mkdtempSync(join(tmpdir(), 'dotlink-commands-'));
}

test('removeLinks should remove multiple links across modules with one write', async () => {
  const cwd = makeTempCwd();
  await writeStore(
    {
      module: {
        alpha: { links: [{ src: 'a1', dst: '~/.a1' }, { src: 'a2', dst: '~/.a2' }] },
        beta: { links: [{ src: 'b1', dst: '~/.b1' }, { src: 'b2', dst: '~/.b2' }] },
      },
    },
    { cwd, scope: 'local' },
  );

  await removeLinks({
    targets: [
      { module: 'alpha', index: 1 },
      { module: 'beta', index: 2 },
    ],
    repoRoot: cwd,
    scope: 'local',
  });

  const { data } = readStore(cwd, { scope: 'local' });
  assert.deepEqual(data.module.alpha.links, [{ src: 'a2', dst: '~/.a2' }]);
  assert.deepEqual(data.module.beta.links, [{ src: 'b1', dst: '~/.b1' }]);
});

test('removeLinks should remove indexes in descending order within one module', async () => {
  const cwd = makeTempCwd();
  await writeStore(
    {
      module: {
        alpha: { links: [{ src: 'a1', dst: '~/.a1' }, { src: 'a2', dst: '~/.a2' }, { src: 'a3', dst: '~/.a3' }] },
      },
    },
    { cwd, scope: 'local' },
  );

  await removeLinks({
    targets: [{ module: 'alpha', index: 1 }, { module: 'alpha', index: 3 }],
    repoRoot: cwd,
    scope: 'local',
  });

  const { data } = readStore(cwd, { scope: 'local' });
  assert.deepEqual(data.module.alpha.links, [{ src: 'a2', dst: '~/.a2' }]);
});

test('unlinkLinks should delete symlinks but keep the configuration', async () => {
  const cwd = makeTempCwd();
  const srcFile = join(cwd, 'real-file');
  const dstLink = join(cwd, 'my-link');
  writeFileSync(srcFile, 'hello');
  symlinkSync(srcFile, dstLink);

  await writeStore(
    { module: { m: { links: [{ src: 'real-file', dst: dstLink }] } } },
    { cwd, scope: 'local' },
  );

  await unlinkLinks({
    targets: [{ module: 'm', index: 1 }],
    repoRoot: cwd,
    scope: 'local',
  });

  assert.equal(existsSync(dstLink), false, 'symlink should be removed');
  
  // TOML shouldn't be touched
  const { data } = readStore(cwd, { scope: 'local' });
  assert.equal(data.module.m.links.length, 1, 'configuration should be untouched');
});
