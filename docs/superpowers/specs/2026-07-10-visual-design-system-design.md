# Visual Design System — First Pass (Design Tokens, Shell, Animals List)

## Goal

Establish the visual foundation of the farm-management app so design and
implementation can progress in parallel: a token-based color system, the
navigation shell, and the first screen (animals list). This is the first of
several screens; the pattern set here (tokens, shell, responsive component
strategy) is reused for every later screen.

## Visual Direction

Earthy / Rustic, light mode only for now. Warm, warm-neutral background with
olive-green and brown accents — reads as "farm" without sacrificing legibility
in direct sunlight on a phone.

Colors are implemented as CSS custom properties (design tokens), not literal
values in components, so a dark theme or custom themes can be added later by
defining a second token set — no component rewrites required.

### Tokens (`design/tokens.css`)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#fdf6ec` | Page background |
| `--surface` | `#ffffff` | Cards, table rows, panels |
| `--border` | `#e7d9c3` | Card/table borders, dividers |
| `--text-primary` | `#4a3a2a` | Primary text |
| `--text-secondary` | `#8a7355` | Secondary/meta text |
| `--accent` | `#7c9070` | Primary actions, "active" status |
| `--accent-dark` | `#5b4630` | Sidebar, header, drawer background |
| `--status-active` | `#7c9070` | Animal status: active |
| `--status-inactive` | `#b08968` | Animal status: sold/inactive |
| `--status-warning` | `#c9a227` | Animal status: withdrawal/alert |
| `--status-danger` | `#b5533c` | Animal status: dead/culled |

Typography: system sans-serif stack, sized for legibility outdoors (base body
size larger than a typical desktop-first app). No custom font is committed to
in this pass.

## Navigation Shell

- **Desktop:** fixed sidebar (icons + labels) on the left, always visible.
  Sections: Animals, Farms, Notes (more added as later features ship).
- **Mobile:** sidebar is hidden by default and opens as a **drawer** — slides
  in from the left over a semi-transparent overlay, with an enter/exit
  animation (slide + fade). Closes on tap-outside, swipe, or an explicit close
  action.
- The same nav data/structure drives both renderings; only the container
  (fixed sidebar vs. overlay drawer) changes by breakpoint.

## Animals List Screen

Layout is **hybrid responsive**: the same data renders as a dense table on
desktop and as stacked cards on mobile, switching at the layout breakpoint.

- **Header:** entity count ("Animals · 42"), primary action ("+ New"),
  filters (status, species, farm), and a search input.
- **Desktop (table):** columns for tag, species, weight, status (at minimum);
  status rendered with the status token colors above.
- **Mobile (cards):** one card per animal — tag + species as the title,
  weight/farm as meta, status as a colored label — sized for thumb tapping.
- Both renderings consume the same underlying list data and filter/search
  state; only the presentation component differs by viewport.

## Design ↔ Repo Workflow

Design lives alongside code so it evolves with the project instead of
drifting from it:

- `design/tokens.css` — the token values above; the single source of truth
  for the palette. Components (once built) reference these tokens rather than
  hardcoding colors.
- `design/mockups/*.html` — one static HTML mockup per screen/component,
  starting with `nav-shell.html` and `animals-list.html`. These are
  presentation-only references, not application code.
- Mockups are pushed to a Claude Design project (via the design-sync tool)
  whenever a screen is created or meaningfully changed, so the design is also
  browsable outside the codebase. The repo copy under `design/` is the source
  of truth; the Claude Design project is a synced view of it.

## Out of Scope (this pass)

- Dark mode / additional themes (architecture supports it; no second token
  set is defined yet).
- Any screen beyond the nav shell and animals list (farm detail, animal
  detail, notes, CSV import UI, etc.) — each gets its own design pass
  following the same token/shell/responsive-component pattern.
- Pixel-accurate visual polish (spacing scale, icon set, custom font) — the
  mockups establish structure and color; polish is refined once real content
  is in place.
