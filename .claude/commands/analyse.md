---
description: "Analyse a saved post — engagement, script, visual, angle, brand fit"
argument-hint: "<shortcode> [--refresh]"
allowed-tools: Bash, Read, Write, Edit, WebFetch
---

# /analyse — 5-Dimension Post Analysis

## Arguments

Parse `$ARGUMENTS` for:

- `<shortcode>` (required): Instagram shortcode of a saved post
- `--refresh` (flag): Re-analyse even if analysis already exists

If no `<shortcode>` is provided, stop with:
> "Usage: `/analyse <shortcode> [--refresh]`"

---

## Stage 0: Resolve Saved Post

Read the index to find the saved post file:

```bash
python3 -c "
import json, sys
with open('vault/imports/instagram-saved/_index.json') as f:
    index = json.load(f)
shortcode = '$SHORTCODE'
if shortcode not in index:
    print('ERROR: not found')
    sys.exit(1)
entry = index[shortcode]
print(json.dumps(entry))
"
```

If exit code is non-zero or output contains `ERROR: not found`:
> "Shortcode `$SHORTCODE` not found in saved posts. Run `/sync-instagram` first."

Extract from the JSON result:
- `$POST_FILE` = `vault/imports/instagram-saved/<entry.file>`
- `$POST_TYPE` = entry `type` (reel, post, carousel)
- `$VIDEO_FILE` = entry `video_file` (may be null for non-reels)
- `$DOWNLOADED` = entry `downloaded` (boolean)

Read the full saved post markdown file at `$POST_FILE`.

Extract from frontmatter:
- `$AUTHOR`, `$AUTHOR_NAME`, `$LINK`
- `$LIKE_COUNT`, `$COMMENT_COUNT`, `$VIEW_COUNT`
- `$DATE_PUBLISHED`, `$COLLECTION`

Extract the caption text (everything after the closing `---` of the frontmatter).

---

## Stage 1: Check for Existing Analysis

Check if the frontmatter contains `analysed_at`.

**If `analysed_at` exists AND `--refresh` is NOT set:**

Read the `## Analysis` section from the markdown and present it to the user in a clear format. Include the overall score and verdict from the frontmatter.

Stop here — no re-analysis needed.

**If `analysed_at` exists AND `--refresh` IS set:**

Continue to Stage 2. The old analysis will be replaced in Stage 5.

**If `analysed_at` does not exist:**

Continue to Stage 2 (normal first-time analysis, regardless of `--refresh` flag).

---

## Stage 2: Gather Engagement Metrics

Compute engagement metrics from the frontmatter data:

```bash
python3 -c "
import json

view_count = $VIEW_COUNT
like_count = $LIKE_COUNT
comment_count = $COMMENT_COUNT

# Engagement rates
like_rate = (like_count / view_count * 100) if view_count > 0 else 0
comment_rate = (comment_count / view_count * 100) if view_count > 0 else 0
total_engagement_rate = ((like_count + comment_count) / view_count * 100) if view_count > 0 else 0
like_to_comment = (like_count / comment_count) if comment_count > 0 else 0

# Benchmarks (Instagram Reels averages)
# Like rate: 2-4% average, >5% strong, <1.5% weak
# Comment rate: 0.1-0.3% average, >0.5% strong, <0.05% weak
# Total engagement: 3-5% average, >6% strong, <2% weak

def rate(value, weak_below, strong_above):
    if value >= strong_above:
        return 'strong'
    elif value >= weak_below:
        return 'average'
    else:
        return 'weak'

metrics = {
    'views': view_count,
    'likes': like_count,
    'comments': comment_count,
    'like_rate': round(like_rate, 2),
    'comment_rate': round(comment_rate, 3),
    'total_engagement_rate': round(total_engagement_rate, 2),
    'like_to_comment_ratio': round(like_to_comment, 1),
    'like_rate_rating': rate(like_rate, 1.5, 5.0),
    'comment_rate_rating': rate(comment_rate, 0.05, 0.5),
    'engagement_rating': rate(total_engagement_rate, 2.0, 6.0),
}
print(json.dumps(metrics, indent=2))
"
```

Store the metrics JSON as `$METRICS`.

---

## Stage 3: Load Context

### 3a. Brand Modules (all optional)

Read the following brand modules if they exist. Missing modules are non-fatal — note which are missing and continue.

