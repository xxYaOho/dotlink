# 删除链接多选设计

**目标**：把 TUI 中基于 index 的单项删除改成按模块分组的多选删除，并在列表中显示简洁健康状态。

## 背景

当前 `删除链接` 流程要求用户先选择模块，再手动输入 `index`。当模块下链接较多时，用户需要先记住编号，再回到输入框执行删除，操作成本高，也容易删错。

项目已有两块可复用能力：

- 配置层以 `module -> links[]` 组织数据，天然适合按模块分组展示
- 运行时已有 `inspectEntry()` 健康检查逻辑，可以给每条链接标注状态

## 设计决策

### 范围

- 只修改默认 TUI 的 `删除链接` 交互
- 保留 CLI 子命令 `dotlink link remove --module <name> --index <n>`，不改脚本化接口
- 删除列表只展示简洁主行，不展示底层 reason

### 列表形态

按 module 分组列出所有 link：

```text
[opencode]
[ 🟢 ] config/opencode/AGENTS.md --> ~/.config/opencode/AGENTS.md
[ 🟡 ] config/foo --> ~/.foo
[ 🔴 ] config/bar --> ~/.bar
```

### 状态映射

删除列表不直接暴露底层状态名，而是收敛成 3 态：

- `🟢 running`：底层状态 `ok`
- `🟡 standby`：底层状态 `missing`
- `🔴 invalid`：底层状态 `source_missing` / `occupied` / `broken` / `wrong_target`

主列表里只显示图标，不显示文字标签；图标语义由文档和实现常量维护。

### 交互流程

1. 用户进入 `删除链接`
2. TUI 先读取当前配置源中的所有 link
3. 后台对每条 link 执行一次健康检查（复用 `buildRuntimeEntries()` + `inspectEntry()`）
4. 展示按 module 分组的多选列表
5. 用户选中 1 条或多条 link
6. 显示一次确认，说明将删除多少条 link
7. 确认后批量写回配置

### 实现边界

- 不调用 `runDoctor()` 直接打印输出，因为 delete UI 只需要状态数据，不需要 doctor 的 CLI 文本格式
- 不引入复杂二级提示或展开细节，保持列表简洁
- 若当前没有任何 link，直接提示 `暂无链接`

## 组件拆分

建议拆成两层：

1. `src/link-remove-select.mjs`
   - 负责把 store links 和运行时状态转换成多选 options
   - 负责按 module 输出分组项和 link 项
2. `index.mjs`
   - 替换现有 `link:remove` 流程
   - 调用新选择器并执行确认

底层删除写入建议新增批量接口，而不是在 TUI 里循环调用旧的单条 `removeLink()`，避免多次读写配置。

## 测试策略

- 为状态映射和 option 构建补单测
- 为批量删除补单测，确认可跨 module 删除多条 link
- 保留旧的 `removeLink()` 以保证 CLI 兼容

## 风险

- `@clack/prompts` 的 `multiselect` 对分组支持有限，可能需要把 module 标题作为不可选项插入 options
- 运行时检查会访问文件系统，删除列表首次打开可能比现在更慢，但这是可接受的，因为它直接提升了删除准确性

## 结论

推荐只重做 TUI 删除体验，不改 CLI 的 index 接口。这样能用最小风险解决真实痛点，同时复用现有健康检查能力。