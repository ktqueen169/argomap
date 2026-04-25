#!/usr/bin/env python3
import json
import pathlib
import sys
from urllib.parse import urlparse


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REGIONS_PATH = DATA_DIR / "regions.json"
LOCATIONS_PATH = DATA_DIR / "locations.json"
ALLOWED_CATEGORIES = {"shop", "residence", "academy", "tavern", "dungeon"}


def load_json(path: pathlib.Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        fail(f"Failed to read {path}: {exc}")
        return None


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

        if not isinstance(points, list) or len(points) < 3:
            fail(f"{where}: points must be an array of at least 3 [y,x] pairs")
        else:
            for j, pt in enumerate(points):
                if (
                    not isinstance(pt, list)
                    or len(pt) != 2
                    or not isinstance(pt[0], (int, float))
                    or not isinstance(pt[1], (int, float))
                ):
                    fail(f"{where}.points[{j}]: must be [number, number]")

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
    owner = floor.get("owner")
    if owner is not None:
        if not isinstance(owner, dict):
            fail(f"{where}.owner: must be an object")
        else:
            if not isinstance(owner.get("name"), str) or not owner.get("name", "").strip():
                fail(f"{where}.owner.name: missing/invalid")
            check_url(owner.get("url", ""), f"{where}.owner.url")


def validate_locations(locations, region_ids):
    if not isinstance(locations, list):
        fail("data/locations.json must be a JSON array")
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

        owner = loc.get("owner")
        if owner is not None:
            if not isinstance(owner, dict):
                fail(f"{where}.owner: must be an object")
            else:
                if not isinstance(owner.get("name"), str) or not owner.get("name", "").strip():
                    fail(f"{where}.owner.name: missing/invalid")
                check_url(owner.get("url", ""), f"{where}.owner.url")

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
    locations = load_json(LOCATIONS_PATH)
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

    print("Validation passed for data/regions.json and data/locations.json.")
