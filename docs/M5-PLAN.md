# M5 计划（独立发布能力）

## 目标

补齐独立工具发布最低能力：

1. shell completion 生成
2. 配置迁移命令
3. 最小运维文档

## 范围

### completion

- 增加命令：`dotlink completions <bash|zsh|fish>`
- 输出到标准输出，用户可重定向到本地 completion 文件

### migrate

- 增加命令：`dotlink migrate import --from <path> [--replace] [--dry-run]`
- 输入源为兼容 `links.toml` 结构
- 默认 merge（按 module 合并，去重）
- `--replace` 用源配置直接覆盖当前配置

### 文档

- README 增补 completion/migrate 用法
- CLI 文档补充新命令
- CHANGELOG 增补 M4/M5 记录

## 验收标准

1. `dotlink completions bash` 有效输出 completion 脚本
2. `migrate import` 在 merge/replace 两种模式下工作正常
3. `--dry-run` 仅输出 diff 不写盘
4. 测试通过且 LSP 无新增诊断
