"""Tests for scripts/analytics.py — pure function logic."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.analytics import (
    compute_engagement_rate,
    compute_performance_score,
    extract_linkedin_urn,
    format_number,
    generate_dashboard,
    generate_insights,
    _is_cache_fresh,
)


# ---------------------------------------------------------------------------
# compute_engagement_rate
# ---------------------------------------------------------------------------

class TestComputeEngagementRate:
    def test_instagram_with_reach(self):
        metrics = {"likes": 100, "comments": 20, "saves": 30, "shares": 10, "reach": 2000}
        rate = compute_engagement_rate(metrics, "instagram")
        assert rate == 8.0  # (100+20+30+10)/2000*100

    def test_instagram_falls_back_to_views(self):
        metrics = {"likes": 50, "comments": 10, "saves": 5, "shares": 5, "reach": None, "views": 1000}
        rate = compute_engagement_rate(metrics, "instagram")
        assert rate == 7.0  # (50+10+5+5)/1000*100

    def test_linkedin_with_impressions(self):
        metrics = {"likes": 40, "comments": 10, "shares": 5, "impressions": 5000}
        rate = compute_engagement_rate(metrics, "linkedin")
        assert rate == 1.1  # (40+10+5)/5000*100

    def test_zero_denominator_returns_none(self):
        metrics = {"likes": 10, "comments": 5, "reach": 0}
        assert compute_engagement_rate(metrics, "instagram") is None

    def test_missing_denominator_returns_none(self):
        metrics = {"likes": 10, "comments": 5}
        assert compute_engagement_rate(metrics, "linkedin") is None

    def test_none_engagement_values_treated_as_zero(self):
        metrics = {"likes": None, "comments": None, "saves": None, "shares": None, "reach": 1000}
        assert compute_engagement_rate(metrics, "instagram") == 0.0


# ---------------------------------------------------------------------------
# compute_performance_score
# ---------------------------------------------------------------------------

class TestComputePerformanceScore:
    def test_empty_analytics(self):
        assert compute_performance_score({}) == 0.0
        assert compute_performance_score({"analytics": {}}) == 0.0

    def test_high_engagement_high_reach(self):
        entry = {
            "analytics": {
                "instagram": {
                    "engagement_rate": 12.0,
                    "views": 15000,
                    "reach": 12000,
                    "saves": 300,
                    "shares": 200,
                    "comments": 15,
                },
            }
        }
        score = compute_performance_score(entry)
        # engagement >= 10 → 4, impressions >= 10000 → 3, ss_rate (500/12000*100=4.16) >= 2 → 1, comments >= 10 → 1 = 9.0
        assert score == 9.0

    def test_moderate_engagement(self):
        entry = {
            "analytics": {
                "instagram": {
                    "engagement_rate": 3.0,
                    "views": 2000,
                    "reach": 1500,
                    "saves": 10,
                    "shares": 5,
                    "comments": 3,
                },
            }
        }
        score = compute_performance_score(entry)
        # engagement 2-5 → 2, impressions 1000-5000 → 1, ss_rate (15/1500*100=1.0) < 2 → 0, comments < 10 → 0 = 3.0
        assert score == 3.0

    def test_capped_at_10(self):
        entry = {
            "analytics": {
                "instagram": {
                    "engagement_rate": 15.0,
                    "views": 50000,
                    "reach": 40000,
                    "saves": 5000,
                    "shares": 5000,
                    "comments": 100,
                },
                "linkedin": {
                    "engagement_rate": 15.0,
                    "impressions": 50000,
                    "saves": None,
                    "shares": 5000,
                    "comments": 100,
                },
            }
        }
        score = compute_performance_score(entry)
        assert score == 10.0

    def test_skips_errored_platforms(self):
        entry = {
            "analytics": {
                "instagram": {"error": "not connected"},
                "linkedin": {
                    "engagement_rate": 5.0,
                    "impressions": 6000,
                    "saves": None,
                    "shares": 200,
                    "comments": 12,
                    "reach": None,
                },
            }
        }
        score = compute_performance_score(entry)
        # engagement 5-10 → 3, impressions 5000-10000 → 2, shares 200 / imp 6000 = 3.33% → 1, comments >= 10 → 1 = 7.0
        assert score == 7.0


# ---------------------------------------------------------------------------
# extract_linkedin_urn
# ---------------------------------------------------------------------------

class TestExtractLinkedinUrn:
    def test_activity_url(self):
        url = "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678"
        assert extract_linkedin_urn(url) == "urn:li:activity:7123456789012345678"

    def test_ugcpost_url(self):
        url = "https://www.linkedin.com/feed/update/urn:li:ugcPost:7123456789012345678"
        assert extract_linkedin_urn(url) == "urn:li:ugcPost:7123456789012345678"

    def test_share_url(self):
        url = "https://www.linkedin.com/feed/update/urn:li:share:7123456789012345678"
        assert extract_linkedin_urn(url) == "urn:li:share:7123456789012345678"

    def test_no_match_returns_none(self):
        assert extract_linkedin_urn("https://linkedin.com/in/johndoe") is None


# ---------------------------------------------------------------------------
# format_number
# ---------------------------------------------------------------------------

class TestFormatNumber:
    def test_none_returns_dash(self):
        assert format_number(None) == "—"

    def test_float_as_percentage(self):
        assert format_number(4.83) == "4.8%"

    def test_int_with_commas(self):
        assert format_number(12345) == "12,345"

    def test_zero(self):
        assert format_number(0) == "0"


# ---------------------------------------------------------------------------
# _is_cache_fresh
# ---------------------------------------------------------------------------

class TestIsCacheFresh:
    def test_no_fetched_at(self):
        assert _is_cache_fresh({}) is False

    def test_fresh_data(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        assert _is_cache_fresh({"fetched_at": now}) is True

    def test_stale_data(self):
        assert _is_cache_fresh({"fetched_at": "2020-01-01T00:00:00+00:00"}) is False

    def test_invalid_date(self):
        assert _is_cache_fresh({"fetched_at": "not-a-date"}) is False


# ---------------------------------------------------------------------------
# generate_dashboard (file output)
# ---------------------------------------------------------------------------

def _make_entries():
    return [
        {
            "id": "2026-05-10-test-reel",
            "type": "reel",
            "status": "published",
            "analytics": {
                "instagram": {"views": 5000, "reach": 4000, "likes": 200, "comments": 15,
                              "saves": 50, "shares": 20, "engagement_rate": 7.12},
                "linkedin": {"impressions": 3000, "likes": 30, "comments": 5,
                             "saves": None, "shares": 10, "engagement_rate": 1.5},
                "performance_score": 7.5,
            },
        },
        {
            "id": "2026-05-11-test-carousel",
            "type": "carousel",
            "status": "published",
            "analytics": {
                "instagram": {"views": 2000, "reach": 1500, "likes": 80, "comments": 5,
                              "saves": 20, "shares": 5, "engagement_rate": 7.33},
                "performance_score": 4.0,
            },
        },
    ]


class TestGenerateDashboard:
    def test_creates_dashboard_files(self, tmp_path):
        registry_path = tmp_path / "registry.json"
        registry_path.write_text(json.dumps(_make_entries()))
        vault = tmp_path / "vault"
        vault.mkdir()

        with patch("scripts.analytics.Registry") as MockReg:
            inst = MockReg.return_value
            inst.list.return_value = _make_entries()

            generate_dashboard(registry_path, vault)

        analytics_dir = vault / "analytics"
        assert (analytics_dir / "overview.md").exists()
        assert (analytics_dir / "performance-leaderboard.md").exists()
        assert (analytics_dir / "platform-comparison.md").exists()
        assert (analytics_dir / "content-type-analysis.md").exists()

        overview = (analytics_dir / "overview.md").read_text()
        assert "Analytics Overview" in overview
        assert "2" in overview  # total count

    def test_leaderboard_sorted_by_score(self, tmp_path):
        vault = tmp_path / "vault"
        vault.mkdir()

        with patch("scripts.analytics.Registry") as MockReg:
            inst = MockReg.return_value
            inst.list.return_value = _make_entries()

            generate_dashboard(tmp_path / "reg.json", vault)

        leaderboard = (vault / "analytics" / "performance-leaderboard.md").read_text()
        reel_pos = leaderboard.index("test-reel")
        carousel_pos = leaderboard.index("test-carousel")
        assert reel_pos < carousel_pos  # higher score first


# ---------------------------------------------------------------------------
# generate_insights (performance.md output)
# ---------------------------------------------------------------------------

class TestGenerateInsights:
    def test_creates_performance_module(self, tmp_path):
        vault = tmp_path / "vault"
        (vault / "brand" / "modules").mkdir(parents=True)

        with patch("scripts.analytics.Registry") as MockReg:
            inst = MockReg.return_value
            inst.list.return_value = _make_entries()

            generate_insights(tmp_path / "reg.json", vault)

        perf = vault / "brand" / "modules" / "performance.md"
        assert perf.exists()
        content = perf.read_text()
        assert "module: performance" in content
        assert "Performance Insights" in content
        assert "What Works" in content

    def test_no_data_skips(self, tmp_path, capsys):
        with patch("scripts.analytics.Registry") as MockReg:
            inst = MockReg.return_value
            inst.list.return_value = []

            generate_insights(tmp_path / "reg.json", tmp_path)

        output = capsys.readouterr().out
        assert "No analytics data" in output
