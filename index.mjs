#!/usr/bin/env node
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { basename } from 'path';
import { existsSync } from 'fs';
import { runCli } from './src/cli.mjs';
import {
  createModule,
  listModules,
  listLinks,
  addLink,
  removeLinks,
} from './src/commands.mjs';
import { promptPath } from './src/path-prompt.mjs';
import { getPathPromptOptions } from './src/path-mode.mjs';
import { runApply, runDoctor, runFix, runPlan } from './src/execute.mjs';
import { listRemovableLinkGroups } from './src/link-remove-select.mjs';
import { STORE_FILES, getStorePaths, readStore } from './src/store.mjs';
import { searchSelect, selectCancelSymbol } from './src/search-select.mjs';

function getModuleNames() {
  const { data } = readStore();
  return Object.keys(data.module || {}).sort((a, b) => a.localeCompare(b));
}

async function chooseConfigSource(cwd = process.cwd()) {
  const paths = getStorePaths(cwd);
  const hasLocal = existsSync(paths.local);

  if (!hasLocal) {
    process.env.DOTLINK_CONFIG_FILE = paths.global;
    return { scope: 'global', filePath: paths.global };
  }

  const picked = await p.select({
    message: '发现 local.symlinks.toml，选择配置源',
    options: [
      { value: paths.global, label: 'global (symlinks.toml)', hint: paths.global },
      { value: paths.local, label: 'local (local.symlinks.toml)', hint: paths.local },
    ],
    initialValue: paths.local,
  });

  if (p.isCancel(picked)) return null;
  process.env.DOTLINK_CONFIG_FILE = picked;
  return {
    scope: basename(picked) === STORE_FILES.local ? 'local' : 'global',
    filePath: picked,
  };
}

async function pickModule({ message, allowAll = false, allowCreate = false }) {
  const modules = getModuleNames();
  const options = [];

  if (allowAll) {
    options.push({ value: '__ALL__', label: '(全部模块)', hint: '不筛选模块' });
  }
  for (const moduleName of modules) {
    options.push({ value: moduleName, label: moduleName });
  }

  if (options.length === 0) {
    if (!allowCreate) return null;
    const created = await p.text({ message: '新模块名', placeholder: '例如: opencode' });
    if (p.isCancel(created)) return null;
    return created;
  }

  if (allowCreate) {
    options.unshift({ value: '__NEW__', label: '(新建模块...)', hint: '输入新模块名' });
  }

  const picked = await searchSelect({
    message,
    options,
    maxVisible: 10,
    returnMeta: allowCreate,
  });

  if (picked === selectCancelSymbol) return null;
  if (allowCreate && picked.value === selectCancelSymbol) return null;
  if (allowCreate && picked.value === '__NEW__') {
    const created = await p.text({
      message: '新模块名',
      placeholder: '例如: opencode',
      initialValue: picked.query || '',
    });
    if (p.isCancel(created)) return null;
    return created;
  }
  const value = allowCreate ? picked.value : picked;
  return value === '__ALL__' ? undefined : value;
}

function printBanner() {
  console.log(pc.cyan('dotlink'));
  console.log(pc.dim('TOML-based dotfiles link manager'));
  console.log('');
}

