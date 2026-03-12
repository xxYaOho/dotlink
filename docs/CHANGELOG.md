# CHANGELOG

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
