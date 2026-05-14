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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Instagram 300.0",
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
        f"{IG_BASE}/api/v1/accounts/current_user/?edit=true",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "ok"
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError):
        return False


def parse_media_type(media: dict) -> str:
    media_type = media.get("media_type")
    if media_type == 8:
        return "carousel"
    if media_type == 2 and media.get("product_type") == "clips":
        return "reel"
    return "post"


def parse_saved_post(item: dict) -> dict:
    media = item.get("media", {})
    shortcode = media.get("code", "")
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

    return {
        "shortcode": shortcode,
        "type": post_type,
        "author": user.get("username", ""),
        "author_name": user.get("full_name", ""),
        "caption": caption,
        "link": link,
        "date_published": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "like_count": media.get("like_count", 0),
        "comment_count": media.get("comment_count", 0),
        "thumbnail_url": _extract_thumbnail(media),
    }


def _extract_thumbnail(media: dict) -> str:
    candidates = media.get("image_versions2", {}).get("candidates", [])
    if candidates:
        return candidates[0].get("url", "")
    return media.get("thumbnail_url", "")


def fetch_saved_posts_page(headers: dict, max_id: str = "") -> dict:
    url = f"{IG_BASE}/api/v1/feed/saved/posts/"
    if max_id:
        url += f"?max_id={max_id}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
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
        with urllib.request.urlopen(req, timeout=15) as resp:
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
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise InstagramSessionError(
                "Session expired — re-grab sessionid, csrftoken, ds_user_id from browser cookies"
            )
        raise InstagramAPIError(f"Instagram API returned {exc.code}: {exc.reason}")
