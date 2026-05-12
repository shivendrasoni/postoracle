# Preview Viewer — Design Spec

Inline platform-native previews for vault session folders. When the vault browser opens a session directory, it auto-detects the content type and renders the appropriate social media frame instead of the raw file tree.

## Content Type Detection

The vault page inspects the file list of a session folder and classifies by file presence:

| Signal | Content Type | Default Frame |
|--------|-------------|---------------|
| `final.mp4` | Reel | TikTok/Reels |
| `1.png` + `2.png` | Carousel | Instagram Carousel |
| `image.png` or `image-instagram.png` | Post | Instagram Post |
| `image-linkedin.png` | Post (LinkedIn variant) | LinkedIn Post |

Detection priority (first match wins): Reel > Carousel > Post. If no signals match, fall back to the existing file tree view.

For posts with multi-platform variants (`image-instagram.png` + `image-linkedin.png`), show tab pills to toggle between platform frames. Caption text is parsed from the matching `## Instagram` / `## LinkedIn` section in `post.md`.

## Frame Style

Platform chrome only — no phone device shell. Each frame renders the app's UI wrapper (header, content area, action bar, caption) at a size that fits naturally in the dashboard layout. This keeps content large and the frames immediately recognizable without unnecessary decoration.

## Component Architecture

```
vault/[[...path]]/page.tsx  (existing — gains session detection)
  └─ <SessionPreview>       (new — detection + routing)
       ├─ <ReelPreview>
       ├─ <CarouselPreview>
       ├─ <PostPreview>
       └─ <PlatformChrome>  (shared frame pieces)
```

### New Files

| File | Purpose |
|------|---------|
| `components/session-preview.tsx` | Detects content type from file list, renders the right preview |
| `components/previews/reel-preview.tsx` | TikTok/Reels frame with video player + caption overlay |
| `components/previews/carousel-preview.tsx` | Instagram carousel frame with slide navigation |
| `components/previews/post-preview.tsx` | Instagram or LinkedIn post frame with platform tabs |
| `components/previews/platform-chrome.tsx` | Shared frame elements (IG header, LI header, action bars) |

### No New API Routes

All data is served by existing routes:
- `/api/vault-asset?path=...` for images and video
- `/api/vault?path=...` for caption/post markdown and file listings
- `/api/brand` for username and avatar

## Data Flow

1. Vault page fetches file list via `/api/vault` (existing behavior)
2. `SessionPreview` classifies content type from filenames
3. Sub-component fetches assets:
   - Images/video via `/api/vault-asset`
   - Caption text via `/api/vault` (markdown/txt content)
   - Brand data via `/api/brand`
4. Platform frame renders around the content

## Platform Frames

### Instagram Post

- **Header**: Profile avatar (from brand) + username + overflow menu (···)
- **Content**: Square image (`image.png` or `image-instagram.png`)
- **Actions**: Heart, Comment, Share, Bookmark icons
- **Below actions**: Like count, username + caption from `post.md ## Instagram` section, timestamp

### Instagram Carousel

- **Header**: Profile avatar + username + slide counter ("1 / 5")
- **Content**: Square slide image with prev/next arrow button overlays
- **Navigation**: Dot indicators below the image, active dot highlighted blue. Keyboard left/right arrow support.
- **Actions**: Same as Instagram Post
- **Below actions**: Username + caption from `caption.txt`
- **Slides**: Loaded from `1.png`, `2.png`, `3.png`, etc. in order

### TikTok / Reels (Reel)

- **Aspect ratio**: 9:16 portrait
- **Content**: Video player (`final.mp4`) filling the entire frame
- **Right column**: Heart (with count), Comment bubble (with count), Share forward-arrow (with count), Bookmark, spinning music disc
- **Bottom overlay** (gradient fade): Profile avatar with white border ring + username + "Follow" pill + caption text from `caption.md` + audio label with music note icon
- **Center**: Subtle play/pause button (frosted glass circle)
- **Bottom edge**: Thin white progress bar showing playback position
- **Video controls**: Click to play/pause, progress bar is interactive

### LinkedIn Post

- **Header**: Large profile avatar + full name + title/tagline + timestamp + globe icon
- **Caption**: Rendered above the image (LinkedIn layout), parsed from `post.md ## LinkedIn` section, with "...see more" truncation
- **Content**: Image (`image-linkedin.png`) at ~1.2:1 landscape aspect ratio
- **Reactions**: Emoji row (thumbs up, heart, bulb) + count + "X comments · Y reposts"
- **Actions**: Like, Comment, Repost, Send — icon + label, evenly spaced

## Platform Tabs (Posts Only)

When a post session contains both `image-instagram.png` and `image-linkedin.png`:
- Render pill-style tabs above the preview: "Instagram" | "LinkedIn"
- Switching tabs swaps the frame, image, and caption section
- Default to Instagram tab

## Brand Data Integration

- Fetch brand data from `/api/brand` on component mount
- Extract: username/handle, display name, tagline, profile avatar
- Source: `vault/brand/modules/` markdown files with YAML frontmatter
- Fallback if brand modules don't exist: "username" text + initials avatar (two-letter circle)

## Vault Browser Integration

- **Auto-detect**: When navigating to a session folder under `vault/outputs/`, check file list and render preview if a content type matches
- **Toggle**: Below the preview, a "View files" text link switches to the raw file tree. On the file tree view, a "Preview" button switches back.
- **Non-session folders**: No change — file tree renders as before
- **Breadcrumbs**: Unchanged — still show the full vault path

## Interaction Details

### Carousel
- Arrow buttons: semi-transparent circles with `‹` / `›`, overlaid on left/right edges of the slide
- Left arrow hidden on first slide, right arrow hidden on last slide
- Dots: 6px circles, active = `#3897f0` (Instagram blue), inactive = `rgba(255,255,255,0.2)`
- Keyboard: left/right arrow keys navigate slides when component is focused

### Reel Video
- Click anywhere on the video to play/pause
- Progress bar: 3px height, white fill on dark track, updates during playback
- Play button overlay: visible when paused, hidden during playback
- Music disc: CSS animation, spins while playing, pauses when video pauses

### Post
- Caption truncation: Show first 3 lines, "...more" expands to full text
- Like count and timestamp are static placeholders (not from real data)

## Styling

Follow the existing dashboard design system:
- Double-bezel card pattern for the preview container
- `--color-surface` / `--color-panel` for background
- Phosphor icons where applicable (frame internals use platform-specific SVG icons)
- Smooth transitions: `ease-[cubic-bezier(0.32,0.72,0,1)]` 500ms for tab switches and slide transitions
- Dark theme throughout (frames are inherently dark — Instagram dark mode, TikTok dark)
