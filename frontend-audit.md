# AiVis Frontend Audit

Scope: audit against the corrected product framing (AiVis = analytics/data-visualization
software for CERP, NYT/WaPo screenshots = visual-quality reference only, not a product model).
Findings below come from reading the actual source (`frontend/src/`), not assumptions.

## Overall Score

**5.5 / 10** — solid, honest engineering foundation (real data, real API calls, working
pipeline end-to-end) with real visual/UX gaps that read as "unfinished internal tool" rather
than "professional analytics software." Nothing here is fake or mocked; the gaps are about
polish and completeness, not correctness.

## Product Positioning

Currently reads as: **a working internal tool with editorial-adjacent typography left over
from an earlier framing**, not yet "professional analytics software" or "editorial product" —
it's in between. The underlying data model, API, and interaction pattern are already
analytics-software-shaped (upload → profile → recommend → studio → export). What's pulling it
toward "unfinished/generic" rather than "premium" is: a serif headline font (reads as
editorial/newspaper, confirmed in `globals.css` — `--font-headline: Georgia, ...`), almost no
motion despite Framer Motion being installed, a dead header nav, and generic component chrome
(flat list rows, no icons, no hover feedback) rather than dashboard-grade cards.

## Visual Quality

| Area | Score | Note |
| --- | --- | --- |
| Typography | 4/10 | Serif headline (Georgia) reads editorial/newspaper, not analytics software. Body font stack is fine (system sans). Hierarchy otherwise reasonable (clamp-based responsive sizing exists). |
| Layout | 6/10 | Consistent `max-w-*` containers, decent structure. No dashboard-style grid/KPI-tile pattern anywhere — everything is single-column lists/cards. |
| Spacing | 6/10 | Reasonably consistent via Tailwind spacing scale, no arbitrary one-offs found. |
| Color | 6/10 | UI tokens (`globals.css`) and visualization tokens (backend `themes.py`, 12 real WCAG-AA-checked palettes) are already properly separated architecturally — this is a genuine strength, just not visible in the *UI chrome* (no colorful accents/icons anywhere outside charts). |
| Charts | 7/10 | Real Vega-Lite rendering, theme-driven colors, reference-line annotations, accessible text annotations. Axis/legend defaults are Vega-Lite stock, not tuned. |
| Components | 5/10 | Functional, accessible-by-default (semantic HTML, focus rings), but visually flat — no icons, no shadows, no hover states on most interactive elements. |
| Information hierarchy | 6/10 | Clear page structure, but dense screens (dataset detail) have no visual grouping beyond headings — everything is the same card style. |

## UX Quality

| Area | Score | Note |
| --- | --- | --- |
| Upload | 5/10 | Click-to-browse only, no drag-drop, no upload progress bar (status pill only, polls every 1.5s). |
| Processing | 4/10 | `ProcessingState` is a generic pulsing-dot + label — no staged progress (Uploading → Ingesting → Profiling shown as one flat label, not a sequence). |
| Dataset understanding | 7/10 | Profile grid is clear and functional. |
| Recommendations | 7/10 | Real data-driven cards (fixed this session to drop narrative framing), static chart-type glyph instead of live preview. |
| Theme selection | 6/10 | Functional swatch grid, no transition/preview animation. |
| Visualization Studio | 6/10 | Real live editing (chart type, fields, aggregation, theme, annotations all persist), but visually a plain two-column form, not an "editor" feel — no toolbar, no distinct canvas framing beyond a border. |
| Export | 7/10 | Works, persists, but no visible confirmation beyond an implicit download. |

## Motion

**Framer Motion is installed but essentially unused.** Grep confirms exactly one file
(`recommendation-card.tsx`) imports `motion`, using only `initial`/`animate`/`transition` for a
staggered fade-in. No `AnimatePresence`, `whileHover`, `whileTap`, `layout`, `layoutId`, or
`variants` anywhere in the codebase.

| Area | Motion used? | Implementation | Quality |
| --- | --- | --- | --- |
| Landing | No | — | — |
| Dataset upload | No | — | — |
| Processing | No | CSS `animate-pulse` only (Tailwind, not Framer) | Generic |
| Data profiling | No | — | — |
| Recommendations | Yes | `motion.div` staggered fade-in-up | Good but isolated |
| Theme selection | No | — | — |
| Visualization studio | No | — | — |
| Inspector (properties panel) | No | — | — |
| Chart changes | No (Vega handles its own internal transitions) | — | — |
| Export | No | — | — |

