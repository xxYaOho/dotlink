import * as readline from 'readline';
import { Writable } from 'stream';
import pc from 'picocolors';

const CSI = '\x1b[';
const ICON_ACTIVE = pc.green('◆');
const ICON_CANCEL = pc.red('■');
const ICON_SUBMIT = pc.green('◇');
const BAR = pc.dim('│');
const CANCEL = Symbol('cancel');

const silentOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return true;
  }
  return false;
}

function clearLines(lineCount) {
  if (lineCount <= 0) return;
  process.stdout.write(`${CSI}${lineCount}A`);
  for (let i = 0; i < lineCount; i += 1) {
    process.stdout.write(`${CSI}2K${CSI}1B`);
  }
  process.stdout.write(`${CSI}${lineCount}A`);
}

function render({ state, message, options, query, cursor, maxVisible, lastHeightRef }) {
  clearLines(lastHeightRef.value);

  const filtered = options.filter((opt) => fuzzyMatch(opt.label, query));
  const lines = [];
  const icon = state === 'active' ? ICON_ACTIVE : state === 'cancel' ? ICON_CANCEL : ICON_SUBMIT;
  lines.push(`${icon}  ${pc.bold(message)}`);

  if (state === 'active') {
    lines.push(`${BAR}  ${pc.dim('Search:')} ${query}${pc.inverse(' ')}`);
    lines.push(`${BAR}  ${pc.dim('↑↓ move, enter select, esc cancel')}`);
    lines.push(`${BAR}`);

    if (filtered.length === 0) {
      lines.push(`${BAR}  ${pc.dim('No matches found')}`);
    } else {
      const visibleStart = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), filtered.length - maxVisible));
      const visibleEnd = Math.min(filtered.length, visibleStart + maxVisible);
      const visible = filtered.slice(visibleStart, visibleEnd);

      for (let i = 0; i < visible.length; i += 1) {
        const actualIndex = visibleStart + i;
        const item = visible[i];
        const isCursor = actualIndex === cursor;
        const prefix = isCursor ? pc.cyan('❯') : ' ';
        const label = isCursor ? pc.underline(item.label) : item.label;
        const hint = item.hint ? pc.dim(` (${item.hint})`) : '';
        lines.push(`${BAR} ${prefix} ○ ${label}${hint}`);
      }
    }
    lines.push(pc.dim('└'));
  } else if (state === 'submit') {
    const picked = filtered[cursor];
    lines.push(`${BAR}  ${pc.dim(picked?.label || '')}`);
  } else {
    lines.push(`${BAR}  ${pc.strikethrough(pc.dim('Cancelled'))}`);
  }

  process.stdout.write(lines.join('\n') + '\n');
  lastHeightRef.value = lines.length;
}

export async function searchSelect(options) {
  const {
    message,
    options: selectOptions,
    maxVisible = 8,
    returnMeta = false,
  } = options;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: silentOutput,
      terminal: false,
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    let query = '';
    let cursor = 0;
    const lastHeightRef = { value: 0 };

    const cleanup = () => {
      process.stdin.removeListener('keypress', keypressHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
    };

    const submit = () => {
      const filtered = selectOptions.filter((opt) => fuzzyMatch(opt.label, query));
      const picked = filtered[cursor];
      render({ state: 'submit', message, options: selectOptions, query, cursor, maxVisible, lastHeightRef });
      cleanup();
      if (returnMeta) {
        resolve({ value: picked ? picked.value : CANCEL, query });
        return;
      }
      resolve(picked ? picked.value : CANCEL);
    };

    const cancel = () => {
      render({ state: 'cancel', message, options: selectOptions, query, cursor, maxVisible, lastHeightRef });
      cleanup();
      resolve(CANCEL);
    };

    const keypressHandler = (_str, key) => {
      if (!key) return;
      const filtered = selectOptions.filter((opt) => fuzzyMatch(opt.label, query));

      if (key.name === 'return') return submit();
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return cancel();
      if (key.name === 'up') {
        cursor = Math.max(0, cursor - 1);
      } else if (key.name === 'down') {
        cursor = Math.min(Math.max(0, filtered.length - 1), cursor + 1);
      } else if (key.name === 'backspace') {
        query = query.slice(0, -1);
        cursor = 0;
      } else if (key.sequence && !key.ctrl && !key.meta && key.sequence.length === 1) {
        query += key.sequence;
        cursor = 0;
      }

      render({ state: 'active', message, options: selectOptions, query, cursor, maxVisible, lastHeightRef });
    };

    process.stdin.on('keypress', keypressHandler);
    render({ state: 'active', message, options: selectOptions, query, cursor, maxVisible, lastHeightRef });
  });
}

export { CANCEL as selectCancelSymbol };
