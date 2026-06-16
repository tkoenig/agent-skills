#!/usr/bin/env python3
"""Extract top offers from Geizhals product pages.

Usage:
  ./geizhals_offers.py URL [URL ...]

No external dependencies. Output is TSV:
  url, price, merchant, delivery_time, delivery_payment, details
"""

from __future__ import annotations

import html
import re
import ssl
import sys
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    # macOS Python installations may not have a configured CA bundle in agent shells.
    # Geizhals content is public; use an unverified context to keep the helper robust.
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=25, context=context) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_price(s: str) -> str | None:
    m = re.search(r'<span class="gh_price">([^<]+)</span>', s)
    return strip_tags(m.group(1)) if m else None


def parse_offers(page: str):
    # Geizhals uses offer-index blocks on product pages.
    parts = re.split(r'<div\s+class="offer[^"]*"\s+id="offer-index-\d+"\s*>', page)
    for part in parts[1:]:
        price = parse_price(part)
        if not price:
            continue

        merchant_m = re.search(r'data-merchant-name="([^"]+)"', part)
        merchant = html.unescape(merchant_m.group(1)) if merchant_m else ""

        delivery_time_m = re.search(r'<div class="offer__delivery-time">(.*?)</div>', part, re.S)
        delivery_time = strip_tags(delivery_time_m.group(1)) if delivery_time_m else ""

        delivery_payment_m = re.search(r'<div class="offer__delivery-payment">(.*?)</div>', part, re.S)
        delivery_payment = strip_tags(delivery_payment_m.group(1)) if delivery_payment_m else ""

        details_m = re.search(r'<div class="offer__details offer-cell">(.*?)<div class="offer__disclaimer">', part, re.S)
        details = strip_tags(details_m.group(1)) if details_m else ""

        yield price, merchant, delivery_time, delivery_payment, details


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: geizhals_offers.py URL [URL ...]", file=sys.stderr)
        return 2

    print("url\tprice\tmerchant\tdelivery_time\tdelivery_payment\tdetails")
    for url in argv:
        try:
            page = fetch(url)
            for price, merchant, delivery_time, delivery_payment, details in parse_offers(page):
                print("\t".join([
                    url,
                    price,
                    merchant,
                    delivery_time,
                    delivery_payment,
                    details,
                ]))
        except Exception as e:
            print(f"# ERROR {url}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
