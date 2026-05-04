---
description: Publish a previously generated session to Instagram, LinkedIn, or all platforms.
argument-hint: '"<partial-name-or-path>" --platform instagram|linkedin|all'
allowed-tools: Bash, Read
---

# /publish Command

Publish a finished reel or carousel session to social platforms.

## 1. Resolve Session Directory

Parse `$ARGUMENTS`:
- Extract everything before `--platform` as `$INPUT` (strip surrounding quotes)
- Extract value after `--platform` as `$PLATFORM` (default: `all` if not provided)

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
