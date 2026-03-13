# CLI 指南

## 安装

### 本地开发

在仓库目录执行：

```bash
npm install
npm link
```

之后可以直接运行：

```bash
dotlink
```

如果本地 `npm link` 后出现 `permission denied: dotlink`，说明入口文件缺少可执行位，可执行：

```bash
chmod +x index.mjs
npm link
```

### 从 GitHub 仓库安装

不发布到 npm 时，可以直接从 GitHub 安装：

```bash
npm install -g git+https://github.com/<owner>/<repo>.git#main
```

若要安装稳定版本，建议先打 tag，再安装对应 tag：

```bash
npm install -g git+https://github.com/<owner>/<repo>.git#v0.5.1
```

更新后可用下面命令确认：

```bash
dotlink --help
```

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
- loading 会显示 dot3 动画与伪进度；超时会提示缩小路径范围
- 所有模块选择场景支持模糊检索与列表选择

在 TUI 的 `删除链接` 流程中：

- 使用按模块分组的多选列表，不再手动输入 `index`
- 列表使用简洁状态标记：`🟢` / `🟡` / `🔴`
- 选中后会先确认，再批量写回配置

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

说明：CLI 子命令仍保留 `--index` 删除方式；多选删除只在默认 TUI 中提供。

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
