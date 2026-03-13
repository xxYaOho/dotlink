import readline from 'readline';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';

const MAX_CANDIDATES = 120;
const dirCache = new Map();

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function fuzzyMatch(name, query) {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return true;
  if (n.includes(q)) return true;
  let i = 0;
  for (const ch of n) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

export function listPathCandidates(line, options = {}) {
  const {
    cwd = process.cwd(),
    allowHome = false,
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
  try {
    if (dirCache.has(scanDir)) {
      entries = dirCache.get(scanDir);
    } else {
      entries = readdirSync(scanDir, { withFileTypes: true });
      dirCache.set(scanDir, entries);
    }
  } catch {
    return [];
  }

  const candidates = entries
    .filter((entry) => fuzzyMatch(entry.name, filePart))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((entry) => {
      const base = outputBase ? `${outputBase}/${entry.name}` : entry.name;
      return entry.isDirectory() ? `${base}/` : base;
    })
    .slice(0, MAX_CANDIDATES);

  return candidates;
}

export function promptPath({ message, initialValue = '', cwd = process.cwd(), allowHome = false }) {
  return new Promise((resolvePrompt) => {
    const hadRawMode = Boolean(process.stdin.isTTY && process.stdin.isRaw);
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.resume();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: (line) => {
        const candidates = listPathCandidates(line, { cwd, allowHome });
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
