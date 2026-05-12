#!/usr/bin/env python3
"""
analytics.py — Fetch and compute social media analytics for published content.

Usage:
  python3 -m scripts.analytics pull [--id <entry_id>] [--force]
  python3 -m scripts.analytics summary
  python3 -m scripts.analytics detail --id <entry_id>
  python3 -m scripts.analytics dashboard [--vault <path>]
  python3 -m scripts.analytics insights [--vault <path>]
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from scripts.registry import Registry, HOOK_PATTERNS

COMPOSIO_BIN = str(Path.home() / ".composio" / "composio")
REGISTRY_PATH = Path("vault/content-registry.json")
CACHE_WINDOW_HOURS = 6

IG_METRICS = ["views", "reach", "saved", "likes", "comments", "shares"]


# ---------------------------------------------------------------------------
# Composio helpers (same pattern as publish.py)
# ---------------------------------------------------------------------------

def _check_composio() -> None:
    if not Path(COMPOSIO_BIN).exists():
        raise RuntimeError(f"composio not found at {COMPOSIO_BIN} — install with: npm install -g @composio/cli")


def _composio_call_raw(slug: str, payload: dict) -> dict:
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


# ---------------------------------------------------------------------------
# Instagram fetchers
# ---------------------------------------------------------------------------

def fetch_instagram_metrics(ig_media_id: str) -> dict:
    """Fetch post-level metrics from Instagram Graph API via Composio."""
    result = _composio_call_raw("INSTAGRAM_GET_IG_MEDIA_INSIGHTS", {
        "ig_media_id": ig_media_id,
        "metric": IG_METRICS,
    })
    if not result.get("successful"):
        return {"error": result.get("error", "unknown")}

    metrics = {"ig_media_id": ig_media_id}
    data = result.get("data", {})

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and "data" in data:
        items = data["data"]
    else:
        items = []

    for item in items:
        name = item.get("name", "")
        value = item.get("values", [{}])[0].get("value") if item.get("values") else item.get("value")
        if name in ("views", "impressions"):
            metrics["views"] = value
        elif name == "reach":
            metrics["reach"] = value
        elif name == "saved":
            metrics["saves"] = value
        elif name == "likes":
            metrics["likes"] = value
        elif name == "comments":
            metrics["comments"] = value
        elif name == "shares":
            metrics["shares"] = value

    for field in ("views", "reach", "likes", "comments", "saves", "shares"):
        metrics.setdefault(field, None)

    metrics["engagement_rate"] = compute_engagement_rate(metrics, "instagram")
    metrics["fetched_at"] = datetime.now(timezone.utc).isoformat()
    return metrics


def resolve_ig_media_id(published_url: str) -> Optional[str]:
    """Resolve an Instagram media ID from a permalink by listing recent user media."""
    user_info = _composio_call_raw("INSTAGRAM_GET_USER_INFO", {})
    if not user_info.get("successful"):
        return None
    ig_user_id = user_info.get("data", {}).get("id")
    if not ig_user_id:
        return None

    media_list = _composio_call_raw("INSTAGRAM_GET_IG_USER_MEDIA", {
        "ig_user_id": ig_user_id,
        "fields": "id,permalink",
        "limit": 50,
    })
    if not media_list.get("successful"):
        return None

    items = media_list.get("data", {})
    if isinstance(items, dict) and "data" in items:
        items = items["data"]
    if not isinstance(items, list):
        return None

    for item in items:
        if item.get("permalink") == published_url:
            return item.get("id")
    return None


# ---------------------------------------------------------------------------
# LinkedIn fetchers
# ---------------------------------------------------------------------------

def extract_linkedin_urn(published_url: str) -> Optional[str]:
    """Extract a LinkedIn post URN from a published URL or return None."""
    match = re.search(r"activity[:-](\d+)", published_url)
    if match:
        return f"urn:li:activity:{match.group(1)}"
    match = re.search(r"ugcPost[:-](\d+)", published_url)
    if match:
        return f"urn:li:ugcPost:{match.group(1)}"
    match = re.search(r"share[:-](\d+)", published_url)
    if match:
        return f"urn:li:share:{match.group(1)}"
    return None


def fetch_linkedin_metrics(post_urn: str) -> dict:
    """Fetch post metrics from LinkedIn via Composio."""
    metrics: dict = {"li_post_urn": post_urn}

    post_result = _composio_call_raw("LINKEDIN_GET_POST_CONTENT", {"post_id": post_urn})
    if not post_result.get("successful"):
        return {"error": post_result.get("error", "unknown")}

    post_data = post_result.get("data", {})
    social = post_data.get("socialDetail", {}).get("totalSocialActivityCounts", {})
    metrics["likes"] = social.get("numLikes", 0)
    metrics["comments"] = social.get("numComments", 0)
    metrics["shares"] = social.get("numShares", 0)
    metrics["impressions"] = social.get("numImpressions")

    reaction_result = _composio_call_raw("LINKEDIN_LIST_REACTIONS", {
        "entity": post_urn, "count": 1, "start": 0,
    })
    if reaction_result.get("successful"):
        paging = reaction_result.get("data", {}).get("paging", {})
        total = paging.get("total")
        if total is not None:
            metrics["likes"] = total

    for field in ("impressions", "likes", "comments", "shares"):
        metrics.setdefault(field, None)
    metrics["saves"] = None
    metrics["reach"] = None

    metrics["engagement_rate"] = compute_engagement_rate(metrics, "linkedin")
    metrics["fetched_at"] = datetime.now(timezone.utc).isoformat()
    return metrics


# ---------------------------------------------------------------------------
# Computed metrics
# ---------------------------------------------------------------------------

def compute_engagement_rate(metrics: dict, platform: str) -> Optional[float]:
    """Compute engagement rate as a percentage."""
    likes = metrics.get("likes") or 0
    comments = metrics.get("comments") or 0
    saves = metrics.get("saves") or 0
    shares = metrics.get("shares") or 0
    total = likes + comments + saves + shares

    if platform == "instagram":
        denominator = metrics.get("reach") or metrics.get("views")
    else:
        denominator = metrics.get("impressions")

    if not denominator or denominator == 0:
        return None
    return round(total / denominator * 100, 2)


def compute_performance_score(entry: dict) -> float:
    """Compute a 0-10 performance score from actual engagement data."""
    analytics = entry.get("analytics", {})
    if not analytics:
        return 0.0

    raw = 0.0
    eng_rates = []
    total_impressions = 0
    total_saves_shares = 0
    total_reach = 0
    total_comments = 0

    for platform in ("instagram", "linkedin"):
        pdata = analytics.get(platform, {})
        if not pdata or "error" in pdata:
            continue

        er = pdata.get("engagement_rate")
        if er is not None:
            eng_rates.append(er)

        impressions = pdata.get("views") or pdata.get("impressions") or 0
        total_impressions += impressions

        saves = pdata.get("saves") or 0
        shares = pdata.get("shares") or 0
        total_saves_shares += saves + shares

        reach = pdata.get("reach") or impressions
        total_reach += reach

        total_comments += pdata.get("comments") or 0

    if eng_rates:
        avg_er = sum(eng_rates) / len(eng_rates)
        if avg_er >= 10:
            raw += 4.0
        elif avg_er >= 5:
            raw += 3.0
        elif avg_er >= 2:
            raw += 2.0
        elif avg_er >= 1:
            raw += 1.0

    if total_impressions >= 10000:
        raw += 3.0
    elif total_impressions >= 5000:
        raw += 2.0
    elif total_impressions >= 1000:
        raw += 1.0

    if total_reach > 0:
        ss_rate = total_saves_shares / total_reach * 100
        if ss_rate >= 5:
            raw += 2.0
        elif ss_rate >= 2:
            raw += 1.0

    if total_comments >= 10:
        raw += 1.0

    return round(min(raw, 10.0), 1)


# ---------------------------------------------------------------------------
# Pull orchestrator
# ---------------------------------------------------------------------------

def _is_cache_fresh(platform_data: dict) -> bool:
    fetched = platform_data.get("fetched_at")
    if not fetched:
        return False
    try:
        fetched_dt = datetime.fromisoformat(fetched)
        age_hours = (datetime.now(timezone.utc) - fetched_dt).total_seconds() / 3600
        return age_hours < CACHE_WINDOW_HOURS
    except (ValueError, TypeError):
        return False


def pull_metrics(
    registry_path: Path = REGISTRY_PATH,
    entry_id: Optional[str] = None,
    force: bool = False,
) -> dict:
    """Pull analytics for published entries. Returns {updated: int, errors: list}."""
    reg = Registry(registry_path)
    entries = reg.list(status="published") if not entry_id else [reg.get(entry_id)]
    entries = [e for e in entries if e is not None]

    updated = 0
    errors = []

    for entry in entries:
        analytics = dict(entry.get("analytics") or {})
        published_urls = entry.get("published_urls", {})
        published_media_ids = entry.get("published_media_ids", {})

        for platform in ("instagram", "linkedin"):
            url = published_urls.get(platform)
            if not url:
                continue

            existing = analytics.get(platform, {})
            if not force and _is_cache_fresh(existing):
                continue

            try:
                if platform == "instagram":
                    media_id = published_media_ids.get("instagram") or existing.get("ig_media_id")
                    if not media_id:
                        media_id = resolve_ig_media_id(url)
                    if not media_id:
                        errors.append(f"{entry['id']}/instagram: could not resolve media ID")
                        continue
                    metrics = fetch_instagram_metrics(media_id)
                else:
                    urn = published_media_ids.get("linkedin") or existing.get("li_post_urn")
                    if not urn:
                        urn = extract_linkedin_urn(url)
                    if not urn:
                        errors.append(f"{entry['id']}/linkedin: could not extract post URN")
                        continue
                    metrics = fetch_linkedin_metrics(urn)

                if "error" in metrics:
                    errors.append(f"{entry['id']}/{platform}: {metrics['error']}")
                    continue

                analytics[platform] = metrics
            except Exception as exc:
                errors.append(f"{entry['id']}/{platform}: {exc}")
                continue

        analytics["performance_score"] = compute_performance_score({"analytics": analytics})
        analytics["last_fetched_at"] = datetime.now(timezone.utc).isoformat()

        reg.update(entry["id"], {"analytics": analytics})
        updated += 1

    return {"updated": updated, "errors": errors}


# ---------------------------------------------------------------------------
# Summary & detail output
# ---------------------------------------------------------------------------

def format_number(n) -> str:
    if n is None:
        return "—"
    if isinstance(n, float):
        return f"{n:.1f}%"
    return f"{n:,}"


def print_summary(registry_path: Path = REGISTRY_PATH) -> None:
    reg = Registry(registry_path)
    entries = [e for e in reg.list(status="published") if e.get("analytics")]
    if not entries:
        print("No analytics data yet. Run: /analytics --refresh")
        return

    print(f"\n— Analytics Summary ({len(entries)} published posts) —\n")
    header = f"{'ID':<50} {'Type':<8} {'IG Views':>9} {'IG Eng%':>8} {'LI Imp':>8} {'LI Eng%':>8} {'Score':>6}"
    print(header)
    print("─" * len(header))

    for e in sorted(entries, key=lambda x: x.get("analytics", {}).get("performance_score", 0), reverse=True):
        a = e.get("analytics", {})
        ig = a.get("instagram", {})
        li = a.get("linkedin", {})
        eid = e["id"][:48]
        print(
            f"{eid:<50} {e.get('type', '?'):<8} "
            f"{format_number(ig.get('views')):>9} {format_number(ig.get('engagement_rate')):>8} "
            f"{format_number(li.get('impressions')):>8} {format_number(li.get('engagement_rate')):>8} "
            f"{a.get('performance_score', '—'):>6}"
        )

    ig_ers = [e["analytics"]["instagram"]["engagement_rate"] for e in entries
              if e.get("analytics", {}).get("instagram", {}).get("engagement_rate") is not None]
    li_ers = [e["analytics"]["linkedin"]["engagement_rate"] for e in entries
              if e.get("analytics", {}).get("linkedin", {}).get("engagement_rate") is not None]
    ig_avg = f"{sum(ig_ers)/len(ig_ers):.1f}%" if ig_ers else "—"
    li_avg = f"{sum(li_ers)/len(li_ers):.1f}%" if li_ers else "—"
    total_reach = sum(
        (e.get("analytics", {}).get("instagram", {}).get("reach") or
         e.get("analytics", {}).get("instagram", {}).get("views") or 0) +
        (e.get("analytics", {}).get("linkedin", {}).get("impressions") or 0)
        for e in entries
    )
    print(f"\nAvg engagement: IG {ig_avg} | LI {li_avg}")
    print(f"Total reach: {total_reach:,}")


def print_detail(entry_id: str, registry_path: Path = REGISTRY_PATH) -> None:
    reg = Registry(registry_path)
    entry = reg.get(entry_id)
    if not entry:
        print(f"Entry not found: {entry_id}", file=sys.stderr)
        sys.exit(1)

    a = entry.get("analytics", {})
    print(f"\n— Analytics: {entry_id} —")
    print(f"Type: {entry.get('type', '?')} | Published: {list(entry.get('published_at', {}).keys())} | Score: {a.get('performance_score', '—')}/10")

    for platform in ("instagram", "linkedin"):
        pdata = a.get(platform)
        if not pdata:
            print(f"\n{platform.title()}: (not published)")
            continue
        if "error" in pdata:
            print(f"\n{platform.title()}: error — {pdata['error']}")
            continue
        print(f"\n{platform.title()}:")
        if platform == "instagram":
            print(f"  Views: {format_number(pdata.get('views'))} | Reach: {format_number(pdata.get('reach'))}")
        else:
            print(f"  Impressions: {format_number(pdata.get('impressions'))}")
        print(f"  Likes: {format_number(pdata.get('likes'))} | Comments: {format_number(pdata.get('comments'))} | "
              f"Saves: {format_number(pdata.get('saves'))} | Shares: {format_number(pdata.get('shares'))}")
        print(f"  Engagement Rate: {format_number(pdata.get('engagement_rate'))}")
        print(f"  Fetched: {pdata.get('fetched_at', '—')}")

    virality = entry.get("virality_score")
    perf = a.get("performance_score")
    if virality and perf:
        delta = "overperformed" if perf > virality else "underperformed"
        print(f"\nPredicted virality: {virality}/10 → Actual: {perf}/10 ({delta})")


# ---------------------------------------------------------------------------
# Dashboard generation
# ---------------------------------------------------------------------------

def generate_dashboard(registry_path: Path = REGISTRY_PATH, vault_path: Path = Path("vault")) -> None:
    analytics_dir = vault_path / "analytics"
    analytics_dir.mkdir(parents=True, exist_ok=True)

    reg = Registry(registry_path)
    entries = [e for e in reg.list(status="published") if e.get("analytics")]
    now = datetime.now(timezone.utc).isoformat()

    _write_overview(analytics_dir, entries, now)
    _write_leaderboard(analytics_dir, entries, now)
    _write_platform_comparison(analytics_dir, entries, now)
    _write_content_type_analysis(analytics_dir, entries, now)

    print(f"Dashboard written to {analytics_dir}/")


def _write_overview(out_dir: Path, entries: list, now: str) -> None:
    total = len(entries)
    scores = [e["analytics"].get("performance_score", 0) for e in entries]
    avg_score = sum(scores) / len(scores) if scores else 0
    best = max(entries, key=lambda e: e["analytics"].get("performance_score", 0)) if entries else None
    total_reach = sum(
        (e.get("analytics", {}).get("instagram", {}).get("reach") or
         e.get("analytics", {}).get("instagram", {}).get("views") or 0) +
        (e.get("analytics", {}).get("linkedin", {}).get("impressions") or 0)
        for e in entries
    )

    (out_dir / "overview.md").write_text(f"""---
