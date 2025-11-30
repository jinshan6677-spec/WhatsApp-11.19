# 🚀 快速参考卡片

**项目**: WhatsApp Desktop v2.0.0  
**最后更新**: 2025-11-27

---

## ⚡ 30 秒快速开始

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/whatsapp-desktop.git
cd whatsapp-desktop

# 2. 安装依赖
npm install

# 3. 启动应用
npm start
```

---

## 📚 文档导航

| 需求 | 文档 | 时间 |
|------|------|------|
| 快速开始 | [README.md - 快速开始](#快速开始) | 5 分钟 |
| 项目结构 | [README.md - 项目结构](#项目结构) | 15 分钟 |
| API 参考 | [README.md - 开发者快速参考](#开发者快速参考) | 20 分钟 |
| 故障排除 | [README.md - 故障排除](#故障排除) | 10 分钟 |
| 部署指南 | [README.md - 部署指南](#部署指南) | 15 分钟 |
| 完整索引 | [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | 30 分钟 |

---

## 🎯 常用命令

### 开发

```bash
npm start          # 启动应用
npm run dev        # 开发模式（带调试）
npm test           # 运行测试
npm run build      # 构建应用
```

### 测试

```bash
npm test                                    # 运行所有测试
npm test -- --testPathPattern="property"   # 运行属性测试
npm run test:coverage                      # 生成覆盖率报告
npm run test:watch                         # 监听模式
```

### 诊断

```bash
npm run test:setup      # 检查系统要求
npm run test:session    # 检查会话数据
npm run test:clean      # 清理缓存
DEBUG=* npm start       # 启用详细日志
```

---

## 🔧 配置快速参考



### 翻译配置

```javascript
{
  chatWindow: {
    engine: 'google',      // google, gpt4, gemini, deepseek
    targetLanguage: 'en'
  },
  inputBox: {
    engine: 'google',
    style: 'formal',       // formal, casual, etc.
    targetLanguage: 'en'
  }
}
```

---

## 🔍 故障排除速查

| 问题 | 解决方案 |
|------|---------|
| 应用无法启动 | 检查 Node.js 版本、清理缓存、重新安装依赖 |
| 翻译不工作 | 检查 API 密钥、验证网络连接、查看日志 |
| 内存占用过高 | 关闭不必要的账号、清理缓存、重启应用 |

---

## 📊 性能指标

| 指标 | 值 |
|------|-----|
| 启动时间 | 3-5 秒 |
| 内存占用 | 200-400MB |
| CPU 使用率 | 2-5% |
| 重连时间 | <5 秒 |

---

## 🔐 安全检查清单

- [ ] 敏感密码已加密
- [ ] API 密钥已安全管理
- [ ] 日志中无敏感信息
- [ ] 所有依赖已更新


---

## 🎓 学习路径

### 初级（第 1 天）
1. 阅读 [README.md - 项目概述](#项目概述)
2. 按照快速开始启动项目
3. 查看常见问题

### 中级（第 1 周）
1. 学习项目结构
2. 理解架构设计
3. 学习 API 使用

### 高级（第 2 周）
1. 深入研究设计文档
2. 参与代码贡献
3. 指导其他开发者

---

## 📞 获取帮助

| 问题类型 | 解决方案 |
|---------|---------|
| 使用问题 | 查看 [README.md - 常见问题](#常见问题) |
| 技术问题 | 查看 [README.md - 故障排除](#故障排除) |
| 开发问题 | 查看 [README.md - 开发者快速参考](#开发者快速参考) |
| 架构问题 | 查看 [ARCHITECTURE_MIGRATION_COMPLETE.md](#架构迁移完成报告) |
| 其他问题 | 提交 GitHub Issue 或 Discussions |

---

## 🔗 重要链接

- 📖 [README.md](README.md) - 完整指南
- 🏗️ [ARCHITECTURE_MIGRATION_COMPLETE.md](ARCHITECTURE_MIGRATION_COMPLETE.md) - 架构说明
- 📚 [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - 文档索引
- 📊 [PROJECT_STATUS.md](PROJECT_STATUS.md) - 项目状态
- 🔧 [.kiro/specs/architecture-refactoring/](./kiro/specs/architecture-refactoring/) - 规范文档

---

## ✅ 检查清单

### 部署前

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档已更新
- [ ] 安全检查完成
- [ ] 性能基准测试完成
- [ ] 备份已创建

### 发布前

- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 标签已创建
- [ ] 发布说明已准备
- [ ] 通知已发送

---

## 🎯 下一步

1. **立即开始**: 按照快速开始启动项目
2. **深入学习**: 阅读完整的 README.md
3. **参与贡献**: 查看贡献指南
4. **获取支持**: 在 GitHub 中提问

---

<div align="center">

**WhatsApp Desktop v2.0.0**  
**Clean Architecture | Enterprise Security | Property-Based Testing**

[📖 完整文档](README.md) | [🏗️ 架构说明](ARCHITECTURE_MIGRATION_COMPLETE.md) | [📚 文档索引](DOCUMENTATION_INDEX.md)

</div>
