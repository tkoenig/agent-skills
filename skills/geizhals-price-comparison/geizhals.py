#!/usr/bin/env python3
"""Geizhals.at search and offer extraction helper.

Commands:
  geizhals.py search "query" [--limit 5] [--json]
  geizhals.py offers URL [URL ...] [--limit 10] [--json]

No third-party dependencies.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BASE = "https://geizhals.at"
SCHEMA_VERSION = "1.0"
CACHE_TTL_SECONDS = 900

BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
    "Referer": "https://geizhals.at/",
}

ACS_HEADERS = {
    **BASE_HEADERS,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://geizhals.at",
    "X-Requested-With": "XMLHttpRequest",
}


class FetchError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def _cache_path(cache_dir: Path, url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return cache_dir / f"{digest}.txt"


def _is_retryable_status(status: int | None) -> bool:
    return status in {403, 408, 409, 425, 429, 500, 502, 503, 504}


def fetch_text(
    url: str,
    timeout: int = 20,
    extra_headers: dict[str, str] | None = None,
    retries: int = 3,
    backoff_base: float = 0.6,
    cache_dir: Path | None = None,
    cache_ttl_seconds: int = CACHE_TTL_SECONDS,
    debug: bool = False,
) -> str:
    if cache_dir is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cp = _cache_path(cache_dir, url)
        if cp.exists() and (time.time() - cp.stat().st_mtime) < cache_ttl_seconds:
            if debug:
                print(f"[debug] cache hit {url}", file=sys.stderr)
            return cp.read_text(encoding="utf-8")

    headers = dict(BASE_HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)

    contexts: list[ssl.SSLContext | None] = [None]
    # macOS Python in agent shells sometimes lacks CA setup. Try verified SSL first,
    # then fall back to an unverified context with a debug note.
    contexts.append(ssl._create_unverified_context())

    last_err: Exception | None = None
    for context_index, context in enumerate(contexts):
        for attempt in range(1, retries + 1):
            try:
                kwargs: dict[str, Any] = {"timeout": timeout}
                if context is not None:
                    kwargs["context"] = context
                with urllib.request.urlopen(req, **kwargs) as resp:
                    body = resp.read().decode("utf-8", "replace")
                    if cache_dir is not None:
                        _cache_path(cache_dir, url).write_text(body, encoding="utf-8")
                    if debug and context_index == 1:
                        print(f"[debug] fetched with unverified SSL fallback {url}", file=sys.stderr)
                    return body
            except urllib.error.HTTPError as e:
                status = e.code
                body = e.read().decode("utf-8", "ignore")
                if debug:
                    print(f"[debug] http {status} attempt={attempt} url={url}", file=sys.stderr)
                if _is_retryable_status(status) and attempt < retries:
                    time.sleep(backoff_base * (2 ** (attempt - 1)))
                    continue
                if body:
                    raise FetchError(f"HTTP {status} for {url} ({len(body)} bytes body)", status=status)
                raise FetchError(f"HTTP {status} for {url}", status=status)
            except Exception as e:
                last_err = e
                if debug:
                    print(f"[debug] network error attempt={attempt} url={url}: {e}", file=sys.stderr)
                # On certificate errors, switch quickly to unverified fallback.
                if "CERTIFICATE_VERIFY_FAILED" in str(e) and context is None:
                    break
                if attempt < retries:
                    time.sleep(backoff_base * (2 ** (attempt - 1)))
                    continue
                break

    raise FetchError(f"Failed to fetch {url}: {last_err}")


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_price_text(price: str) -> float | None:
    m = re.search(r"([0-9.]+),([0-9]{2})", price)
    if m:
        return float(m.group(1).replace(".", "") + "." + m.group(2))
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", price)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def parse_price_from_title(title_text: str) -> float | None:
    m = re.search(r"ab\s*€\s*([0-9][0-9\.,]*)", html.unescape(title_text), re.I)
    if not m:
        return None
    return parse_price_text(m.group(1))


def parse_price_from_meta(page_html: str) -> float | None:
    m = re.search(
        r'<meta[^>]+property=["\']product:price:amount["\'][^>]+content=["\']([0-9]+(?:\.[0-9]+)?)["\']',
        page_html,
        re.I,
    )
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_offer_count(page_html: str) -> int | None:
    text = strip_tags(page_html)
    m = re.search(r"\b([0-9]{1,5})\s+Angebote\b", text, re.I)
    return int(m.group(1)) if m else None


def extract_title_tag(page_html: str) -> str | None:
    m = re.search(r"<title[^>]*>(.*?)</title>", page_html, re.I | re.S)
    return html.unescape(strip_tags(m.group(1))).strip() if m else None


def parse_embedded_cheapest_shop(page_html: str) -> tuple[float | None, str | None]:
    patterns = [
        r'"tracking_merchant"\s*:\s*"([^\"]+)".{1,2000}?"raw_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)',
        r'"raw_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*"[^\"]*".{0,400}?"tracking_merchant"\s*:\s*"([^\"]+)"',
        r'"merchant"\s*:\s*"([^\"]+)".{1,2000}?"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)',
    ]

    best_price: float | None = None
    best_shop: str | None = None
    for pat in patterns:
        for match in re.findall(pat, page_html, flags=re.I | re.S):
            if pat.startswith('"raw_price"'):
                price_raw, shop_raw = match
            else:
                shop_raw, price_raw = match
            try:
                price = float(price_raw)
            except ValueError:
                continue
            if best_price is None or price < best_price:
                best_price = price
                best_shop = html.unescape(shop_raw)
    return best_price, best_shop


def parse_offer_rows(page_html: str) -> list[dict[str, Any]]:
    parts = re.split(r'<div\s+class="offer[^"]*"\s+id="offer-index-\d+"\s*>', page_html)
    offers: list[dict[str, Any]] = []
    for part in parts[1:]:
        price_m = re.search(r'<span class="gh_price">([^<]+)</span>', part)
        if not price_m:
            continue
        price_text = strip_tags(price_m.group(1))

        merchant_m = re.search(r'data-merchant-name="([^"]+)"', part)
        merchant = html.unescape(merchant_m.group(1)) if merchant_m else None

        delivery_time_m = re.search(r'<div class="offer__delivery-time">(.*?)</div>', part, re.S)
        delivery_time = strip_tags(delivery_time_m.group(1)) if delivery_time_m else None

        delivery_payment_m = re.search(r'<div class="offer__delivery-payment">(.*?)</div>', part, re.S)
        delivery_payment = strip_tags(delivery_payment_m.group(1)) if delivery_payment_m else None

        details_m = re.search(r'<div class="offer__details offer-cell">(.*?)<div class="offer__disclaimer">', part, re.S)
        details = strip_tags(details_m.group(1)) if details_m else None

        price_eur = parse_price_text(price_text)
        offers.append(
            {
                "price_eur": price_eur,
                "price": price_text,
                "merchant": merchant,
                "delivery_time": delivery_time,
                "delivery_payment": delivery_payment,
                "details": details,
            }
        )

    offers.sort(key=lambda row: row["price_eur"] if row["price_eur"] is not None else float("inf"))
    return offers


def enrich_page(page_html: str, include_offers: bool = False, offer_limit: int = 5) -> dict[str, Any]:
    title = extract_title_tag(page_html) or ""
    offer_count = parse_offer_count(page_html)
    offers = parse_offer_rows(page_html)

    if offers and offers[0].get("price_eur") is not None:
        out: dict[str, Any] = {
            "min_price_eur": offers[0]["price_eur"],
            "shop": offers[0].get("merchant"),
            "offer_count": offer_count or len(offers),
            "price_confidence": "high",
            "price_source": "offer_table",
            "page_title": title,
        }
        if include_offers:
            out["offers"] = offers[:offer_limit]
        return out

    embedded_price, embedded_shop = parse_embedded_cheapest_shop(page_html)
    if embedded_price is not None:
        return {
            "min_price_eur": embedded_price,
            "shop": embedded_shop,
            "offer_count": offer_count,
            "price_confidence": "high",
            "price_source": "embedded_offer_raw_price",
            "page_title": title,
        }

    meta_price = parse_price_from_meta(page_html)
    if meta_price is not None:
        return {
            "min_price_eur": meta_price,
            "shop": embedded_shop,
            "offer_count": offer_count,
            "price_confidence": "medium",
            "price_source": "meta_product_price",
            "page_title": title,
        }

    title_price = parse_price_from_title(title)
    if title_price is not None:
        return {
            "min_price_eur": title_price,
            "shop": embedded_shop,
            "offer_count": offer_count,
            "price_confidence": "low",
            "price_source": "title_ab_price",
            "page_title": title,
        }

    return {
        "min_price_eur": None,
        "shop": embedded_shop,
        "offer_count": offer_count,
        "price_confidence": "unknown",
        "price_source": "none",
        "page_title": title,
    }


def acs_search(query: str, debug: bool = False, cache_dir: Path | None = None) -> list[list[Any]]:
    url = f"{BASE}/acs?lang=de&loc=at&o=json&k={urllib.parse.quote(query)}"
    raw = fetch_text(url, extra_headers=ACS_HEADERS, retries=3, backoff_base=0.5, debug=debug, cache_dir=cache_dir)
    data = json.loads(raw)
    return data if isinstance(data, list) else []


def candidate_to_url(candidate: list[Any]) -> str | None:
    if not candidate:
        return None
    first = candidate[0]
    if not isinstance(first, str) or not first:
        return None
    if first.startswith("http"):
        return first
    if first.startswith("/"):
        return BASE + first
    return f"{BASE}/{first}"


def search(query: str, limit: int, debug: bool = False, cache_dir: Path | None = None) -> list[dict[str, Any]]:
    rows = acs_search(query, debug=debug, cache_dir=cache_dir)
    out: list[dict[str, Any]] = []

    for row in rows:
        if not isinstance(row, list) or len(row) < 2:
            continue
        name = strip_tags(str(row[1]))
        detail_url = candidate_to_url(row)
        if not name or not detail_url:
            continue

        item: dict[str, Any] = {
            "schema_version": SCHEMA_VERSION,
            "name": name,
            "detail_url": detail_url,
            "min_price_eur": None,
            "shop": None,
            "offer_count": None,
            "price_confidence": "unknown",
            "price_source": "none",
            "error": None,
        }
        try:
            page = fetch_text(
                detail_url,
                extra_headers={"Accept": "text/html,*/*"},
                retries=3,
                backoff_base=0.6,
                cache_dir=cache_dir,
                debug=debug,
            )
            item.update(enrich_page(page))
        except Exception as e:
            item["error"] = str(e)

        out.append(item)
        if len(out) >= limit:
            break
        time.sleep(0.2)

    return out


def offers_for_urls(urls: list[str], limit: int, debug: bool = False, cache_dir: Path | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for url in urls:
        item: dict[str, Any] = {"schema_version": SCHEMA_VERSION, "url": url, "page_title": None, "offers": [], "error": None}
        try:
            page = fetch_text(url, extra_headers={"Accept": "text/html,*/*"}, cache_dir=cache_dir, debug=debug)
            item["page_title"] = extract_title_tag(page)
            item["offer_count"] = parse_offer_count(page)
            item["offers"] = parse_offer_rows(page)[:limit]
        except Exception as e:
            item["error"] = str(e)
        out.append(item)
    return out


def print_search_table(items: list[dict[str, Any]]) -> None:
    if not items:
        print("No results")
        return
    for i, item in enumerate(items, 1):
        price = item.get("min_price_eur")
        price_s = f"€{price:.2f}" if isinstance(price, (int, float)) else "n/a"
        offers = item.get("offer_count") if item.get("offer_count") is not None else "n/a"
        shop = item.get("shop") or "n/a"
        print(f"{i}. {item.get('name', '-')}")
        print(f"   Price: {price_s} | Shop: {shop} | Offers: {offers}")
        print(f"   Confidence: {item.get('price_confidence')} ({item.get('price_source')})")
        print(f"   URL: {item.get('detail_url', '-')}")
        if item.get("error"):
            print(f"   Error: {item['error']}")


def print_offers_tsv(items: list[dict[str, Any]]) -> None:
    print("url\tprice\tmerchant\tdelivery_time\tdelivery_payment\tdetails")
    for item in items:
        if item.get("error"):
            print(f"# ERROR {item.get('url')}: {item.get('error')}", file=sys.stderr)
            continue
        for offer in item.get("offers", []):
            print(
                "\t".join(
                    [
                        str(item.get("url") or ""),
                        str(offer.get("price") or ""),
                        str(offer.get("merchant") or ""),
                        str(offer.get("delivery_time") or ""),
                        str(offer.get("delivery_payment") or ""),
                        str(offer.get("details") or ""),
                    ]
                )
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Geizhals.at search and offer extraction")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_search = sub.add_parser("search", help="Search Geizhals autocomplete and enrich candidates")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=5)
    p_search.add_argument("--json", action="store_true", dest="as_json")
    p_search.add_argument("--debug", action="store_true")
    p_search.add_argument("--cache-dir", default=os.path.expanduser("~/.cache/geizhals-skill"))

    p_offers = sub.add_parser("offers", help="Extract offer rows from Geizhals product URLs")
    p_offers.add_argument("urls", nargs="+")
    p_offers.add_argument("--limit", type=int, default=20)
    p_offers.add_argument("--json", action="store_true", dest="as_json")
    p_offers.add_argument("--debug", action="store_true")
    p_offers.add_argument("--cache-dir", default=os.path.expanduser("~/.cache/geizhals-skill"))

    args = parser.parse_args()
    cache_dir = Path(args.cache_dir) if args.cache_dir else None

    if args.cmd == "search":
        items = search(args.query, max(1, min(args.limit, 15)), debug=args.debug, cache_dir=cache_dir)
        if args.as_json:
            print(json.dumps(items, ensure_ascii=False, indent=2))
        else:
            print_search_table(items)
        return 0

    if args.cmd == "offers":
        items = offers_for_urls(args.urls, max(1, args.limit), debug=args.debug, cache_dir=cache_dir)
        if args.as_json:
            print(json.dumps(items, ensure_ascii=False, indent=2))
        else:
            print_offers_tsv(items)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
