#!/usr/bin/env python3
"""
Discover Notion pages under a root page and create fully-populated
markdown files for any that don't already exist in the repo.

Fetches page content from the Notion API and converts it to markdown,
so the resulting PR contains complete documents (not empty stubs).

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
    resp = requests.get(f"{BASE_URL}/pages/{page_id}", headers=HEADERS)
    resp.raise_for_status()
    props = resp.json().get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            return "".join(t["plain_text"] for t in prop.get("title", []))
    return "(untitled)"


def get_page_metadata(page_id: str) -> dict:
    resp = requests.get(f"{BASE_URL}/pages/{page_id}", headers=HEADERS)
    resp.raise_for_status()
    data = resp.json()
    return {
        "created_time": data.get("created_time", ""),
        "last_edited_time": data.get("last_edited_time", ""),
    }


def notion_url(page_id: str) -> str:
    return f"https://www.notion.so/{page_id.replace('-', '')}"


def get_children_blocks(block_id: str) -> list:
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


# ── Notion blocks → Markdown conversion ──────────────────────────────


def rich_text_to_md(rich_texts: list) -> str:
    """Convert a Notion rich_text array to a markdown string."""
    parts: list[str] = []
    for rt in rich_texts:
        text = rt.get("plain_text", "")
        if not text:
            continue
        href = rt.get("href")
        annot = rt.get("annotations", {})

        if annot.get("code"):
            text = f"`{text}`"
        if annot.get("bold"):
            text = f"**{text}**"
        if annot.get("italic"):
            text = f"*{text}*"
        if annot.get("strikethrough"):
            text = f"~~{text}~~"
        if href:
            text = f"[{text}]({href})"

        parts.append(text)
    return "".join(parts)


def blocks_to_markdown(blocks: list, indent: int = 0) -> str:
    """Convert a list of Notion blocks to markdown text."""
    lines: list[str] = []
    prefix = "  " * indent
    numbered_counter = 0

    for block in blocks:
        btype = block.get("type", "")
        data = block.get(btype, {})
        rtext = data.get("rich_text", [])
        text = rich_text_to_md(rtext)

        if btype.startswith("heading_"):
            level = int(btype[-1])
            lines.append(f"\n{'#' * level} {text}\n")
            numbered_counter = 0

        elif btype == "paragraph":
            lines.append(f"{prefix}{text}\n")
            numbered_counter = 0

        elif btype == "bulleted_list_item":
            lines.append(f"{prefix}- {text}")
            numbered_counter = 0

        elif btype == "numbered_list_item":
            numbered_counter += 1
            lines.append(f"{prefix}{numbered_counter}. {text}")

        elif btype == "to_do":
            checked = data.get("checked", False)
            mark = "x" if checked else " "
            lines.append(f"{prefix}- [{mark}] {text}")
            numbered_counter = 0

        elif btype == "quote":
            for line in text.split("\n"):
                lines.append(f"{prefix}> {line}")
            numbered_counter = 0

        elif btype == "callout":
            icon = data.get("icon", {}).get("emoji", "")
            for i, line in enumerate(text.split("\n")):
                leader = f"> {icon} " if i == 0 and icon else "> "
                lines.append(f"{prefix}{leader}{line}")
            numbered_counter = 0

        elif btype == "code":
            lang = data.get("language", "")
            lines.append(f"\n{prefix}```{lang}")
            lines.append(f"{prefix}{text}")
            lines.append(f"{prefix}```\n")
            numbered_counter = 0

        elif btype == "divider":
            lines.append(f"\n{prefix}---\n")
            numbered_counter = 0

        elif btype == "image":
            img_data = data
            url = ""
            if img_data.get("type") == "file":
                url = img_data.get("file", {}).get("url", "")
            elif img_data.get("type") == "external":
                url = img_data.get("external", {}).get("url", "")
            caption = rich_text_to_md(img_data.get("caption", []))
            lines.append(f"{prefix}![{caption}]({url})")
            numbered_counter = 0

        elif btype == "bookmark":
            url = data.get("url", "")
            caption = rich_text_to_md(data.get("caption", []))
            label = caption or url
            lines.append(f"{prefix}[{label}]({url})")
            numbered_counter = 0

        elif btype == "table":
            lines.append(self_render_table(block))
            numbered_counter = 0

        elif btype == "child_page":
            title = data.get("title", "")
            child_id = block.get("id", "").replace("-", "")
            lines.append(f"{prefix}[{title}](https://www.notion.so/{child_id})")
            numbered_counter = 0

        elif btype == "toggle":
            lines.append(f"\n{prefix}<details>")
            lines.append(f"{prefix}<summary>{text}</summary>\n")
            if block.get("has_children"):
                children = get_children_blocks(block["id"])
                time.sleep(0.15)
                lines.append(blocks_to_markdown(children, indent + 1))
            lines.append(f"{prefix}</details>\n")
            numbered_counter = 0

        elif btype == "column_list":
            if block.get("has_children"):
                children = get_children_blocks(block["id"])
                time.sleep(0.15)
                for child in children:
                    if child.get("has_children"):
                        col_blocks = get_children_blocks(child["id"])
                        time.sleep(0.15)
                        lines.append(blocks_to_markdown(col_blocks, indent))
            numbered_counter = 0

        else:
            if text:
                lines.append(f"{prefix}{text}")
            numbered_counter = 0

        if btype not in ("numbered_list_item",):
            numbered_counter = 0

        if block.get("has_children") and btype not in (
            "toggle", "column_list", "table", "child_page",
        ):
            children = get_children_blocks(block["id"])
            time.sleep(0.15)
            lines.append(blocks_to_markdown(children, indent + 1))

    return "\n".join(lines)


def self_render_table(table_block: dict) -> str:
    """Fetch table rows and render as a markdown table."""
    rows = get_children_blocks(table_block["id"])
    time.sleep(0.15)
    if not rows:
        return ""

    md_rows: list[str] = []
    for i, row in enumerate(rows):
        cells = row.get("table_row", {}).get("cells", [])
        cell_texts = [rich_text_to_md(cell) for cell in cells]
        md_rows.append("| " + " | ".join(cell_texts) + " |")
        if i == 0:
            md_rows.append("| " + " | ".join("----" for _ in cells) + " |")

    return "\n".join(md_rows)


def fetch_page_content(page_id: str) -> str:
    """Fetch all blocks for a page and convert to markdown."""
    blocks = get_children_blocks(page_id)
    time.sleep(0.15)
    return blocks_to_markdown(blocks)


# ── Local repo helpers ────────────────────────────────────────────────


def normalize_id(page_id: str) -> str:
    return page_id.replace("-", "").lower()


def extract_known_page_ids(docs_dir: Path) -> set[str]:
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

        hex_match = re.search(r"([0-9a-f]{32})\s*$", url)
        if hex_match:
            known.add(hex_match.group(1).lower())

    return known


def slugify(title: str) -> str:
    title = unicodedata.normalize("NFKD", title)
    title = title.encode("ascii", "ignore").decode("ascii")
    title = title.lower()
    title = re.sub(r"[^a-z0-9]+", "-", title)
    title = title.strip("-")
    return title or "untitled"


def build_notion_url_with_title(title: str, page_id: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-")
    clean_id = page_id.replace("-", "")
    return f"https://www.notion.so/{slug}-{clean_id}"


def create_page(page: dict) -> Path:
    """Fetch content from Notion and write a complete markdown file."""
    slug = slugify(page["title"])
    dest = UNSORTED_DIR / f"{slug}.md"

    counter = 2
    while dest.exists():
        dest = UNSORTED_DIR / f"{slug}-{counter}.md"
        counter += 1

    url = build_notion_url_with_title(page["title"], page["id"])
    meta = get_page_metadata(page["id"])
    time.sleep(0.15)

    print(f"    Fetching content for: {page['title']} …")
    body = fetch_page_content(page["id"])

    front_matter = (
        f"---\n"
        f"notion-url: {url}\n"
        f"title: \"{page['title']}\"\n"
        f"from_notion: {url}\n"
        f"author: From Notion\n"
        f"last_edited_time: '{meta['last_edited_time']}'\n"
        f"---\n"
    )

    content = front_matter + body + "\n"

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

        dest = create_page(page)
        tag = "[dry-run] " if DRY_RUN else ""
        linked = " (linked)" if page.get("linked") else ""
        print(f"  {tag}Created: {dest}  ←  {page['title']}{linked}")
        created += 1

    print(f"\nDone. {created} new page(s) created.")


if __name__ == "__main__":
    main()
