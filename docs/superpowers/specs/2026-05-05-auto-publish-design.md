# Auto-Publish Design

**Date:** 2026-05-05
**Status:** Approved

## Problem

After `make-reel` or `make-carousel` produces a finished asset, publishing to Instagram and LinkedIn requires manual steps. There is also no way to publish previously generated sessions without re-running the pipeline. As more platforms are added (Twitter, YouTube, Bluesky, Threads), the publish logic must stay maintainable without touching pipeline command files.

## Goals

- Add `--auto-publish instagram|linkedin|all` flag to `make-reel` and `make-carousel`
- Add `/publish "partial-name-or-path" --platform instagram|linkedin|all` standalone command
- Send an email notification after every successful publish (configurable, off by default if config is missing)
- Add `/add-platform <name>` command to scaffold new platform handlers without touching core logic
- Never touch existing pipeline stages — publish is always appended, never embedded

## Non-Goals

- Scheduling or queued publishing (post now only)
- Analytics or engagement tracking
- Multi-account support per platform (single connected account per platform)

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `scripts/publish.py` | Core publisher — platform registry, content detection, Composio calls, email |
| `vault/publish-config.md` | User config: notify email, notify_enabled flag |
| `.claude/commands/publish.md` | `/publish` slash command |
| `.claude/commands/add-platform.md` | `/add-platform` slash command |
| `tests/test_publish.py` | Unit tests for detection and routing logic |

### Modified Files

| File | Change |
|------|--------|
| `.claude/commands/make-reel.md` | Parse `--auto-publish` flag; add Stage 6 publish step |
| `.claude/commands/make-carousel.md` | Parse `--auto-publish` flag; add Stage 6 publish step |

Nothing else changes. Existing scripts, brand modules, and pipeline stages are untouched.

---

## `scripts/publish.py`

### Platform Registry Pattern

```python
PLATFORM_REGISTRY = {
    "instagram": {
        "reel":     _instagram_reel,
        "carousel": _instagram_carousel,
    },
    "linkedin": {
        "reel":     _linkedin_reel,
        "carousel": _linkedin_carousel,
    },
}
```

Each handler has the signature:
```python
def handler(session_dir: Path, caption: str, config: dict) -> dict:
    # returns {"success": bool, "url": str | None, "error": str | None}
```

The core `publish()` function:
1. Resolves `all` → all registered platform keys
2. Detects content type from folder contents:
   - `final.mp4` present → `reel`
   - `1.png` present → `carousel`
   - Both present → error: "Ambiguous session: contains both final.mp4 and 1.png"
   - Neither present → error: "No publishable asset found in session dir"
3. Reads caption from the appropriate file:
   - Reel: `caption.md` — extracts text under `## Post Caption` section
   - Carousel: `caption.txt` — extracts text after `[POST CAPTION]` line
4. Loops over resolved platforms, calls each handler, collects results
5. After all handlers complete (regardless of per-platform success/failure): if `notify_enabled` in config, sends email via agent-mail with the full per-platform result summary
6. Prints a result summary per platform (succeeded / failed / skipped)

### Adding a New Platform

Adding Twitter in the future requires:
1. Define `_twitter_reel()` and/or `_twitter_carousel()` handler functions
2. Add one entry to `PLATFORM_REGISTRY`
3. Register the Composio account with `composio link twitter`

No other files change.

### CLI Interface

```
python3 scripts/publish.py \
  --session-dir <path> \
  --platform instagram|linkedin|all \
  [--dry-run]
```

`--dry-run` prints what would be published without calling Composio.

### Composio Integration

Handlers call `composio execute <SLUG> -d '<json>'` via `subprocess.run()`. Slugs are discovered at implementation time via `composio search`. If Composio reports a toolkit is not connected, the handler returns `{"success": false, "error": "Not connected — run: composio link <platform>"}` and the publish loop continues with remaining platforms (non-fatal per platform).

---

## `vault/publish-config.md`

```yaml
---
notify_email: shivendrasoni91+agent@gmail.com
notify_enabled: true
---
```

Read at publish time by `publish.py`. If the file is missing entirely, email is skipped with a `[WARN]` (not a hard failure). The `notify_enabled: false` flag disables email without removing the address.

---

## `make-reel.md` Changes

### Argument parsing (Stage 0)

Add to the `Parse $ARGUMENTS` block:
```
--auto-publish instagram|linkedin|all  — optional; if present, publish after pipeline completes
```

### New Stage 6 — Publish (conditional)

Appended after Stage 5.5 (pipeline log). Runs only if `--auto-publish` was passed.

```bash
if [ -n "$AUTO_PUBLISH" ]; then
  python3 scripts/publish.py \
    --session-dir "$SESSION_DIR" \
    --platform "$AUTO_PUBLISH"
fi
```

Done report gains a `Published:` line when auto-publish ran.

### `make-carousel.md` Changes

Identical treatment: parse `--auto-publish`, add the same Stage 6 block after Stage 5.5.

---

## `/publish` Command

**Argument hint:** `"<partial-name-or-path>" --platform instagram|linkedin|all`

**Flow:**
1. If input starts with `/`, `./`, or `vault/` — treat as a direct path to a session folder, skip search. Otherwise, search `vault/outputs/reels/` and `vault/outputs/carousels/` for folders whose name contains the input string (case-insensitive)
2. If 0 matches → `[ERROR] No session found matching '<input>'`
3. If exactly 1 match → proceed
4. If 2+ matches → list them with full paths and last-modified timestamps, ask user to pick by number. Wait for input before continuing.
5. Call `python3 scripts/publish.py --session-dir <resolved-dir> --platform <platform>`
6. Report result inline

---

## `/add-platform` Command

**Argument hint:** `<platform-name> [--types reel|carousel|both]`

**Flow:**
1. Run `composio search "post <name> video" "post <name> images carousel"` to find slugs
2. For each discovered slug, run `composio execute <SLUG> --get-schema` to inspect required parameters
3. In `scripts/publish.py`:
   - Scaffold handler function(s) using real slug names and parameter names from the schema
   - Add entry to `PLATFORM_REGISTRY`
4. Report to user:
   ```
   ✓ Added <name> handlers to PLATFORM_REGISTRY
   Connect your account: composio link <name>
   Then test with: /publish "session-name" --platform <name> --dry-run
   ```

If no Composio slugs are found for the platform, report: `[WARN] No Composio tools found for '<name>'. Check 'composio search "<name>"' manually.`

---

## Email Notification

Sent via the agent-mail Composio connection after a successful publish run. Email includes:
- Subject: `Published: <session folder name> → <platform(s)>`
- Body: platform-by-platform result summary, session path, post URL(s) if available

Recipient and enabled flag come from `vault/publish-config.md`.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Platform not connected in Composio | Per-platform failure, continue others, report at end |
| Session dir not found | Hard fail with clear message |
| Ambiguous content type (both mp4 + png) | Hard fail with message |
| No publishable asset found | Hard fail with message |
| Caption file missing | Hard fail — caption is required for publish |
| `vault/publish-config.md` missing | Warn + skip email, continue publish |
| Composio CLI not on PATH | Hard fail: "composio not found — install with: npm install -g @composio/cli" |

---

## Testing

`tests/test_publish.py` covers:
- Content type detection (reel / carousel / ambiguous / empty)
- Caption extraction from both `caption.md` and `caption.txt` formats
- Registry resolution: `all` expands to all registered platforms
- `--dry-run` flag produces no Composio calls
- Missing config file → email skipped, publish continues
