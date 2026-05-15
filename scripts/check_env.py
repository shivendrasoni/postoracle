#!/usr/bin/env python3
import os
import sys
from typing import Optional

REQUIRED = ["PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY"]
OPTIONAL = ["PIXABAY_API_KEY", "ELEVENLABS_API_KEY", "INSTAGRAM_SESSION_ID", "INSTAGRAM_CSRF_TOKEN", "INSTAGRAM_DS_USER_ID"]

EDIT_RAW_REQUIRED = ["PEXELS_API_KEY", "ELEVENLABS_API_KEY"]
EDIT_RAW_OPTIONAL = ["PIXABAY_API_KEY"]

HEYGEN_BASIC_REQUIRED = ["PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY", "ELEVENLABS_API_KEY"]
HEYGEN_BASIC_OPTIONAL = ["PIXABAY_API_KEY"]


def check_env(env: Optional[dict] = None) -> tuple[list[str], list[str]]:
    e = env if env is not None else dict(os.environ)
    missing = [k for k in REQUIRED if not e.get(k)]
    missing_optional = [k for k in OPTIONAL if not e.get(k)]
    return missing, missing_optional


def check_env_edit_raw(env: Optional[dict] = None) -> tuple[list[str], list[str]]:
    e = env if env is not None else dict(os.environ)
    missing = [k for k in EDIT_RAW_REQUIRED if not e.get(k)]
    missing_optional = [k for k in EDIT_RAW_OPTIONAL if not e.get(k)]
    return missing, missing_optional


def check_env_heygen_basic(env: Optional[dict] = None) -> tuple[list[str], list[str]]:
    e = env if env is not None else dict(os.environ)
    missing = [k for k in HEYGEN_BASIC_REQUIRED if not e.get(k)]
    missing_optional = [k for k in HEYGEN_BASIC_OPTIONAL if not e.get(k)]
    return missing, missing_optional


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "default"

    if mode == "edit-raw":
        missing, missing_optional = check_env_edit_raw()
    elif mode == "heygen-basic":
        missing, missing_optional = check_env_heygen_basic()
    else:
        missing, missing_optional = check_env()

    if missing_optional:
        print(f"[INFO] Optional keys not set: {', '.join(missing_optional)}", file=sys.stderr)
    if missing:
        print(f"[ERROR] Missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    print("Environment OK")
