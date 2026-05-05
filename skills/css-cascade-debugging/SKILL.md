---
name: css-cascade-debugging
description: Debug CSS override issues in Tailwind/DaisyUI/component-library projects. Use when styles do not apply as expected, active/hover states look wrong, `!important` does not win, `:where()` specificity is involved, or Tailwind `@layer`/generated CSS order may affect the cascade.
---

# CSS Cascade Debugging

Use this skill when a CSS rule appears correct but the browser renders something else.

Common triggers:
- active/hover/focus state styles not applying
- theme override losing to DaisyUI/Tailwind defaults
- `!important` not winning
- `:where()` or `:is()` selectors involved
- generated CSS differs from source expectations
- Tailwind `@layer base/components/utilities` or DaisyUI component styles involved

## Core Rule

Do not stop at specificity. The cascade is decided by:

1. origin and importance (`!important`)
2. cascade layers (`@layer`)
3. selector specificity
4. source order
5. inherited/computed values

Specificity tools help, but they do not explain layer ordering or runtime markup mismatches by themselves.

## Debug Workflow

### 1. Inspect the actual rendered markup

Verify the element really has the class/attribute your selector expects.

Examples:

```js
Array.from(document.querySelectorAll(".menu a")).map((a) => ({
  text: a.textContent.trim(),
  className: a.className,
  href: a.href,
  active: a.classList.contains("active"),
  ariaCurrent: a.getAttribute("aria-current")
}))
```

Do this before changing CSS. Many bugs are selector/markup mismatches.

### 2. Check computed styles in the browser

Use DevTools or browser automation to inspect the actual winning values:

```js
(() => {
  const element = document.querySelector(".menu a.active")
  const styles = getComputedStyle(element)

  return {
    text: element?.textContent.trim(),
    className: element?.className,
    backgroundColor: styles.backgroundColor,
    color: styles.color,
    matched: element?.matches('[data-theme="terminal"] .menu li > a.active')
  }
})()
```

If the selector matches but a value is still wrong, suspect cascade layers, `!important`, or later generated CSS.

### 3. Inspect generated CSS, not only source CSS

For Tailwind builds, inspect the generated output:

```bash
rg -n "menu.*active|data-theme=terminal|your-selector" app/assets/builds/tailwind.css
```

For minified CSS, use a small script to print surrounding text:

```bash
python3 - <<'PY'
from pathlib import Path
s = Path('app/assets/builds/tailwind.css').read_text()
for needle in ['.menu :where(li>.active)', '[data-theme=terminal] .menu li>a.active']:
    i = s.find(needle)
    print('\n---', needle, i, '---')
    print(s[max(0, i - 180):i + 360] if i != -1 else 'not found')
PY
```

Confirm:
- selector exists
- selector appears after the rule it should override, when source order matters
- selector is in the expected cascade layer
- declarations are not transformed away by the build

### 4. Check selector specificity

Use:

```bash
npx --yes @bramus/specificity '<selector>'
```

Examples:

```bash
npx --yes @bramus/specificity '[data-theme="terminal"] .menu li > a.active'
# (0,3,2)

npx --yes @bramus/specificity '.menu :where(li > .active)'
# (0,1,0)

npx --yes @bramus/specificity '[data-theme="terminal"] .menu :where(li > *:hover)'
# (0,2,0)
```

Important: `:where(...)` contributes **zero** specificity for its contents. A selector with `:where(li > .active)` is weaker than it looks.

### 5. Check cascade layers

Tailwind and DaisyUI often emit rules inside cascade layers, especially `@layer components`.

If overriding a DaisyUI/Tailwind component rule that is inside `@layer components`, put your override in the same layer:

```css
@layer components {
  [data-theme="terminal"] .menu li > a.active,
  [data-theme="terminal"] .menu li > a.active:hover,
  [data-theme="terminal"] .menu li > a.active:focus-visible {
    background-color: var(--terminal-phosphor) !important;
    color: #0b0b0a !important;
  }
}
```

This avoids surprises where a generic layered `!important` declaration beats an apparently stronger unlayered rule.

### 6. Rebuild and hard-refresh

For generated CSS projects, rebuild before browser verification:

```bash
npm run build:css
```

Then hard refresh or restart the dev server if the served CSS is stale.

## Fix Patterns

### Prefer explicit selectors for state overrides

Good:

```css
[data-theme="terminal"] .menu li > a.active {
  background-color: var(--terminal-phosphor) !important;
}
```

Riskier for overrides:

```css
[data-theme="terminal"] .menu :where(li > .active) {
  background-color: var(--terminal-phosphor) !important;
}
```

The `:where()` version is convenient, but lower specificity.

### Keep theme styles in theme files

If a style exists only for one theme, keep it in that theme file and import the theme after generic component overrides.

Example:

```css
@import "./daisyui.css";
@import "./themes/halloween.css";
@import "./themes/christmas.css";
@import "./themes/terminal.css";
```

### Verify active elements outside menu lists separately

Mobile quick-link cards, buttons, or custom nav items may not live inside `.menu`. If they do not share the same markup or `.active` class, menu selectors will not affect them.

Inspect markup before assuming the selector applies.

## Red Flags

- “Specificity says this should win” but computed styles disagree
- `!important` on both competing declarations
- Tailwind/DaisyUI `@layer components` involved
- selector uses `:where()`
- source CSS looks correct but generated CSS order differs
- element is styled by utility classes or component classes outside the expected selector path

## Quick Checklist

1. Does the actual element match the selector?
2. What are the computed `backgroundColor`, `color`, etc.?
3. Does generated CSS contain the expected rule?
4. Is the expected rule before or after the competing rule?
5. Are both rules in the same cascade layer?
6. Are both rules `!important`?
7. Does `:where()` reduce specificity?
8. After a CSS change, was the CSS rebuilt and the browser hard-refreshed?