Score: Quantity 2/10, Quality (of what exists) 7/10, Consistency 2/10 (one component only),
Performance N/A (too little to matter), UX value 3/10 (the one animation that exists is good
but the app otherwise gives zero motion feedback for state changes).

## Responsive

Not fully audited this pass (no viewport-by-viewport pass done this session) — Tailwind
responsive classes (`sm:`, `lg:`) are used consistently for grid columns on the recommendation
grids. Studio's two-column layout (`lg:grid-cols-[1fr_260px]`) has no defined mobile behavior
below `lg` (stacks by default, untested). Scored provisionally:

- Desktop: 7/10 (verified functional this session via screenshots)
- Tablet: not verified
- Mobile: not verified — studio in particular likely needs real mobile-specific treatment, not just stacking

## Accessibility

- Keyboard: semantic HTML (`<button>`, `<select>`, `<input>`) used throughout — should be
  keyboard-operable by default, not explicitly tested with a full keyboard-only pass this session.
- Contrast: all 12 visualization themes are WCAG AA contrast-checked at construction time
  (`backend/pain, abhi abhi app upload kar raha tha app/visualization/themes.py`) — a real, tested strength. UI chrome contrast (text on
  `--surface-muted`, etc.) not formally audited.
- Focus: `focus-visible:ring-2` wired into the `Button` component; plain `<select>`/`<input>`
  elsewhere rely on browser defaults (not explicitly styled, but not suppressed either).
- Reduced motion: handled globally via a CSS rule in `globals.css` that zeroes all
  animation/transition durations under `prefers-reduced-motion: reduce` — blunt but functional.

---

## Screenshot Comparison

Extracting visual *principles* only, not product structure, per the brief.

### Reference: KPI/stat-tile dashboard (image 1)

**Valuable characteristic:** compact stat tiles (icon + label + big number + delta indicator)
give an at-a-glance summary before the detail charts.
**Current AiVis:** no stat-tile pattern anywhere; the dataset profile grid shows raw column
metadata (name, type, null/unique counts) as flat cards, not KPI-style tiles.
**Gap:** no summary/at-a-glance layer above the detail views.
**Recommendation:** not P0 — AiVis's "KPIs" would be dataset-level (row count, column count,
insight count) which already exist as plain text; a tile treatment is cosmetic, defer to P2.
**Priority:** P2

### Reference: sans-serif typography with clear weight hierarchy (all images)

**Valuable characteristic:** every reference uses a single sans-serif family with weight/size
doing the hierarchy work — no serif mixed in.
**Current AiVis:** `Headline`/`SectionHeading` use a serif stack (Georgia), everything else
sans — the mixed pairing reads editorial, not software.
**Gap:** serif headline font is the single biggest visual signal pulling AiVis toward
"editorial" rather than "analytics software."
**Recommendation:** switch `--font-headline` to the same sans stack as body, differentiate via
weight (bold/semibold) instead of family. **Implemented this session** (see below).
**Priority:** P0

### Reference: soft depth via subtle shadows/borders on cards (images 1, 4, 5)

**Valuable characteristic:** cards have a soft shadow or subtle border giving gentle depth
without looking heavy.
**Current AiVis:** cards use a flat 1px border only, no shadow (`Card` component,
`border border-border`).
**Gap:** flatter than the references; acceptable for a restrained aesthetic but worth a subtle
shadow token.
**Recommendation:** add a `shadow-sm`-equivalent token for interactive cards (recommendation
cards, dataset rows) — not global, to avoid heaviness. Deferred to P1 (cosmetic, low risk,
not done this session to keep this pass bounded).
**Priority:** P1

### Reference: purposeful, subtle motion (hover states, panel transitions — images 2, 3)

**Valuable characteristic:** hover/selection states have visible, quick feedback; panels
transition rather than snap.
**Current AiVis:** confirmed via grep — motion is essentially absent outside one card
component.
**Gap:** largest UX gap found this session.
**Recommendation:** add `whileHover`/`whileTap` micro-feedback to interactive cards and
buttons, and a real staged processing indicator. **Partially implemented this session**
(see below) — full studio-panel-transition treatment deferred to P1.
**Priority:** P0 (baseline hover/press feedback), P1 (full panel transition system)

### Reference: dead-simple, always-visible primary navigation (all images)

**Valuable characteristic:** left rail or top nav is always clickable, current section
clearly indicated.
**Current AiVis:** header nav items ("Projects", "Datasets") are plain `<span>` elements with
no `href` and no click handler — **completely non-functional**, found while reading
`app-shell.tsx` for this audit.
**Gap:** this is a functional bug, not a polish gap — users cannot navigate via the header at
all today (only via the "Datasets" link inside a project or the landing-page CTA).
**Recommendation:** wire nav items to real routes. **Implemented this session** (see below).
**Priority:** P0

