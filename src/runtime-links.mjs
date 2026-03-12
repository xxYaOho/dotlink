import { existsSync, lstatSync, readdirSync, readlinkSync, realpathSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return path.replace(/^~/, homedir());
  return path;
}

function isGlob(value) {
  return value.includes('*') || value.includes('?');
}

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function expandGlobEntries(srcPattern, dstDir, repoRoot) {
  const lastSlash = srcPattern.lastIndexOf('/');
  const srcDir = lastSlash >= 0 ? srcPattern.slice(0, lastSlash) : '';
  const pattern = lastSlash >= 0 ? srcPattern.slice(lastSlash + 1) : srcPattern;
  const absSrcDir = resolve(repoRoot, srcDir);

  if (!existsSync(absSrcDir)) {
    return { entries: [], warn: `no such directory: ${absSrcDir}` };
  }

  const regex = globToRegex(pattern);
  const files = readdirSync(absSrcDir).filter((entry) => regex.test(entry));
  if (files.length === 0) {
    return { entries: [], warn: `no match: ${srcPattern}` };
  }

  return {
    entries: files.map((fileName) => ({
      srcAbs: resolve(absSrcDir, fileName),
      dstAbs: resolve(expandHome(dstDir), fileName),
    })),
    warn: null,
  };
}

export function buildRuntimeEntries(data, options = {}) {
  const { repoRoot = process.cwd(), moduleFilter } = options;
  const module = data.module || {};
  const output = [];

  for (const [moduleName, payload] of Object.entries(module)) {
    if (moduleFilter && moduleName !== moduleFilter) continue;

    const links = payload.links || [];
    for (let index = 0; index < links.length; index += 1) {
      const link = links[index];
      if (isGlob(link.src)) {
        const expanded = expandGlobEntries(link.src, link.dst, repoRoot);
        if (expanded.warn) {
          output.push({
            module: moduleName,
            index: index + 1,
            srcRaw: link.src,
            dstRaw: link.dst,
            srcAbs: null,
            dstAbs: expandHome(link.dst),
            status: 'source_missing',
            reason: expanded.warn,
          });
          continue;
        }
        for (const item of expanded.entries) {
          output.push({
            module: moduleName,
            index: index + 1,
            srcRaw: link.src,
            dstRaw: link.dst,
            srcAbs: item.srcAbs,
            dstAbs: item.dstAbs,
            status: 'unknown',
            reason: null,
          });
        }
        continue;
      }

      output.push({
        module: moduleName,
        index: index + 1,
        srcRaw: link.src,
        dstRaw: link.dst,
        srcAbs: resolve(repoRoot, link.src),
        dstAbs: expandHome(link.dst),
        status: 'unknown',
        reason: null,
      });
    }
  }

  return output;
}

function safeRealPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function safeLstat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

export function inspectEntry(entry) {
  if (entry.status === 'source_missing') return entry;

  if (!entry.srcAbs || !existsSync(entry.srcAbs)) {
    return { ...entry, status: 'source_missing', reason: `src not found: ${entry.srcAbs}` };
  }

  const stat = safeLstat(entry.dstAbs);
  if (!stat) {
    return { ...entry, status: 'missing', reason: null };
  }

  if (!stat.isSymbolicLink()) {
    return { ...entry, status: 'occupied', reason: 'dst exists but not symlink' };
  }

  if (!existsSync(entry.dstAbs)) {
    return { ...entry, status: 'broken', reason: `broken symlink -> ${readlinkSync(entry.dstAbs)}` };
  }

  const srcReal = safeRealPath(entry.srcAbs);
  const dstReal = safeRealPath(entry.dstAbs);
  if (srcReal && dstReal && srcReal === dstReal) {
    return { ...entry, status: 'ok', reason: null };
  }

  return {
    ...entry,
    status: 'wrong_target',
    reason: `wrong target -> ${readlinkSync(entry.dstAbs)}`,
  };
}
