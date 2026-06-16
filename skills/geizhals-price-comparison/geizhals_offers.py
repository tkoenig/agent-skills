#!/usr/bin/env python3
"""Extract offers from Geizhals product pages.

Usage:
  ./geizhals_offers.py URL [URL ...]

Output is TSV:
  url, price, merchant, delivery_time, delivery_payment, details

This intentionally has no third-party dependencies.
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
    # macOS Python in agent shells may lack CA setup. Geizhals data is public.
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=25, context=context) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def price_to_float(price: str) -> float | None:
    m = re.search(r"([0-9.]+),([0-9]{2})", price)
    if not m:
        return None
    return float(m.group(1).replace(".", "") + "." + m.group(2))


def parse_offers(page: str):
    parts = re.split(r'<div\s+class="offer[^"]*"\s+id="offer-index-\d+"\s*>', page)
    offers = []
    for part in parts[1:]:
        price_m = re.search(r'<span class="gh_price">([^<]+)</span>', part)
        if not price_m:
            continue
        price = strip_tags(price_m.group(1))

        merchant_m = re.search(r'data-merchant-name="([^"]+)"', part)
        merchant = html.unescape(merchant_m.group(1)) if merchant_m else ""

        delivery_time_m = re.search(r'<div class="offer__delivery-time">(.*?)</div>', part, re.S)
        delivery_time = strip_tags(delivery_time_m.group(1)) if delivery_time_m else ""

        delivery_payment_m = re.search(r'<div class="offer__delivery-payment">(.*?)</div>', part, re.S)
        delivery_payment = strip_tags(delivery_payment_m.group(1)) if delivery_payment_m else ""

        details_m = re.search(r'<div class="offer__details offer-cell">(.*?)<div class="offer__disclaimer">', part, re.S)
        details = strip_tags(details_m.group(1)) if details_m else ""

        offers.append((price_to_float(price), price, merchant, delivery_time, delivery_payment, details))

    offers.sort(key=lambda row: row[0] if row[0] is not None else float("inf"))
    return offers


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: geizhals_offers.py URL [URL ...]", file=sys.stderr)
        return 2

    print("url\tprice\tmerchant\tdelivery_time\tdelivery_payment\tdetails")
    for url in argv:
        try:
            page = fetch(url)
            for _numeric_price, price, merchant, delivery_time, delivery_payment, details in parse_offers(page):
                print("\t".join([url, price, merchant, delivery_time, delivery_payment, details]))
        except Exception as e:
            print(f"# ERROR {url}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
