# D-slop Phase 2: Automated Rules Maintenance — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate discovery and validation of AI-slop phrase signals so `rules.json` stays current without manual intervention.

**Architecture:** Two decoupled GitHub Actions workflows — `discover.yml` scrapes content and extracts candidates, `validate.yml` calls the Claude API to confirm them. Validated changes auto-merge to `main`; the extension's existing 24-hour cache picks them up automatically.

**Tech Stack:** Node.js (ESM, matching existing project), GitHub Actions, Anthropic API, Brave Search API

---

## Overview

The rules engine's primary signal — `phraseMatch` — degrades over time as AI writing patterns evolve and as new LLMs develop new verbal tics. Phase 2 adds a self-maintaining pipeline that:

1. Discovers candidate phrases via web search (meta-articles) and frequency differential analysis
2. Validates candidates using Claude before adding them to `rules.json`
3. Prunes stale phrases that have migrated into common human usage
4. Commits updates automatically; users receive them within 24 hours via the existing fetch cache

---

## Workflows

### `discover.yml` — Discovery

**Triggers:** Weekly cron (Sunday 00:00 UTC) + `workflow_dispatch`

**Script:** `scripts/discover.mjs`

**Steps:**

1. **Web search for meta-articles** — runs search queries from `config/discovery.json` against Brave Search API. Deduplicates results against `config/seen-urls.json` (rolling log, capped at 500 entries) so articles aren't reprocessed across runs.

2. **Meta-article extraction** — fetches each new article, strips HTML, and extracts candidate phrases from: quoted strings, bulleted/numbered lists, inline code spans, and sentences matching patterns like "ChatGPT often says X" or "watch for the phrase X". These are high-confidence candidates — a human already identified them as AI-tells.

3. **AI corpus scrape** — fetches URLs in `config/ai-sources.json` (marketing blogs, AI content farms, known-LLM-generated pages) and extracts clean text.

4. **Human corpus scrape** — fetches URLs in `config/human-sources.json` (Wikipedia articles, pre-2022 news) and extracts clean text. This is the baseline for frequency comparison.

5. **Frequency differential** — for each 2–4 word n-gram appearing in the AI corpus, computes `AI frequency / human frequency`. Candidates that exceed `frequencyMultiplier` (default: 5×) and appear at least `minOccurrences` (default: 3) times in the AI corpus are surfaced.

Both channels (meta-article + differential) are merged and deduplicated. Phrases already present in `rules.json` are filtered out.

**Output:** `candidates/YYYY-MM-DD.json` — committed to `main` with provenance per phrase (source URL or "frequency-differential", occurrence count).

If zero candidates are found, no file is written and the workflow exits cleanly.

---

### `validate.yml` — Validation

**Triggers:** Push to `candidates/` (path filter) + `workflow_dispatch`

**Script:** `scripts/validate.mjs`

**Steps:**

1. **Claude confirmation gate** — for each candidate phrase, calls the Anthropic API with a structured prompt asking Claude to evaluate two criteria:
   - Does this phrase appear in AI-generated content at a noticeably higher rate than human writing?
   - Is it specific enough to be a useful signal (not so generic it fires on normal human prose)?

   Both must be `yes` for a phrase to pass.

2. **Staleness review** — separately, Claude reviews the full existing `phraseMatch.phrases` list and flags any phrases that have become too common in general human usage to remain useful signals. Flagged phrases are removed.

3. **rules.json update** — confirmed new phrases are appended; stale phrases are removed; `version` is incremented by 1.

4. **Commit** — if any net change occurred, commits with message:
   `chore(rules): auto-update phrases vN → vN+1 [+N added, -N removed]`
   and pushes to `main`. If no net change, skips the commit.

**Observability:** Both workflows write a step summary to the GitHub Actions UI listing phrases discovered, confirmed, removed, and the new total count.

---

## File Structure

```
config/
  ai-sources.json       # Curated list of known-AI content URLs
  human-sources.json    # Baseline human-writing URLs (Wikipedia, pre-2022 news)
  discovery.json        # Tunable parameters (search queries, thresholds)
  seen-urls.json        # Rolling log of processed meta-article URLs (committed)

candidates/
  YYYY-MM-DD.json       # Discovery output, one file per run (audit trail)

scripts/
  discover.mjs          # Discovery script
  validate.mjs          # Validation script

.github/workflows/
  discover.yml
  validate.yml
```

### `config/discovery.json`

```json
{
  "searchQueries": [
    "AI writing patterns phrases",
    "ChatGPT phrases to avoid",
    "AI slop words list",
    "LLM writing tells site:medium.com",
    "how to detect AI writing patterns"
  ],
  "frequencyMultiplier": 5,
  "minOccurrences": 3,
  "maxArticlesPerRun": 20
}
```

---

## Secrets Required

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude API calls in validate workflow |
| `BRAVE_SEARCH_API_KEY` | Web search in discover workflow (free tier: 2,000 calls/month) |

Both stored as GitHub Actions repository secrets.

---

## Alternatives Considered

These options were deliberately not chosen for Phase 2 but are documented here for future reference.

### Discovery: Claude Open Analysis (deferred to Phase 3)

Feed representative AI content to Claude without an existing phrase list and ask it to identify patterns it notices independently. This approach is intentionally unanchored — it can surface emergent patterns the frequency differential would miss.

Not selected now because it's expensive, hard to evaluate without a ground-truth baseline, and the system needs to mature before open-ended Claude analysis is reliable. The intent is to enable this as the corpus and provenance data grow — the candidates audit trail in `candidates/` will eventually provide enough signal to calibrate Claude's open analysis.

**Future trigger:** Once the system has run for 3+ months and the phrase list has stabilized, add a third discovery channel in `scripts/discover.mjs` that feeds 5–10 AI corpus samples to Claude with the prompt: "Identify phrases in this text that feel distinctly AI-generated. Don't reference the existing phrase list." Aggregate responses across samples, filter for phrases appearing in 3+ responses, and add to the candidate pool.

### Validation Gate: Triple confirmation (not selected)

Option C added a third gate: after Claude confirms a phrase, check its false-positive rate against the human corpus — if it appears above a threshold in human writing, reject it even if Claude approved it.

Not selected because:
- Claude's evaluation implicitly accounts for human usage ("is it generic?")
- Adds complexity and another threshold to tune
- The staleness review already handles phrases that migrate into human usage over time

Revisit if false-positive rates become a problem in practice.

### Architecture: Single sequential workflow (not selected)

One workflow doing everything in order: search → scrape → extract → validate → commit. Simpler to understand, but discovery (cheap, fast) and validation (calls paid API) are coupled — a validation failure requires re-running the full scrape, and there's no inspection point between the two stages.

### Architecture: Three-job workflow with artifact passing (not selected)

Same as chosen Option B but as a single workflow file with three jobs passing data via GitHub Actions artifacts. Cleaner separation than Option A but more complex than Option B without meaningful benefit for this use case. The `candidates/` commit in Option B already serves as the artifact and provides a persistent audit trail.

---

## Extension Compatibility

No changes to the extension are required for Phase 2. The background script already fetches `rules.json` from `raw.githubusercontent.com` on a 24-hour cache interval. Automated commits to `main` propagate to users within one cache cycle.

If phrase list churn becomes noticeable (many additions/removals per week), a future option is to gate users on `version` and only re-score a page when the version changes.
