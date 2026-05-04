import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.fetch_sfx import fetch_pixabay_sfx

PIXABAY_RESPONSE = {
    "hits": [{"previewURL": "https://example.com/sfx.mp3"}]
}


@patch("scripts.fetch_sfx.requests.get")
def test_returns_mp3_path_when_key_set(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PIXABAY_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_sfx.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_pixabay_sfx("whoosh", tmp_path, "beat-00-whoosh", api_key="test")

    assert result is not None
    assert str(result).endswith(".mp3")


@patch("scripts.fetch_sfx.requests.get")
def test_returns_none_when_no_hits(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"hits": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_pixabay_sfx("xyznotfound", tmp_path, "beat-00-xyz", api_key="test")
    assert result is None


def test_returns_none_when_no_api_key(tmp_path):
    result = fetch_pixabay_sfx("whoosh", tmp_path, "beat-00-whoosh", api_key=None)
    assert result is None
