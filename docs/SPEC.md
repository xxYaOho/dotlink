# SPEC - dotlink

## 目标

`dotlink` 通过 `links.toml` 管理 dotfiles 链接配置。

## M1 范围

1. schema 校验
2. 原子写入
3. 自动备份
4. 文件锁

## M2 范围

1. `module list/create`
2. `link list/add/remove/update`
3. 去重校验
4. `--dry-run` 预览
5. 写前 diff

## 配置格式

```toml
[module.agent]
links = [
  { src = "agent", dst = "~/.agents" },
]
```
