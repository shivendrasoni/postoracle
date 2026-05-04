import base64
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.fetch_images import generate_image

FAKE_PNG = base64.b64encode(b"fakepngbytes").decode()


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_writes_file(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "beat-00-sunset.png"
    result = generate_image("a sunset over mountains", out_path, api_key="test")

    assert result == out_path
    assert out_path.exists()
    assert out_path.read_bytes() == base64.b64decode(FAKE_PNG)


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_uses_portrait_size(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "out.png"
    generate_image("robot working", out_path, api_key="test")

    call_kwargs = mock_client.images.generate.call_args[1]
    assert call_kwargs["size"] in ("1024x1792", "1792x1024")
    assert "1792" in call_kwargs["size"]


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_uses_gpt_image_model(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "out.png"
    generate_image("abstract tech", out_path, api_key="test")

    call_kwargs = mock_client.images.generate.call_args[1]
    assert "gpt-image" in call_kwargs["model"]
