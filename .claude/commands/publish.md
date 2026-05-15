---
description: Publish a previously generated session to Instagram, LinkedIn, or all platforms.
argument-hint: '"<partial-name-or-path>" --platform instagram|linkedin|all'
allowed-tools: Bash, Read
---

# /publish Command

Publish a finished reel or carousel session to social platforms.

## 0. List Unpublished (if no arguments)

If `$ARGUMENTS` is empty or `--list`:

```bash
python3 scripts/registry.py list --status draft
```

Display the result as a numbered list:
```
Unpublished content:
1) 2026-05-05-stop-trying-to-be-creative-just-see-what (carousel, instagram)
2) 2026-05-05-url (carousel, instagram)
3) 2026-05-06-openai-age-predictor (post, instagram, linkedin)
```

Ask: "Enter the number of the session to publish, and the platform (instagram/linkedin/all):"
Use the selected entry's `session_dir` as `SESSION_DIR` and proceed to Step 2.

If the user provided arguments, skip this step and proceed to Step 1 as before.

## 1. Resolve Session Directory

Parse `$ARGUMENTS`:
- Extract everything before `--platform` as `$INPUT` (strip surrounding quotes)
- Extract value after `--platform` as `$PLATFORM` (default: `all` if not provided)

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('publish')
print(json.dumps(config))
"
```

If `--platform` was not provided, use `config.platform` as the default.

**Path resolution:**
- If `$INPUT` starts with `/`, `./`, or `vault/` → treat as a direct path. Set `SESSION_DIR="$INPUT"`. Skip search.
- Otherwise → search for folders whose names contain `$INPUT` (case-insensitive):

```bash
find vault/outputs/reels vault/outputs/carousels -maxdepth 1 -type d \
  | grep -i "$INPUT" \
  | sort -t'-' -k1,3
```

**Match handling:**
- 0 matches → `[ERROR] No session found matching '$INPUT'` — stop.
- 1 match → set `SESSION_DIR` to that path, proceed.
- 2+ matches → list them numbered with full path and last-modified timestamp:

```bash
i=1
while IFS= read -r dir; do
  echo "$i) $dir  (modified: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$dir"))"
  i=$((i+1))
done <<< "$MATCHES"
```

Ask: "Multiple sessions match. Enter the number of the session to publish:"
Wait for user input. Use the selected path as `SESSION_DIR`.

## 2. Publish

```bash
python3 scripts/publish.py \
  --session-dir "$SESSION_DIR" \
  --platform "$PLATFORM"
```

## 3. Report Result

Report inline: show the publish summary printed by `publish.py`. No additional output needed.
