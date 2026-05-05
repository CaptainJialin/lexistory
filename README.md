# LexiStory

> An AI-powered contextual English learning app that turns your vocabulary and grammar into personalized reading passages.
>
> 一款 AI 驱动的语境式英语学习应用，将词汇和语法编织成专属阅读文章。

## Quick Start / 快速开始

```bash
npm install
npm run dev
```

Open http://localhost:3000 to start learning.

打开 http://localhost:3000 即可开始学习。

## How It Works / 核心流程

1. **Input vocabulary** — Enter 5-10 words you want to learn.
   **输入单词** — 输入今日要学的 5-10 个单词。

2. **Pick a grammar point** — Choose from topics like Simple Present, Relative Clauses, etc.
   **选择语法** — 从一般现在时、定语从句等话题中选择。

3. **Generate** — AI writes a custom article that naturally incorporates your words and grammar.
   **生成文章** — AI 为你写一篇自然融入这些单词和语法的文章。

4. **Read & learn** — Target words are highlighted; click for definitions. Sentence-level analysis available.
   **阅读学习** — 目标单词高亮显示，点击查看释义；支持句子级语法分析。

5. **Quiz & review** — Take a 3-question quiz and check your learning history anytime.
   **测验回顾** — 完成课后测验，随时在历史记录中复习。

## Features / 功能特性

- **AI-generated articles** tailored to your vocabulary and grammar level
  **AI 生成文章**，根据你的词汇和语法水平量身定制

- **Sentence analysis** with constituent breakdown, difficult words, and grammar explanations
  **句子分析**，包含成分拆解、难词解释和语法说明

- **Interactive quiz** after each article (vocabulary, grammar, reading comprehension)
  **互动测验**，每篇文章后附词汇、语法、阅读理解三类题目

- **Wordbook** to track word proficiency over time
  **单词本**，追踪单词掌握度

- **Learning history** with all generated articles
  **学习历史**，保存所有生成的文章

- **AI-recommended words & grammar** for each study session
  **AI 推荐单词和语法**，每次学习自动推荐新内容

## Tech Stack / 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- localStorage persistence
  localStorage 本地持久化
- DeepSeek API (article generation)
  DeepSeek API（文章生成）

## AI Configuration / AI 配置

Create a `.env.local` file in the project root and add your DeepSeek API key:

在项目根目录创建 `.env.local` 文件，写入你的 DeepSeek API Key：

```
DEEPSEEK_API_KEY=your_api_key_here
```

Then restart the dev server:

然后重启开发服务器：

```bash
npm run dev
```

## Deployment / 部署

Recommended platform: [Vercel](https://vercel.com)

推荐部署平台：[Vercel](https://vercel.com)

```bash
npx vercel
```

Remember to set the `DEEPSEEK_API_KEY` environment variable in your Vercel project settings.

别忘了在 Vercel 项目设置中配置 `DEEPSEEK_API_KEY` 环境变量。

## License / 许可

MIT
