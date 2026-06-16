---
name: geizhals-price-comparison
description: Research and compare prices on Geizhals.at for arbitrary products. Use when the user asks for cheapest offers, price comparisons, pack/variant comparisons, cart checks, shipping-aware totals, or whether a Geizhals/shop offer is good.
---

# Geizhals Price Comparison

Use this skill for general Geizhals price research, not only contact lenses.

## Goals

- Find the correct product/variant on Geizhals.at.
- Compare offers by item price, shipping/payment fees, availability, and merchant.
- Check whether a user's cart/order summary looks correct.
- Explain the cheapest sensible option, not just the lowest sticker price.

## Search

When the Geizhals URL is unknown, search with Brave:

```bash
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js "site:geizhals.at PRODUCT MODEL VARIANT" -n 20 --country AT
```

For exact product names, quote the query:

```bash
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js '"PRODUCT NAME" "Geizhals Österreich"' -n 10 --country AT
```

Prefer Geizhals product pages (`...-a123456.html`) over broad variant/category pages (`...-v12345.html`) when comparing offers.

## Offer Extraction Helper

This skill includes a no-dependency parser for Geizhals product pages:

```bash
/Users/tom/Development/tkoenig/agent-skills/skills/geizhals-price-comparison/geizhals_offers.py URL [URL ...]
```

Output is TSV:

```text
url price merchant delivery_time delivery_payment details
```

Example:

```bash
/Users/tom/Development/tkoenig/agent-skills/skills/geizhals-price-comparison/geizhals_offers.py \
  https://geizhals.at/some-product-a123456.html
```

Use the `details` column to verify the exact product variant.

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

Run the helper on multiple product pages and compare:

```bash
/Users/tom/Development/tkoenig/agent-skills/skills/geizhals-price-comparison/geizhals_offers.py URL1 URL2 URL3
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
