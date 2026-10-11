# LexiStory

[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md)
[![zh-CN](https://img.shields.io/badge/lang-zh--CN-blue.svg)](README.zh-CN.md)

> An AI-powered contextual English reading app, built for China's graduate entrance exam (考研英语). What you've learned doesn't get dropped — words and grammar resurface on a spaced-repetition schedule, woven into new articles so you meet them again in real context.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 to start learning.

## The Idea

Memorizing words and studying grammar in isolation, without ever using them in real text, doesn't stick.

LexiStory puts your **wordbook** and **grammar notebook** on one spaced-repetition engine, and every article is a mix:

```
one article = new words from your textbook unit + words due for review
            + words you got wrong on a quiz     + words you pasted in yourself
            + new grammar from the unit         + grammar due for review
```

The recipe is shown before you generate, with new vs. resurfacing content colour-coded.

## How It Works

1. **Pick a unit** — PEP primary / junior high / graduate-exam syllabus, or just paste your own word list.
2. **Review today's recipe** — see exactly how many new words, review words and grammar points go in; drop any you don't want.
3. **Generate** — AI writes an article. New words get strong context clues; review words are woven in naturally with a different collocation.
4. **Read** — target words are highlighted; tap a sentence for constituent breakdown, difficult words, grammar notes, and audio.
5. **Quiz** — 3 questions. Correct answers stretch the interval; wrong ones come back the same day and lead the next article.
6. **Look back** — open any grammar point to see every real sentence from your own reading that used it.

## Features

- **Mixed-recipe generation** — learned material resurfaces on schedule instead of being dropped
- **Spaced repetition** — simplified SM-2, shared by words and grammar
- **Coverage verification** — checks target words actually appear (including inflections like *preserved* / *cats*); words the model skipped are not credited and stay in the review queue
- **Sense control** — pins the intended meaning per word, so *book* doesn't drift between "a book" and "to book"
- **Grammar notebook + explanation pages** — reverse-lookup every sentence from your reading that used a given grammar point
- **Sentence analysis** — constituents, IPA + glosses for hard words, grammar notes, phrase spotting
- **Wordbook** — due view, bulk import, source-sentence lookup
- **Stats** — vocabulary growth, grammar coverage, review heatmap
- **Backup** — one-click JSON export/import (all data lives only in your browser)

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (desktop sidebar / mobile bottom nav)
- localStorage persistence with versioned migration and automatic snapshots
- DeepSeek API (article generation, word enrichment)
- Alibaba DashScope (sentence audio, optional)

## AI Configuration

Create a `.env.local` file in the project root:

```
DEEPSEEK_API_KEY=your_api_key_here     # required: article generation, word enrichment
DASHSCOPE_API_KEY=your_api_key_here    # optional: sentence audio; falls back to browser speech
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
