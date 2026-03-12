#!/usr/bin/env node
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { runCli } from './src/cli.mjs';
import {
  createModule,
  listModules,
  listLinks,
  addLink,
  removeLink,
} from './src/commands.mjs';
import { promptPath } from './src/path-prompt.mjs';

function printBanner() {
  console.log(pc.cyan('dotlink'));
  console.log(pc.dim('TOML-based dotfiles link manager'));
  console.log('');
}

async function runTui() {
  printBanner();
  while (true) {
    const action = await p.select({
      message: '选择操作',
      options: [
        { value: 'module:list', label: '模块列表' },
        { value: 'module:create', label: '新建模块' },
        { value: 'link:list', label: '链接列表' },
        { value: 'link:add', label: '新增链接' },
        { value: 'link:remove', label: '删除链接' },
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
        const name = await p.text({ message: '模块名', placeholder: '例如: opencode' });
        if (p.isCancel(name)) return;
        await createModule({ name });
      } else if (action === 'link:list') {
        const module = await p.text({ message: '模块名(可空)', placeholder: '留空=全部' });
        if (p.isCancel(module)) return;
        await listLinks({ module: module || undefined });
      } else if (action === 'link:add') {
        const module = await p.text({ message: '模块名', placeholder: '例如: opencode' });
        if (p.isCancel(module)) return;
        console.log(pc.dim('src 输入支持 Tab 补全（模糊匹配）'));
        const src = await promptPath({ message: 'src', cwd: process.cwd(), allowHome: false });
        if (!src) return;
        console.log(pc.dim('dst 输入支持 Tab 补全（支持 ~/）'));
        const dst = await promptPath({ message: 'dst', cwd: process.cwd(), allowHome: true });
        if (!dst) return;
        await addLink({ module, src, dst, dryRun: false });
      } else if (action === 'link:remove') {
        const module = await p.text({ message: '模块名', placeholder: '例如: opencode' });
        if (p.isCancel(module)) return;
        const indexRaw = await p.text({ message: 'index(从 1 开始)', placeholder: '例如: 1' });
        if (p.isCancel(indexRaw)) return;
        await removeLink({ module, index: Number(indexRaw) });
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
