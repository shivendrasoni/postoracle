#!/usr/bin/env python3
import os
import sys
from typing import Optional

REQUIRED = ["PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY"]
OPTIONAL = ["PIXABAY_API_KEY", "ELEVENLABS_API_KEY"]


def check_env(env: Optional[dict] = None) -> tuple[list[str], list[str]]:
    e = env if env is not None else dict(os.environ)
    missing = [k for k in REQUIRED if not e.get(k)]
    missing_optional = [k for k in OPTIONAL if not e.get(k)]
    return missing, missing_optional


if __name__ == "__main__":
    missing, missing_optional = check_env()
    if missing_optional:
        print(f"[INFO] Optional keys not set (SFX skipped): {', '.join(missing_optional)}", file=sys.stderr)
    if missing:
        print(f"[ERROR] Missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    print("Environment OK")
