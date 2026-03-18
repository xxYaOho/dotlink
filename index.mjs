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
  unlinkLinks,
} from './src/commands.mjs';
import { promptPath } from './src/path-prompt.mjs';
import { getPathPromptOptions } from './src/path-mode.mjs';
import { runApply, runDoctor, runFix, runPlan } from './src/execute.mjs';
import { listRemovableLinkGroups } from './src/link-remove-select.mjs';
import { STORE_FILES, getStorePaths, readStore } from './src/store.mjs';
import { searchSelect, selectCancelSymbol } from './src/search-select.mjs';
import { buildRuntimeEntries } from './src/runtime-links.mjs';

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

// ----------------------------------------------------------------------------
// 三级菜单：模块管理
// ----------------------------------------------------------------------------
async function runModuleManageMenu(selectedSource) {
  while (true) {
    const action = await p.select({
      message: '模块管理：',
      options: [
        { value: 'add', label: '添加' },
        { value: 'apply', label: '应用' },
        { value: 'remove', label: '移除' },
        { value: 'back', label: '返回' },
      ],
    });

    if (p.isCancel(action)) {
      console.log(pc.dim('已退出'));
      process.exit(0);
    }
    if (action === 'back') return;

    try {
      if (action === 'add') {
        const modules = getModuleNames();
        let name;
        if (modules.length > 0) {
          const picked = await searchSelect({
            message: '先搜索确认模块是否已存在，再决定是否新增',
            options: [{ value: '__NEW__', label: '(新建模块...)', hint: '输入新模块名' }, ...modules.map((m) => ({ value: m, label: m, hint: '已存在' }))],
            maxVisible: 10,
            returnMeta: true,
          });
          if (picked.value === selectCancelSymbol) continue;
          if (picked.value !== '__NEW__') {
            console.log(pc.yellow(`模块已存在: ${picked.value}`));
            continue;
          }
          name = await p.text({
            message: '新模块名',
            placeholder: '例如: opencode',
            initialValue: picked.query || '',
          });
        } else {
          name = await p.text({ message: '新模块名', placeholder: '例如: opencode' });
        }
        
        if (p.isCancel(name)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        await createModule({ name });
      } 
      else if (action === 'apply') {
        const module = await pickModule({ message: '选择需要应用的模块（支持模糊搜索）', allowAll: true });
        if (module === null) continue; // pickModule 内部触发 cancel 暂不做处理或保留原逻辑（或后续需要也可以统一步骤退出）
        const mode = await p.select({
          message: '应用模式：',
          options: [
            { value: 'back', label: '返回' },
            { value: 'update', label: '创建 (安全模式)' },
            { value: 'aggressive', label: '覆盖 (强制替换)' },
          ],
        });
        if (p.isCancel(mode)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (mode === 'back') continue;
        await runApply({ module, mode, dryRun: false });
      } 
      else if (action === 'remove') {
        const modules = getModuleNames();
        if (modules.length === 0) {
          console.log(pc.dim('暂无模块'));
          continue;
        }
        const picked = await p.multiselect({
          message: '选择要彻底移除的模块（包含软链接和配置）',
          options: modules.map(m => ({ value: m, label: m })),
          required: false,
        });
        if (p.isCancel(picked)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (picked.length === 0) continue;
        
        const confirmed = await p.confirm({
          message: `将完全移除这 ${picked.length} 个模块下的所有软链接及配置，请确认`,
        });
        if (p.isCancel(confirmed)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (!confirmed) continue;
        
        const { data } = readStore();
        for (const m of picked) {
          const links = data.module[m]?.links || [];
          if (links.length > 0) {
            const targets = links.map((_, i) => ({ module: m, index: i + 1 }));
            await removeLinks({ targets, repoRoot: process.cwd(), scope: selectedSource.scope, filePath: selectedSource.filePath });
          } else {
            // 空模块的场合，直接删除配置
            delete data.module[m];
            await STORE_FILES.writeStore(data, { scope: selectedSource.scope, filePath: selectedSource.filePath }); // this is rough but ok
          }
        }
      }
    } catch (e) {
      console.error(pc.red(`错误: ${e.message || e}`));
    }
    console.log('');
  }
}

// ----------------------------------------------------------------------------
// 三级菜单：软链接管理
// ----------------------------------------------------------------------------
async function runLinkManageMenu(selectedSource, pathPromptOptions) {
  while (true) {
    const action = await p.select({
      message: '软链接管理：',
      options: [
        { value: 'add', label: '添加' },
        { value: 'unlink', label: '取消' },
        { value: 'apply', label: '应用' },
        { value: 'remove', label: '移除' },
        { value: 'back', label: '返回' },
      ],
    });

    if (p.isCancel(action)) {
      console.log(pc.dim('已退出'));
      process.exit(0);
    }
    if (action === 'back') return;

    try {
      if (action === 'add') {
        const module = await pickModule({ message: '选择模块（支持模糊搜索）', allowCreate: true });
        if (module === null) continue;
        console.log(pc.dim(pathPromptOptions.src.message));
        const src = await promptPath({ message: pathPromptOptions.src.message, cwd: process.cwd(), allowHome: pathPromptOptions.src.allowHome });
        if (!src) continue;
        console.log(pc.dim(pathPromptOptions.dst.message));
        const dst = await promptPath({ message: pathPromptOptions.dst.message, cwd: process.cwd(), allowHome: pathPromptOptions.dst.allowHome });
        if (!dst) continue;
        
        await addLink({ module, src, dst, dryRun: false });
        
        // Find missing links to offer immediate apply
        const { data } = readStore();
        const runtimeEntries = buildRuntimeEntries(data, { repoRoot: process.cwd() });
        const missingTargets = runtimeEntries
          .filter(e => {
            const stat = existsSync(e.dstAbs);
            return !stat; // simple proxy for 'missing' or 'source_missing' before full inspector
          })
          .map(e => ({ value: { module: e.module, index: e.index }, label: `[${e.module}] ${e.srcRaw} -> ${e.dstRaw}` }));
        
        if (missingTargets.length > 0) {
          // Identify the newly added one
          const newIdx = data.module[module].links.length;
          const newlyAdded = missingTargets.find(t => t.value.module === module && t.value.index === newIdx);
          
          const nextStep = await p.select({
            message: '配置已添加。接下来...',
            options: [
              { value: 'back', label: '返回上一层' },
              { value: 'apply_missing', label: '立即应用缺少的链接' }
            ]
          });
          
        if (p.isCancel(nextStep)) {
            console.log(pc.dim('已退出'));
            process.exit(0);
          }
          
          if (nextStep === 'apply_missing') {
            const targetsToApply = await p.multiselect({
              message: '选择要应用的链接（已预选新增内容）',
              options: missingTargets,
              initialValues: newlyAdded ? [newlyAdded.value] : [],
              required: false
            });
            if (p.isCancel(targetsToApply)) {
              console.log(pc.dim('已退出'));
              process.exit(0);
            }
            if (targetsToApply.length > 0) {
              const applyMode = await p.select({
                message: '应用模式：',
                options: [
                  { value: 'back', label: '返回' },
                  { value: 'update', label: '创建 (安全模式)' },
                  { value: 'aggressive', label: '覆盖 (强制替换)' },
                ],
              });
              if (p.isCancel(applyMode)) {
                console.log(pc.dim('已退出'));
                process.exit(0);
              }
              if (applyMode !== 'back') {
                await runApply({ mode: applyMode, dryRun: false, targets: targetsToApply });
              }
            }
          }
        }
      } 
      else if (action === 'unlink') {
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
          message: '取消（仅移除文件系统软链接，保留配置以供日后重新应用）',
          options: groupedOptions,
          required: false,
          groupSpacing: 1,
        });
        if (p.isCancel(targets)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (targets.length === 0) continue;
        
        const step = await p.select({
          message: '确认操作',
          options: [
            { value: 'back', label: '返回' },
            { value: 'confirm', label: `取消勾选的 ${targets.length} 条链接目标` }
          ]
        });
        if (p.isCancel(step)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (step === 'back') continue;
        
        await unlinkLinks({
          targets,
          repoRoot: process.cwd(),
          scope: selectedSource.scope,
          filePath: selectedSource.filePath,
        });
      }
      else if (action === 'apply') {
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
          message: '选择要在文件系统中应用的链接配置',
          options: groupedOptions,
          required: false,
          groupSpacing: 1,
        });
        if (p.isCancel(targets)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (targets.length === 0) continue;
        
        const applyMode = await p.select({
          message: '应用模式：',
          options: [
            { value: 'back', label: '返回' },
            { value: 'update', label: '创建 (安全模式)' },
            { value: 'aggressive', label: '覆盖 (强制替换)' },
          ],
        });
        if (p.isCancel(applyMode)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (applyMode === 'back') continue;
        
        await runApply({ mode: applyMode, dryRun: false, targets });
      }
      else if (action === 'remove') {
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
          message: '选择要彻底移除的链接',
          options: groupedOptions,
          required: false,
          groupSpacing: 1,
        });
        if (p.isCancel(targets)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (targets.length === 0) continue;
        
        const step = await p.select({
          message: `将完全移除这 ${targets.length} 条软链接及配置，请确认`,
          options: [
            { value: 'back', label: '返回' },
            { value: 'confirm', label: `完全移除` }
          ]
        });
        if (p.isCancel(step)) {
          console.log(pc.dim('已退出'));
          process.exit(0);
        }
        if (step === 'back') continue;
        
        await removeLinks({
          targets,
          repoRoot: process.cwd(),
          scope: selectedSource.scope,
          filePath: selectedSource.filePath,
        });
      }
    } catch (e) {
      console.error(pc.red(`错误: ${e.message || e}`));
    }
    console.log('');
  }
}

// ----------------------------------------------------------------------------
// 二级菜单：管理
// ----------------------------------------------------------------------------
async function runManageMenu(selectedSource, pathPromptOptions) {
  while (true) {
    const action = await p.select({
      message: '管理：',
      options: [
        { value: 'link', label: '软链接' },
        { value: 'module', label: '模块' },
        { value: 'back', label: '返回' },
      ],
    });

    if (p.isCancel(action)) {
      console.log(pc.dim('已退出'));
      process.exit(0);
    }
    if (action === 'back') return;

    if (action === 'link') {
      await runLinkManageMenu(selectedSource, pathPromptOptions);
    } else if (action === 'module') {
      await runModuleManageMenu(selectedSource);
    }
  }
}

// ----------------------------------------------------------------------------
// 主入口
// ----------------------------------------------------------------------------
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
        { value: 'preview', label: '列表预览' },
        { value: 'manage', label: '管理' },
        { value: 'doctor', label: '健康检查' },
        { value: 'exit', label: '退出' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      console.log(pc.dim('已退出'));
      process.exit(0);
    }

    try {
      if (action === 'preview') {
        const modules = getModuleNames();
        if (modules.length === 0) {
          console.log(pc.dim('暂无模块/配置'));
        } else {
          await listLinks({}); // 打印全部
        }
      } else if (action === 'doctor') {
        await runDoctor({});
      } else if (action === 'manage') {
        await runManageMenu(selectedSource, pathPromptOptions);
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
