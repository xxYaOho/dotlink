# 架构说明

## 分层

- `index.mjs`：入口（默认 TUI）
- `src/cli.mjs`：命令分发和参数解析
- `src/commands.mjs`：业务命令（M2）
- `src/store.mjs`：配置读写（M1）

## 写入流程

1. 读取并校验 `links.toml`
2. 应用命令变更
3. 生成 diff
4. 若 `--dry-run` 则结束
5. 文件锁保护
6. 备份旧文件
7. 写入 temp 文件并 rename

## 设计目标

- SSOT：仅 `links.toml`
- 安全：原子写 + 备份 + 锁
- 可审计：diff 预览
