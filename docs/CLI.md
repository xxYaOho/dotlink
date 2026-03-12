# CLI 指南

## 默认入口

```bash
dotlink
```

进入 TUI。

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

## dry-run

所有写命令支持 `--dry-run`：

- 输出 diff
- 不写入 `links.toml`
