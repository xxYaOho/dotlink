import readline from 'readline';
import { readdirSync } from 'fs';
import { homedir as getHomeDir } from 'os';
import { resolve, dirname } from 'path';

const MAX_CANDIDATES = 120;
const SPINNER_FRAMES = ['|', '/', '-', '\\'];
const SCAN_TIMEOUT_MS = 60_000;
const dirCache = new Map();

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

export function getPseudoProgressPercent(elapsedMs) {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs <= 1_000) return Math.min(80, Math.floor((elapsedMs / 1_000) * 80));
  if (elapsedMs <= 11_000) return Math.min(90, 80 + Math.floor(((elapsedMs - 1_000) / 10_000) * 10));
  if (elapsedMs <= SCAN_TIMEOUT_MS) return Math.min(100, 90 + Math.floor(((elapsedMs - 11_000) / (SCAN_TIMEOUT_MS - 11_000)) * 10));
  return 100;
}

function getSpinnerFrame(step) {
  return SPINNER_FRAMES[step % SPINNER_FRAMES.length];
}

function matchScore(name, query) {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 3;
  if (n.startsWith(q)) return 3;
  if (n.includes(q)) return 2;
  return 0;
}

function resolveScanContext(line, options = {}) {
  const {
    cwd = process.cwd(),
    allowHome = false,
    homeDir = getHomeDir(),
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
    scanDir = resolve(homeDir, suffixDir === '.' ? '' : suffixDir);
    outputBase = `~/${suffixDir === '.' ? '' : suffixDir}`.replace(/\/$/, '');
  } else if (input.startsWith('/')) {
    scanDir = resolve('/', inputDir === '.' ? '' : inputDir);
    outputBase = inputDir === '.' ? '' : inputDir;
  } else {
    scanDir = resolve(cwd, inputDir === '.' ? '' : inputDir);
    outputBase = inputDir === '.' ? '' : inputDir;
  }

  return {
    filePart,
    outputBase,
    scanDir,
  };
}

function buildCandidates(entries, filePart, outputBase) {
  const scored = [];

  for (const entry of entries) {
    const score = matchScore(entry.name, filePart);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  const hasPrefixMatch = scored.some((item) => item.score === 3);
  const filtered = hasPrefixMatch ? scored.filter((item) => item.score === 3) : scored;

  return filtered
    .sort((a, b) => b.score - a.score || Number(b.entry.isDirectory()) - Number(a.entry.isDirectory()) || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => {
      const base = outputBase ? `${outputBase}/${entry.name}` : entry.name;
      return entry.isDirectory() ? `${base}/` : base;
    })
    .slice(0, MAX_CANDIDATES);
}

function emitProgress(onProgress, payload) {
  onProgress?.(payload);
}

export async function listPathCandidates(line, options = {}) {
  const {
    cwd = process.cwd(),
    allowHome = false,
    homeDir = getHomeDir(),
    onProgress,
  } = options;

  const { filePart, outputBase, scanDir } = resolveScanContext(line, { cwd, allowHome, homeDir });

  let entries = [];
  let fromCache = false;
  const startedAt = Date.now();

  try {
    if (dirCache.has(scanDir)) {
      entries = dirCache.get(scanDir);
      fromCache = true;
      emitProgress(onProgress, { phase: 'loading', percent: 100, fromCache: true, frame: getSpinnerFrame(0), timedOut: false });
    } else {
      emitProgress(onProgress, { phase: 'loading', percent: 0, fromCache: false, frame: getSpinnerFrame(0), timedOut: false });
      await new Promise((resolveNext) => setImmediate(resolveNext));
      entries = readdirSync(scanDir, { withFileTypes: true });
      dirCache.set(scanDir, entries);
    }
  } catch {
    emitProgress(onProgress, { phase: 'error', percent: 100, fromCache: false, frame: getSpinnerFrame(0), timedOut: false });
    return [];
  }

  if (fromCache) {
    return buildCandidates(entries, filePart, outputBase);
  }

  const total = Math.max(entries.length, 1);
  for (let i = 0; i < entries.length; i += 32) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= SCAN_TIMEOUT_MS) {
      emitProgress(onProgress, {
        phase: 'timeout',
        percent: 100,
        fromCache: false,
        frame: getSpinnerFrame(Math.floor(i / 32)),
        timedOut: true,
      });
      return [];
    }

    const chunkPercent = Math.floor((((i + 32) > total ? total : i + 32) / total) * 100);
    emitProgress(onProgress, {
      phase: 'loading',
      percent: Math.min(99, Math.max(chunkPercent, getPseudoProgressPercent(elapsedMs))),
      fromCache: false,
      frame: getSpinnerFrame(Math.floor(i / 32)),
      timedOut: false,
    });

    await new Promise((resolveNext) => setImmediate(resolveNext));
  }

  const candidates = buildCandidates(entries, filePart, outputBase);
  emitProgress(onProgress, { phase: 'done', percent: 100, fromCache: false, frame: getSpinnerFrame(entries.length), timedOut: false });
  return candidates;
}

export function promptPath({ message, initialValue = '', cwd = process.cwd(), allowHome = false }) {
  return new Promise((resolvePrompt) => {
    const hadRawMode = Boolean(process.stdin.isTTY && process.stdin.isRaw);
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.resume();

    let loadingLine = '';
    let statusLine = '';

    const renderPrompt = () => {
      const prompt = statusLine
        ? `${loadingLine || message}\n${statusLine}\n`
        : `${message}: `;
      rl.setPrompt(prompt);
      rl.prompt(true);
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: async (line, callback) => {
        const candidates = await listPathCandidates(line, {
          cwd,
          allowHome,
          onProgress: (event) => {
            if (event.timedOut) {
              loadingLine = `${message} (loading): ${line}`;
              statusLine = `${event.frame} 扫描内容过多，已超时，请缩小路径范围`;
            } else if (event.fromCache) {
              loadingLine = '';
              statusLine = '';
            } else {
              loadingLine = `${message} (loading): ${line}`;
              statusLine = `${event.frame} ${event.percent}%`;
            }
            renderPrompt();
          },
        });

        loadingLine = '';
        statusLine = '';
        renderPrompt();
        callback(null, [candidates, line]);
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
