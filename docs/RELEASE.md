# 发布策略

## 版本语义

遵循语义化版本 `MAJOR.MINOR.PATCH`：

- `MAJOR`：不兼容变更
- `MINOR`：向后兼容的新功能
- `PATCH`：向后兼容的修复

## 当前约定

- M1 完成后发布：`v0.1.0`
- M2 完成后发布：`v0.2.0`
- 后续修复/补丁：按 patch 自增（例如 `v0.2.1`、`v0.2.2`）

## 发布流程

1. 确认测试通过：`npm test`
2. 确认工作区干净：`git status`
3. 更新 `docs/CHANGELOG.md`
4. 提交代码（中文 Conventional Commits）
5. 创建 tag：`git tag vx.y.z`
6. 推送提交：`git push`
7. 推送标签：`git push --tags`

## 分发方式

当前不依赖 npm registry，默认通过 GitHub 仓库分发。

- 开发阶段：在本地仓库执行 `npm link`
- 安装最新主分支：`npm install -g git+https://github.com/<owner>/<repo>.git#main`
- 安装稳定版本：`npm install -g git+https://github.com/<owner>/<repo>.git#vX.Y.Z`

若需要稳定安装体验，推荐每次可用版本都创建 tag，再让使用者按 tag 安装。

## 提交信息约定

使用中文 Conventional Commits：

- `feat: 新增...`
- `fix: 修复...`
- `docs: 更新...`
- `refactor: 重构...`
- `test: 补充...`
