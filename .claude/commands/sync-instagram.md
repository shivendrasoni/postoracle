---
description: Sync saved Instagram posts into the vault with metadata and collections.
argument-hint: '[--refresh] [--collection "Name"]'
allowed-tools: Bash, Read
---

# /sync-instagram Command

Sync your saved/bookmarked Instagram posts into the vault as structured markdown files.

## 0. Check Environment

Verify Instagram session cookies are set:

```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
missing = [k for k in ('INSTAGRAM_SESSION_ID', 'INSTAGRAM_CSRF_TOKEN', 'INSTAGRAM_DS_USER_ID') if not os.environ.get(k)]
if missing:
    print('MISSING: ' + ', '.join(missing))
else:
    print('OK')
"
```

If any are missing, show:
```
⚠ Instagram session cookies not configured.

Add these to your .env file:
  INSTAGRAM_SESSION_ID=<your sessionid cookie>
  INSTAGRAM_CSRF_TOKEN=<your csrftoken cookie>
  INSTAGRAM_DS_USER_ID=<your ds_user_id cookie>

To get these values:
  1. Open Chrome → instagram.com (logged in)
  2. Cmd+Option+I → Application tab → Cookies → instagram.com
  3. Copy sessionid, csrftoken, ds_user_id values
```
Stop here if missing.

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('sync_instagram')
print(json.dumps(config))
"
```

Use config values as defaults:
- `--collection` overrides `config.collection` (default: null/none)

## 1. Parse Arguments

Parse `$ARGUMENTS`:
- `--refresh` → `$REFRESH=--refresh`
- `--collection <name>` → `$COLLECTION=--collection "<name>"`
- No flags → default sync (skip existing)

## 2. Run Sync

```bash
python3 -m scripts.sync_instagram sync $REFRESH $COLLECTION
```

## 3. Report

Display the output from the script. If sync was successful and new posts were found, also show:

```
Tip: Browse your saved posts at vault/imports/instagram-saved/
     View collections with: /sync-instagram --collection "<name>"
     Full refresh with: /sync-instagram --refresh
```
