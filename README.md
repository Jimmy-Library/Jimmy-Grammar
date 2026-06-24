# Jimmy-Grammar · 英语语法速通宝典

互动式英语语法学习中心，专为 CET-6 / 考研英语备考设计。

**在线访问**: https://jimmy-library.github.io/Jimmy-Grammar/

---

## 功能

- 📖 **34 章语法讲解** — 覆盖词法、时态语态、复合句与非谓语三大模块
- 📝 **章节配套练习** — 单选 / 判断 / 填空，自动批改 + 详细解析
- 🃏 **抽认卡** — 固定搭配与动词翻卡记忆
- 📕 **错题本** — 自动收集错题，一键重做
- 🎮 **闯关挑战** — 限时连击得分，自选章节
- 📝 **入学测试** — 完整版 & 简化版，客观题自动评分，导出 PDF
- 🖊️ **高亮与笔记** — 选中文字高亮批注，自动保存
- 🔍 **全文搜索** — 中英文检索所有讲解与题目
- 📄 **导出 PDF** — 章节与试卷一键导出，带青山沃思页眉

## 本地运行

```bash
cd Jimmy-Grammar
python3 -m http.server 8766
# 打开 http://localhost:8766/
```

纯静态 HTML/CSS/JS，无需构建工具，无需后端。

## 项目结构

```
├── index.html          # 入口页面
├── styles.css          # 所有样式
├── app.js              # 路由、练习引擎、闯关、笔记、导出
├── data-chapters.js    # 34 章语法讲解内容
├── data-questions.js   # 章节配套练习题
├── data-cards.js       # 抽认卡数据
├── data-exams.js       # 入学测试卷（完整版 & 简化版）
├── QRcode.png          # 课程咨询二维码
└── Jimmy's logo.png    # Logo
```

## 入学测试

| 模块 | 完整版 | 简化版 |
|------|--------|--------|
| Part 1 词汇 | 40题 × 1分 | 40题 × 1分 |
| Part 2 单选 | 10题 × 2分 | 8题 × 4分 |
| Part 3 动词填空 | 5题 × 2分 | 4题 × 2分 |
| Part 4 翻译（主观） | 5题 × 3分 | 2题 × 5分 |
| Part 5 从句分析（主观） | 5题 × 3分 | 2题 × 5分 |

客观题自动批改，主观题显示参考答案。批改后自动弹出 PDF 导出。

## 技术栈

- 纯静态 SPA，hash 路由
- localStorage 持久化学习进度、成绩、笔记
- Web Speech API 音标朗读
- Web Audio API 闯关音效
- CSS 变量 + Flexbox/Grid 响应式布局

## License

© 2026 Jimmy · 青山沃思
