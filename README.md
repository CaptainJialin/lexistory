# LexiStory

[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md)
[![zh-CN](https://img.shields.io/badge/lang-zh--CN-blue.svg)](README.zh-CN.md)

> An AI-powered contextual English learning app that turns your vocabulary and grammar into personalized reading passages.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 to start learning.

## How It Works

1. **Input vocabulary** — Enter 5-10 words you want to learn.
2. **Pick a grammar point** — Choose from topics like Simple Present, Relative Clauses, etc.
3. **Generate** — AI writes a custom article that naturally incorporates your words and grammar.
4. **Read & learn** — Target words are highlighted; click for definitions. Sentence-level analysis available.
5. **Quiz & review** — Take a 3-question quiz and check your learning history anytime.

## Features

- **AI-generated articles** tailored to your vocabulary and grammar level
- **Sentence analysis** with constituent breakdown, difficult words, and grammar explanations
- **Interactive quiz** after each article (vocabulary, grammar, reading comprehension)
- **Wordbook** to track word proficiency over time
- **Learning history** with all generated articles
- **AI-recommended words & grammar** for each study session

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- localStorage persistence
- DeepSeek API (article generation)

## AI Configuration

Create a `.env.local` file in the project root and add your DeepSeek API key:

```
DEEPSEEK_API_KEY=your_api_key_here
```

Then restart the dev server:

```bash
npm run dev
```

## Deployment

Recommended platform: [Vercel](https://vercel.com)

```bash
npx vercel
```

Remember to set the `DEEPSEEK_API_KEY` environment variable in your Vercel project settings.

## License

MIT
