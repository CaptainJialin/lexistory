# LexiStory

[English](README.md) | 中文

> 一款 AI 驱动的语境式英语学习应用，将词汇和语法编织成专属阅读文章。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可开始学习。

## 核心流程

1. **输入单词** — 输入今日要学的 5-10 个单词。
2. **选择语法** — 从一般现在时、定语从句等话题中选择。
3. **生成文章** — AI 为你写一篇自然融入这些单词和语法的文章。
4. **阅读学习** — 目标单词高亮显示，点击查看释义；支持句子级语法分析。
5. **测验回顾** — 完成课后测验，随时在历史记录中复习。

## 功能特性

- **AI 生成文章**，根据你的词汇和语法水平量身定制
- **句子分析**，包含成分拆解、难词解释和语法说明
- **互动测验**，每篇文章后附词汇、语法、阅读理解三类题目
- **单词本**，追踪单词掌握度
- **学习历史**，保存所有生成的文章
- **AI 推荐单词和语法**，每次学习自动推荐新内容

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- localStorage 本地持久化
- DeepSeek API（文章生成）

## AI 配置

在项目根目录创建 `.env.local` 文件，写入你的 DeepSeek API Key：

```
DEEPSEEK_API_KEY=你的API密钥
```

然后重启开发服务器：

```bash
npm run dev
```

## 部署

推荐部署平台：[Vercel](https://vercel.com)

```bash
npx vercel
```

别忘了在 Vercel 项目设置中配置 `DEEPSEEK_API_KEY` 环境变量。

## 许可

MIT
