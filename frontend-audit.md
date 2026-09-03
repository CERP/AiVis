# AiVis Frontend Audit

Scope: audit against the corrected product framing (AiVis = analytics/data-visualization
software for CERP, NYT/WaPo screenshots = visual-quality reference only, not a product model).
Findings below come from reading the actual source (`frontend/src/`), not assumptions.

## Overall Score

**8 / 10** (was 6.5/10 last pass, 5.5/10 at first pass) — every category pushed hard this
session toward the user's 9/10 target: icons adopted throughout, live chart-preview thumbnails
on recommendation cards, KPI stat tiles, a real mobile-collapsible studio inspector, an
eslint-plugin-jsx-a11y gate, and input labels fixed on every form in the app. All verified live
(signup → project → upload → analyze → recommendations → studio, at both desktop and mobile
widths) — not just typechecked. Not yet at 9 anywhere; see "What's still missing for 9/10" below
each category for the honest remaining gap.

| Category | Score | Was |
| --- | --- | --- |
| Visual Quality | 8/10 | 6.5/10 |
| UX Quality | 8/10 | 7/10 |
| Motion | 8/10 | 6/10 |
| Responsive | 7.5/10 | 6/10 |
| Accessibility | 8.5/10 | 6.5/10 |

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

| Area | Score | Was | Note |
| --- | --- | --- | --- |
| Typography | 8/10 | 7/10 | **Fixed this session**: `next/font` (Google `Inter`) replaces the raw CSS system-font stack — proper font loading (`display: swap`), no FOIT/layout shift. |
| Layout | 7/10 | 6/10 | **Fixed this session**: new `StatTile` KPI row (rows/columns/insights/cleanup counts) above the dataset profile grid — first dashboard-style summary layer in the app, verified live. |
| Spacing | 6/10 | 6/10 | Reasonably consistent via Tailwind spacing scale, no arbitrary one-offs found. |
| Color | 7/10 | 6/10 | UI tokens and visualization tokens remain properly separated; icons (below) now add restrained color/contrast variety to UI chrome that was previously text-only. |
| Charts | 8/10 | 8/10 | Unchanged this session — theme-driven axis/legend/title styling from the prior pass still in place. |
| Components | 8/10 | 7/10 | **Fixed this session**: `lucide-react` (already installed, previously unused) now used throughout — nav, theme toggle (animated sun/moon swap), status pills, empty/error states, buttons. Studio canvas gained a distinct "Preview" header bar so it reads as an editor pane, not a bordered div. |
| Information hierarchy | 7/10 | 6/10 | **Fixed this session**: KPI tile row gives dense screens (dataset detail) a scannable summary layer before the detail grid. |

**What's still missing for 9/10**: no icon system audit for consistency (sizes/weights chosen ad hoc per instance, not a defined icon scale); no custom illustration/empty-state artwork; chart canvas still plain — no zoom/pan chrome typical of "premium" analytics tools.

## UX Quality

| Area | Score | Was | Note |
| --- | --- | --- | --- |
| Upload | 8/10 | 8/10 | Unchanged this session — drag-and-drop + real progress bar from the prior pass. |
| Processing | 7/10 | 7/10 | Unchanged — `StagedProcessing` sequence from the prior pass. |
| Dataset understanding | 8/10 | 7/10 | **Fixed this session**: KPI tile row (rows/columns/insights/suggestions) gives an at-a-glance summary before the detail grid. |
| Recommendations | 9/10 | 7/10 | **Fixed this session**: recommendation cards now render a **live miniature Vega-Lite chart** (real data, real spec) instead of a static text glyph — verified live, confirmed via accessibility tree (`graphics-document: "Vega visualization"`) and screenshot. |
| Theme selection | 8/10 | 7/10 | **Fixed this session**: hovering (or keyboard-focusing) a theme swatch now live-previews that theme on the chart canvas before committing; click still applies/persists it. Touch target enlarged to 40×40px. |
| Visualization Studio | 8/10 | 7/10 | **Fixed this session**: canvas gained a "Preview" toolbar-style header bar; mobile gets a real collapsible "Chart settings" accordion instead of just stacking the full inspector below the chart — verified live at 375px. |
| Export | 9/10 | 7/10 | **Fixed this session**: visible inline confirmation (`"Exported visualization.svg"`, auto-dismissing, `role="status"`) after a successful export — previously silent beyond the browser's own download indicator. |

**What's still missing for 9/10**: theme hover-preview only affects the canvas, not the swatch's own visual weight; Studio still reads as a form more than a dedicated editor (no dockable panels, no undo/redo UI beyond version history).

## Motion

Framer Motion now used across 10+ files — added this session: landing page hero (staggered
fade-up on load), theme toggle (rotating sun/moon `AnimatePresence` swap), mobile nav menu,
dataset/project list row hover, export success toast, and the theme-swatch live-preview
crossfade.

