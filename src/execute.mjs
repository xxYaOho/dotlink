import pc from 'picocolors';
import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { formatDoctorLine } from './link-health-display.mjs';
import { readStore } from './store.mjs';
import { buildRuntimeEntries, inspectEntry } from './runtime-links.mjs';

function toAction(status, mode) {
  if (status === 'ok') return 'noop';
  if (status === 'missing') return 'link';
  if (status === 'source_missing') return 'skip';
  if (status === 'occupied') return mode === 'aggressive' ? 'replace' : 'conflict';
  if (status === 'broken' || status === 'wrong_target') {
    return mode === 'create' ? 'conflict' : 'replace';
  }
  return 'skip';
}

function listInspected(module, repoRoot, options = {}) {
  const { scope, filePath } = options;
  const { data } = readStore(repoRoot, { scope, filePath });
  const runtimeEntries = buildRuntimeEntries(data, { repoRoot, moduleFilter: module });
  return runtimeEntries.map((entry) => inspectEntry(entry));
}

function printSummary(summary) {
  console.log(
    pc.dim(
      `total=${summary.total} link=${summary.link} replace=${summary.replace} conflict=${summary.conflict} skip=${summary.skip} noop=${summary.noop}`,
    ),
  );
}

function makeSummary(steps) {
  const summary = { total: steps.length, link: 0, replace: 0, conflict: 0, skip: 0, noop: 0 };
  for (const step of steps) {
    summary[step.action] += 1;
  }
  return summary;
}

export async function runPlan({ module, mode = 'update', repoRoot = process.cwd(), scope, filePath }) {
  const inspected = listInspected(module, repoRoot, { scope, filePath });
  const steps = inspected.map((entry) => ({
    ...entry,
    action: toAction(entry.status, mode),
  }));

  for (const step of steps) {
    const marker =
      step.action === 'link' || step.action === 'replace'
        ? pc.green('+')
        : step.action === 'conflict'
          ? pc.yellow('!')
          : step.action === 'skip'
            ? pc.dim('-')
            : pc.dim('=');
    const reason = step.reason ? ` (${step.reason})` : '';
    console.log(`${marker} [${step.module}] ${step.action} ${step.dstAbs}${reason}`);
  }

  const summary = makeSummary(steps);
  printSummary(summary);
  return { steps, summary };
}

function safeUnlink(path) {
  try {
    const stat = lstatSync(path);
    if (stat) unlinkSync(path);
  } catch {
  }
}

function applyStep(step) {
  if (step.action !== 'link' && step.action !== 'replace') return;
  mkdirSync(dirname(step.dstAbs), { recursive: true });
  if (step.action === 'replace') {
    safeUnlink(step.dstAbs);
  }
  symlinkSync(step.srcAbs, step.dstAbs);
}

export async function runApply({
  module,
  mode = 'update',
  dryRun = false,
  repoRoot = process.cwd(),
  scope,
  filePath,
}) {
  const planned = await runPlan({ module, mode, repoRoot, scope, filePath });
  if (dryRun) {
    console.log(pc.yellow('dry-run: 未执行实际写入'));
    return planned;
  }

  for (const step of planned.steps) {
    applyStep(step);
  }
  console.log(pc.green('apply completed'));
  return planned;
}

export async function runDoctor({ module, repoRoot = process.cwd(), scope, filePath }) {
  const inspected = listInspected(module, repoRoot, { scope, filePath });
  const summary = {
    ok: 0,
    missing: 0,
    source_missing: 0,
    occupied: 0,
    broken: 0,
    wrong_target: 0,
  };

  for (const entry of inspected) {
    summary[entry.status] += 1;
    console.log(formatDoctorLine(entry));
  }

  console.log(
    pc.dim(
      `ok=${summary.ok} missing=${summary.missing} source_missing=${summary.source_missing} occupied=${summary.occupied} broken=${summary.broken} wrong_target=${summary.wrong_target}`,
    ),
  );
  return summary;
}

export async function runFix({
  module,
  mode = 'safe',
  dryRun = false,
  repoRoot = process.cwd(),
  scope,
  filePath,
}) {
  const applyMode = mode === 'aggressive' ? 'aggressive' : 'update';
  return runApply({ module, mode: applyMode, dryRun, repoRoot, scope, filePath });
}
