import readline from 'readline';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';

const MAX_CANDIDATES = 120;
const dirCache = new Map();

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function matchScore(name, query) {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 3;
  if (n.startsWith(q)) return 3;
  if (n.includes(q)) return 2;
  return 0;
}

export function listPathCandidates(line, options = {}) {
  const {
    cwd = process.cwd(),
    allowHome = false,
    onProgress,
  } = options;

  const input = normalizeSlashes(line || '');
  const hasSlash = input.endsWith('/');
  const inputDir = hasSlash ? input.slice(0, -1) : dirname(input);
  const filePart = hasSlash ? '' : input.split('/').pop() || '';

  let scanDir = cwd;
  let outputBase = '';

  if (allowHome && (input === '~' || input.startsWith('~/'))) {
    const suffix = input === '~' ? '' : input.slice(2);
    const suffixDir = hasSlash ? suffix : dirname(suffix);
    scanDir = resolve(homedir(), suffixDir === '.' ? '' : suffixDir);
    outputBase = `~/${suffixDir === '.' ? '' : suffixDir}`;
    outputBase = outputBase.replace(/\/$/, '');
  } else if (input.startsWith('/')) {
    scanDir = resolve('/', inputDir === '.' ? '' : inputDir);
    outputBase = inputDir === '.' ? '' : inputDir;
  } else {
    scanDir = resolve(cwd, inputDir === '.' ? '' : inputDir);
    outputBase = inputDir === '.' ? '' : inputDir;
  }

  let entries = [];
  let fromCache = false;
  try {
    if (dirCache.has(scanDir)) {
      entries = dirCache.get(scanDir);
      fromCache = true;
    } else {
      entries = readdirSync(scanDir, { withFileTypes: true });
      dirCache.set(scanDir, entries);
    }
  } catch {
    onProgress?.(100, false);
    return [];
  }

  onProgress?.(fromCache ? 100 : 0, fromCache);

  const scored = [];
  const total = Math.max(entries.length, 1);
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const score = matchScore(entry.name, filePart);
    if (score > 0) {
      scored.push({ entry, score });
    }

    if (!fromCache && i % 32 === 0) {
      const percent = Math.min(99, Math.floor(((i + 1) / total) * 100));
      onProgress?.(percent, false);
    }
  }

  const candidates = scored
    .sort((a, b) => b.score - a.score || Number(b.entry.isDirectory()) - Number(a.entry.isDirectory()) || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => {
      const base = outputBase ? `${outputBase}/${entry.name}` : entry.name;
      return entry.isDirectory() ? `${base}/` : base;
    })
    .slice(0, MAX_CANDIDATES);

  onProgress?.(100, fromCache);

  return candidates;
}

export function promptPath({ message, initialValue = '', cwd = process.cwd(), allowHome = false }) {
  return new Promise((resolvePrompt) => {
    const hadRawMode = Boolean(process.stdin.isTTY && process.stdin.isRaw);
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.resume();

    let titleSuffix = '';
    const renderPrompt = () => {
      rl.setPrompt(`${message}${titleSuffix}: `);
      rl.prompt(true);
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: (line) => {
        const candidates = listPathCandidates(line, {
          cwd,
          allowHome,
          onProgress: (percent, fromCache) => {
            const cacheTag = fromCache ? 'cached' : 'loading';
            titleSuffix = ` (${cacheTag} ${percent}%)`;
            renderPrompt();
          },
        });
        titleSuffix = '';
        renderPrompt();
        return [candidates, line];
      },
    });

    rl.question(`${message}: `, (answer) => {
      rl.close();
      if (process.stdin.isTTY && hadRawMode) {
        process.stdin.setRawMode(true);
      }
      const value = (answer || initialValue || '').trim();
      resolvePrompt(value);
    });

    rl.on('SIGINT', () => {
      rl.close();
      if (process.stdin.isTTY && hadRawMode) {
        process.stdin.setRawMode(true);
      }
      resolvePrompt('');
    });
  });
}