async function runTui() {
  const selectedSource = await chooseConfigSource();
  if (!selectedSource) {
    console.log(pc.dim('已取消'));
    return;
  }

  printBanner();
  console.log(pc.dim(`当前配置源: ${selectedSource.scope} (${selectedSource.filePath})`));
  console.log('');

  const pathPromptOptions = getPathPromptOptions(selectedSource.scope);

  while (true) {
    const action = await p.select({
      message: '选择操作',
      options: [
        { value: 'module:list', label: '模块列表' },
        { value: 'module:create', label: '新建模块' },
        { value: 'link:list', label: '链接列表' },
        { value: 'link:add', label: '新增链接' },
        { value: 'link:remove', label: '删除链接' },
        { value: 'exec:plan', label: '执行计划(plan)' },
        { value: 'exec:apply', label: '执行应用(apply)' },
        { value: 'exec:doctor', label: '健康检查(doctor)' },
        { value: 'exec:fix', label: '修复(fix)' },
        { value: 'exit', label: '退出' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      console.log(pc.dim('已退出'));
      return;
    }

    try {
      if (action === 'module:list') {
        await listModules({});
      } else if (action === 'module:create') {
        const modules = getModuleNames();
        if (modules.length > 0) {
          const picked = await searchSelect({
            message: '先搜索确认模块是否已存在，再决定是否新增',
            options: [{ value: '__NEW__', label: '(新建模块...)', hint: '输入新模块名' }, ...modules.map((m) => ({ value: m, label: m, hint: '已存在' }))],
            maxVisible: 10,
            returnMeta: true,
          });
          if (picked.value === selectCancelSymbol) return;
          if (picked.value !== '__NEW__') {
            console.log(pc.yellow(`模块已存在: ${picked.value}`));
            continue;
          }

          const name = await p.text({
            message: '新模块名',
            placeholder: '例如: opencode',
            initialValue: picked.query || '',
          });
          if (p.isCancel(name)) return;
          await createModule({ name });
          continue;
        }

        const name = await p.text({ message: '新模块名', placeholder: '例如: opencode' });
        if (p.isCancel(name)) return;
        await createModule({ name });
      } else if (action === 'link:list') {
        const module = await pickModule({ message: '选择模块（支持模糊搜索）', allowAll: true });
        if (module === null) return;
        await listLinks({ module });
      } else if (action === 'link:add') {
        const module = await pickModule({ message: '选择模块（支持模糊搜索）', allowCreate: true });
        if (module === null) return;
        console.log(pc.dim(pathPromptOptions.src.message));
        const src = await promptPath({ message: pathPromptOptions.src.message, cwd: process.cwd(), allowHome: pathPromptOptions.src.allowHome });
        if (!src) return;
        console.log(pc.dim(pathPromptOptions.dst.message));
        const dst = await promptPath({ message: pathPromptOptions.dst.message, cwd: process.cwd(), allowHome: pathPromptOptions.dst.allowHome });
        if (!dst) return;
        await addLink({ module, src, dst, dryRun: false });
      } else if (action === 'link:remove') {
        const groupedOptions = listRemovableLinkGroups({
          repoRoot: process.cwd(),
          scope: selectedSource.scope,
          filePath: selectedSource.filePath,
        });
        const totalLinks = Object.values(groupedOptions).reduce((count, items) => count + items.length, 0);
        if (totalLinks === 0) {
          console.log(pc.dim('暂无链接'));
          continue;
        }
        const targets = await p.groupMultiselect({
          message: '选择要删除的链接（可多选）',
          options: groupedOptions,
          required: false,
          groupSpacing: 1,
        });
        if (p.isCancel(targets)) return;
        if (targets.length === 0) {
          console.log(pc.dim('未选择任何链接'));
          continue;
        }
        const confirmed = await p.confirm({
          message: `确认删除 ${targets.length} 条链接？`,
        });
        if (p.isCancel(confirmed) || !confirmed) {
          console.log(pc.dim('已取消'));
          continue;
        }
        await removeLinks({
          targets,
          repoRoot: process.cwd(),
          scope: selectedSource.scope,
          filePath: selectedSource.filePath,
        });
      } else if (action === 'exec:plan') {
        const mode = await p.select({
          message: '模式',
          options: [
            { value: 'create', label: 'create' },
            { value: 'update', label: 'update' },
            { value: 'aggressive', label: 'aggressive' },
          ],
          initialValue: 'update',
        });
        if (p.isCancel(mode)) return;
        await runPlan({ mode });
      } else if (action === 'exec:apply') {
        const mode = await p.select({
          message: '模式',
          options: [
            { value: 'create', label: 'create' },
            { value: 'update', label: 'update' },
            { value: 'aggressive', label: 'aggressive' },
          ],
          initialValue: 'update',
        });
        if (p.isCancel(mode)) return;
        await runApply({ mode, dryRun: false });
      } else if (action === 'exec:doctor') {
        await runDoctor({});
      } else if (action === 'exec:fix') {
        const mode = await p.select({
          message: '修复模式',
          options: [
            { value: 'safe', label: 'safe' },
            { value: 'aggressive', label: 'aggressive' },
          ],
          initialValue: 'safe',
        });
        if (p.isCancel(mode)) return;
        await runFix({ mode, dryRun: false });
      }
    } catch (error) {
      console.error(pc.red(`错误: ${error.message || error}`));
    }

    console.log('');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    await runTui();
    return;
  }
  await runCli(args);
}

main().catch((error) => {
  console.error(pc.red(`fatal: ${error.message || error}`));
  process.exit(1);
});