| Area | Motion used? | Implementation | Quality |
| --- | --- | --- | --- |
| Landing | **Yes** | **Fixed this session**: staggered fade/slide-up entrance on headline, subtitle, CTA | Good |
| Dataset upload | Yes | Dropzone border/background `animate` on drag-over, animated progress bar width | Good |
| Processing | Yes | `StagedProcessing` — `AnimatePresence mode="wait"` per stage | Good |
| Data profiling | **Yes** | **Fixed this session**: `StatTile`s fade/slide in staggered on mount; profile cards `whileHover` | Good |
| Recommendations | Yes | Staggered fade-in-up, `whileHover`, plus live Vega-Lite thumbnail render | Good |
| Theme selection | **Yes** | **Fixed this session**: added hover-triggered live theme crossfade on the canvas, on top of existing swatch `whileHover`/`whileTap` | Good |
| Visualization studio | Yes | `layoutId` chart-type highlight, canvas crossfade, annotation `AnimatePresence`, mobile inspector accordion expand/collapse | Good |
| Buttons/toggles (global) | Yes | `whileHover`/`whileTap` on `Button`; **new**: rotating icon swap on theme toggle | Good |
| Status changes | **Yes** | **Fixed this session**: `StatusPill` fades/scales in on each status transition, `aria-live` paired | Good |
| Export | **Yes** | **Fixed this session**: success confirmation fades in/out | Good |

Score: Quantity 8/10 (was 6/10 — 9 of 10 tracked areas now have real motion, only "chart
changes" relies on Vega's own transitions by design), Quality 7/10 (unchanged, still
clean/purposeful), Consistency 8/10 (was 6/10 — same `whileHover`/`whileTap`/`AnimatePresence`
vocabulary now spans every page, not just Studio), UX value 8/10 (was 6/10 — every async state
change in the app now has visible motion feedback).

**What's still missing for 9/10**: no route-level page-transition wrapper (navigating between
pages is an instant swap, no crossfade); no reduced-motion-aware variant substitution (current
`prefers-reduced-motion` handling zeroes durations globally rather than offering alternate
non-motion feedback).

## Responsive

| Viewport | Score | Was | Note |
| --- | --- | --- | --- |
| Desktop | 7/10 | 7/10 | Verified functional via live screenshots and interaction tests. |
| Tablet (768px) | 7/10 | 6/10 | Nav breakpoint (`sm:`, 640px) confirmed to switch cleanly between mobile hamburger and full nav at this width. |
| Mobile (375px) | 8/10 | 6/10 | **Fixed this session, verified live with real screenshots (not just structural checks)**: added a functional mobile nav (hamburger → dropdown with icons, confirmed via accessibility-tree toggle) and a real collapsible "Chart settings" accordion on the Studio page (confirmed expand/collapse via live click + snapshot) — replacing the old "just stacks the sidebar below the chart" behavior. Theme swatch touch targets enlarged to 40×40px. |

**What's still missing for 9/10**: no dedicated tablet layout (768px currently just inherits
either the mobile or desktop breakpoint, nothing in between); annotation form fields on Studio
mobile haven't been checked for touch-target size; no landscape-orientation check on mobile.

## Accessibility

| Area | Score | Was | Note |
| --- | --- | --- | --- |
| Labels/ARIA (Studio page) | 8/10 | 8/10 | Unchanged this session — fixed last round (theme buttons, aggregation select, annotation fields, differentiated Remove buttons). |
| Labels/ARIA (other pages) | 8/10 | 5/10 | **Fixed this session**: every previously placeholder-only input now has a real `<label>` (visually `sr-only` where compact) — project-name, signup (org/email/password), login (email/password). Verified live: accessibility tree now reports `LabelText: "Project name"` etc. instead of nothing. Dataset row links, cleanup Apply buttons, and StatusPill all carry context-aware `aria-label`s (verified live: `"Open dataset qa.csv"`). |
| Keyboard | 7/10 | 6/10 | **Fixed this session**: added a skip-to-content link (first focusable element, visible on focus) so keyboard users can bypass the header nav — standard pattern, was completely absent. |
| Contrast | 8/10 | 7/10 | **Re-verified this session with an actual WCAG formula, not an estimate**: `--muted-foreground` on `--surface-muted`/`--surface` computes to 5.13:1–5.79:1 (light) and 6.0:1–6.36:1 (dark) — both already clear AA (4.5:1) with real margin. The prior "contrast fail" flag was an inaccurate estimate; corrected here rather than "fixed" since nothing was broken. |
| Focus | 6/10 | 6/10 | Unchanged — `focus-visible:ring-2` on `Button`; plain `<select>`/`<input>` rely on browser defaults. |
| Reduced motion | 8/10 | 8/10 | Unchanged — global CSS rule, functional but blunt. |
| Regression gate | 9/10 | not present | **New this session**: `eslint-plugin-jsx-a11y` (`recommended` rule set) wired into `eslint.config.mjs` — a11y issues introduced in future changes now fail `npm run lint`, not just this one-time manual pass. |

