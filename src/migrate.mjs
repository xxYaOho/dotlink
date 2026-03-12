import { readFileSync } from 'fs';
import { parse } from 'smol-toml';
import { readStore, validateConfig, writeStore } from './store.mjs';

function dedupeLinks(links) {
  const seen = new Set();
  const output = [];
  for (const link of links) {
    const key = `${link.src}::${link.dst}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(link);
  }
  return output;
}

export async function migrateImport({
  from,
  replace = false,
  dryRun = false,
  cwd = process.cwd(),
}) {
  if (!from) throw new Error('--from 必填');

  const raw = readFileSync(from, 'utf-8');
  const parsed = raw.trim() ? parse(raw) : { module: {} };
  const source = validateConfig(parsed);
  const target = readStore(cwd).data;

  const next = replace ? { module: {} } : structuredClone(target);

  for (const [moduleName, payload] of Object.entries(source.module || {})) {
    if (!next.module[moduleName]) {
      next.module[moduleName] = { links: [] };
    }
    const mergedLinks = replace
      ? payload.links || []
      : [...(next.module[moduleName].links || []), ...(payload.links || [])];
    next.module[moduleName].links = dedupeLinks(mergedLinks);
  }

  const result = await writeStore(next, { cwd, dryRun });
  return result;
}
