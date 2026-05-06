#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


class Registry:
    def __init__(self, path: str | Path = "vault/content-registry.json"):
        self.path = Path(path)

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text())

    def _save(self, entries: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")

    def add(self, entry: dict) -> None:
        entries = self._load()
        if any(e["id"] == entry["id"] for e in entries):
            raise ValueError(f"Entry '{entry['id']}' already exists in registry")
        entries.append(entry)
        self._save(entries)

    def get(self, entry_id: str) -> dict | None:
        for e in self._load():
            if e["id"] == entry_id:
                return e
        return None

    def update(self, entry_id: str, fields: dict) -> None:
        entries = self._load()
        for entry in entries:
            if entry["id"] == entry_id:
                entry.update(fields)
                self._save(entries)
                return
        raise KeyError(f"Entry '{entry_id}' not found in registry")

    def list(self, **filters) -> list[dict]:
        entries = self._load()
        for key, value in filters.items():
            if key == "platform":
                entries = [e for e in entries if value in e.get("platforms", [])]
            else:
                entries = [e for e in entries if e.get(key) == value]
        return entries


HOOK_PATTERNS = [
    r"(?i)\bstop\b.*\b(doing|trying|using)\b",
    r"(?i)\bnobody\b.*\btells?\b",
    r"(?i)\bhere'?s?\s+(the\s+)?(truth|what|why)\b",
    r"(?i)\byou'?re\b.*\bwrong\b",
    r"(?i)\bforget\b.*\beverything\b",
    r"(?i)\bthis\s+(changed|broke|blew)\b",
    r"(?i)\bI\s+(was|used\s+to)\b.*\buntil\b",
]

CTA_PATTERNS = [
    r"(?i)\bcomment\b",
    r"(?i)\bDM\b",
    r"(?i)\bfollow\b",
    r"(?i)\blink\s+in\s+bio\b",
    r"(?i)\bsave\s+this\b",
    r"(?i)\bshare\s+this\b",
    r"(?i)\btag\s+(a\s+friend|someone)\b",
]

TYPE_MULTIPLIERS = {"reel": 1.5, "carousel": 1.2, "post": 1.0}
MAX_RAW = 3.0 + 2.0 + 1.5 + 1.0 + 0.5 + 0.5  # 8.5


def compute_virality_score(
    entry: dict,
    hook_text: str = "",
    brand_loaded: bool = False,
) -> float:
    raw = 0.0

    hook_matches = sum(1 for p in HOOK_PATTERNS if re.search(p, hook_text))
    raw += min(hook_matches / len(HOOK_PATTERNS) * 3.0, 3.0)

    content_type = entry.get("type", "post")
    raw += TYPE_MULTIPLIERS.get(content_type, 1.0)

    if brand_loaded:
        raw += 1.0

    cta_matches = sum(1 for p in CTA_PATTERNS if re.search(p, hook_text))
    if cta_matches > 0:
        raw += 0.5

    if len(entry.get("platforms", [])) >= 2:
        raw += 0.5

    return round(min(raw / MAX_RAW * 10.0, 10.0), 1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Content registry CLI")
    parser.add_argument("--registry", default="vault/content-registry.json", help="Path to registry JSON")
    sub = parser.add_subparsers(dest="command")

    list_p = sub.add_parser("list")
    list_p.add_argument("--registry", default="vault/content-registry.json", help="Path to registry JSON")
    list_p.add_argument("--status", help="Filter by status")
    list_p.add_argument("--type", help="Filter by content type")
    list_p.add_argument("--platform", help="Filter by platform")

    get_p = sub.add_parser("get")
    get_p.add_argument("--registry", default="vault/content-registry.json", help="Path to registry JSON")
    get_p.add_argument("--id", required=True, help="Entry ID")

    update_p = sub.add_parser("update")
    update_p.add_argument("--registry", default="vault/content-registry.json", help="Path to registry JSON")
    update_p.add_argument("--id", required=True, help="Entry ID")
    update_p.add_argument("--status", help="New status")
    update_p.add_argument("--scheduled-at", help="Scheduled datetime")

    args = parser.parse_args()
    # --registry may be on subparser or top-level parser depending on placement
    registry_path = getattr(args, "registry", "vault/content-registry.json")
    reg = Registry(registry_path)

    if args.command == "list":
        filters = {}
        if args.status:
            filters["status"] = args.status
        if args.type:
            filters["type"] = args.type
        if args.platform:
            filters["platform"] = args.platform
        print(json.dumps(reg.list(**filters), indent=2))

    elif args.command == "get":
        entry = reg.get(args.id)
        if entry is None:
            print(f"Entry '{args.id}' not found", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(entry, indent=2))

    elif args.command == "update":
        fields = {}
        if args.status:
            fields["status"] = args.status
        if args.scheduled_at:
            fields["scheduled_at"] = args.scheduled_at
        reg.update(args.id, fields)
        print(json.dumps(reg.get(args.id), indent=2))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
