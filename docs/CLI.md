# CLI 指南

## 默认入口

```bash
dotlink
```

进入 TUI。

在 TUI 的 `新增链接` 流程中：

- `src` 支持 Tab 补全（模糊匹配）
- `dst` 支持 Tab 补全（含 `~/` 路径）

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

### completions

```bash
dotlink completions bash
dotlink completions zsh
dotlink completions fish
```

### migrate

```bash
dotlink migrate import --from <path> [--replace] [--dry-run]
```

## dry-run

所有写命令支持 `--dry-run`：

- 输出 diff
- 不写入 `links.toml`
