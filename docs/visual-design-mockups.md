# Visual Design Mockups (Tokens, Nav Shell, Animals List)

## Goal

Turn the approved design spec (`docs/superpowers/specs/2026-07-10-visual-design-system-design.md`)
into a `design/` folder with a token stylesheet and two static HTML mockups,
then publish them to a Claude Design project so they're browsable outside the
repo.

## Tasks

- [x] Create `design/tokens.css` with the 11 CSS custom properties from the
      spec's token table (`--bg`, `--surface`, `--border`, `--text-primary`,
      `--text-secondary`, `--accent`, `--accent-dark`, `--status-active`,
      `--status-inactive`, `--status-warning`, `--status-danger`) plus a base
      font-size bump for outdoor legibility.
      → Verify: file exists, all 11 tokens present, values match the spec table.

- [x] Create `design/mockups/nav-shell.html`: fixed left sidebar with icon +
      label nav items (Animals, Farms, Notes) on desktop (`min-width: 768px`);
      below that width, sidebar is hidden behind a "menu" trigger and opens as
      an overlay drawer with a CSS transition (slide-in from the left +
      overlay fade, ~200-250ms) and closes on overlay click.
      → Verify: open the file directly in a browser, resize the window across
      768px — confirm the sidebar becomes a drawer below the breakpoint and
      the drawer's open/close has a visible slide animation, not an instant
      cut.

- [x] Create `design/mockups/animals-list.html`: header with entity count
      ("Animals · 42"), "+ New" button, status/species/farm filters, and a
      search input; below 768px render animals as stacked cards (tag, species,
      weight, farm, colored status label); at/above 768px render the same data
      as a table (tag, species, weight, status columns). Use `design/tokens.css`
      for all colors — no hardcoded hex values in this file.
      → Verify: open in a browser, resize across 768px — table renders on wide
      viewport, cards render on narrow viewport; status colors match the
      spec's status tokens (active=green, inactive=tan, warning=mustard,
      danger=terracotta).

- [x] Manually review both mockups side by side against the spec's "Out of
      Scope" list — confirm no dark-mode toggle, no other screens, and no
      pixel-polish beyond structure/color got added.
      → Verify: read both files, confirm they only implement what's in the
      spec.

- [x] List existing Claude Design projects (`DesignSync.list_projects`); if
      none suitable exists, create one (`DesignSync.create_project`) named
      after this project (e.g. "Farm Management").
      → Verify: a `projectId` for a `PROJECT_TYPE_DESIGN_SYSTEM` project is in
      hand.

- [x] Finalize a `DesignSync` plan covering `design/tokens.css`,
      `design/mockups/nav-shell.html`, and `design/mockups/animals-list.html`,
      then write those three files to the project.
      → Verify: `write_files` returns success for all three paths.

## Done When

- [ ] `design/tokens.css`, `design/mockups/nav-shell.html`, and
      `design/mockups/animals-list.html` exist in the repo and match the
      approved spec.
- [ ] Both mockups correctly switch layout at the 768px breakpoint when
      resized in a browser.
- [ ] The same three files are live in a Claude Design project, confirmed via
      `list_files` on that project.

## Notes

- This plan covers the design/mockup layer only — no NestJS/React app code.
- Breakpoint (768px) is a reasonable default not pinned down in the spec;
  flag it to the user as an assumption when this plan is presented.
- Commit the new `design/` files to git as a separate, clearly-scoped commit
  once the user reviews them (per repo convention: no auto-commit without
  explicit ask).
