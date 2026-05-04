"""
Tests for scripts/brand_voice.py
"""
import textwrap
from datetime import date, timedelta
from pathlib import Path

import pytest
import yaml

from scripts.brand_voice import (
    MODULES,
    compile_master,
    module_path,
    module_status,
    parse_module_file,
    read_module,
    write_module,
)


# ---------------------------------------------------------------------------
# parse_module_file
# ---------------------------------------------------------------------------

def test_parse_module_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        module: cta
        last_updated: 2026-05-05
        ---

        ## CTA Philosophy

        Low-friction engagement first.
    """)
    fm, body = parse_module_file(content)
    assert fm["module"] == "cta"
    assert fm["last_updated"] == date(2026, 5, 5)
    assert "CTA Philosophy" in body


def test_parse_module_file_no_frontmatter_returns_empty_dict():
    content = "Just a plain body with no frontmatter."
    fm, body = parse_module_file(content)
    assert fm == {}
    assert body == content


def test_parse_module_file_nested_frontmatter():
    content = textwrap.dedent("""\
        ---
        module: watermark
        elements:
          - type: handle
            value: "@shivendra"
        position: 6
        opacity: 0.85
        ---

        Watermark notes here.
    """)
    fm, body = parse_module_file(content)
    assert fm["position"] == 6
    assert fm["elements"][0]["type"] == "handle"
    assert "Watermark notes" in body


# ---------------------------------------------------------------------------
# write_module + read_module
# ---------------------------------------------------------------------------

def test_write_module_creates_file(tmp_path):
    content = "---\nmodule: niche\nlast_updated: 2026-05-05\n---\n\nBody here."
    path = write_module(tmp_path, "niche", content)
    assert path.exists()
    assert path.read_text(encoding="utf-8") == content


def test_write_module_creates_parent_dirs(tmp_path):
    # vault dir does not exist yet
    vault = tmp_path / "vault"
    write_module(vault, "goals", "---\nmodule: goals\n---\n\nBody.")
    assert (vault / "brand" / "modules" / "goals.md").exists()


def test_read_module_returns_frontmatter_and_body(tmp_path):
    content = "---\nmodule: style\nlast_updated: 2026-05-05\n---\n\nStyle body."
    write_module(tmp_path, "style", content)
    fm, body = read_module(tmp_path, "style")
    assert fm["module"] == "style"
    assert "Style body" in body


def test_read_module_raises_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_module(tmp_path, "niche")


# ---------------------------------------------------------------------------
# module_status
# ---------------------------------------------------------------------------

def test_module_status_not_started_when_file_missing(tmp_path):
    status, last = module_status(tmp_path, "niche")
    assert status == "not_started"
    assert last is None


def test_module_status_complete_when_recently_updated(tmp_path):
    today = date.today().isoformat()
    content = f"---\nmodule: niche\nlast_updated: {today}\n---\n\nBody."
    write_module(tmp_path, "niche", content)
    status, last = module_status(tmp_path, "niche")
    assert status == "complete"
    assert last == date.today()


def test_module_status_stale_when_over_30_days(tmp_path):
    old_date = (date.today() - timedelta(days=31)).isoformat()
    content = f"---\nmodule: goals\nlast_updated: {old_date}\n---\n\nBody."
    write_module(tmp_path, "goals", content)
    status, _ = module_status(tmp_path, "goals")
    assert status == "stale"


def test_module_status_complete_when_no_date_field(tmp_path):
    write_module(tmp_path, "brand", "---\nmodule: brand\n---\n\nBody.")
    status, last = module_status(tmp_path, "brand")
    assert status == "complete"
    assert last is None


# ---------------------------------------------------------------------------
# compile_master
# ---------------------------------------------------------------------------

def test_compile_master_creates_brand_voice_md(tmp_path):
    today = date.today().isoformat()
    write_module(tmp_path, "niche", f"---\nmodule: niche\ncreator_name: TestCreator\nlast_updated: {today}\n---\n\nNiche body.")
    write_module(tmp_path, "style", f"---\nmodule: style\nlast_updated: {today}\n---\n\nStyle body.")
    for mod in ["competitors", "goals", "cta", "watermark", "brand"]:
        write_module(tmp_path, mod, f"---\nmodule: {mod}\nlast_updated: {today}\n---\n\n{mod} body.")

    master = compile_master(tmp_path)
    assert master.exists()
    text = master.read_text(encoding="utf-8")
    assert "# Brand Voice — TestCreator" in text
    assert "## Niche" in text
    assert "## Brand Identity" in text
    assert "Niche body." in text


def test_compile_master_shows_not_configured_for_missing_module(tmp_path):
    master = compile_master(tmp_path)
    text = master.read_text(encoding="utf-8")
    assert "_Not configured_" in text


def test_compile_master_includes_last_updated_date(tmp_path):
    master = compile_master(tmp_path)
    text = master.read_text(encoding="utf-8")
    assert f"Last updated: {date.today().isoformat()}" in text
