#!/usr/bin/env python3
import json
import pathlib
import sys
from urllib.parse import urlparse


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REGIONS_PATH = DATA_DIR / "regions.json"
LOCATIONS_PATH = DATA_DIR / "locations.json"
LOCATIONS_SPLIT_DIR = DATA_DIR / "locations"
ALLOWED_CATEGORIES = {
    "shop",
    "food-drink",
    "residences",
    "schools",
    "parks",
    "farms",
    "government",
    "services",
    "entertainment",
    "other",
}


def load_json(path: pathlib.Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        fail(f"Failed to read {path}: {exc}")
        return None


def load_locations():
    if LOCATIONS_SPLIT_DIR.exists() and LOCATIONS_SPLIT_DIR.is_dir():
        locations = []
        json_files = sorted(
            path
            for path in LOCATIONS_SPLIT_DIR.glob("*.json")
            if path.name != "index.json"
        )
        if not json_files:
            fail("data/locations exists but has no .json files")
            return None
        for path in json_files:
            payload = load_json(path)
            if payload is None:
                return None
            if not isinstance(payload, list):
                fail(f"{path.relative_to(ROOT)} must be a JSON array")
                continue
            locations.extend(payload)
        return locations
    return load_json(LOCATIONS_PATH)


def fail(msg: str):
    ERRORS.append(msg)


def warn(msg: str):
    WARNINGS.append(msg)


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def check_url(value: str, where: str):
    if not value:
        return
    if not is_http_url(value):
        fail(f"{where}: invalid URL '{value}'")


def check_image_path(value: str, where: str):
    if not value:
        return
    path = ROOT / value
    if not path.exists():
        fail(f"{where}: image path does not exist '{value}'")


def validate_owner(owner, where: str):
    if owner is None:
        return
    if not isinstance(owner, dict):
        fail(f"{where}: must be an object")
        return
    if not isinstance(owner.get("name"), str) or not owner.get("name", "").strip():
        fail(f"{where}.name: missing/invalid")
    check_url(owner.get("url", ""), f"{where}.url")


def validate_regions(regions):
    if not isinstance(regions, list):
        fail("data/regions.json must be a JSON array")
        return set()

    ids = set()
    for i, region in enumerate(regions):
        where = f"regions[{i}]"
        if not isinstance(region, dict):
            fail(f"{where}: must be an object")
            continue

        rid = region.get("id")
        label = region.get("label")
        points = region.get("points")
        if not isinstance(rid, str) or not rid.strip():
            fail(f"{where}: missing/invalid id")
            continue
        if rid in ids:
            fail(f"{where}: duplicate region id '{rid}'")
        ids.add(rid)

        if not isinstance(label, str) or not label.strip():
            fail(f"{where}: missing/invalid label")

        if not isinstance(points, list) or len(points) == 0:
            fail(
                f"{where}: points must be either a ring [[y,x],...] or rings [[[y,x],...],...]"
            )
        else:
            first = points[0] if points else None
            is_single_ring = (
                isinstance(first, list)
                and len(first) == 2
                and isinstance(first[0], (int, float))
                and isinstance(first[1], (int, float))
            )

            rings = [points] if is_single_ring else points
            for j, ring in enumerate(rings):
                ring_where = (
                    f"{where}.points[{j}]" if not is_single_ring else f"{where}.points"
                )
                if not isinstance(ring, list) or len(ring) < 3:
                    fail(
                        f"{ring_where}: must contain at least 3 [number, number] points"
                    )
                    continue
                for k, pt in enumerate(ring):
                    if (
                        not isinstance(pt, list)
                        or len(pt) != 2
                        or not isinstance(pt[0], (int, float))
                        or not isinstance(pt[1], (int, float))
                    ):
                        fail(f"{ring_where}[{k}]: must be [number, number]")

        check_url(region.get("link", ""), f"{where}.link")
        check_image_path(region.get("img", ""), f"{where}.img")

    return ids


def validate_floor(floor, where: str):
    if not isinstance(floor, dict):
        fail(f"{where}: must be an object")
        return
    name = floor.get("name")
    if not isinstance(name, str) or not name.strip():
        fail(f"{where}: missing/invalid name")
    check_url(floor.get("link", ""), f"{where}.link")
    check_image_path(floor.get("img", ""), f"{where}.img")
    validate_owner(floor.get("owner"), f"{where}.owner")


def validate_locations(locations, region_ids):
    if not isinstance(locations, list):
        fail("locations data must be a JSON array")
        return

    ids = set()
    for i, loc in enumerate(locations):
        where = f"locations[{i}]"
        if not isinstance(loc, dict):
            fail(f"{where}: must be an object")
            continue

        lid = loc.get("id")
        if not isinstance(lid, str) or not lid.strip():
            fail(f"{where}: missing/invalid id")
            continue
        if lid in ids:
            fail(f"{where}: duplicate location id '{lid}'")
        ids.add(lid)

        if not isinstance(loc.get("name"), str) or not loc.get("name", "").strip():
            fail(f"{where}: missing/invalid name")

        cat = loc.get("cat")
        if cat not in ALLOWED_CATEGORIES:
            fail(f"{where}: invalid category '{cat}'")

        region = loc.get("region")
        if region and region not in region_ids:
            fail(f"{where}: unknown region '{region}'")

        pos = loc.get("pos")
        if (
            not isinstance(pos, list)
            or len(pos) != 2
            or not isinstance(pos[0], (int, float))
            or not isinstance(pos[1], (int, float))
        ):
            fail(f"{where}: pos must be [number, number]")

        check_url(loc.get("link", ""), f"{where}.link")
        check_image_path(loc.get("img", ""), f"{where}.img")

        validate_owner(loc.get("owner"), f"{where}.owner")

        floors = loc.get("floors")
        if floors is not None:
            if not isinstance(floors, list):
                fail(f"{where}.floors: must be an array")
            else:
                for j, floor in enumerate(floors):
                    validate_floor(floor, f"{where}.floors[{j}]")


if __name__ == "__main__":
    ERRORS = []
    WARNINGS = []

    regions = load_json(REGIONS_PATH)
    locations = load_locations()
    if regions is None or locations is None:
        sys.exit(1)

    region_ids = validate_regions(regions)
    validate_locations(locations, region_ids)

    for msg in WARNINGS:
        print(f"[WARN] {msg}")

    if ERRORS:
        for msg in ERRORS:
            print(f"[ERROR] {msg}")
        print(f"Validation failed with {len(ERRORS)} error(s).")
        sys.exit(1)

    print("Validation passed for data/regions.json and data/locations/*.json.")
