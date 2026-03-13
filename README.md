# dotlink

基于 `links.toml` 的 dotfiles 链接配置管理工具。

- 默认执行 `dotlink` 进入 TUI
- 保留 `dotlink <subcommand>` 支持脚本化
- 配置文件是 SSOT（single source of truth）
- 在 TUI 的新增链接流程支持 Tab 路径补全（src/dst）
- TUI 中所有模块选择场景支持“模糊检索 + 列表选择”
- 路径输入时提供“扫描目录缓存中”加载反馈
- 提供 `exec plan/apply/doctor/fix` 执行与自愈命令
- 提供 shell completion 生成与 `migrate import` 配置迁移

## 快速开始

```bash
npm install
npm start
```

## 测试

```bash
npm test
```

## 常用命令

```bash
# 模块
dotlink module list
dotlink module create opencode

# 链接
dotlink link list --module opencode
dotlink link add --module opencode --src config/opencode/AGENTS.md --dst ~/.config/opencode/AGENTS.md
dotlink link update --module opencode --index 1 --dst ~/.config/opencode/AGENTS.md
dotlink link remove --module opencode --index 1

# 预览变更，不写入
dotlink link add --module opencode --src a --dst b --dry-run

# 执行计划与修复
dotlink exec plan --mode update
dotlink exec doctor
dotlink exec fix --mode safe

# completion
dotlink completions zsh > ~/.zsh/completions/_dotlink

# 迁移配置
dotlink migrate import --from ./legacy-links.toml --dry-run
```

更多说明见 `docs/`。

- completion 安装参考：`docs/COMPLETIONS.md`
