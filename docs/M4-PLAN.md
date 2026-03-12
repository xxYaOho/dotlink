# M4 计划（执行与自愈）

## 目标

在不改变 `links.toml` 格式的前提下，补齐执行链路：

- `plan`：仅计算并展示将执行的动作
- `apply`：执行链接创建/重建
- `doctor`：检查状态并给出问题分类
- `fix`：按模式修复已知问题

## 状态模型

- `ok`：目标为正确 symlink
- `missing`：目标不存在
- `source_missing`：src 不存在
- `occupied`：目标存在但不是 symlink
- `broken`：目标是断链
- `wrong_target`：目标是 symlink 但指向错误

## 动作模型

- `noop`：无需动作
- `link`：创建 symlink
- `replace`：先移除目标再重建 symlink
- `conflict`：冲突，默认不执行
- `skip`：跳过（通常是 source_missing）

## 模式

- `create`：只创建缺失链接
- `update`：允许修复 broken/wrong_target
- `aggressive`：额外允许覆盖 occupied（有风险）

## 验收标准

1. `dotlink exec plan` 能输出动作计划与摘要
2. `dotlink exec apply` 能执行 `link/replace`
3. `dotlink exec doctor` 能输出状态统计
4. `dotlink exec fix --mode safe|aggressive` 能按模式修复
5. 对应测试覆盖核心路径（missing、wrong_target、occupied）
