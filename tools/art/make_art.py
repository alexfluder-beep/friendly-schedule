"""Make the avatar and badge pictures for Friendly Schedule with Gemini, once.

Run on the bot server (it already has GEMINI_API_KEY in its .env):
    GEMINI_API_KEY=... python3 tools/art/make_art.py            # all pictures
    python3 tools/art/make_art.py --only avatars --limit 3       # a small test first

Pictures go to tools/art/out/avatars/<id>.png and tools/art/out/badges/<id>.png.
A picture that already exists is skipped, so the script can be stopped and started again.
Only the Python standard library is used. The key is read from the environment and never written anywhere.
Model: GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image). Each picture costs a few US cents.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def ask(prompt: str, key: str, model: str) -> bytes:
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}}}).encode()
    req = urllib.request.Request(API.format(model=model), data=body, method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    for cand in data.get("candidates", []):
        for part in (cand.get("content") or {}).get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob and blob.get("data"):
                return base64.b64decode(blob["data"])
    raise RuntimeError("no picture in the answer: " + json.dumps(data)[:300])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["avatars", "badges"])
    ap.add_argument("--limit", type=int, default=0, help="make at most this many new pictures")
    ap.add_argument("--redo", default="", help="comma-separated ids to make again")
    a = ap.parse_args()
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        print("GEMINI_API_KEY is not set (it is in the bot .env).")
        return 1
    model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image").strip()
    spec = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
    jobs = []
    if a.only in (None, "avatars"):
        jobs += [("avatars", x["id"], f"{spec['style']['avatar']} Subject: {x['subject']}.") for x in spec["avatars"]]
    if a.only in (None, "badges"):
        jobs += [("badges", x["id"], f"{spec['style']['badge']} Badge \"{x['name']}\": {x['idea']}. Show it as a symbol, not as words.") for x in spec["badges"]]
    redo = {x.strip() for x in a.redo.split(",") if x.strip()}
    made = failed = 0
    for kind, pid, prompt in jobs:
        out = HERE / "out" / kind / f"{pid}.png"
        if out.exists() and pid not in redo:
            continue
        if a.limit and made >= a.limit:
            break
        out.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(4):
            try:
                out.write_bytes(ask(prompt, key, model))
                made += 1
                print(f"ok   {kind}/{pid}")
                break
            except urllib.error.HTTPError as e:
                wait = 20 * (attempt + 1) if e.code in (429, 500, 503) else 0
                print(f"{e.code} {kind}/{pid} {e.read()[:200]!r}")
                if not wait:
                    break
                time.sleep(wait)
            except Exception as e:  # noqa: BLE001 (one bad picture must not stop the rest)
                print(f"fail {kind}/{pid}: {e}")
                time.sleep(5)
        else:
            failed += 1
        time.sleep(2)
    total = sum(1 for _ in (HERE / "out").rglob("*.png")) if (HERE / "out").exists() else 0
    print(f"new {made}, failed {failed}, pictures in out/: {total} of {len(jobs)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