- `vault/brand/modules/niche.md` — audience persona, transformation
- `vault/brand/modules/style.md` — tone, vocabulary, patterns
- `vault/brand/modules/pillars.md` — content pillars
- `vault/brand/modules/audience.md` — target audience definition

Store loaded content as `$BRAND_NICHE`, `$BRAND_STYLE`, `$BRAND_PILLARS`, `$BRAND_AUDIENCE`. Set each to `null` if the file does not exist.

Track whether ANY brand modules were loaded: `$HAS_BRAND_MODULES` (true/false).

### 3b. Video Keyframes (reels only)

If `$POST_TYPE` is `reel` and `$DOWNLOADED` is true and the video file exists at `vault/imports/instagram-saved/$VIDEO_FILE`:

Extract 4-6 keyframes at evenly spaced intervals:

```bash
VIDEO_PATH="vault/imports/instagram-saved/$VIDEO_FILE"
KEYFRAME_DIR="vault/imports/instagram-saved/keyframes/$SHORTCODE"
mkdir -p "$KEYFRAME_DIR"

# Get video duration
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH" 2>/dev/null | cut -d. -f1)

if [ -n "$DURATION" ] && [ "$DURATION" -gt 0 ]; then
  # Extract keyframes at 0%, 20%, 40%, 60%, 80%, 95% of duration
  for PCT in 0 20 40 60 80 95; do
    TS=$(( DURATION * PCT / 100 ))
    ffmpeg -y -ss "$TS" -i "$VIDEO_PATH" -vframes 1 -q:v 2 "$KEYFRAME_DIR/frame_${PCT}.jpg" 2>/dev/null
  done
  echo "Keyframes extracted to $KEYFRAME_DIR"
else
  echo "WARN: Could not determine video duration"
fi
```

If keyframes were extracted, read/view them for the visual analysis in Stage 4.

If `$POST_TYPE` is not `reel` or video is not available, set `$HAS_KEYFRAMES=false`.

### 3c. Transcript (reels only)

If `$POST_TYPE` is `reel` and `$DOWNLOADED` is true and the video file exists:

```bash
python3 -c "
import subprocess, json
result = subprocess.run(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
     '-of', 'json', 'vault/imports/instagram-saved/$VIDEO_FILE'],
    capture_output=True, text=True
)
info = json.loads(result.stdout)
dur = float(info['format']['duration'])
print(f'Duration: {dur:.1f}s')
"
```

Check if a transcript already exists. If not, and if ElevenLabs key is configured, transcribe:

```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
if os.environ.get('ELEVENLABS_API_KEY'):
    print('TRANSCRIBE_AVAILABLE')
else:
    print('NO_KEY')
"
```

If transcription is available:
```bash
mkdir -p "vault/imports/instagram-saved/transcripts"
python3 scripts/video_edit/transcribe.py \
  "vault/imports/instagram-saved/$VIDEO_FILE" \
  --edit-dir "vault/imports/instagram-saved/transcripts/$SHORTCODE"
python3 scripts/video_edit/pack_transcripts.py \
  --edit-dir "vault/imports/instagram-saved/transcripts/$SHORTCODE"
```

Read the packed transcript from `vault/imports/instagram-saved/transcripts/$SHORTCODE/takes_packed.md`.

If transcription is not available or fails, use the caption text as the script source and note: "No transcript available — using caption for script analysis."

Store the transcript or caption text as `$SCRIPT_TEXT`.

---

## Stage 4: Perform 5-Dimension Analysis

**SCORING DISCIPLINE — read this before scoring anything:**
Be BRUTALLY objective. A 5/10 is average, and most content IS average. Do not inflate scores. If a hook is weak, say so. If production quality is mediocre, say so. No empty praise. The user wants honest analysis, not encouragement.

### Dimension 1 — Engagement Analysis

Use `$METRICS` from Stage 2. Format as:

```markdown
### Engagement

| Metric | Value | Rate | Benchmark |
|--------|-------|------|-----------|
| Views | {views} | — | — |
| Likes | {likes} | {like_rate}% | {indicator} {rating} (avg 2-4%) |
| Comments | {comments} | {comment_rate}% | {indicator} {rating} (avg 0.1-0.3%) |
| Total Engagement | {likes+comments} | {total_rate}% | {indicator} {rating} (avg 3-5%) |
| Like:Comment Ratio | {ratio}:1 | — | — |
```

