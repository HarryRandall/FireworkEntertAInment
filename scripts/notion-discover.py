#!/usr/bin/env python3
"""
Discover Notion pages under a root page and create stub markdown files
for any that don't already have a corresponding file in the repo.

Intended to run as a GitHub Actions step before YouXam/Notion-GitHub-Sync
so that newly-created Notion pages are automatically picked up.

Environment variables:
    NOTION_TOKEN          – Notion integration API key
    NOTION_ROOT_PAGE_ID   – UUID of the top-level Notion page to scan
    DOCS_DIR              – path to the docs directory (default: docs)
    DRY_RUN               – set to "true" to skip writing files
"""

import os
import re
import sys
import glob
import time
import unicodedata
from pathlib import Path

import requests
import yaml

NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
ROOT_PAGE_ID = os.environ.get("NOTION_ROOT_PAGE_ID", "")
DOCS_DIR = Path(os.environ.get("DOCS_DIR", "docs"))
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}
BASE_URL = "https://api.notion.com/v1"
UNSORTED_DIR = DOCS_DIR / "unsorted"


# ── Notion API helpers ────────────────────────────────────────────────


def get_page_title(page_id: str) -> str:
    """Retrieve a page's title via the Notion pages endpoint."""
    resp = requests.get(f"{BASE_URL}/pages/{page_id}", headers=HEADERS)
    resp.raise_for_status()
    props = resp.json().get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            return "".join(t["plain_text"] for t in prop.get("title", []))
    return "(untitled)"


def notion_url(page_id: str) -> str:
    """Build a Notion URL from a page ID."""
    return f"https://www.notion.so/{page_id.replace('-', '')}"


def get_children_blocks(block_id: str) -> list:
    """Paginate through all child blocks of a given block."""
    blocks: list = []
    cursor = None
    while True:
        params: dict = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        resp = requests.get(
            f"{BASE_URL}/blocks/{block_id}/children",
            headers=HEADERS,
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        blocks.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
        time.sleep(0.35)
    return blocks


def find_all_pages(block_id: str, depth: int = 0) -> list:
    """Recursively find all child_page and link_to_page blocks."""
    pages: list = []
    blocks = get_children_blocks(block_id)

    for block in blocks:
        btype = block.get("type")

        if btype == "child_page":
            bid = block["id"]
            title = block["child_page"]["title"]
            pages.append({
                "title": title,
                "id": bid,
                "depth": depth,
            })
            pages.extend(find_all_pages(bid, depth + 1))

        elif btype == "link_to_page":
            linked_id = block.get("link_to_page", {}).get("page_id")
            if linked_id:
                title = get_page_title(linked_id)
                pages.append({
                    "title": title,
                    "id": linked_id,
                    "depth": depth,
                    "linked": True,
                })

        elif block.get("has_children"):
            pages.extend(find_all_pages(block["id"], depth))

        time.sleep(0.15)

    return pages


# ── Local repo helpers ────────────────────────────────────────────────


def normalize_id(page_id: str) -> str:
    """Strip dashes and lowercase a page ID for consistent comparison."""
    return page_id.replace("-", "").lower()


def extract_known_page_ids(docs_dir: Path) -> set[str]:
    """
    Walk all markdown files under docs_dir and return a set of
    normalized Notion page IDs extracted from the notion-url front matter.
    """
    known: set[str] = set()
    pattern = str(docs_dir / "**" / "*.md")
    for filepath in glob.glob(pattern, recursive=True):
        try:
            text = Path(filepath).read_text(encoding="utf-8")
        except OSError:
            continue

        match = re.match(r"^---\s*\n(.+?)\n---", text, re.DOTALL)
        if not match:
            continue

        try:
            fm = yaml.safe_load(match.group(1))
        except yaml.YAMLError:
            continue

        url = (fm or {}).get("notion-url", "")
        if not url:
            continue

        # The last 32 hex chars of the URL path are the page ID.
        hex_match = re.search(r"([0-9a-f]{32})\s*$", url)
        if hex_match:
            known.add(hex_match.group(1).lower())

    return known


def slugify(title: str) -> str:
    """Convert a page title to a filesystem-safe slug."""
    title = unicodedata.normalize("NFKD", title)
    title = title.encode("ascii", "ignore").decode("ascii")
    title = title.lower()
    title = re.sub(r"[^a-z0-9]+", "-", title)
    title = title.strip("-")
    return title or "untitled"


def build_notion_url_with_title(title: str, page_id: str) -> str:
    """
    Reconstruct a Notion-style URL:  https://www.notion.so/Title-Slug-<id>
    This matches the format the sync action expects.
    """
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-")
    clean_id = page_id.replace("-", "")
    return f"https://www.notion.so/{slug}-{clean_id}"


def create_stub(page: dict) -> Path:
    """Write a stub markdown file for a Notion page and return its path."""
    slug = slugify(page["title"])
    dest = UNSORTED_DIR / f"{slug}.md"

    # Avoid clobbering if a file with the same slug already exists.
    counter = 2
    while dest.exists():
        dest = UNSORTED_DIR / f"{slug}-{counter}.md"
        counter += 1

    url = build_notion_url_with_title(page["title"], page["id"])
    content = (
        f"---\n"
        f"notion-url: {url}\n"
        f"title: \"{page['title']}\"\n"
        f"---\n"
    )

    if not DRY_RUN:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")

    return dest


# ── Main ──────────────────────────────────────────────────────────────


def main() -> None:
    if not NOTION_TOKEN:
        print("ERROR: NOTION_TOKEN environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not ROOT_PAGE_ID:
        print("ERROR: NOTION_ROOT_PAGE_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning Notion page {ROOT_PAGE_ID} …")
    all_pages = find_all_pages(ROOT_PAGE_ID)
    print(f"Found {len(all_pages)} pages in Notion.\n")

    known_ids = extract_known_page_ids(DOCS_DIR)
    print(f"Found {len(known_ids)} pages already tracked in {DOCS_DIR}/.\n")

    created = 0
    for page in all_pages:
        nid = normalize_id(page["id"])
        if nid in known_ids:
            continue

        dest = create_stub(page)
        tag = "[dry-run] " if DRY_RUN else ""
        linked = " (linked)" if page.get("linked") else ""
        print(f"  {tag}Created stub: {dest}  ←  {page['title']}{linked}")
        created += 1

    print(f"\nDone. {created} new stub(s) created.")


if __name__ == "__main__":
    main()
