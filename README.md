# D-slop

A browser extension that detects AI-generated content and gets out of your way.

It flags suspicious text, collapses it behind a click, or blocks the whole page until you decide you want to see it. Media detection is built in too: images, video, and audio are checked against C2PA provenance metadata, the open standard that major AI generators embed in their output. The phrase list refreshes automatically in the background, so there's nothing to maintain.

---

## How it works

### Text detection

D-slop scores each block of text on your page using five signals:

- **Phrase matching** — a curated list of phrases that appear disproportionately in AI writing ("delve into", "it's worth noting", "moving forward", and about 50 others)
- **Burstiness** — AI tends to write sentences of nearly identical length; human writing varies
- **Punctuation density** — consistent over- or under-punctuation is a tell
- **List uniformity** — AI bullet points are eerily even in length
- **Conclusion markers** — formulaic closings like "in conclusion" and "to summarize"

Any block scoring above your threshold gets flagged.

### Media detection

D-slop scans images, video, and audio for [C2PA](https://c2pa.org/) provenance metadata — the Content Authenticity Initiative standard that major AI image generators (Adobe Firefly, DALL-E, Midjourney, Stable Diffusion, Bing Image Creator, Microsoft Designer) embed in their output. If a valid AI-provenance manifest is found, the element is flagged with the detection method and, when available, the name of the generating tool.

Scans run in the background to avoid browser CORS restrictions, checking only the first 200KB of each file to keep things fast. Images and videos that load lazily are caught as they appear.

## Modes

Text and media each have independent mode and threshold controls in the popup.

- **Highlight** — flagged content gets an orange outline and a badge ("AI ~72%" for text, "C2PA: Adobe Firefly" for media)
- **Collapse** — flagged content is hidden behind a placeholder with a "Show anyway" button
- **Hidden** — a full-page overlay appears with a 3-second countdown before navigating back; a "Show anyway" button lets you override

## Automatic phrase updates

The phrase list is maintained by a weekly GitHub Actions pipeline. It searches for new AI-writing-pattern articles, scrapes a corpus of known-AI and known-human content, runs frequency differential analysis, and passes candidates through a Claude validation gate before anything gets added. Stale phrases are pruned the same way. Updates reach your browser within 24 hours of each run — no reinstall needed.

Rules are served from a private Cloudflare endpoint, not the public repo, so the phrase list isn't trivially reverse-engineerable.

---

## Install

### Chrome / Vivaldi / Brave / Edge

1. Download `d-slop-chrome-vX.X.X.zip` from the [latest release](https://github.com/jared-the-automator/d-slop/releases/latest) and unzip it
2. Go to your browser's extensions page (e.g. `chrome://extensions`)
3. Enable Developer mode (top right toggle)
4. Click "Load unpacked" and select the unzipped folder

### Firefox

1. Download `d-slop-firefox-vX.X.X.zip` from the [latest release](https://github.com/jared-the-automator/d-slop/releases/latest)
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select the zip

---

## Build from source

Requires Node.js >= 20.

```bash
git clone https://github.com/jared-the-automator/d-slop.git
cd d-slop
npm install
npm run build        # Chrome
npm run build:firefox  # Firefox
```

Run tests:

```bash
npm test
```

Development mode with hot reload:

```bash
npm run dev
```

---

## Privacy

D-slop has no telemetry, no accounts, and no data collection. It reads the text and media already on your screen. The only outbound requests it makes are a periodic fetch of the rules file from Cloudflare (about 5KB, once per 24 hours) and partial media fetches for C2PA scanning (first 200KB of each media element, only while detection is enabled).

---

## Contributing

Bug reports and phrase suggestions are welcome via [GitHub Issues](https://github.com/jared-the-automator/d-slop/issues). The automated pipeline handles phrase maintenance, so manual phrase PRs are unlikely to be merged — but if you've found a whole category the detector misses, open an issue and describe it.

---

## License

MIT — see [LICENSE](LICENSE).
