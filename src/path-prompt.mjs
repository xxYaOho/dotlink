import readline from 'readline';
import { readdir } from 'fs/promises';
import { homedir as getHomeDir } from 'os';
import { resolve, dirname } from 'path';

const MAX_CANDIDATES = 120;
const SCAN_TIMEOUT_MS = 60_000;
const MIN_LOADING_VISIBLE_MS = 300;
const LOADING_TICK_MS = 120;
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

export function shouldShowLoading(elapsedMs) {
  return elapsedMs >= MIN_LOADING_VISIBLE_MS;
}

export function getDot3Frame(step) {
  return '.'.repeat((step % 3) + 1).padEnd(3, ' ');
}

export function getCommonPrefix(values) {
  const items = values.filter(Boolean);
  if (items.length === 0) return '';
  let prefix = items[0];
  for (let i = 1; i < items.length; i += 1) {
    while (prefix && !items[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) break;
  }
  return prefix;
}

export function shouldListCandidatesImmediately(candidates, completeOn) {
  if (!candidates || candidates.length <= 1) return false;
  const prefix = getCommonPrefix(candidates);
  return prefix.length <= completeOn.length && completeOn.startsWith(prefix);
}

export function formatCandidatePreview(candidates) {
  return candidates.join('\n');
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
    now = Date.now,
    readDir = (target) => readdir(target, { withFileTypes: true }),
    sleep = (ms) => new Promise((resolveNext) => setTimeout(resolveNext, ms)),
  } = options;

  const { filePart, outputBase, scanDir } = resolveScanContext(line, { cwd, allowHome, homeDir });

  if (!allowHome && (line === '~' || line.startsWith('~/'))) {
    emitProgress(onProgress, {
      phase: 'unsupported_home',
      percent: 100,
      fromCache: false,
      frame: getDot3Frame(0),
      timedOut: false,
    });
    return [];
  }

  let entries = [];
  let fromCache = false;
  const startedAt = now();
  let loadingShown = false;

  try {
    if (dirCache.has(scanDir)) {
      entries = dirCache.get(scanDir);
      fromCache = true;
      emitProgress(onProgress, { phase: 'loading', percent: 100, fromCache: true, frame: getDot3Frame(2), timedOut: false });
    } else {
      let readResolved = false;
      const readDirPromise = Promise.resolve(readDir(scanDir)).then((value) => {
        readResolved = true;
        return value;
      });
      const thresholdResult = await Promise.race([
        readDirPromise.then((value) => ({ type: 'entries', value })),
        sleep(MIN_LOADING_VISIBLE_MS).then(() => ({ type: 'threshold' })),
      ]);

      if (thresholdResult.type === 'entries') {
        entries = thresholdResult.value;
      } else {
        loadingShown = true;
        let loadingStep = 0;
        emitProgress(onProgress, {
          phase: 'loading',
          percent: Math.min(99, getPseudoProgressPercent(now() - startedAt)),
          fromCache: false,
          frame: getDot3Frame(loadingStep),
          timedOut: false,
        });

        while (!readResolved) {
          const elapsedMs = now() - startedAt;
          if (elapsedMs >= SCAN_TIMEOUT_MS) {
            emitProgress(onProgress, {
              phase: 'timeout',
              percent: 100,
              fromCache: false,
              frame: getDot3Frame(loadingStep),
              timedOut: true,
            });
            return [];
          }

          await sleep(LOADING_TICK_MS);
          if (readResolved) break;
          loadingStep += 1;
          emitProgress(onProgress, {
            phase: 'loading',
            percent: Math.min(99, getPseudoProgressPercent(now() - startedAt)),
            fromCache: false,
            frame: getDot3Frame(loadingStep),
            timedOut: false,
          });
        }

        entries = await readDirPromise;
      }

      dirCache.set(scanDir, entries);
    }
  } catch {
    emitProgress(onProgress, { phase: 'error', percent: 100, fromCache: false, frame: getDot3Frame(0), timedOut: false });
    return [];
  }

  if (fromCache) {
    return buildCandidates(entries, filePart, outputBase);
  }

  const candidates = buildCandidates(entries, filePart, outputBase);
  emitProgress(onProgress, { phase: 'done', percent: 100, fromCache: false, frame: loadingShown ? getDot3Frame(2) : '', timedOut: false });
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
    let preserveStatus = false;

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
              preserveStatus = true;
            } else if (event.phase === 'unsupported_home') {
              loadingLine = `${message}: ${line}`;
              statusLine = `${event.frame} src 不支持 ~/，请使用相对路径或绝对路径`;
              preserveStatus = true;
            } else if (event.phase === 'error') {
              loadingLine = `${message}: ${line}`;
              statusLine = `${event.frame} 未找到可扫描目录，请检查输入路径`;
              preserveStatus = true;
            } else if (event.fromCache) {
              loadingLine = '';
              statusLine = '';
              preserveStatus = false;
            } else {
              loadingLine = `${message} (loading): ${line}`;
              statusLine = `${event.frame} ${event.percent}%`;
              preserveStatus = false;
            }
            renderPrompt();
          },
        });

        if (!preserveStatus) {
          loadingLine = '';
          statusLine = '';
        }

        const shouldPreview = shouldListCandidatesImmediately(candidates, line);
        const preview = shouldPreview ? formatCandidatePreview(candidates) : '';
        if (preview) {
          process.stdout.write(`\r\n${preview}\r\n`);
        }

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
