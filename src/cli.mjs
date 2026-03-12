import pc from 'picocolors';
import {
  addLink,
  createModule,
  listLinks,
  listModules,
  removeLink,
  updateLink,
} from './commands.mjs';
import { runApply, runDoctor, runFix, runPlan } from './execute.mjs';

function parseFlags(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { flags, positionals };
}

function printHelp() {
  console.log(`dotlink

用法:
  dotlink                                  进入 TUI
  dotlink module list
  dotlink module create <name> [--dry-run]
  dotlink link list [--module <name>]
  dotlink link add --module <name> --src <path> --dst <path> [--dry-run]
  dotlink link remove --module <name> --index <n> [--dry-run]
  dotlink link update --module <name> --index <n> [--src <path>] [--dst <path>] [--dry-run]
  dotlink exec plan [--module <name>] [--mode create|update|aggressive]
  dotlink exec apply [--module <name>] [--mode create|update|aggressive] [--dry-run]
  dotlink exec doctor [--module <name>]
  dotlink exec fix [--module <name>] [--mode safe|aggressive] [--dry-run]
`);
}

export async function runCli(args) {
  if (args[0] === '-h' || args[0] === '--help') {
    printHelp();
    return;
  }

  const { flags, positionals } = parseFlags(args);
  const [group, action, third] = positionals;

  if (group === 'module' && action === 'list') {
    await listModules({});
    return;
  }
  if (group === 'module' && action === 'create') {
    await createModule({ name: third, dryRun: Boolean(flags['dry-run']) });
    return;
  }

  if (group === 'link' && action === 'list') {
    await listLinks({ module: flags.module });
    return;
  }
  if (group === 'link' && action === 'add') {
    await addLink({
      module: flags.module,
      src: flags.src,
      dst: flags.dst,
      dryRun: Boolean(flags['dry-run']),
    });
    return;
  }
  if (group === 'link' && action === 'remove') {
    await removeLink({
      module: flags.module,
      index: Number(flags.index),
      dryRun: Boolean(flags['dry-run']),
    });
    return;
  }
  if (group === 'link' && action === 'update') {
    await updateLink({
      module: flags.module,
      index: Number(flags.index),
      src: flags.src,
      dst: flags.dst,
      dryRun: Boolean(flags['dry-run']),
    });
    return;
  }

  if (group === 'exec' && action === 'plan') {
    await runPlan({ module: flags.module, mode: flags.mode || 'update' });
    return;
  }
  if (group === 'exec' && action === 'apply') {
    await runApply({
      module: flags.module,
      mode: flags.mode || 'update',
      dryRun: Boolean(flags['dry-run']),
    });
    return;
  }
  if (group === 'exec' && action === 'doctor') {
    await runDoctor({ module: flags.module });
    return;
  }
  if (group === 'exec' && action === 'fix') {
    await runFix({
      module: flags.module,
      mode: flags.mode || 'safe',
      dryRun: Boolean(flags['dry-run']),
    });
    return;
  }

  console.error(pc.red('未知命令'));
  printHelp();
  process.exitCode = 1;
}
