# D-slop

A browser extension that detects AI-generated content and gets out of your way.

Highlight suspicious blocks, collapse them behind a click, or block the whole page until you decide you want to see it. The phrase list updates automatically — no manual maintenance required.

---

## How it works

D-slop scores each block of text on your page using five signals:

- **Phrase matching** — a curated list of phrases that appear disproportionately in AI writing ("delve into", "it's worth noting", "moving forward", and about 50 others)
- **Burstiness** — AI tends to write sentences of nearly identical length; human writing varies
- **Punctuation density** — consistent over- or under-punctuation is a tell
- **List uniformity** — AI bullet points are eerily even in length
- **Conclusion markers** — formulaic closings like "in conclusion" and "to summarize"

Any block scoring above the threshold gets flagged. You choose what happens next.

## Modes

- **Highlight** — flags get an orange outline and a score badge
- **Collapse** — flagged blocks fold into a `<details>` element; click to reveal
- **Hidden** — a full-page overlay appears with a 3-second countdown before navigating back; a "Show anyway" button lets you override

The threshold and mode are adjustable from the popup.

## Automatic phrase updates

The phrase list is maintained by a weekly GitHub Actions pipeline. It searches for new AI-writing-pattern articles, scrapes a corpus of known-AI and known-human content, runs frequency differential analysis, and passes candidates through a Claude validation gate before anything gets added. Stale phrases are pruned the same way. Updates reach your browser within 24 hours of each run — no reinstall needed.

Rules are served from a private Cloudflare endpoint, not the public repo, so the phrase list isn't trivially reverse-engineerable.

---

## Install

### Chrome Web Store

_Coming soon._

### Manual (developer mode)

1. Download the latest release zip from the [Releases](https://github.com/jared-the-automator/d-slop/releases) page and unzip it, or clone and build (see below)
2. Go to `chrome://extensions`
3. Enable Developer mode (top right)
4. Click "Load unpacked" and select the `.output/chrome-mv3/` folder

Firefox users: use `npm run build:firefox` and load `.output/firefox-mv2/`.

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

D-slop has no telemetry, no accounts, and no data collection. It reads the text already on your screen. The only outbound request it makes is a periodic fetch of the rules file from Cloudflare — about 5KB, once per 24 hours.

---

## Contributing

Bug reports and phrase suggestions are welcome via [GitHub Issues](https://github.com/jared-the-automator/d-slop/issues). The automated pipeline handles phrase maintenance, so manual phrase PRs are unlikely to be merged — but if you've found a whole category the detector misses, open an issue and describe it.

---

## License

MIT — see [LICENSE](LICENSE).
