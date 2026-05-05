# LexiStory

一款**语境式英语学习 Web App**。

核心想法：把你当天学的单词和语法，编织成一篇专属的英文文章。在真实语境中阅读、记忆、理解。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可使用。

## 核心流程

1. 输入今日要学的单词（5-10 个）
2. 选择一个语法点（如：一般现在时、现在完成时等）
3. 点击生成，AI 为你写一篇文章
4. 在阅读页中高亮查看目标单词，阅读中文大意
5. 历史记录页回顾所有生成的文章

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- localStorage 本地持久化
- Claude API（可选，用于真实文章生成）

## 配置真实 AI 生成（可选）

MVP 版本在没有 API Key 时会返回示例文章。如需接入真实的 Claude API：

1. 在根目录创建 `.env.local`
2. 写入：`ANTHROPIC_API_KEY=你的API密钥`
3. 重启 `npm run dev`

## 部署

推荐部署到 [Vercel](https://vercel.com)：

```bash
npx vercel
```
