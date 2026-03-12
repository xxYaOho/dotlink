#!/usr/bin/env node
import pc from 'picocolors';
import { readStore } from './src/store.mjs';

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log('dotlink v0.1.0');
    console.log('当前版本聚焦 M1（稳定写入层）');
    return;
  }

  const { filePath, data } = readStore();
  const modules = Object.keys(data.module || {});
  console.log(pc.cyan('dotlink v0.1.0'));
  console.log(pc.dim(`配置文件: ${filePath}`));
  console.log(pc.dim(`模块数量: ${modules.length}`));
  console.log(pc.dim('M1 已完成：schema 校验、原子写入、自动备份、文件锁'));
}

main();