Where `{indicator}` is:
- `strong` rating = checkmark Strong
- `average` rating = warning Average
- `weak` rating = cross Weak

Write a 1-2 sentence verdict. Be specific about what drove performance up or down. Example: "Strong like rate suggests visual appeal, but low comment rate indicates the content didn't spark conversation or debate."

### Dimension 2 — Script Analysis (Hybrid Scoring)

Source: `$SCRIPT_TEXT` (transcript for reels, caption for posts/carousels).

**Fixed rubric (0-10):**

| Element | Weight | 8-10 | 5-7 | 1-4 |
|---------|--------|------|-----|-----|
| Hook (first 3s / first line) | 25% | Pattern interrupt + curiosity gap + specificity | Has hook but generic or missing element | No clear hook |
| Structure | 15% | Clear setup, tension, payoff | Has structure but uneven | Rambles, no arc |
| CTA/Close | 10% | Clear, specific, matches content | Generic ("follow for more") | No CTA |

**LLM judgment (0-10):**

| Element | Weight | Evaluates |
|---------|--------|-----------|
| Value density | 25% | Info-to-filler ratio. How much substance per second/line? |
| Originality | 15% | Fresh take or template rehash? Would this stand out on your FYP? |
| Emotional resonance | 10% | Creates curiosity, surprise, or "I need this"? Or flat? |

Score each element. Compute weighted overall:
`overall = hook*0.25 + value_density*0.25 + structure*0.15 + originality*0.15 + emotional*0.10 + cta*0.10`

Format as:

```markdown
### Script

| Element | Score | Weight | Weighted |
|---------|-------|--------|----------|
| Hook | X/10 | 25% | X.XX |
| Value Density | X/10 | 25% | X.XX |
| Structure | X/10 | 15% | X.XX |
| Originality | X/10 | 15% | X.XX |
| Emotional Resonance | X/10 | 10% | X.XX |
| CTA/Close | X/10 | 10% | X.XX |
| **Overall** | | | **X.XX/10** |

**Hook transcript:** "{first 3 seconds or first line of script}"

**Key insight:** {1 sentence — what makes this script work or fail}
```

Remember: 5/10 = average. Most hooks are generic. Most CTAs are weak. Score honestly.

### Dimension 3 — Visual/Video Analysis

**If keyframes exist (`$HAS_KEYFRAMES` is true):**

View the extracted keyframe images. Evaluate:

| Element | Assessment |
|---------|-----------|
| Opening frame | Scroll-stopping? Pattern interrupt? Or generic talking head? Use indicator. |
| Text overlay usage | Readable? Reinforces audio? Well-timed? Or cluttered/absent? Use indicator. |
| Cut pacing | Tight cuts keeping attention? Or long static shots? Use indicator. |
| B-roll / visual variety | Multiple angles, overlays, context? Or single-camera? Use indicator. |
| Production quality | Lighting, framing, audio clarity? Use indicator. |

Where indicators are: checkmark Strong, warning Average, cross Weak.

**If no keyframes (image post/carousel, or video not downloaded):**

Evaluate from the caption and thumbnail (if available):
- Composition and visual hierarchy
- Text readability
- Brand consistency
- Use same indicator scale

Write a 1-2 sentence visual verdict.

### Dimension 4 — Angle Tagging

Identify and tag:

- **Primary angle**: contrarian take, tutorial, mistake callout, listicle, behind-the-scenes, authority proof, relatable moment, transformation story, hot take, curated tips, myth-busting, or other (specify)
- **Format type**: talking head, screen share, montage, text-on-screen, b-roll heavy, interview, skit, photo dump, carousel slides, or other (specify)
- **Hook pattern** — match against known patterns:
  - "stop doing X"
  - "nobody tells you"
  - "here's the truth/what/why"
  - "you're wrong"
  - "forget everything"
  - "this changed/broke/blew"
  - "I was/used to...until"
  - "X things that..."
  - "secret/hidden..."
  - Or identify the pattern if none match

Format as:

```markdown
### Angle

- **Primary angle:** {angle}
- **Format type:** {format}
- **Hook pattern:** "{matched pattern or custom description}"
```

### Dimension 5 — Content Fit & Recreation

