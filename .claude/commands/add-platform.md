---
description: Scaffold a new social platform handler in scripts/publish.py without touching any other file.
argument-hint: "<platform-name> [--types reel|carousel|both]"
allowed-tools: Bash, Read, Edit
---

# /add-platform Command

Add a new platform to the publish registry by discovering Composio slugs and scaffolding handler functions.

## 1. Parse Arguments

Parse `$ARGUMENTS`:
- `$PLATFORM_NAME` — everything before any `--` flags (required, lowercase it)
- `--types reel|carousel|both` — default `both`

## 2. Discover Composio Slugs

```bash
composio search "post $PLATFORM_NAME video"
composio search "post $PLATFORM_NAME images carousel"
```

For each discovered slug, inspect its schema:

```bash
composio execute <SLUG> --get-schema
```

Note the required parameters for each slug.

If no slugs are found for the platform, report:
```
[WARN] No Composio tools found for '<platform-name>'. Check 'composio search "<platform-name>"' manually.
```
And stop.

## 3. Scaffold Handler Functions in scripts/publish.py

Read `scripts/publish.py`. Add new handler functions using the real slug names and parameter names discovered in Step 2.

Handler function template (adapt parameter names from the schema):

```python
def _<platform>_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call(
        slug="<DISCOVERED_REEL_SLUG>",
        payload={
            "<param_from_schema>": str(session_dir / "final.mp4"),
            "<caption_param>": caption,
        },
    )

def _<platform>_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())
    return _composio_call(
        slug="<DISCOVERED_CAROUSEL_SLUG>",
        payload={
            "<image_param>": image_paths,
            "<caption_param>": caption,
        },
    )
```

Add the new entry to `PLATFORM_REGISTRY`:

```python
"<platform>": {
    "reel": _<platform>_reel,       # omit if --types carousel
    "carousel": _<platform>_carousel, # omit if --types reel
},
```

Only add handler types matching `--types`. If `--types reel`, only add the reel handler (and only `"reel"` key in registry). If `--types carousel`, only carousel. If `--types both` (default), add both.

## 4. Report

```
✓ Added <platform> handlers to PLATFORM_REGISTRY
Connect your account: composio link <platform>
Then test with: /publish "session-name" --platform <platform> --dry-run
```
