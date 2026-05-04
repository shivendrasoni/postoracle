---
description: One-time brand setup — saves brand colors to CAROUSEL-BRAND.json for use in /make-carousel.
allowed-tools: Bash, Read, Write, WebFetch
---

# /carousel-brand Setup

Configure the brand palette used by `/make-carousel` to render slides. Run this once before your first carousel.

## 1. Collect Brand Input

Ask the user:

> "Provide hex codes for 5 colors (primary, secondary, accent, background, text) — space or comma separated. OR provide a file path or URL to a brand image."

Wait for the user's response before proceeding.

## 2. Handle Hex Codes

**If the user provides hex codes:**

```bash
python3 scripts/carousel_brand.py --hex "<user input>" --out "$(pwd)/CAROUSEL-BRAND.json"
```

Read back `CAROUSEL-BRAND.json` and present the saved colors to the user in a clear table:

| Role       | Hex     |
|------------|---------|
| primary    | #...    |
| secondary  | #...    |
| accent     | #...    |
| background | #...    |
| text       | #...    |

Confirm: `✓ Brand saved to CAROUSEL-BRAND.json`

## 3. Handle Brand Image

**If the user provides a file path or URL:**

```bash
python3 scripts/carousel_brand.py --image "<path_or_url>" --out "$(pwd)/CAROUSEL-BRAND.json"
```

Read back `CAROUSEL-BRAND.json` and show the extracted colors in a table (role → hex):

| Role       | Hex     |
|------------|---------|
| primary    | #...    |
| secondary  | #...    |
| accent     | #...    |
| background | #...    |
| text       | #...    |

Ask: "These colors were extracted — would you like to accept or override any?"

**If user wants to override:** Ask for specific hex values and re-run:
```bash
python3 scripts/carousel_brand.py --hex "<updated hex values>" --out "$(pwd)/CAROUSEL-BRAND.json"
```

**If user accepts:** proceed to confirmation.

## 4. Handle colorthief Failure

If the script exits with an error (colorthief unavailable or image unreadable), report the error and ask:

> "Color extraction failed. Please provide your 5 brand hex codes manually (primary, secondary, accent, background, text) — space or comma separated."

Then proceed with the hex-code flow in Step 2.

## 5. Confirm

```
✓ Brand saved to CAROUSEL-BRAND.json
```

The brand palette will be picked up automatically on the next `/make-carousel` run.
