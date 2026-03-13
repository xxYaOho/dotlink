# 架构说明

## 分层

- `index.mjs`：入口（默认 TUI）
- `src/cli.mjs`：命令分发和参数解析
- `src/commands.mjs`：业务命令（M2）
- `src/store.mjs`：配置读写（M1）
- `src/execute.mjs` + `src/runtime-links.mjs`：执行与状态检查（M4）
- `src/completions.mjs`：shell completion 脚本生成（M5）
- `src/migrate.mjs`：配置迁移（M5）

## 写入流程

1. 读取并校验当前配置源（`symlinks.toml` 或 `local.symlinks.toml`）
2. 应用命令变更
3. 生成 diff
4. 若 `--dry-run` 则结束
5. 文件锁保护
6. 备份旧文件
7. 写入 temp 文件并 rename

## 设计目标

- SSOT：当前选中的 symlinks 配置文件
- 安全：原子写 + 备份 + 锁
- 可审计：diff 预览
