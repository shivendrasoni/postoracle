#!/usr/bin/env python3
"""
brand_voice.py — CLI for vault brand module read/write/compile/status.

Subcommands:
  read     --module <name> --vault <path>
  write    --module <name> --vault <path>   (reads full file from stdin)
  compile  --vault <path>
  status   --vault <path>
"""
import argparse
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import yaml

MODULES = ["niche", "style", "competitors", "goals", "cta", "watermark", "brand"]
STALE_DAYS = 30
BRAND_DIR = "brand"
MODULES_SUBDIR = "modules"
MASTER_FILENAME = "brand-voice.md"

SECTION_NAMES = {
    "niche": "Niche",
    "style": "Style",
    "competitors": "Competitors & Inspiration",
    "goals": "Goals",
    "cta": "CTA",
    "watermark": "Watermark",
    "brand": "Brand Identity",
}


def module_path(vault_dir: Path, module: str) -> Path:
    return vault_dir / BRAND_DIR / MODULES_SUBDIR / f"{module}.md"


def parse_module_file(content: str) -> tuple[dict, str]:
    """Split '---\\nfrontmatter\\n---\\nbody' → (frontmatter_dict, body_str).

    Returns ({}, content) if no frontmatter delimiters found.
    """
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


def read_module(vault_dir: Path, module: str) -> tuple[dict, str]:
    """Read and parse vault/brand/modules/<module>.md → (frontmatter, body).

    Raises FileNotFoundError if the file does not exist.
    """
    path = module_path(vault_dir, module)
    content = path.read_text(encoding="utf-8")
    return parse_module_file(content)


def write_module(vault_dir: Path, module: str, content: str) -> Path:
    """Write full file content to vault/brand/modules/<module>.md.

    Creates parent directories. Returns the path written.
    """
    path = module_path(vault_dir, module)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def module_status(vault_dir: Path, module: str) -> tuple[str, Optional[date]]:
    """Return (status, last_updated_date) for a module.

    status is one of: 'complete', 'not_started', 'stale'
    last_updated_date is None when status is 'not_started' or no date was recorded.
    """
    path = module_path(vault_dir, module)
    if not path.exists():
        return "not_started", None
    try:
        frontmatter, _ = read_module(vault_dir, module)
    except Exception:
        return "not_started", None
    raw = frontmatter.get("last_updated")
    if not raw:
        return "complete", None
    if isinstance(raw, datetime):
        last_updated = raw.date()
    elif isinstance(raw, date):
        last_updated = raw
    else:
        try:
            last_updated = datetime.strptime(str(raw), "%Y-%m-%d").date()
        except ValueError:
            return "complete", None
    delta = (date.today() - last_updated).days
    if delta > STALE_DAYS:
        return "stale", last_updated
    return "complete", last_updated


def compile_master(vault_dir: Path) -> Path:
    """Regenerate vault/brand/brand-voice.md from all 7 module files.

    Pulls frontmatter YAML + body from each module into one Obsidian document.
    Returns the path written.
    """
    creator_name = "Creator"
    niche_p = module_path(vault_dir, "niche")
    if niche_p.exists():
        try:
            fm, _ = read_module(vault_dir, "niche")
            creator_name = fm.get("creator_name", "Creator")
        except Exception:
            pass

    lines = [
        f"# Brand Voice — {creator_name}",
        f"Last updated: {date.today().isoformat()}",
        "",
    ]

    for mod in MODULES:
        lines.append(f"## {SECTION_NAMES[mod]}")
        p = module_path(vault_dir, mod)
        if not p.exists():
            lines += ["_Not configured_", ""]
            continue
        try:
            fm, body = read_module(vault_dir, mod)
            if fm:
                lines += ["```yaml", yaml.dump(fm, default_flow_style=False).rstrip(), "```"]
            if body:
                lines += ["", body]
        except Exception as exc:
            lines.append(f"_Error reading module: {exc}_")
        lines.append("")

    master_path = vault_dir / BRAND_DIR / MASTER_FILENAME
    master_path.parent.mkdir(parents=True, exist_ok=True)
    master_path.write_text("\n".join(lines), encoding="utf-8")
    return master_path


def print_status(vault_dir: Path) -> None:
    """Print module status table to stdout."""
    for mod in MODULES:
        status, last_updated = module_status(vault_dir, mod)
        if status == "not_started":
            icon = "✗"
            detail = "not started"
        elif status == "stale":
            icon = "~"
            detail = f"last updated {last_updated}  (stale — >{STALE_DAYS} days)"
        else:
            icon = "✓"
            detail = f"last updated {last_updated}" if last_updated else "no date"
        print(f"{mod:<12} {icon}  {detail}")


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Vault brand module CLI")
    parser.add_argument("--vault", default="vault", help="Path to vault root directory")
    sub = parser.add_subparsers(dest="command", required=True)

    read_p = sub.add_parser("read", help="Print module frontmatter + body")
    read_p.add_argument("--module", required=True, choices=MODULES)

    write_p = sub.add_parser("write", help="Write module file from stdin")
    write_p.add_argument("--module", required=True, choices=MODULES)

    sub.add_parser("compile", help="Regenerate brand-voice.md")
    sub.add_parser("status", help="Show all module statuses")

    args = parser.parse_args(argv)
    vault_dir = Path(args.vault)

    if args.command == "read":
        try:
            fm, body = read_module(vault_dir, args.module)
        except FileNotFoundError:
            print(f"Error: module '{args.module}' not found", file=sys.stderr)
            sys.exit(1)
        print(yaml.dump(fm, default_flow_style=False))
        print(body)

    elif args.command == "write":
        content = sys.stdin.read()
        path = write_module(vault_dir, args.module, content)
        print(str(path))

    elif args.command == "compile":
        path = compile_master(vault_dir)
        print(str(path))

    elif args.command == "status":
        print_status(vault_dir)


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