generated_at: {now}
---
# Analytics Overview

## Quick Stats
- **Total published with analytics:** {total}
- **Avg performance score:** {avg_score:.1f}/10
- **Best performer:** {best['id'] if best else '—'} ({best['analytics'].get('performance_score', 0) if best else 0})
- **Total reach:** {total_reach:,}

## Reports
- [[performance-leaderboard]] — Top posts ranked by engagement
- [[platform-comparison]] — IG vs LI head-to-head
- [[content-type-analysis]] — Reels vs carousels vs posts
""")


def _write_leaderboard(out_dir: Path, entries: list, now: str) -> None:
    lines = [f"---\ngenerated_at: {now}\n---\n# Performance Leaderboard\n"]
    lines.append("| Rank | Content | Type | Score | IG Eng% | LI Eng% |")
    lines.append("|------|---------|------|-------|---------|---------|")
    ranked = sorted(entries, key=lambda e: e["analytics"].get("performance_score", 0), reverse=True)
    for i, e in enumerate(ranked[:20], 1):
        a = e.get("analytics", {})
        ig_er = a.get("instagram", {}).get("engagement_rate")
        li_er = a.get("linkedin", {}).get("engagement_rate")
        lines.append(
            f"| {i} | {e['id'][:40]} | {e.get('type', '?')} | "
            f"{a.get('performance_score', '—')} | {format_number(ig_er)} | {format_number(li_er)} |"
        )
    (out_dir / "performance-leaderboard.md").write_text("\n".join(lines) + "\n")


def _write_platform_comparison(out_dir: Path, entries: list, now: str) -> None:
    cross = [e for e in entries if "instagram" in e.get("analytics", {}) and "linkedin" in e.get("analytics", {})]
    lines = [f"---\ngenerated_at: {now}\n---\n# Platform Comparison\n"]
    if not cross:
        lines.append("No cross-posted content with analytics yet.")
    else:
        lines.append("| Content | IG Views | LI Imp | IG Eng% | LI Eng% |")
        lines.append("|---------|----------|--------|---------|---------|")
        for e in cross:
            ig = e["analytics"]["instagram"]
            li = e["analytics"]["linkedin"]
            lines.append(
                f"| {e['id'][:35]} | {format_number(ig.get('views'))} | "
                f"{format_number(li.get('impressions'))} | {format_number(ig.get('engagement_rate'))} | "
                f"{format_number(li.get('engagement_rate'))} |"
            )
    (out_dir / "platform-comparison.md").write_text("\n".join(lines) + "\n")


def _write_content_type_analysis(out_dir: Path, entries: list, now: str) -> None:
    by_type: dict[str, list] = {}
    for e in entries:
        t = e.get("type", "unknown")
        by_type.setdefault(t, []).append(e)

    lines = [f"---\ngenerated_at: {now}\n---\n# Content Type Analysis\n"]
    lines.append("| Type | Count | Avg Score | Avg IG Eng% | Avg LI Eng% |")
    lines.append("|------|-------|-----------|-------------|-------------|")
    for ctype, group in sorted(by_type.items()):
        scores = [e["analytics"].get("performance_score", 0) for e in group]
        ig_ers = [e["analytics"].get("instagram", {}).get("engagement_rate") for e in group
                  if e["analytics"].get("instagram", {}).get("engagement_rate") is not None]
        li_ers = [e["analytics"].get("linkedin", {}).get("engagement_rate") for e in group
                  if e["analytics"].get("linkedin", {}).get("engagement_rate") is not None]
        avg_s = sum(scores) / len(scores) if scores else 0
        avg_ig = f"{sum(ig_ers)/len(ig_ers):.1f}%" if ig_ers else "—"
        avg_li = f"{sum(li_ers)/len(li_ers):.1f}%" if li_ers else "—"
        lines.append(f"| {ctype} | {len(group)} | {avg_s:.1f} | {avg_ig} | {avg_li} |")
    (out_dir / "content-type-analysis.md").write_text("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# Insights / feedback loop
# ---------------------------------------------------------------------------

def generate_insights(registry_path: Path = REGISTRY_PATH, vault_path: Path = Path("vault")) -> None:
    """Analyze performance data and write vault/brand/modules/performance.md."""
    reg = Registry(registry_path)
    entries = [e for e in reg.list(status="published") if e.get("analytics")]
    if not entries:
        print("No analytics data to generate insights from.")
        return

    by_type: dict[str, list] = {}
    hook_scores: dict[str, list] = {}
    all_scores: list[float] = []
    ig_ers: list[float] = []
    li_ers: list[float] = []

    for e in entries:
        a = e.get("analytics", {})
        score = a.get("performance_score", 0)
        all_scores.append(score)

        t = e.get("type", "unknown")
        by_type.setdefault(t, []).append(score)

        topic = e.get("topic", "")
        for i, pattern in enumerate(HOOK_PATTERNS):
            if re.search(pattern, topic):
                hook_scores.setdefault(f"pattern_{i}", []).append(score)

        ig_er = a.get("instagram", {}).get("engagement_rate")
        if ig_er is not None:
            ig_ers.append(ig_er)
        li_er = a.get("linkedin", {}).get("engagement_rate")
        if li_er is not None:
            li_ers.append(li_er)

    best_type = max(by_type.items(), key=lambda x: sum(x[1]) / len(x[1])) if by_type else ("unknown", [0])
    worst_type = min(by_type.items(), key=lambda x: sum(x[1]) / len(x[1])) if by_type else ("unknown", [0])

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    avg_ig = f"{sum(ig_ers)/len(ig_ers):.1f}" if ig_ers else "0"
    avg_li = f"{sum(li_ers)/len(li_ers):.1f}" if li_ers else "0"
    avg_score = sum(all_scores) / len(all_scores) if all_scores else 0

    best_type_avg = sum(best_type[1]) / len(best_type[1]) if best_type[1] else 0
    worst_type_avg = sum(worst_type[1]) / len(worst_type[1]) if worst_type[1] else 0

    content = f"""---