**If `$HAS_BRAND_MODULES` is true:**

Using the loaded brand modules (niche, style, pillars, audience), evaluate:

| Alignment | Score | Notes |
|-----------|-------|-------|
| Pillar match | X/10 | Does this topic fall within your defined content pillars? |
| Tone match | X/10 | Does the delivery style match your brand voice? |
| Audience overlap | X/10 | Would YOUR audience care about this? |
| **Brand alignment** | **X/10** | Weighted average |

Produce a verdict:
- **Recreate** (alignment >= 7): This fits your brand. Recreate with your angle.
- **Adapt** (alignment 4-6): Core idea is useful but needs significant reframing.
- **Skip** (alignment < 4): Not your lane. Save your energy.

If verdict is **Recreate** or **Adapt**, provide 3 concrete recreation steps:

```markdown
### Content Fit

**Verdict:** Recreate / Adapt / Skip

| Alignment | Score |
|-----------|-------|
| Pillar match | X/10 |
| Tone match | X/10 |
| Audience overlap | X/10 |
| **Brand alignment** | **X/10** |

**Recreation steps:**
1. {specific step}
2. {specific step}
3. {specific step}
```

**If `$HAS_BRAND_MODULES` is false:**

```markdown
### Content Fit

> Run `/brand-voice` to enable content fit scoring.
```

When brand modules are not loaded, do NOT include `brand_alignment` or `content_verdict` in the frontmatter (Stage 5). Omit those fields entirely.

---

## Stage 5: Write Results

### 5a. Update Frontmatter

Use the Edit tool to add/update these fields in the saved post markdown frontmatter (inside the existing `---` block):

```yaml
analysed_at: {today's date via $(date +%Y-%m-%d)}
analysis_version: 1
overall_score: {weighted script score from Dimension 2, rounded to 1 decimal}
angle: {primary angle from Dimension 4, kebab-case}
hook_pattern: "{hook pattern from Dimension 4}"
format_type: {format type from Dimension 4, kebab-case}
```

**Only if brand modules were loaded**, also add:
```yaml
content_verdict: {recreate|adapt|skip}
brand_alignment: {brand alignment score from Dimension 5, integer}
```

### 5b. Remove Old Analysis (--refresh only)

If `--refresh` was set AND the file already contains a `## Analysis` section:

Locate the `---` separator followed by `## Analysis` (the horizontal rule that precedes the analysis block). Remove everything from that `---` separator through the end of the file.

Use the Edit tool: set `old_string` to the content from the `---` separator (the one right before `## Analysis`) through the end of file, and set `new_string` to empty string.

### 5c. Append Analysis Body

After the caption text, append the analysis separated by a horizontal rule:

```markdown
---

## Analysis

### Engagement
{engagement table + verdict from Dimension 1}

### Script
{scoring table + hook transcript + key insight from Dimension 2}

### Visual
{element assessments from Dimension 3}

### Angle
{tags from Dimension 4}

### Content Fit
{verdict + alignment + steps from Dimension 5, or brand-voice prompt}
```

Use the Edit tool to append this content at the end of the file.

---

## Stage 6: Summary

Print a concise summary:

```
Analysis complete: $SHORTCODE ($AUTHOR)

  Overall score: X.X/10
  Angle: {primary angle} ({hook pattern})
  Format: {format type}
  Engagement: {engagement rating}
  {If brand modules: "Verdict: Recreate/Adapt/Skip (alignment X/10)"}
  {If no brand modules: "Brand fit: Run /brand-voice to enable"}

  Full analysis: $POST_FILE
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No shortcode provided | Show usage: `/analyse <shortcode> [--refresh]` |
| Shortcode not in `_index.json` | "Shortcode not found in saved posts. Run `/sync-instagram` first." |
| Saved post file missing | "Post file missing from vault. Run `/sync-instagram --refresh` to re-sync." |
| Video not downloaded | "Video not downloaded. Run `/sync-instagram` to download videos." Skip keyframe extraction and transcript — use caption only. |
| ffmpeg not available | Skip keyframe extraction. Note: "ffmpeg not found — skipping visual analysis from keyframes." |
| Transcription fails | Use caption text for script analysis. Note: "Transcription failed — using caption for script analysis." |
| No brand modules | Skip Dimension 5. Omit `brand_alignment` and `content_verdict` from frontmatter. |
