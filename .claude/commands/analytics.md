# /analytics — Social Media Performance Analytics

Pull engagement metrics from Instagram and LinkedIn, compute performance scores, and generate vault dashboards + brand insights.

## Usage

```
/analytics                     Pull metrics + show summary
/analytics --post <id>         Detailed metrics for one post
/analytics --refresh           Force refresh all (ignore 6hr cache)
/analytics --insights          Regenerate vault/brand/modules/performance.md
/analytics --dashboard         Regenerate vault/analytics/ markdown files
```

Flags are composable: `/analytics --refresh --insights --dashboard`

## Parse Arguments

Parse `$ARGUMENTS`:
- `--post <id>` → `$POST_ID`
- `--refresh` → `$FORCE=true`
- `--insights` → `$GEN_INSIGHTS=true`
- `--dashboard` → `$GEN_DASHBOARD=true`
- No flags → pull + summary (default)

## Pipeline

### Step 1: Pull Metrics

```bash
if [ -n "$POST_ID" ]; then
  python3 -m scripts.analytics pull --id "$POST_ID" $( [ "$FORCE" = true ] && echo "--force" )
elif [ "$FORCE" = true ]; then
  python3 -m scripts.analytics pull --force
else
  python3 -m scripts.analytics pull
fi
```

### Step 2: Show Output

**If `--post` was set:**
```bash
python3 -m scripts.analytics detail --id "$POST_ID"
```

**Otherwise (default):**
```bash
python3 -m scripts.analytics summary
```

### Step 3: Dashboard (conditional)

If `--dashboard` is set:
```bash
python3 -m scripts.analytics dashboard
```

Report: `✓ Dashboard written to vault/analytics/`

### Step 4: Insights (conditional)

If `--insights` is set:
```bash
python3 -m scripts.analytics insights
```

Report: `✓ Performance insights written to vault/brand/modules/performance.md`

### Step 5: Done

Report what was done:
```
✓ /analytics complete
  Pulled: <N> posts updated
  [if --dashboard] Dashboard: vault/analytics/
  [if --insights] Insights: vault/brand/modules/performance.md
```
