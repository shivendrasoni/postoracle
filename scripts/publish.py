#!/usr/bin/env python3
"""
publish.py — Platform publisher for reel, carousel, and post sessions.

Usage:
  python3 -m scripts.publish --session-dir <path> --platform instagram|linkedin|all [--dry-run]
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml

from scripts.registry import Registry

COMPOSIO_BIN = str(Path.home() / ".composio" / "composio")
REGISTRY_PATH = Path("vault/content-registry.json")


class PublishError(Exception):
    pass


# ---------------------------------------------------------------------------
# Instagram helpers (two-step: create container → publish)
# ---------------------------------------------------------------------------

def _instagram_get_user_id() -> str:
    result = _composio_call_raw("INSTAGRAM_GET_USER_INFO", {})
    if not result.get("successful"):
        raise PublishError(f"Could not get Instagram user ID: {result.get('error')}")
    return result["data"]["id"]


def _instagram_create_and_publish(payload: dict) -> dict:
    ig_user_id = _instagram_get_user_id()
    payload["ig_user_id"] = ig_user_id

    create_result = _composio_call_raw("INSTAGRAM_POST_IG_USER_MEDIA", payload)
    if not create_result.get("successful"):
        err = create_result.get("error") or create_result.get("data", {}).get("error", {}).get("message", "unknown")
        return {"success": False, "url": None, "error": f"Container creation failed: {err}"}

    creation_id = create_result["data"].get("id")
    if not creation_id:
        return {"success": False, "url": None, "error": f"No container ID returned: {create_result['data']}"}

    publish_result = _composio_call_raw(
        "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
        {"ig_user_id": ig_user_id, "creation_id": creation_id},
    )
    if not publish_result.get("successful"):
        err = publish_result.get("error") or "publish step failed"
        return {"success": False, "url": None, "error": f"Publish failed: {err}"}

    ig_media_id = publish_result["data"].get("id")
    permalink = None
    if ig_media_id:
        try:
            media_result = _composio_call_raw(
                "INSTAGRAM_GET_IG_MEDIA",
                {"ig_media_id": ig_media_id, "fields": "permalink"},
            )
            permalink = media_result.get("data", {}).get("permalink")
        except Exception:
            pass

    return {"success": True, "url": permalink, "error": None}


# ---------------------------------------------------------------------------
# Platform handlers
# ---------------------------------------------------------------------------

def _instagram_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _instagram_create_and_publish({
        "video_file": str(session_dir / "final.mp4"),
        "media_type": "REELS",
        "caption": caption,
    })


def _instagram_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    ig_user_id = _instagram_get_user_id()
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())

    child_ids = []
    for img_path in image_paths:
        child_result = _composio_call_raw("INSTAGRAM_POST_IG_USER_MEDIA", {
            "ig_user_id": ig_user_id,
            "image_file": img_path,
            "is_carousel_item": True,
        })
        if not child_result.get("successful") or not child_result.get("data", {}).get("id"):
            return {"success": False, "url": None, "error": f"Failed to create carousel child for {img_path}: {child_result.get('error')}"}
        child_ids.append(child_result["data"]["id"])

    container_result = _composio_call_raw("INSTAGRAM_POST_IG_USER_MEDIA", {
        "ig_user_id": ig_user_id,
        "media_type": "CAROUSEL",
        "caption": caption,
        "children": child_ids,
    })
    if not container_result.get("successful") or not container_result.get("data", {}).get("id"):
        return {"success": False, "url": None, "error": f"Carousel container failed: {container_result.get('error')}"}

    creation_id = container_result["data"]["id"]
    publish_result = _composio_call_raw(
        "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
        {"ig_user_id": ig_user_id, "creation_id": creation_id},
    )
    if not publish_result.get("successful"):
        return {"success": False, "url": None, "error": f"Carousel publish failed: {publish_result.get('error')}"}

    ig_media_id = publish_result["data"].get("id")
    permalink = None
    if ig_media_id:
        try:
            media_result = _composio_call_raw(
                "INSTAGRAM_GET_IG_MEDIA",
                {"ig_media_id": ig_media_id, "fields": "permalink"},
            )
            permalink = media_result.get("data", {}).get("permalink")
        except Exception:
            pass

    return {"success": True, "url": permalink, "error": None}


def _instagram_post(session_dir: Path, caption: str, config: dict) -> dict:
    return _instagram_create_and_publish({
        "image_file": str(session_dir / "image-instagram.png"),
        "caption": caption,
    })


def _linkedin_post(session_dir: Path, caption: str, config: dict) -> dict:
    image_path = session_dir / "image-linkedin.png"
    payload = {"commentary": caption, "visibility": "PUBLIC"}
    if image_path.exists():
        payload["images"] = [str(image_path)]
    return _composio_call_parsed("LINKEDIN_CREATE_LINKED_IN_POST", payload)


def _linkedin_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())
    return _composio_call_parsed("LINKEDIN_CREATE_LINKED_IN_POST", {
        "images": image_paths,
        "commentary": caption,
        "visibility": "PUBLIC",
    })


def _linkedin_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call_parsed("LINKEDIN_CREATE_LINKED_IN_POST", {
        "commentary": caption,
        "visibility": "PUBLIC",
    })


def _x_post(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call_parsed("TWITTER_CREATION_OF_A_POST", {"text": caption})


PLATFORM_REGISTRY: dict[str, dict[str, callable]] = {
    "instagram": {
        "reel": _instagram_reel,
        "carousel": _instagram_carousel,
        "post": _instagram_post,
    },
    "linkedin": {
        "reel": _linkedin_reel,
        "carousel": _linkedin_carousel,
        "post": _linkedin_post,
    },
    "x": {
        "post": _x_post,
    },
}


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def detect_content_type(session_dir: Path) -> str:
    has_reel = (session_dir / "final.mp4").exists()
    has_carousel = (session_dir / "1.png").exists()
    has_post = (session_dir / "image.png").exists()
    found = [name for name, present in [("reel", has_reel), ("carousel", has_carousel), ("post", has_post)] if present]
    if len(found) > 1:
        raise PublishError(f"Ambiguous session: contains {', '.join(found)} assets in {session_dir}")
    if not found:
        raise PublishError(f"No publishable asset found in session dir: {session_dir}")
    return found[0]


def extract_caption(session_dir: Path, content_type: str, platform: Optional[str] = None) -> str:
    if content_type == "post":
        caption_path = session_dir / "post.md"
        if not caption_path.exists():
            raise PublishError(f"post.md not found in {session_dir}")
        text = caption_path.read_text()
        section_map = {"instagram": "Instagram", "linkedin": "LinkedIn", "x": "X"}
        section_name = section_map.get(platform, platform or "Instagram")
        match = re.search(rf"## {section_name}\s*\n(.*?)(?:\n## |\Z)", text, re.DOTALL)
        if not match:
            raise PublishError(f"## {section_name} section not found in {caption_path}")
        return match.group(1).strip()

    caption_path = session_dir / "caption.md"
    if not caption_path.exists():
        caption_path = session_dir / "caption.txt"
    if not caption_path.exists():
        raise PublishError(f"caption file missing: {session_dir / 'caption.md'}")
    text = caption_path.read_text()

    if content_type == "reel":
        match = re.search(r"## Post Caption\s*\n(.*?)(?:\n---|\n##|\Z)", text, re.DOTALL)
        if not match:
            raise PublishError(f"## Post Caption section not found in {caption_path}")
        return match.group(1).strip()

    match = re.search(r"\[POST CAPTION\]\s*\n(.*?)(?:\n---|\Z)", text, re.DOTALL)
    if not match:
        raise PublishError(f"[POST CAPTION] marker not found in {caption_path}")
    return match.group(1).strip()


def resolve_platforms(platform: str) -> list[str]:
    if platform == "all":
        return list(PLATFORM_REGISTRY.keys())
    if platform not in PLATFORM_REGISTRY:
        raise PublishError(f"Unknown platform '{platform}'. Registered: {list(PLATFORM_REGISTRY.keys())}")
    return [platform]


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        print(f"[WARN] {config_path} not found — email notifications disabled", file=sys.stderr)
        return {}
    text = config_path.read_text()
    parts = text.split("---", 2)
    if len(parts) < 2:
        print(f"[WARN] {config_path} has no YAML frontmatter — email disabled", file=sys.stderr)
        return {}
    return yaml.safe_load(parts[1]) or {}


# ---------------------------------------------------------------------------
# Composio integration
# ---------------------------------------------------------------------------

def _composio_call_raw(slug: str, payload: dict) -> dict:
    """Execute a Composio tool and return the parsed JSON response."""
    _check_composio()
    result = subprocess.run(
        [COMPOSIO_BIN, "execute", slug, "-d", json.dumps(payload)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        err = result.stderr.strip() or result.stdout.strip()
        if "not connected" in err.lower() or "not authenticated" in err.lower():
            platform_guess = slug.split("_")[0].lower()
            return {"successful": False, "error": f"Not connected — run: composio link {platform_guess}"}
        return {"successful": False, "error": err}
    try:
        return json.loads(result.stdout.strip())
    except (json.JSONDecodeError, ValueError):
        return {"successful": False, "error": f"Could not parse output: {result.stdout[:500]}"}


def _composio_call_parsed(slug: str, payload: dict) -> dict:
    """Execute a Composio tool and return a normalized {success, url, error} dict."""
    raw = _composio_call_raw(slug, payload)
    if not raw.get("successful"):
        err = raw.get("error") or "unknown error"
        return {"success": False, "url": None, "error": err}
    url_str = json.dumps(raw.get("data", {}))
    url_match = re.search(r"https?://[^\s\"']+", url_str)
    return {"success": True, "url": url_match.group(0) if url_match else None, "error": None}


def _check_composio() -> None:
    if not Path(COMPOSIO_BIN).exists():
        raise PublishError(f"composio not found at {COMPOSIO_BIN} — install with: npm install -g @composio/cli")


# ---------------------------------------------------------------------------
# Email notification
# ---------------------------------------------------------------------------

def _send_email(session_dir: Path, platforms: list[str], results: dict, config: dict) -> None:
    if not config.get("notify_enabled"):
        return
    recipient = config.get("notify_email", "")
    if not recipient:
        print("[WARN] notify_email is empty — skipping email", file=sys.stderr)
        return

    platform_summary = "\n".join(
        f"  {p}: {'✓ ' + (results[p].get('url') or 'posted') if results[p]['success'] else '✗ ' + results[p].get('error', 'unknown error')}"
        for p in platforms
        if p in results
    )
    subject = f"Published: {session_dir.name} → {', '.join(platforms)}"
    body = f"Session: {session_dir}\n\n{platform_summary}"

    inbox_id = config.get("agent_mail_inbox_id", "")
    if not inbox_id:
        print("[WARN] agent_mail_inbox_id not set in publish-config.md — skipping email", file=sys.stderr)
        return

    try:
        result = subprocess.run(
            [COMPOSIO_BIN, "execute", "AGENT_MAIL_SEND_EMAIL", "-d",
             json.dumps({"inbox_id": inbox_id, "to": [recipient], "subject": subject, "text": body})],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            err = result.stderr.strip() or result.stdout.strip()
            print(f"[WARN] Email notification failed: {err}", file=sys.stderr)
        else:
            parsed = json.loads(result.stdout)
            if not parsed.get("successful"):
                print(f"[WARN] Email notification failed: {parsed.get('error')}", file=sys.stderr)
    except (FileNotFoundError, OSError) as exc:
        print(f"[WARN] Email notification failed: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Registry integration
# ---------------------------------------------------------------------------

def _update_registry(session_dir: Path, platforms: list[str], results: dict) -> None:
    try:
        reg = Registry(REGISTRY_PATH)
        entry = reg.get(session_dir.name)
        if entry is None:
            return
        published_at = dict(entry.get("published_at") or {})
        published_urls = dict(entry.get("published_urls") or {})
        now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        for p in platforms:
            r = results.get(p, {})
            if r.get("success") and not r.get("dry_run"):
                published_at[p] = now
                if r.get("url"):
                    published_urls[p] = r["url"]
        target_platforms = set(entry.get("platforms", []))
        published_platforms = set(published_at.keys())
        status = "published" if target_platforms <= published_platforms else entry.get("status", "draft")
        reg.update(session_dir.name, {
            "status": status,
            "published_at": published_at,
            "published_urls": published_urls,
        })
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def publish(
    session_dir: Path,
    platform: str,
    dry_run: bool = False,
    config_path: Optional[Path] = None,
) -> dict:
    if config_path is None:
        config_path = Path("vault/publish-config.md")

    if not session_dir.exists():
        raise PublishError(f"Session dir not found: {session_dir}")

    content_type = detect_content_type(session_dir)
    platforms = resolve_platforms(platform)
    config = load_config(config_path)

    results: dict[str, dict] = {}

    for p in platforms:
        caption = extract_caption(session_dir, content_type, platform=p)
        handler = PLATFORM_REGISTRY[p].get(content_type)
        if handler is None:
            results[p] = {"success": False, "url": None, "error": f"No {content_type} handler for {p}"}
            continue

        if dry_run:
            print(f"[DRY-RUN] Would publish {content_type} to {p} from {session_dir}")
            results[p] = {"success": True, "url": None, "error": None, "dry_run": True}
            continue

        try:
            results[p] = handler(session_dir, caption, config)
        except PublishError as exc:
            results[p] = {"success": False, "url": None, "error": str(exc)}
        except Exception as exc:
            results[p] = {"success": False, "url": None, "error": f"Unexpected error: {exc}"}

    if not dry_run:
        _send_email(session_dir, platforms, results, config)
        _update_registry(session_dir, platforms, results)

    _print_summary(platforms, results)
    return results


def _print_summary(platforms: list[str], results: dict) -> None:
    print("\n── Publish Summary ──")
    for p in platforms:
        r = results.get(p, {})
        if r.get("dry_run"):
            print(f"  {p}: [DRY-RUN] would publish")
        elif r.get("success"):
            url = r.get("url") or "no URL returned"
            print(f"  {p}: ✓ published — {url}")
        else:
            print(f"  {p}: ✗ failed — {r.get('error', 'unknown')}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a session to social platforms")
    parser.add_argument("--session-dir", required=True, type=Path)
    parser.add_argument("--platform", required=True, help="instagram | linkedin | all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--config", type=Path, default=None)
    args = parser.parse_args()

    try:
        publish(args.session_dir, args.platform, dry_run=args.dry_run, config_path=args.config)
    except PublishError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
