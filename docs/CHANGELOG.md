# CHANGELOG

## v0.5.1

- 修复路径补全匹配过宽导致 `./docs/RE` 无法有效收敛的问题
- 路径补全显示动态进度（0-100%）并保持输入可继续

## v0.5.0

- 调整路径补全触发时机：仅在按下 Tab 时扫描当前层目录并匹配
- 调整 loading 反馈：改为标题状态提示，不阻塞输入
- 优化模块创建交互：列表检索确认 + 顶部“新建模块” + 搜索词预填
- 配置文件升级：`symlinks.toml`（global）与 `local.symlinks.toml`（project local）
- 新增 `dotlink local`：在当前目录创建 `local.symlinks.toml` 模板
- 兼容迁移：支持从 legacy `links.toml` 自动迁移到 `symlinks.toml`

## v0.4.1

- 修复 TUI 内路径补全在 rawMode 场景下不生效的问题
- 优化路径补全性能：增加目录缓存与候选数量上限
- 增加路径补全加载反馈
- 模块名交互升级为“模糊检索 + 列表选择”
- 新增补全文档 `docs/COMPLETIONS.md`

## v0.4.0

- 新增 `completions` 命令，支持 bash/zsh/fish
- 新增 `migrate import` 命令，支持 merge/replace 与 dry-run
- 补充 completion 与 migrate 测试
- 补充 M5 计划文档与架构说明

## v0.3.0

- 新增执行链路：`exec plan/apply/doctor/fix`
- 增加链接状态与动作模型，支持冲突检测
- 增加 create/update/aggressive 三种执行模式
- 补充执行链路测试与 M4 计划文档

## v0.2.1

- 新增发布策略文档 `docs/RELEASE.md`
- 新增 `link:add` 路径补全能力（Tab + 模糊匹配）
- 新增路径补全测试

## v0.2.0

- 完成 M2：模块与链接 CRUD（`module list/create`、`link list/add/remove/update`）
- 增加去重校验，防止重复链接写入
- 增加 `--dry-run` 与写前 diff 预览
- 默认执行 `dotlink` 进入 TUI，保留子命令用于自动化

## v0.1.0

- 完成 M1：schema 校验
- 完成 M1：原子写入（temp + rename）
- 完成 M1：自动备份
- 完成 M1：文件锁