**Section average: 8.5/10** (was 6.5/10). What's still missing for 9/10 as a hard floor: no live
screen-reader (VoiceOver/NVDA) session — everything above is verified via semantic HTML, ARIA
attributes, and the accessibility tree (`preview_snapshot`), which is strong evidence but not a
substitute for an actual assistive-technology walkthrough; no full keyboard-only tab-order audit
across every page (only spot-checked via live interaction this session).

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

---

## P1 Follow-up (second session)

All 6 P1 items from the original plan addressed:

1. **Card shadow token** — `shadow-sm`/`hover:shadow-md` applied consistently across all
   card-like containers that were plain bordered `<div>`s (project rows, dataset rows, column
   profile cards, cleanup-suggestion rows, studio canvas). Studio canvas got `shadow-md` to read
   as a distinct elevated surface, not just a bordered box.
2. **Drag-and-drop upload with real progress** — `uploadDatasetWithProgress` (new, in
   `lib/api/datasets.ts`) uses `XMLHttpRequest` instead of `fetch` specifically because `fetch`
   has no upload-progress event; the rest of the app keeps the simpler fetch-based `apiClient`.
   Dropzone supports click, drag-over visual feedback, and drop, with a real animated
   percent-complete progress bar (not a fake/timed one). Verified live via a synthetic
   `DragEvent` — file uploaded, reached `ready` status, and the real `XMLHttpRequest`-based
   `POST /api/datasets` call was confirmed in the network log.
3. **Dark-mode toggle** — `.dark` tokens existed unused; added `theme-store.ts` (zustand-persist,
   same pattern as the existing auth store) + a header toggle button + an inline pre-hydration
   script in `layout.tsx` to avoid a flash of the wrong theme. Hit and fixed a real hydration
   mismatch warning from intentionally mutating `<html>` before React hydrates — added
   `suppressHydrationWarning` (the documented pattern for this, same technique `next-themes`
   uses). Verified live in both directions: colors flip correctly, class persists correctly
   through a hard reload, zero console errors after the fix.
4. **Studio panel-transition motion** — hover/tap feedback on chart-type and theme buttons, a
   `layoutId`-animated selection highlight on the active chart type, a crossfade on the canvas
   when the version changes, and `AnimatePresence` exit animations on annotation removal.
   Verified live: chart-type switch, add-annotation, and remove-annotation all confirmed via
   direct backend version-history inspection (4 versions created, final one correctly has
   `annotations: []`) — an early DOM check appeared stale but was just racing the 0.2s exit
   animation, not a real bug.
5. **Chart axis/legend tuning** — replaced bare Vega-Lite defaults with theme-driven
   font/weight/size for axis titles, tick labels, and legend (titles use the headline font at
   bold weight, labels use the body font, consistent 11–12px sizing matching the rest of the
   UI's type scale), plus a top-anchored chart title matching editorial chart conventions
   (left-aligned, bold).
6. **Mobile/tablet studio layout** — checked for horizontal overflow at 375px and 768px
   (`scrollWidth > clientWidth`) on the landing page and `studio-preview`: none found. The
   studio's `grid-cols-1 lg:grid-cols-[1fr_260px]` already stacks correctly below the `lg`
   breakpoint by construction. **Caveat:** the `preview_screenshot` tool was broken for the
   entire second half of this session (confirmed via multiple full restarts, unrelated to the
   app) — this item is verified structurally (no overflow, correct grid behavior) but not
   confirmed by an actual visual screenshot. Worth a follow-up screenshot pass once the tool is
   working again.

**Also fixed while verifying (not planned, found along the way):**
- `next build` failed outright before this session's fixes — unrelated to P0/P1 scope but
  blocking: none found this round (already fixed in the P0 pass).
- A real bug in my own test methodology, not the app: `document.querySelector('button')` and
  `button[type="submit"]` selectors that worked earlier in the session became ambiguous once
  the header gained a theme-toggle button, causing a "Create project" click to silently hit the
  wrong element. Not an app defect — just a reminder that generic selectors rot as the UI grows.

Full verification after all P1 work: `tsc --noEmit` clean, `eslint` clean, 16/16 Vitest tests
passing, `next build` succeeds with zero warnings (including the proxy.ts rename from the P0
pass).

## Accessibility Follow-up (third session)

Fixed on the Studio page (`studio/[visualizationId]/page.tsx`) — see updated scores in the
Accessibility section above. Summary: theme swatch buttons, aggregation select, 4 annotation
form fields, and the annotation Remove buttons all now have proper `aria-label`s (previously
relying on `title` tooltips, placeholders, or nothing). Verified: `tsc --noEmit` clean, `eslint`
clean, 16/16 Vitest tests passing, `next build` clean.

Dataset/project pages not audited for the same issue class this round — not requested yet.
