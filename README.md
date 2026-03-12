# dotlink

基于 `links.toml` 的 dotfiles 链接配置管理工具。

当前版本实现 M1（稳定写入层）：

- schema 校验
- 原子写入（temp + rename）
- 自动备份
- 文件锁

## 运行

```bash
npm install
npm start
```

## 测试

```bash
npm test
```
