# D-slop Browser Extension

A browser extension that highlights or hides AI-generated content on web pages.

## Setup

Requires Node.js >= 20.

```bash
npm install
npx wxt prepare
npm run dev
```

## Build

```bash
npm run build        # Chrome/Chromium
npm run build:firefox  # Firefox
```

Output goes to `.output/chrome-mv3/` or `.output/firefox-mv2/`.

## Test

```bash
npm test        # Run once
npm run test:watch  # Watch mode
```
