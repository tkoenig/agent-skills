---
name: geizhals-price-comparison
description: Research and compare prices on Geizhals.at for arbitrary products. Use when the user asks for cheapest offers, price comparisons, product search, pack/variant comparisons, cart checks, shipping-aware totals, or whether a Geizhals/shop offer is good.
---

# Geizhals Price Comparison

Use this skill for general Geizhals price research.

## Goals

- Find the correct product/variant on Geizhals.at.
- Compare offers by item price, shipping/payment fees, availability, and merchant.
- Check whether a user's cart/order summary looks correct.
- Explain the cheapest sensible option, not just the lowest sticker price.

## CLI

This skill includes a no-dependency Geizhals helper:

```bash
.pi/skills/geizhals-price-comparison/geizhals.py search "query" --limit 5
.pi/skills/geizhals-price-comparison/geizhals.py search "query" --limit 5 --json
.pi/skills/geizhals-price-comparison/geizhals.py offers URL [URL ...]
.pi/skills/geizhals-price-comparison/geizhals.py offers URL [URL ...] --json
```

## Search Mode

`search` uses Geizhals autocomplete (`/acs`) and enriches top candidates by fetching detail pages.

Output fields include:

- `name`
- `detail_url`
- `min_price_eur`
- `shop`
- `offer_count`
- `price_confidence`: `high|medium|low|unknown`
- `price_source`: `offer_table|embedded_offer_raw_price|meta_product_price|title_ab_price|none`
- `error`

Example:

```bash
.pi/skills/geizhals-price-comparison/geizhals.py search "mac mini m4 512" --limit 5 --json
```

If Geizhals search is not enough, use Brave as fallback:

```bash
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js "site:geizhals.at PRODUCT MODEL VARIANT" -n 20 --country AT
```

## Offers Mode

Prefer Geizhals product pages (`...-a123456.html`) over broad variant/category pages (`...-v12345.html`) when comparing offers.

`offers` extracts Geizhals offer rows from product pages and includes:

- item price
- merchant
- delivery time
- shipping/payment notes
- shop-specific product detail string

Example:

```bash
.pi/skills/geizhals-price-comparison/geizhals.py offers \
  https://geizhals.at/some-product-a123456.html
```

Use the details field to verify the exact product variant.

## Variant Verification

Always verify details before recommending an offer. Depending on product type, check:

- exact model number / generation
- color / storage / size / region version
- pack size / quantity
- compatibility constraints
- warranty/import notes
- refurbished/open-box status
- shop-specific product title in the details column

If variants are ambiguous, say so and ask the user for confirmation or provide multiple links.

## Shipping and Payment Heuristics

Geizhals offer rows often contain payment/dispatch notes. Use these rules for a first estimate:

- `GRATISVERSAND` → shipping €0
- `€ X (kostenfrei ab € Y Warenwert)` → add €X only if cart subtotal is below Y
- `Gratisversand ab € Y Warenwert` → shipping €0 if cart subtotal is >= Y, otherwise add listed shipping fee if present
- If multiple products are bought from the same merchant, estimate shipping once for the combined subtotal
- If shipping/payment fees are unclear, report item price and say checkout should confirm final shipping

Do not overstate precision: Geizhals prices can change and final checkout may differ.

## Comparing Multiple URLs

Run `offers` on multiple product pages:

```bash
.pi/skills/geizhals-price-comparison/geizhals.py offers URL1 URL2 URL3 --json
```

For multi-item carts, group offers by merchant where possible and compute:

```text
combined subtotal + estimated one-time shipping/payment fee
```

## Answer Style

Keep answers concise and in the user's language. For German users:

```markdown
Am günstigsten aktuell:

| Produkt | Anbieter | Preis | Versand/Hinweis |
|---|---:|---:|---|
| ... | ... | ... | ... |

Fazit: ...

Bitte im Checkout final prüfen, weil Geizhals-Preise/Versandbedingungen sich ändern können.
```

Include direct Geizhals links used for the comparison.
