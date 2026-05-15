#!/usr/bin/env python3
"""
sync_instagram.py — Fetch saved Instagram posts and curate them in the vault.

Usage:
  python3 -m scripts.sync_instagram sync [--refresh] [--collection <name>]
  python3 -m scripts.sync_instagram collections
  python3 -m scripts.sync_instagram status
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


VAULT_DIR = Path("vault/imports/instagram-saved")
INDEX_PATH = VAULT_DIR / "_index.json"
IG_BASE = "https://www.instagram.com"
IG_APP_ID = "936619743392459"
_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE


class InstagramSessionError(Exception):
    pass


class InstagramAPIError(Exception):
    pass


def build_headers(session_id: str, csrf_token: str, ds_user_id: str) -> dict:
    if not session_id:
        raise InstagramSessionError("sessionid is empty — re-grab from browser cookies")
    if not csrf_token:
        raise InstagramSessionError("csrftoken is empty — re-grab from browser cookies")
    if not ds_user_id:
        raise InstagramSessionError("ds_user_id is empty — re-grab from browser cookies")

    return {
        "Cookie": f"sessionid={session_id}; csrftoken={csrf_token}; ds_user_id={ds_user_id}",
        "X-CSRFToken": csrf_token,
        "X-IG-App-ID": IG_APP_ID,
        "Accept": "*/*",
        "Referer": f"{IG_BASE}/",
        "X-Requested-With": "XMLHttpRequest",
    }


def load_env_session() -> tuple[str, str, str]:
    session_id = os.environ.get("INSTAGRAM_SESSION_ID", "")
    csrf_token = os.environ.get("INSTAGRAM_CSRF_TOKEN", "")
    ds_user_id = os.environ.get("INSTAGRAM_DS_USER_ID", "")
    return session_id, csrf_token, ds_user_id


def validate_session(headers: dict) -> bool:
    req = urllib.request.Request(
        f"{IG_BASE}/api/v1/feed/saved/posts/?limit=1",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CTX) as resp:
            data = json.loads(resp.read().decode())
            return "items" in data
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError):
        return False


def parse_media_type(media: dict) -> str:
    media_type = media.get("media_type")
    if media_type == 8:
        return "carousel"
    if media_type == 2 and media.get("product_type") == "clips":
        return "reel"
    return "post"


def fetch_media_info(headers: dict, media_pk: str) -> dict:
    url = f"{IG_BASE}/api/v1/media/{media_pk}/info/"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("items", [])
            return items[0] if items else {}
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError):
        return {}


def parse_saved_post(item: dict, headers: dict | None = None) -> dict:
    media = item.get("media", {})
    shortcode = media.get("code", "")
    media_pk = media.get("pk", "")
    post_type = parse_media_type(media)
    caption_obj = media.get("caption")
    caption = caption_obj.get("text", "") if isinstance(caption_obj, dict) else ""
    user = media.get("user", {})
    taken_at = media.get("taken_at", 0)
    dt = datetime.fromtimestamp(taken_at, tz=timezone.utc)

    if post_type == "reel":
        link = f"{IG_BASE}/reel/{shortcode}/"
    else:
        link = f"{IG_BASE}/p/{shortcode}/"

    comment_count = media.get("comment_count", 0)
    view_count = media.get("play_count", 0) or media.get("view_count", 0)
    video_url = _extract_video_url(media)

    needs_detail = (comment_count == 0 or view_count == 0
                    or (post_type == "reel" and not video_url))
    if headers and media_pk and needs_detail:
        detailed = fetch_media_info(headers, str(media_pk))
        if detailed:
            if comment_count == 0:
                comment_count = detailed.get("comment_count", 0)
            if view_count == 0:
                view_count = (
                    detailed.get("play_count", 0)
                    or detailed.get("view_count", 0)
                )
            if not video_url:
                video_url = _extract_video_url(detailed)
            time.sleep(0.5)

    return {
        "shortcode": shortcode,
        "type": post_type,
        "author": user.get("username", ""),
        "author_name": user.get("full_name", ""),
        "caption": caption,
        "link": link,
        "date_published": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "like_count": media.get("like_count", 0),
        "comment_count": comment_count,
        "view_count": view_count,
        "thumbnail_url": _extract_thumbnail(media),
        "video_url": video_url,
    }


def _extract_thumbnail(media: dict) -> str:
    candidates = media.get("image_versions2", {}).get("candidates", [])
    if candidates:
        return candidates[0].get("url", "")
    return media.get("thumbnail_url", "")


def _extract_video_url(media: dict) -> str:
    versions = media.get("video_versions", [])
    if versions:
        return versions[0].get("url", "")
    return ""


def fetch_saved_posts_page(headers: dict, max_id: str = "") -> dict:
    url = f"{IG_BASE}/api/v1/feed/saved/posts/"
    if max_id:
        url += f"?max_id={max_id}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise InstagramSessionError(
                "Session expired — re-grab sessionid, csrftoken, ds_user_id from browser cookies"
            )
        raise InstagramAPIError(f"Instagram API returned {exc.code}: {exc.reason}")


def fetch_collections(headers: dict) -> list[dict]:
    url = f"{IG_BASE}/api/v1/collections/list/"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            data = json.loads(resp.read().decode())
            return data.get("items", [])
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise InstagramSessionError(
                "Session expired — re-grab sessionid, csrftoken, ds_user_id from browser cookies"
            )
        raise InstagramAPIError(f"Instagram API returned {exc.code}: {exc.reason}")


def fetch_collection_posts_page(headers: dict, collection_id: str, max_id: str = "") -> dict:
    url = f"{IG_BASE}/api/v1/feed/collection/{collection_id}/posts/"
    if max_id:
        url += f"?max_id={max_id}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise InstagramSessionError(
                "Session expired — re-grab sessionid, csrftoken, ds_user_id from browser cookies"
            )
        raise InstagramAPIError(f"Instagram API returned {exc.code}: {exc.reason}")


class Index:
    def __init__(self, path: Path = INDEX_PATH):
        self.path = Path(path)
        self.entries: dict[str, dict] = {}
        if self.path.exists():
            self.entries = json.loads(self.path.read_text())

    def has(self, shortcode: str) -> bool:
        return shortcode in self.entries

    def add(self, shortcode: str, filename: str, collection: str = "",
            video_url: str = "", post_type: str = "") -> None:
        existing = self.entries.get(shortcode, {})
        entry = {
            "file": filename,
            "collection": collection,
            "type": post_type,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
        if video_url:
            entry["video_url"] = video_url
            entry["downloaded"] = existing.get("downloaded", False)
            entry["video_file"] = existing.get("video_file", "")
            entry["downloaded_at"] = existing.get("downloaded_at", "")
        self.entries[shortcode] = entry

    def count(self) -> int:
        return len(self.entries)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.entries, indent=2, ensure_ascii=False) + "\n")


def _slugify(text: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-")


def generate_markdown(post: dict, collection: str = "", date_saved: str = "") -> str:
    lines = [
        "---",
        "source: instagram",
        f"shortcode: {post['shortcode']}",
        f"link: {post['link']}",
        f"type: {post['type']}",
        f'author: "@{post["author"]}"',
    ]
    if post.get("author_name"):
        lines.append(f"author_name: {post['author_name']}")
    lines.append(f"date_published: {post['date_published']}")
    if date_saved:
        lines.append(f"date_saved: {date_saved}")
    if collection:
        lines.append(f"collection: {collection}")
    lines.append(f"like_count: {post['like_count']}")
    lines.append(f"comment_count: {post['comment_count']}")
    if post.get("view_count"):
        lines.append(f"view_count: {post['view_count']}")
    if post.get("thumbnail_url"):
        lines.append(f"thumbnail: {post['thumbnail_url']}")
    if post.get("video_url"):
        lines.append(f"video_url: {post['video_url']}")
    lines.append("---")
    lines.append("")
    lines.append(post.get("caption", ""))
    lines.append("")
    return "\n".join(lines)


def write_post_file(post: dict, out_dir: Path = VAULT_DIR, collection: str = "", date_saved: str = "") -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    caption_slug = _slugify(post.get("caption", "")[:60])
    filename = f"{post['shortcode']}-{caption_slug}.md" if caption_slug else f"{post['shortcode']}.md"
    filepath = out_dir / filename
    md = generate_markdown(post, collection=collection, date_saved=date_saved)
    filepath.write_text(md)
    return filepath


def sync_saved_posts(
    headers: dict,
    vault_dir: Path = VAULT_DIR,
    index_path: Path = INDEX_PATH,
    refresh: bool = False,
    collection_name: str = "",
    collection_id: str = "",
) -> dict:
    idx = Index(index_path)
    vault_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    synced = 0
    skipped = 0
    errors = []
    max_id = ""

    while True:
        if collection_id:
            page = fetch_collection_posts_page(headers, collection_id, max_id=max_id)
        else:
            page = fetch_saved_posts_page(headers, max_id=max_id)

        items = page.get("items", [])
        for item in items:
            media = item.get("media", {})
            shortcode = media.get("code", "")
            if not shortcode:
                continue

            if not refresh and idx.has(shortcode):
                skipped += 1
                continue

            try:
                post = parse_saved_post(item, headers=headers)
                filepath = write_post_file(
                    post, vault_dir,
                    collection=collection_name,
                    date_saved=today,
                )
                idx.add(
                    shortcode, filepath.name,
                    collection=collection_name,
                    video_url=post.get("video_url", ""),
                    post_type=post.get("type", ""),
                )
                synced += 1
            except Exception as exc:
                errors.append(f"{shortcode}: {exc}")

        if not page.get("more_available", False):
            break

        next_id = page.get("next_max_id", "")
        if not next_id:
            break
        max_id = next_id
        time.sleep(1.5)

    idx.save()
    return {"synced": synced, "skipped": skipped, "errors": errors, "total_indexed": idx.count()}


def parse_collection(item: dict) -> dict:
    return {
        "id": str(item.get("collection_id", "")),
        "name": item.get("collection_name", ""),
        "count": item.get("collection_media_count", 0),
    }


def sync_all_collections(
    headers: dict,
    vault_dir: Path = VAULT_DIR,
    index_path: Path = INDEX_PATH,
    refresh: bool = False,
    filter_name: str = "",
) -> dict:
    raw_collections = fetch_collections(headers)
    collections = [parse_collection(c) for c in raw_collections]

    if filter_name:
        collections = [c for c in collections if c["name"].lower() == filter_name.lower()]

    total_synced = 0
    total_skipped = 0
    all_errors = []

    for col in collections:
        print(f"  Syncing collection: {col['name']} ({col['count']} posts)...")
        result = sync_saved_posts(
            headers=headers,
            vault_dir=vault_dir,
            index_path=index_path,
            refresh=refresh,
            collection_name=col["name"],
            collection_id=col["id"],
        )
        total_synced += result["synced"]
        total_skipped += result["skipped"]
        all_errors.extend(result["errors"])

    return {
        "collections_synced": len(collections),
        "synced": total_synced,
        "skipped": total_skipped,
        "errors": all_errors,
    }


def download_videos(
    index_path: Path = INDEX_PATH,
    vault_dir: Path = VAULT_DIR,
) -> dict:
    idx = Index(index_path)
    downloaded = 0
    skipped = 0
    errors = []

    video_dir = vault_dir / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)

    pending = [
        (sc, entry) for sc, entry in idx.entries.items()
        if entry.get("video_url") and not entry.get("downloaded")
    ]

    for shortcode, entry in pending:
        video_url = entry["video_url"]
        filename = f"videos/{shortcode}.mp4"
        filepath = video_dir / f"{shortcode}.mp4"

        try:
            req = urllib.request.Request(video_url, headers={
                "User-Agent": "Mozilla/5.0",
            })
            with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
                filepath.write_bytes(resp.read())

            entry["downloaded"] = True
            entry["video_file"] = filename
            entry["downloaded_at"] = datetime.now(timezone.utc).isoformat()
            downloaded += 1
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as exc:
            errors.append(f"{shortcode}: {exc}")

        if (downloaded + len(errors)) % 10 == 0:
            idx.save()
        time.sleep(0.5)

    idx.save()
    total_with_video = sum(1 for e in idx.entries.values() if e.get("video_url"))
    total_downloaded = sum(1 for e in idx.entries.values() if e.get("downloaded"))
    return {
        "downloaded": downloaded,
        "errors": errors,
        "total_with_video": total_with_video,
        "total_downloaded": total_downloaded,
    }


def _print_download_result(result: dict) -> None:
    print(f"\n✓ Download complete")
    print(f"  Downloaded: {result['downloaded']} videos")
    print(f"  Total: {result['total_downloaded']}/{result['total_with_video']} videos on disk")
    if result.get("errors"):
        print(f"  Errors: {len(result['errors'])}")
        for err in result["errors"]:
            print(f"    [ERROR] {err}")
    print(f"  Vault: {VAULT_DIR}/")


def _print_result(result: dict, label: str = "Sync") -> None:
    print(f"\n✓ {label} complete")
    print(f"  Synced: {result['synced']} new posts")
    if result.get("skipped"):
        print(f"  Skipped: {result['skipped']} (already indexed)")
    if result.get("collections_synced"):
        print(f"  Collections: {result['collections_synced']}")
    print(f"  Total indexed: {result.get('total_indexed', '—')}")
    if result.get("errors"):
        print(f"  Errors: {len(result['errors'])}")
        for err in result["errors"]:
            print(f"    [ERROR] {err}")
    print(f"  Vault: {VAULT_DIR}/")


def main() -> None:
    from dotenv import load_dotenv
    load_dotenv()

    parser = argparse.ArgumentParser(description="Sync saved Instagram posts to vault")
    sub = parser.add_subparsers(dest="command")

    sync_p = sub.add_parser("sync", help="Sync saved posts")
    sync_p.add_argument("--refresh", action="store_true", help="Re-fetch all, update existing")
    sync_p.add_argument("--collection", default="", help="Sync only this collection")
    sync_p.add_argument("--no-download", action="store_true", help="Skip video download after sync")

    sub.add_parser("download", help="Download videos not yet downloaded")
    sub.add_parser("collections", help="List saved collections")
    sub.add_parser("status", help="Show sync status")

    args = parser.parse_args()

    session_id, csrf_token, ds_user_id = load_env_session()
    headers = build_headers(session_id, csrf_token, ds_user_id)

    if args.command == "sync":
        if args.collection:
            print(f"Syncing collection: {args.collection}...")
            result = sync_all_collections(
                headers=headers,
                refresh=args.refresh,
                filter_name=args.collection,
            )
            _print_result(result, label=f"Collection sync ({args.collection})")
        else:
            print("Syncing all saved posts...")
            result = sync_saved_posts(headers=headers, refresh=args.refresh)

            print("Syncing collections...")
            col_result = sync_all_collections(headers=headers, refresh=args.refresh)

            combined = {
                "synced": result["synced"] + col_result["synced"],
                "skipped": result["skipped"] + col_result["skipped"],
                "errors": result["errors"] + col_result["errors"],
                "total_indexed": result["total_indexed"],
                "collections_synced": col_result["collections_synced"],
            }
            _print_result(combined)

        if not args.no_download:
            print("\nDownloading videos...")
            dl_result = download_videos()
            _print_download_result(dl_result)

    elif args.command == "download":
        print("Downloading videos...")
        dl_result = download_videos()
        _print_download_result(dl_result)

    elif args.command == "collections":
        print("Fetching collections...")
        raw = fetch_collections(headers)
        collections = [parse_collection(c) for c in raw]
        if not collections:
            print("No saved collections found.")
            return
        print(f"\n{len(collections)} collection(s):\n")
        for c in collections:
            print(f"  • {c['name']} ({c['count']} posts) [id: {c['id']}]")

    elif args.command == "status":
        idx = Index()
        if idx.count() == 0:
            print("No posts synced yet. Run: /sync-instagram")
            return
        collections = set()
        total_with_video = 0
        total_downloaded = 0
        for entry in idx.entries.values():
            collections.add(entry.get("collection", "uncategorized"))
            if entry.get("video_url"):
                total_with_video += 1
            if entry.get("downloaded"):
                total_downloaded += 1
        md_files = list(VAULT_DIR.glob("*.md"))
        print(f"\n— Instagram Saved Posts Status —")
        print(f"  Indexed: {idx.count()} posts")
        print(f"  Files: {len(md_files)} markdown files")
        print(f"  Collections: {len(collections)}")
        print(f"  Videos: {total_downloaded}/{total_with_video} downloaded")
        print(f"  Vault: {VAULT_DIR}/")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
