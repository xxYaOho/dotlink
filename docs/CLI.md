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

- `src` 会根据配置源切换路径模式：
  - global：支持 `~/` / 绝对路径 / Tab 补全
  - local：使用项目内相对路径 / Tab 补全
- `dst` 支持 `~/` / 绝对路径 / Tab 补全
- 扫描只在按下 Tab 时触发，按当前路径层级扫描并匹配
- 目录扫描超过约 `300ms` 才显示 loading，避免快速扫描时闪烁
- loading 会显示 ASCII spinner 与伪进度；超时会提示缩小路径范围
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
