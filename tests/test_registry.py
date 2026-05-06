import json
import pytest
from scripts.registry import Registry


def _sample_entry(**overrides):
    base = {
        "id": "2026-05-06-test-post",
        "type": "post",
        "topic": "Test topic",
        "source_url": None,
        "platforms": ["instagram"],
        "status": "draft",
        "virality_score": None,
        "created_at": "2026-05-06T12:00:00Z",
        "scheduled_at": None,
        "published_at": {},
        "published_urls": {},
        "session_dir": "vault/outputs/posts/2026-05-06-test-post",
        "tags": [],
    }
    base.update(overrides)
    return base


def test_add_creates_file_and_stores_entry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    entry = _sample_entry()
    reg.add(entry)
    assert (tmp_path / "registry.json").exists()
    data = json.loads((tmp_path / "registry.json").read_text())
    assert len(data) == 1
    assert data[0]["id"] == "2026-05-06-test-post"


def test_add_appends_to_existing(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    reg.add(_sample_entry(id="post-2"))
    data = json.loads((tmp_path / "registry.json").read_text())
    assert len(data) == 2


def test_add_duplicate_id_raises(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    with pytest.raises(ValueError, match="already exists"):
        reg.add(_sample_entry(id="post-1"))


def test_get_returns_entry_by_id(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", topic="First"))
    result = reg.get("post-1")
    assert result is not None
    assert result["topic"] == "First"


def test_get_returns_none_for_missing(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    assert reg.get("nonexistent") is None


def test_get_on_empty_registry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    assert reg.get("anything") is None


def test_list_returns_all_when_no_filters(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    reg.add(_sample_entry(id="post-2"))
    assert len(reg.list()) == 2


def test_list_filters_by_status(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", status="draft"))
    reg.add(_sample_entry(id="post-2", status="published"))
    results = reg.list(status="draft")
    assert len(results) == 1
    assert results[0]["id"] == "post-1"


def test_list_filters_by_type(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", type="post"))
    reg.add(_sample_entry(id="carousel-1", type="carousel"))
    results = reg.list(type="carousel")
    assert len(results) == 1
    assert results[0]["id"] == "carousel-1"


def test_list_filters_by_platform(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", platforms=["instagram"]))
    reg.add(_sample_entry(id="post-2", platforms=["instagram", "linkedin"]))
    results = reg.list(platform="linkedin")
    assert len(results) == 1
    assert results[0]["id"] == "post-2"


def test_list_combines_filters(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", type="post", status="draft"))
    reg.add(_sample_entry(id="carousel-1", type="carousel", status="draft"))
    reg.add(_sample_entry(id="post-2", type="post", status="published"))
    results = reg.list(type="post", status="draft")
    assert len(results) == 1
    assert results[0]["id"] == "post-1"


def test_list_empty_registry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    assert reg.list() == []


def test_update_changes_status(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", status="draft"))
    reg.update("post-1", {"status": "published"})
    assert reg.get("post-1")["status"] == "published"


def test_update_merges_published_at(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", published_at={}))
    reg.update("post-1", {
        "published_at": {"instagram": "2026-05-06T18:00:00Z"},
        "published_urls": {"instagram": "https://instagram.com/p/123"},
    })
    result = reg.get("post-1")
    assert result["published_at"]["instagram"] == "2026-05-06T18:00:00Z"
    assert result["published_urls"]["instagram"] == "https://instagram.com/p/123"


def test_update_nonexistent_raises(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    with pytest.raises(KeyError, match="not found"):
        reg.update("nonexistent", {"status": "published"})


def test_update_preserves_other_fields(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", topic="Original topic", status="draft"))
    reg.update("post-1", {"status": "scheduled"})
    result = reg.get("post-1")
    assert result["topic"] == "Original topic"
    assert result["status"] == "scheduled"
