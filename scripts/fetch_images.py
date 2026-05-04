#!/usr/bin/env python3
import argparse
import base64
import os
from pathlib import Path
from typing import Optional

import openai


def generate_image(
    prompt: str, out_path: Path, api_key: Optional[str] = None
) -> Path:
    client = openai.OpenAI(api_key=api_key or os.environ["OPENAI_API_KEY"])
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size="1024x1792",  # portrait closest to 1080x1920
        n=1,
        response_format="b64_json",
    )
    image_data = base64.b64decode(response.data[0].b64_json)
    out_path.write_bytes(image_data)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt")
    parser.add_argument("out_path")
    args = parser.parse_args()
    result = generate_image(args.prompt, Path(args.out_path))
    print(str(result))
