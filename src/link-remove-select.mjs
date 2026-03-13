import { readStore } from './store.mjs';
import { buildRuntimeEntries, inspectEntry } from './runtime-links.mjs';
import { formatLinkHealthLabel, mapLinkStatusToHealth } from './link-health-display.mjs';

const HEALTH_RANK = {
  running: 0,
  standby: 1,
  invalid: 2,
};

export function formatRemoveOptionLabel({ health, src, dst }) {
  return formatLinkHealthLabel({ status: health === 'running' ? 'ok' : health === 'standby' ? 'missing' : 'broken', src, dst });
}

function mergeEntry(target, entry) {
  const health = mapLinkStatusToHealth(entry.status);
  const current = target ? HEALTH_RANK[target.health] : -1;
  const next = HEALTH_RANK[health];
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