---

## Implementation Plan

### P0 (implemented this session)

1. **Fix dead header nav** — `AppShell`'s "Projects"/"Datasets" were unclickable `<span>`s.
2. **Typography**: `--font-headline` switched from serif (Georgia) to the same sans stack as
   body text; `Headline`/`SectionHeading` given explicit `font-semibold`/`font-bold` for
   hierarchy without a serif crutch.
3. **Baseline motion**: hover/press micro-feedback (`whileHover`/`whileTap`) added to
   `Button` and `RecommendationCard`; a real staged `ProcessingState` (shows the actual
   pipeline stage, not a generic pulsing dot) used for dataset processing and insight analysis.

### P1 (not done this session — flagged, not forgotten)

- Subtle card shadow token for depth.
- Real drag-and-drop upload with progress feedback (not just a status pill).
- Studio panel-transition motion (inspector, chart-type switch, theme switch).
- Dark-mode toggle — `.dark` CSS variables already exist in `globals.css` but nothing ever
  applies the class; no toggle exists anywhere in the UI.
- Mobile/tablet-specific studio layout (currently just stacks the two-column grid).
- Chart axis/legend tuning beyond Vega-Lite defaults.

### P2 (cosmetic, low priority)

- KPI-tile-style dataset summary above the profile grid.
- Icons in nav/buttons/list rows.

---

## Final Questions

**Product**

1. Does AiVis now clearly feel like an analytics/data visualization platform? — Closer after
   this session's copy pivot (dropped "story"/"editorial" framing) and typography fix, but
   full "professional software" feel needs the P1 motion/depth work too.
2. Does anything accidentally make it feel like editorial/news? — The serif headline was the
   main offender; fixed this session.
3. Does the UI prioritize visualization over chrome? — Yes structurally (charts are the
   largest element on every screen that has one), not yet visually (no shadow/depth
   distinguishing the chart canvas from surrounding chrome).

**Visuals**
4. Graphical quality vs. references? — Charts themselves: close (real Vega-Lite, theme-driven,
   WCAG-checked colors). Surrounding UI chrome: not yet — flatter, less depth, less motion.
5. Typography sophistication? — Adequate after this session's fix; not yet using a distinct
   display weight/optical size the way the references do.
6. Charts visually polished? — Yes for what's implemented (bar/line/area/scatter/histogram/
   box/donut via Vega-Lite with theme-driven color, annotations); no bespoke D3 charts yet
   (treemap/choropleth/sankey are registry-defined but unimplemented).
7. Spacing/composition intentional? — Yes, consistent Tailwind scale used throughout.

**Motion**
8. Is Motion actually installed? — Yes, `framer-motion@^13`.
9. Where used? — One component (`RecommendationCard`) before this session; extended to
   `Button` and processing states this session.
10. Meaningfully improving UX? — The one pre-existing use (card entrance) is good; the app
    otherwise gave zero motion feedback before this session.
11. Where should it still be added? — Studio panel transitions, theme-switch preview,
    upload drag-over feedback (all P1, not done this session).
12. Reduced-motion supported? — Yes, globally via CSS, functional but blunt (kills all
    transitions rather than substituting reduced variants).

**UX**
13. Is upload → analysis → recommendations → studio intuitive? — Yes, verified live
    end-to-end multiple times this session; the flow itself works well.
14. Does AI enhance without becoming a chatbot? — Yes — there is no chat UI at all (correctly
    out of scope per Phase 2), AI assists quietly via insight/recommendation generation only.
15. Does the Studio feel like professional software? — Functionally yes (real live editing,
    versioning, export), visually not yet (plain two-column form, no toolbar/canvas framing).

**Engineering**
16. Maintainable? — Yes, clean separation (lib/api, lib/visualization, components), typed
    throughout, no `any` in application code.
17. Reusable components? — Yes (`Button`, `Card`, typography primitives, `RecommendationCard`,
    `VisualizationRenderer`, `AnnotationList` all reused across screens).
18. Responsive? — Partially verified (recommendation grids), studio/mobile not fully audited.
19. Performant? — No obvious red flags (no huge unmemoized re-renders found), not profiled.
20. Accessible? — Reasonable baseline (semantic HTML, focus rings, WCAG-checked chart colors,
    reduced-motion support); no formal screen-reader or full keyboard-only pass done.
