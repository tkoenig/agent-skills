---
name: contact-lens-price-research
description: Research and compare contact lens prices on Geizhals, Lensbest, and similar shops. Use when the user asks to find/compare/reorder lenses, verify prescription values, compare 30/90/180 packs, or check whether a contact lens cart is correct.
---

# Contact Lens Price Research

Use this skill for Kontaktlinsen-Recherche, price comparisons, and cart checks.

## Source of Truth for Personal Values

Personal lens values and previous carts are documented in Obsidian:

```text
/Users/tom/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thok/Kontaktlinsen.md
```

Read this file first when the user asks to reorder or compare "the usual lenses". Do not rely on memory.

## Workflow

1. Identify exact product and parameters:
   - product name/variant
   - Stärke / PWR / SPH
   - BC / Krümmung
   - DIA / Durchmesser
   - pack size: 30, 90, 180 etc.
2. Search Geizhals first because it exposes comparable product pages per prescription/pack.
3. Verify each offer detail string contains the exact PWR, BC, DIA, and pack size.
   - Important: many lenses exist with multiple BC values, e.g. ACUVUE OASYS 1-Day can appear as BC 8.5 and BC 9.0.
4. Compare by:
   - price per pack
   - price per lens
   - if buying for both eyes: combined cart total at same merchant, including shipping thresholds
5. Check Lensbest or direct shops only as fallback or comparison.
6. Present concise recommendation and links.
7. If an order/cart is finalized, offer to update the Obsidian note.

## Brave Search Commands

Use Brave search when product URLs are unknown:

```bash
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js "site:geizhals.at PRODUCT PWR BC DIA 90" -n 20 --country AT
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js "site:lensbest.de PRODUCT PWR BC DIA" -n 10 --country DE
```

Exact-title searches are useful:

```bash
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js '"Alcon Dailies AquaComfort Plus, -4.75 Dioptrien, 90"' -n 10 --country AT
psst --global run /Users/tom/.pi/agent/skills/brave-search/search.js '"Johnson & Johnson Acuvue Oasys 1-Day, -1.75 Dioptrien, 90"' -n 10 --country AT
```

## Geizhals Offer Extraction

This skill includes a helper script:

```bash
/Users/tom/.pi/agent/skills/contact-lens-price-research/geizhals_offers.py URL [URL ...]
```

It prints top Geizhals offers as TSV: URL, price, merchant, delivery time, delivery/payment notes, details.

Example:

```bash
/Users/tom/.pi/agent/skills/contact-lens-price-research/geizhals_offers.py \
  https://geizhals.at/alcon-dailies-aquacomfort-plus-a1957641.html
```

## Finding Geizhals Variant Pages

When on a Geizhals variant overview page (`...-vNNNNN.html`), use filters for Dioptrien and Inhalt to discover exact product pages.

Example approach:

```bash
python3 - <<'PY'
import requests, re, html
url = 'https://geizhals.at/alcon-dailies-aquacomfort-plus-v39998.html'
s = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=20).text
for m in re.finditer(r'href="(\.\/)?(alcon-dailies-aquacomfort-plus-a\d+\.html[^"]*)"[^>]*>(.*?)</a>', s, re.S):
    txt = html.unescape(re.sub('<[^>]+>', ' ', m.group(3))).strip()
    if '-4.75' in txt or '-4.00' in txt:
        print(m.group(2), txt)
PY
```

Often easier: search exact strings with Brave Search.

## Shipping/Cart Heuristics

For a single merchant cart:

- If delivery notes say `GRATISVERSAND`, use shipping €0.
- If notes say `€ X (kostenfrei ab € Y Warenwert)`, shipping is €0 when combined merchant subtotal is >= Y; otherwise add X.
- If comparing multiple pack sizes, prefer same-merchant combined totals for two eyes.
- Always state if shipping is inferred from Geizhals and should be confirmed in the final checkout.

## Output Format

Keep final answers short, in German, e.g.:

```markdown
Für deine Werte ist aktuell am günstigsten:

| Packung | Anbieter | Summe beide Augen | €/Linse |
|---|---:|---:|---:|
| 90er | Kodano via Geizhals | 82,48 € | 0,46 € |

Links:
- Links -4,00: ...
- Rechts -4,75: ...

Bitte im Warenkorb noch BC/DIA prüfen.
```
