import { parse } from 'smol-toml';
import { createPatch } from 'diff';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'fs';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { homedir } from 'os';
import { setTimeout as sleep } from 'timers/promises';

const DEFAULT_SYMLINKS_FILE = 'symlinks.toml';
const LOCAL_SYMLINKS_FILE = 'local.symlinks.toml';
const LEGACY_LINKS_FILE = 'links.toml';
const ENV_CONFIG_FILE = 'DOTLINK_CONFIG_FILE';

export const STORE_FILES = {
  global: DEFAULT_SYMLINKS_FILE,
  local: LOCAL_SYMLINKS_FILE,
  legacy: LEGACY_LINKS_FILE,
};

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function ensureStoreFile(filePath, cwd) {
  if (!existsSync(filePath)) {
    const fileName = basename(filePath);
    if (fileName === DEFAULT_SYMLINKS_FILE) {
      const legacyPath = join(cwd, LEGACY_LINKS_FILE);
      if (existsSync(legacyPath)) {
        ensureParentDir(filePath);
        const legacyRaw = readFileSync(legacyPath, 'utf-8');
        writeFileSync(filePath, legacyRaw, 'utf-8');
        return;
      }
    }
    ensureParentDir(filePath);
    writeFileSync(filePath, '', 'utf-8');
  }
}

export function serializeConfig(data) {
  const module = data.module || {};
  const moduleNames = Object.keys(module).sort((a, b) => a.localeCompare(b));
  const lines = [];

  for (const name of moduleNames) {
    lines.push(`[module.${name}]`);
    lines.push('links = [');
    const links = module[name].links || [];
    for (const link of links) {
      lines.push(`  { src = ${JSON.stringify(link.src)}, dst = ${JSON.stringify(link.dst)} },`);
    }
    lines.push(']');
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function validateConfig(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('配置必须是对象');
  }
  if (!data.module) {
    data.module = {};
  }
  if (typeof data.module !== 'object') {
    throw new Error('module 字段必须是对象');
  }
  for (const [name, payload] of Object.entries(data.module)) {
    if (!payload || typeof payload !== 'object') {
      throw new Error(`module.${name} 必须是对象`);
    }
    if (!Array.isArray(payload.links)) {
      payload.links = [];
    }
    for (const [index, link] of payload.links.entries()) {
      if (!link || typeof link !== 'object') {
        throw new Error(`module.${name}.links[${index}] 必须是对象`);
      }
      if (typeof link.src !== 'string' || !link.src.trim()) {
        throw new Error(`module.${name}.links[${index}].src 必须是非空字符串`);
      }
      if (typeof link.dst !== 'string' || !link.dst.trim()) {
        throw new Error(`module.${name}.links[${index}].dst 必须是非空字符串`);
      }
    }
  }
  return data;
}

function backupPathFor(filePath) {
  const backupDir = join(dirname(filePath), '.dotlink', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const prefix = basename(filePath).replace(/\.toml$/, '');
  return join(backupDir, `${prefix}.${timestamp}.toml`);
}

async function withFileLock(filePath, fn) {
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();
  while (true) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        return await fn();
      } finally {
        closeSync(fd);
        unlinkSync(lockPath);
      }
    } catch {
      if (Date.now() - startedAt > 5000) {
        throw new Error('等待文件锁超时: symlinks 文件可能正在被其他进程写入');
      }
      await sleep(50);
    }
  }
}

export function getStorePaths(cwd = process.cwd()) {
  const home = homedir();
  return {
    global: join(home, '.config', 'dotlink', DEFAULT_SYMLINKS_FILE),
    local: join(cwd, LOCAL_SYMLINKS_FILE),
    legacy: join(cwd, LEGACY_LINKS_FILE),
    projectGlobalLegacy: join(cwd, DEFAULT_SYMLINKS_FILE),
  };
}

export function resolveStoreFilePath(cwd = process.cwd(), options = {}) {
  const envPath = process.env[ENV_CONFIG_FILE];
  if (envPath) {
    return isAbsolute(envPath) ? envPath : resolve(cwd, envPath);
  }

  if (options.filePath) {
    return isAbsolute(options.filePath) ? options.filePath : resolve(cwd, options.filePath);
  }

  if (options.scope === 'local') {
    return getStorePaths(cwd).local;
  }

  return getStorePaths(cwd).global;
}

export function readStore(cwd = process.cwd(), options = {}) {
  const filePath = resolveStoreFilePath(cwd, options);
  ensureStoreFile(filePath, cwd);
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = raw.trim() ? parse(raw) : { module: {} };
  const validated = validateConfig(parsed);
  return { filePath, raw, data: validated };
}

export function previewDiff(beforeRaw, afterRaw, filePath = DEFAULT_SYMLINKS_FILE) {
  return createPatch(filePath, beforeRaw || '', afterRaw || '', 'before', 'after');
}

export async function writeStore(data, options = {}) {
  const { cwd = process.cwd(), dryRun = false, backup = true } = options;
  const { filePath, raw: beforeRaw } = readStore(cwd, options);
  const validated = validateConfig(structuredClone(data));
  const afterRaw = serializeConfig(validated);
  const changed = beforeRaw !== afterRaw;
  const diff = previewDiff(beforeRaw, afterRaw, basename(filePath));

  if (!changed) {
    return { changed: false, diff, filePath, dryRun, backupPath: null };
  }
  if (dryRun) {
    return { changed: true, diff, filePath, dryRun, backupPath: null };
  }

  return withFileLock(filePath, async () => {
    const current = readFileSync(filePath, 'utf-8');
    if (current !== beforeRaw) {
      throw new Error('写入前检测到 symlinks 文件已被其他进程修改，请重试');
    }
    let backupPath = null;
    if (backup && current.trim()) {
      backupPath = backupPathFor(filePath);
      writeFileSync(backupPath, current, 'utf-8');
    }

    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, afterRaw, 'utf-8');
    renameSync(tempPath, filePath);
    return { changed: true, diff, filePath, dryRun: false, backupPath };
  });
}

export function createLocalTemplate(cwd = process.cwd(), { force = false } = {}) {
  const filePath = join(cwd, LOCAL_SYMLINKS_FILE);
  if (existsSync(filePath) && !force) {
    return { filePath, created: false };
  }
  const template = `# dotlink local symlinks\n\n[module.sample]\nlinks = [\n  { src = \"path/to/source\", dst = \"~/path/to/target\" },\n]\n`;
  writeFileSync(filePath, template, 'utf-8');
  return { filePath, created: true };
}
