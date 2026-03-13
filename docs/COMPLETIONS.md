# Shell Completions 安装指南

`dotlink` 支持生成三种 shell 的补全脚本：`bash`、`zsh`、`fish`。

## macOS / Linux

### zsh

```bash
mkdir -p ~/.zsh/completions
dotlink completions zsh > ~/.zsh/completions/_dotlink

# 确保 fpath 包含该目录（写入 ~/.zshrc）
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc

source ~/.zshrc
```

### bash

```bash
mkdir -p ~/.bash_completion.d
dotlink completions bash > ~/.bash_completion.d/dotlink

# 写入 ~/.bashrc
echo 'source ~/.bash_completion.d/dotlink' >> ~/.bashrc

source ~/.bashrc
```

### fish

```bash
mkdir -p ~/.config/fish/completions
dotlink completions fish > ~/.config/fish/completions/dotlink.fish
```

fish 会自动加载该补全文件。

## Windows

当前仓库内置了 `bash/zsh/fish` 生成命令。Windows 建议：

- 在 WSL 中使用上述 Linux 步骤；或
- 在 Git Bash 中使用 bash 补全步骤。

## 验证

执行下面命令检查补全脚本是否生成：

```bash
dotlink completions zsh | head -n 5
dotlink completions bash | head -n 5
dotlink completions fish | head -n 5
```
