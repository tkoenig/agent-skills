---
name: daisyui
description: Get DaisyUI component snippets, layouts, templates, and theme configuration for Tailwind CSS 4. Use when building UI with DaisyUI 5 components.
---

# DaisyUI Snippets

Retrieve DaisyUI 5 component code, layouts, templates, and theme configuration via the `daisyui-blueprint` MCP.

## Quick Reference

```bash
# Get component(s)
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'components={"button": true}'
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'components={"button": true, "card": true, "modal": true}'

# Get component example (use key=value syntax for dotted names)
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'component-examples={"button.button-with-icon": true}'
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'component-examples={"modal.dialog-modal-with-a-close-button-at-corner": true}'

# Get theme configuration (Tailwind 4 + DaisyUI 5)
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'themes={"custom-theme": true}'
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'themes={"builtin-themes": true, "colors": true, "custom-theme": true}'

# Get layout
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'layouts={"responsive-collapsible-drawer-sidebar": true}'

# Get template
npx mcporter call daisyui-blueprint.daisyUI-Snippets 'templates={"dashboard": true}'
```

## Available Components

accordion, alert, avatar, badge, breadcrumbs, button, calendar, card,
carousel, chat, checkbox, collapse, countdown, diff, divider, dock,
drawer, dropdown, fab, fieldset, file-input, filter, footer, hero,
hover-3d, hover-gallery, indicator, input, join, kbd, label, link,
list, loading, mask, menu, mockup-browser, mockup-code, mockup-phone,
mockup-window, modal, navbar, pagination, progress, radial-progress,
radio, range, rating, select, skeleton, stack, stat, status, steps,
swap, tab, table, text-rotate, textarea, theme-controller, timeline,
toast, toggle, validator

**Note:** `tooltip` is missing from the MCP but exists in DaisyUI 5. Use:
```html
<div class="tooltip" data-tip="hello"><button class="btn">Hover</button></div>
<div class="tooltip tooltip-right tooltip-primary" data-tip="info">...</div>
```
Classes: tooltip, tooltip-content, tooltip-top/bottom/left/right, tooltip-open, tooltip-{color}

## Component Examples

Each component has multiple examples. Format: `component.example-name`

When you request a component, it lists available examples. Common patterns:
- `button.button-with-icon`
- `button.button-with-loading-spinner`
- `modal.dialog-modal`
- `modal.dialog-modal-with-a-close-button-at-corner`
- `card.card-with-image-on-side`

## Layouts

- bento-grid-5-sections
- bento-grid-8-sections
- responsive-collapsible-drawer-sidebar
- responsive-offcanvas-drawer-sidebar
- top-navbar

## Templates

- dashboard
- login-form

## Themes

- builtin-themes - List of built-in DaisyUI themes
- colors - Color palette reference  
- custom-theme - How to create custom themes with Tailwind 4 + DaisyUI 5

## When to Use

- Building new UI components with DaisyUI
- Need the correct class names and HTML structure
- Setting up Tailwind 4 + DaisyUI 5 theme configuration
- Looking for layout patterns (sidebars, navbars, grids)
- Need login form or dashboard templates
