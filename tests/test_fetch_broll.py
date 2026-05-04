import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.fetch_broll import fetch_video, fetch_photo

PEXELS_VIDEO_RESPONSE = {
    "videos": [{
        "id": 1,
        "video_files": [
            {"quality": "hd", "file_type": "video/mp4", "link": "https://example.com/video.mp4"}
        ]
    }]
}

PEXELS_PHOTO_RESPONSE = {
    "photos": [{
        "id": 1,
        "src": {"portrait": "https://example.com/photo.jpg"}
    }]
}


@patch("scripts.fetch_broll.requests.get")
def test_fetch_video_returns_mp4_path(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PEXELS_VIDEO_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_broll.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_video("sunset", tmp_path, "beat-00-sunset", api_key="test")

    assert result is not None
    assert str(result).endswith(".mp4")


@patch("scripts.fetch_broll.requests.get")
def test_fetch_video_returns_none_when_empty(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"videos": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_video("xyznotfound", tmp_path, "beat-00-xyz", api_key="test")
    assert result is None


@patch("scripts.fetch_broll.requests.get")
def test_fetch_photo_returns_jpg_path(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PEXELS_PHOTO_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_broll.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_photo("city", tmp_path, "beat-01-city", api_key="test")

    assert result is not None
    assert str(result).endswith(".jpg")


@patch("scripts.fetch_broll.requests.get")
def test_fetch_photo_returns_none_when_empty(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"photos": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_photo("xyznotfound", tmp_path, "beat-01-xyz", api_key="test")
    assert result is None
