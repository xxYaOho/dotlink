# CLI 指南

## 默认入口

```bash
dotlink
```

进入 TUI。

若当前目录存在 `local.symlinks.toml`，启动后第一步会让你选择：

- global（`~/.config/dotlink/symlinks.toml`）
- local（`./local.symlinks.toml`）

在 TUI 的 `新增链接` 流程中：

- `src` 支持 Tab 补全（模糊匹配）
- `dst` 支持 Tab 补全（含 `~/` 路径）
- 扫描只在按下 Tab 时触发，按当前路径层级扫描并匹配
- 标题会提示 `(loading)` 状态，不阻塞输入
- 所有模块选择场景支持模糊检索与列表选择

## 子命令

### module

```bash
dotlink module list
dotlink module create <name> [--dry-run]
```

### link

```bash
dotlink link list [--module <name>]
dotlink link add --module <name> --src <path> --dst <path> [--dry-run]
dotlink link remove --module <name> --index <n> [--dry-run]
dotlink link update --module <name> --index <n> [--src <path>] [--dst <path>] [--dry-run]
```

### exec

```bash
dotlink exec plan [--module <name>] [--mode create|update|aggressive]
dotlink exec apply [--module <name>] [--mode create|update|aggressive] [--dry-run]
dotlink exec doctor [--module <name>]
dotlink exec fix [--module <name>] [--mode safe|aggressive] [--dry-run]
```

### local

```bash
dotlink local
```

在当前目录创建 `local.symlinks.toml` 模板。

### completions

```bash
dotlink completions bash
dotlink completions zsh
dotlink completions fish
```

安装示例见 `docs/COMPLETIONS.md`。

### migrate

```bash
dotlink migrate import --from <path> [--replace] [--dry-run]
```

## dry-run

所有写命令支持 `--dry-run`：

- 输出 diff
- 不写入 `symlinks.toml` / `local.symlinks.toml`
