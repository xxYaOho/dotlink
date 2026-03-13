import { readStore } from './store.mjs';
import { buildRuntimeEntries, inspectEntry } from './runtime-links.mjs';

const HEALTH_META = {
  running: { icon: '🟢', rank: 0 },
  standby: { icon: '🟡', rank: 1 },
  invalid: { icon: '🔴', rank: 2 },
};

export function mapLinkStatusToHealth(status) {
  if (status === 'ok') return 'running';
  if (status === 'missing') return 'standby';
  return 'invalid';
}

export function formatRemoveOptionLabel({ health, src, dst }) {
  return `[ ${HEALTH_META[health].icon} ] ${src} --> ${dst}`;
}

function mergeEntry(target, entry) {
  const health = mapLinkStatusToHealth(entry.status);
  const current = target ? HEALTH_META[target.health].rank : -1;
  const next = HEALTH_META[health].rank;
  if (!target) {
    return {
      module: entry.module,
      index: entry.index,
      src: entry.srcRaw,
      dst: entry.dstRaw,
      health,
    };
  }
  if (next > current) {
    return { ...target, health };
  }
  return target;
}

export function buildGroupedRemoveOptions(inspectedEntries) {
  const grouped = new Map();

  for (const entry of inspectedEntries) {
    const key = `${entry.module}:${entry.index}`;
    grouped.set(key, mergeEntry(grouped.get(key), entry));
  }

  const modules = {};
  for (const item of Array.from(grouped.values()).sort((a, b) => a.module.localeCompare(b.module) || a.index - b.index)) {
    if (!modules[item.module]) modules[item.module] = [];
    modules[item.module].push({
      value: { module: item.module, index: item.index },
      label: formatRemoveOptionLabel(item),
    });
  }

  return modules;
}

export function listRemovableLinkGroups({ repoRoot = process.cwd(), scope, filePath } = {}) {
  const { data } = readStore(repoRoot, { scope, filePath });
  const inspected = buildRuntimeEntries(data, { repoRoot }).map((entry) => inspectEntry(entry));
  return buildGroupedRemoveOptions(inspected);
}
