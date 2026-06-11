#!/usr/bin/env python3
import json
import pathlib
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SPLIT_DIR = DATA_DIR / "locations"
OUT_PATH = DATA_DIR / "locations.json"


def load_json(path: pathlib.Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main():
    if not SPLIT_DIR.exists() or not SPLIT_DIR.is_dir():
        print(f"Missing split locations directory: {SPLIT_DIR}")
        return 1

    merged = []
    files = sorted(path for path in SPLIT_DIR.glob("*.json") if path.name != "index.json")
    for path in files:
        payload = load_json(path)
        if not isinstance(payload, list):
            print(f"Expected JSON array in {path}")
            return 1
        merged.extend(payload)

    merged.sort(key=lambda loc: ((loc.get("district") or "").lower(), (loc.get("name") or "").lower(), loc.get("id") or ""))
    OUT_PATH.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(merged)} locations to {OUT_PATH.relative_to(ROOT)} from {len(files)} split files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