module: performance
last_updated: {now}
data_points: {len(entries)}
avg_score: {avg_score:.1f}
top_content_type: {best_type[0]}
avg_engagement_rate:
  instagram: {avg_ig}
  linkedin: {avg_li}
best_content_type:
  type: {best_type[0]}
  avg_score: {best_type_avg:.1f}
worst_content_type:
  type: {worst_type[0]}
  avg_score: {worst_type_avg:.1f}
---

## Performance Insights

Based on {len(entries)} published posts with analytics data.

### What Works

"""
    if best_type[0] != worst_type[0]:
        pct = ((best_type_avg - worst_type_avg) / worst_type_avg * 100) if worst_type_avg > 0 else 0
        content += f"- **{best_type[0].title()}s outperform {worst_type[0]}s** by {pct:.0f}% in performance score ({best_type_avg:.1f} vs {worst_type_avg:.1f}). Prioritize {best_type[0]} format.\n"

    if ig_ers and li_ers:
        ig_avg_val = sum(ig_ers) / len(ig_ers)
        li_avg_val = sum(li_ers) / len(li_ers)
        winner = "Instagram" if ig_avg_val > li_avg_val else "LinkedIn"
        content += f"- **{winner} drives higher engagement** ({ig_avg_val:.1f}% IG vs {li_avg_val:.1f}% LI avg engagement rate).\n"

    content += f"\n### Content Type Breakdown\n\n"
    for ctype, scores in sorted(by_type.items()):
        avg = sum(scores) / len(scores) if scores else 0
        content += f"- **{ctype.title()}** ({len(scores)} posts): avg score {avg:.1f}/10\n"

    content += f"\n### Recommendations\n\n"
    content += f"- Lead with {best_type[0]} format when possible\n"
    if ig_ers and li_ers:
        content += "- Consider platform-specific formatting (LinkedIn prefers text-first)\n"
    content += "- Use comment-keyword CTAs to drive engagement\n"

    perf_path = vault_path / "brand" / "modules" / "performance.md"
    perf_path.parent.mkdir(parents=True, exist_ok=True)
    perf_path.write_text(content)
    print(f"Insights written to {perf_path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Social media analytics for PostOracle")
    sub = parser.add_subparsers(dest="command")

    pull_p = sub.add_parser("pull", help="Fetch metrics for published posts")
    pull_p.add_argument("--id", dest="entry_id", help="Specific entry ID")
    pull_p.add_argument("--force", action="store_true", help="Ignore cache")
    pull_p.add_argument("--registry", default=str(REGISTRY_PATH))

    summary_p = sub.add_parser("summary", help="Show analytics summary")
    summary_p.add_argument("--registry", default=str(REGISTRY_PATH))

    detail_p = sub.add_parser("detail", help="Show detailed metrics for one post")
    detail_p.add_argument("--id", dest="entry_id", required=True)
    detail_p.add_argument("--registry", default=str(REGISTRY_PATH))

    dash_p = sub.add_parser("dashboard", help="Generate vault dashboard")
    dash_p.add_argument("--registry", default=str(REGISTRY_PATH))
    dash_p.add_argument("--vault", default="vault")

    insight_p = sub.add_parser("insights", help="Generate performance.md brand module")
    insight_p.add_argument("--registry", default=str(REGISTRY_PATH))
    insight_p.add_argument("--vault", default="vault")

    args = parser.parse_args()

    if args.command == "pull":
        result = pull_metrics(Path(args.registry), args.entry_id, args.force)
        print(f"Updated: {result['updated']}")
        for err in result["errors"]:
            print(f"  [ERROR] {err}", file=sys.stderr)
    elif args.command == "summary":
        print_summary(Path(args.registry))
    elif args.command == "detail":
        print_detail(args.entry_id, Path(args.registry))
    elif args.command == "dashboard":
        generate_dashboard(Path(args.registry), Path(args.vault))
    elif args.command == "insights":
        generate_insights(Path(args.registry), Path(args.vault))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
