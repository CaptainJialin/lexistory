# LexiStory - 语境式英语学习 App

## 产品愿景
帮助用户通过"生成式阅读"来巩固单词和语法。核心创新点：用户学习的单词和语法不再是孤立的，而是会被编织成一篇连贯的英文文章，在真实语境中复现。

## 核心用户流程 (MVP)
1. **添加单词**：用户手动输入或粘贴今日要学的单词列表（约 5-10 个）
2. **选择语法**：从预设的语法点中选择一个（如：Simple Present Tense, Past Tense, Conditional I 等）
3. **生成文章**：调用 LLM 生成一篇短文，要求：
   - 必须自然地包含目标单词
   - 句式应主要体现所选语法点
   - 文章长度 150-300 词，难度适中（默认 B1）
4. **阅读学习**：
   - 目标单词在文章中高亮显示
   - 点击单词可查看释义
   - 显示文章的中文大意或关键语法提示
5. **历史回顾**：用户可以查看过去生成的文章和学过的单词

## 技术栈
- **框架**：Next.js 15 (App Router) + React 19 + TypeScript
- **样式**：Tailwind CSS 4 + shadcn/ui 组件库
- **状态管理**：React Context / useState（MVP 阶段保持简单）
- **后端/数据库**：暂用本地存储 (localStorage) 做数据持久化，零后端依赖
- **文章生成**：Claude API (通过 Next.js API Route 代理调用)
- **部署**：Vercel（免费且与 Next.js 无缝集成）

## 项目结构
```
app/
  page.tsx              # 主页面（单词输入 + 语法选择 + 生成按钮）
  layout.tsx            # 根布局
  article/
    page.tsx            # 文章阅读页
  history/
    page.tsx            # 历史记录页
components/
  ui/                   # shadcn/ui 组件
  word-input.tsx        # 单词输入组件
  grammar-select.tsx    # 语法选择组件
  article-viewer.tsx    # 文章展示组件
  word-highlight.tsx    # 单词高亮组件
lib/
  types.ts              # TypeScript 类型定义
  utils.ts              # 工具函数
  storage.ts            # localStorage 封装
  prompt.ts             # LLM prompt 模板
api/
  generate/route.ts     # 文章生成 API Route
```

## 设计原则
- **移动优先**：大多数用户会在手机上使用，UI 必须适配移动端
- **快速反馈**：生成文章时显示 loading 状态和进度提示
- **零配置启动**：新开发者 clone 后 `npm install && npm run dev` 即可运行
- **中文界面，英文内容**：降低中国用户的使用门槛
