import pc from 'picocolors';
import { readStore, writeStore } from './store.mjs';

function requireText(name, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} 必填`);
  }
  return value.trim();
}

function requireIndex(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('index 必须是从 1 开始的整数');
  }
  return value;
}

function printWriteResult(result) {
  if (!result.changed) {
    console.log(pc.dim('没有变更')); 
    return;
  }
  console.log(result.diff);
  if (result.dryRun) {
    console.log(pc.yellow('dry-run: 未写入文件'));
    return;
  }
  if (result.backupPath) {
    console.log(pc.dim(`已备份: ${result.backupPath}`));
  }
  console.log(pc.green(`已写入: ${result.filePath}`));
}

export async function listModules() {
  const { data } = readStore();
  const names = Object.keys(data.module || {}).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    console.log(pc.dim('暂无模块'));
    return;
  }
  for (const name of names) {
    const count = data.module[name]?.links?.length || 0;
    console.log(`${name} (${count})`);
  }
}

export async function createModule({ name, dryRun = false }) {
  const moduleName = requireText('name', name);
  const { data } = readStore();
  if (data.module[moduleName]) {
    throw new Error(`模块已存在: ${moduleName}`);
  }
  data.module[moduleName] = { links: [] };
  const result = await writeStore(data, { dryRun });
  printWriteResult(result);
}

export async function listLinks({ module }) {
  const { data } = readStore();
  const modules = Object.keys(data.module || {}).sort((a, b) => a.localeCompare(b));
  if (modules.length === 0) {
    console.log(pc.dim('暂无链接'));
    return;
  }

  for (const moduleName of modules) {
    if (module && module !== moduleName) continue;
    const links = data.module[moduleName]?.links || [];
    console.log(pc.bold(`[${moduleName}]`));
    if (links.length === 0) {
      console.log(pc.dim('  (empty)'));
      continue;
    }
    links.forEach((link, index) => {
      console.log(`  ${index + 1}. src=${link.src} -> dst=${link.dst}`);
    });
  }
}

function ensureModule(data, moduleName) {
  if (!data.module[moduleName]) {
    data.module[moduleName] = { links: [] };
  }
  return data.module[moduleName];
}

function existsDuplicate(links, src, dst) {
  return links.some((link) => link.src === src && link.dst === dst);
}

export async function addLink({ module, src, dst, dryRun = false }) {
  const moduleName = requireText('module', module);
  const srcPath = requireText('src', src);
  const dstPath = requireText('dst', dst);
  const { data } = readStore();
  const currentModule = ensureModule(data, moduleName);

  if (existsDuplicate(currentModule.links, srcPath, dstPath)) {
    throw new Error(`重复链接: ${moduleName} ${srcPath} -> ${dstPath}`);
  }

  currentModule.links.push({ src: srcPath, dst: dstPath });
  const result = await writeStore(data, { dryRun });
  printWriteResult(result);
}

export async function removeLink({ module, index, dryRun = false }) {
  const moduleName = requireText('module', module);
  const oneBasedIndex = requireIndex(index);
  const { data } = readStore();
  if (!data.module[moduleName]) {
    throw new Error(`模块不存在: ${moduleName}`);
  }
  const links = data.module[moduleName].links || [];
  const target = links[oneBasedIndex - 1];
  if (!target) {
    throw new Error(`index 超出范围: ${oneBasedIndex}`);
  }
  links.splice(oneBasedIndex - 1, 1);
  const result = await writeStore(data, { dryRun });
  printWriteResult(result);
}

export async function removeLinks({ targets, dryRun = false, repoRoot = process.cwd(), scope, filePath }) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('targets 必须至少包含一条链接');
  }

  const { data } = readStore(repoRoot, { scope, filePath });
  const grouped = new Map();

  for (const target of targets) {
    const moduleName = requireText('module', target?.module);
    const oneBasedIndex = requireIndex(target?.index);
    if (!data.module[moduleName]) {
      throw new Error(`模块不存在: ${moduleName}`);
    }
    const links = data.module[moduleName].links || [];
    if (!links[oneBasedIndex - 1]) {
      throw new Error(`index 超出范围: ${moduleName}#${oneBasedIndex}`);
    }

    const indexes = grouped.get(moduleName) || new Set();
    indexes.add(oneBasedIndex);
    grouped.set(moduleName, indexes);
  }

  for (const [moduleName, indexes] of grouped.entries()) {
    const links = data.module[moduleName].links || [];
    for (const oneBasedIndex of Array.from(indexes).sort((a, b) => b - a)) {
      links.splice(oneBasedIndex - 1, 1);
    }
  }

  const result = await writeStore(data, { cwd: repoRoot, dryRun, scope, filePath });
  printWriteResult(result);
}

export async function updateLink({ module, index, src, dst, dryRun = false }) {
  const moduleName = requireText('module', module);
  const oneBasedIndex = requireIndex(index);
  const { data } = readStore();
  if (!data.module[moduleName]) {
    throw new Error(`模块不存在: ${moduleName}`);
  }
  const links = data.module[moduleName].links || [];
  const target = links[oneBasedIndex - 1];
  if (!target) {
    throw new Error(`index 超出范围: ${oneBasedIndex}`);
  }

  const nextSrc = typeof src === 'string' && src.trim() ? src.trim() : target.src;
  const nextDst = typeof dst === 'string' && dst.trim() ? dst.trim() : target.dst;

  if (
    links.some(
      (link, i) =>
        i !== oneBasedIndex - 1 && link.src === nextSrc && link.dst === nextDst,
    )
  ) {
    throw new Error(`更新后会与现有链接重复: ${nextSrc} -> ${nextDst}`);
  }

  target.src = nextSrc;
  target.dst = nextDst;

  const result = await writeStore(data, { dryRun });
  printWriteResult(result);
}
