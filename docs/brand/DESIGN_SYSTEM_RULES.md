# Sona Design System Rules

An operational reference for engineers and designers. Where the Brand Guidelines describe *what* the system is, this document describes *how to make decisions* — the rules, logic trees, and caveats that turn brand intent into shipped UI.

All class names, values, and patterns referenced here are live in the codebase. Nothing is aspirational.

---

## 1. Design Principles

Five principles that translate the Sona brand strategy into concrete visual and interaction decisions. Each decision you make at the component level should be traceable back to at least one of these.

---

### 1.1 Sona is the frame, not the picture

**Definition.** The interface recedes. The person behind the Sona is the product. Every design choice should reduce visual noise and let the portrait fill the space.

**Do.** Keep backgrounds white. Use colour only for functional accent (completion, active state). Let avatars and names dominate the visual hierarchy on portrait cards.

**Don't.** Add decorative gradients, tinted panels, or coloured backgrounds to fill empty space. Don't place interface chrome — buttons, tags, badges — where they compete with a person's name or face.

---

### 1.2 Precision over decoration

**Definition.** Every element earns its pixel. Restraint is not minimalism for its own sake — it is a deliberate signal of quality. Sona's aesthetic communicates: "we are not trying too hard."

**Do.** Use a single accent colour. Remove anything that does not serve comprehension or navigation. When in doubt, use less.

**Don't.** Add drop shadows to text, add gradients where a flat colour works, or add icons beside labels that are already self-explanatory. Resist the temptation to fill whitespace — the whitespace is doing work.

---

### 1.3 Two voices, one language

**Definition.** Cormorant carries personality and humanity. Geist carries function and knowledge. The contrast between them *is* the design — it mirrors the product concept of personality fused with expertise. Never collapse this distinction.

**Do.** Use Cormorant italic for any content that carries emotional weight: names, stats, headings, confirmations. Use Geist for everything operational: labels, buttons, descriptions, navigation, form fields.

**Don't.** Use Geist for hero headlines. Don't use Cormorant for button text, labels, or anything interactive. Don't use Cormorant upright — if it appears without `fontStyle: 'italic'`, it is wrong.

---

### 1.4 State is communicated through weight and opacity, not colour

**Definition.** Sona uses a single accent colour. This means states (done, inactive, muted, disabled) must be communicated through typographic weight, opacity, and greyscale — not by adding colours.

**Do.** Indicate completion with strikethrough + `#b0b0b0` text + coral checkmark. Indicate inactivity with `opacity: 0.4`. Indicate hierarchy with `fontWeight: 300` vs `400` vs `500`.

**Don't.** Introduce new colours to mean "completed," "warning," or "optional." Don't use blue for links or green for success in the primary UI flow — reserve status colours (`#2a7c4f`, `#b08850`) for badge pills only.

---

### 1.5 Motion must feel inevitable, not decorative

**Definition.** Transitions exist to confirm that an interaction happened, not to entertain the user. Every animation should be so fast and purposeful that the user barely notices it — they just feel a sense of responsiveness.

**Do.** Use `0.15s ease` for all interactive element state changes. Use `0.2s ease` for card entrance/shadow transitions. Keep the `bounce` keyframe animation (chat streaming dots) as the only keyframe animation.

**Don't.** Add entrance animations to page sections. Don't animate layout changes. Don't use `ease-in-out` or `cubic-bezier` curves that create a "bouncy" or "springy" feel — Sona is precise, not playful.

---

## 2. Visual Hierarchy System

### 2.1 The two-font hierarchy model

Every surface in Sona maps to one of two registers:

| Register | Font | Style | Role |
|---|---|---|---|
| Editorial | Cormorant Garamond | Italic, weight 400 | Names, headings, numerals, emotional beats |
| Operational | Geist Sans | Upright, weight 300–500 | Navigation, labels, descriptions, inputs, buttons |

The decision rule is simple: **if a user needs to feel something, use Cormorant. If a user needs to do something or read information, use Geist.**

Specific examples:
- A person's name on a card → Cormorant (emotional)
- The subscriber count below that name → Geist (informational)
- The big stat numeral on the dashboard → Cormorant (it should feel significant)
- The label above that stat ("Subscribers") → Geist (operational context)

### 2.2 When to use display type (Cormorant)

Use Cormorant when the text is:
- A human name (portrait name in SonaCard, DashboardNav, profile page)
- A page heading (all `h1` elements in the Sona product)
- A large numeral that carries meaning (subscriber count, MRR)
- A confirmation or state heading ("Interview requested", "Link sent")
- An editorial statement in a promotional context (landing page)
- A banner title inside a dark card (the next-action banner)

Size guidance:
```
Hero (landing page):        clamp(3.75rem, 7vw, 6.5rem)
Explore / home page h1:     clamp(2.5rem, 4vw, 3.25rem)
Dashboard h1:               clamp(1.75rem, 3vw, 2.25rem)–clamp(1.75rem, 3vw, 2.5rem)
Banner / card heading:      1.375rem
Auth heading:               1.625rem
Stats numeral:              2.5rem
SonaCard name:              1.375rem
```

All Cormorant uses share:
```tsx
fontStyle: 'italic',
fontWeight: 400,
letterSpacing: '-0.02em',    // –0.01em for smaller sizes (< 1.25rem)
lineHeight: 1.0–1.2,
```

### 2.3 When to use UI type (Geist)

Use Geist for everything that is not covered by the Cormorant rules above. Within Geist, weight creates sub-hierarchy:

| Weight | Context |
|---|---|
| 300 | Body descriptions, taglines, checklist sub-text, input values, textarea content |
| 400 | Navigation links, standard labels, meta text, informational content |
| 500 | Section labels (uppercase), active nav states, CTA button text, badge text |

### 2.4 The "jewel on white" principle

The visual metaphor is a jewel in a display case. The case (the interface) should be as neutral and minimal as possible — white, bordered, quietly structured — so the jewel (the portrait, the person) dominates.

In practice:
- Page backgrounds are always `#ffffff`. No exceptions.
- Card backgrounds are always `#ffffff` (or `#fafafa` for input fields).
- The dominant visual on a portrait card is the avatar, then the name. Everything else — tagline, category, price — is secondary.
- Negative space is intentional. A page that feels "too empty" is usually correct.
- If you feel the urge to add visual decoration to fill space, add whitespace instead.

---

## 3. Colour Usage Rules

### 3.1 The complete palette

```
Ink:        #1a1a1a     Primary text, dark buttons, headings
Coral:      #DE3E7B     Accent only — see rules below
Muted:      #6b6b6b     Secondary text, inactive nav links, taglines
Dim:        #b0b0b0     Labels, meta, checklist descriptions, form labels
Ghost:      #c0c0c0     Very muted — subscriber counts, optional tags, disabled states
White:      #ffffff     All page and card backgrounds
Near-white: #fafafa     Textarea and bordered-input backgrounds
Dash bg:    #f7f7f7     Dashboard sub-nav bar only
```

CSS theme tokens (in `globals.css`):
```css
--color-ink:    #1a1a1a
--color-coral:  #DE3E7B
--color-muted:  #6b6b6b
--color-border: rgba(0,0,0,0.08)
--color-white:  #ffffff
```

### 3.2 Coral: the exact rules

Coral (`#DE3E7B`) is Sona's single brand colour. Its power comes from its scarcity. Every new use of coral must be justified against this list.

**Coral IS used for:**

| Use | Implementation |
|---|---|
| Active filter/tab underline | `borderBottom: '2px solid #DE3E7B'` |
| Completion checkmark circle (large) | 48px filled circle, white SVG check inside |
| Completion checkmark circle (small) | 20px filled circle, white SVG check inside |
| Category dot in SonaCard footer | 5px filled circle (`backgroundColor: '#DE3E7B'`) |
| Unlock status dot (when unlocked) | 6px filled circle |
| Unlock label text (when unlocked) | `color: '#DE3E7B'` |
| Text selection highlight | `::selection { background: #DE3E7B }` in globals.css |
| Coral mark decorative element | Radial gradient SVG circle, used on landing and empty states |

**Coral is NEVER used for:**
- Button backgrounds (primary buttons are `#1a1a1a`, not coral)
- Borders of any kind
- Body text or heading text
- Error or warning states
- Hover state colour changes
- Background fills of sections, panels, or cards
- Decorative solid fills without gradient fade

**The rule in one sentence:** coral appears as a small filled circle or a 2px underline — never as a large fill, never as text colour in the main UI flow.

### 3.3 Ink: primary text and button fill

`#1a1a1a` is used for:
- All primary body text (default)
- All `h1`–`h6` headings
- Dark pill button backgrounds (the primary CTA)
- Active navigation links and active sort options
- Input values after typing
- The next-action banner background (the dark card)

Do not substitute near-black values like `#111111`, `#0a0a0a`, or Tailwind's `gray-900`. Use `#1a1a1a` consistently.

### 3.4 The muted/dim/ghost scale

Choose the shade based on content importance:

| Shade | Hex | When to use |
|---|---|---|
| Muted | `#6b6b6b` | Actively readable secondary content — taglines, nav links in default state, body paragraphs in cards |
| Dim | `#b0b0b0` | Labels and meta the user may want but doesn't need to scan — form labels, stat labels, checklist descriptions, optional indicators |
| Ghost | `#c0c0c0` | Background noise — subscriber counts, rating counts, right-arrow affordances, disabled chevrons, content the user ignores most of the time |

Completed items (strikethrough in checklist) use Dim (`#b0b0b0`) text to signal they are out of the user's action path without disappearing entirely.

### 3.5 Border system

Choose based on what you are surrounding:

| Context | Value | Why |
|---|---|---|
| Cards, panels, lists | `1px solid rgba(0,0,0,0.07)` | Standard surface boundary |
| Card hover state | `1px solid rgba(0,0,0,0.14)` | Handled by `.sona-card` hover class |
| Underline input (default) | `1px solid rgba(0,0,0,0.15)` | Slightly stronger to remain legible at bottom-only placement |
| Underline input (focus) | `1px solid #1a1a1a` | Hard ink — confirms active state |
| Bordered textarea | `1px solid rgba(0,0,0,0.08)` | Full border, slightly lighter than standard card |
| Filter bar top/bottom | `1px solid rgba(0,0,0,0.06)` | Very subtle — separates sticky bar from content |
| Section divider within a card | `1px solid rgba(0,0,0,0.05)` | Lightest possible — within a card's interior (unlock list rows) |
| Outline pill button | `1px solid rgba(0,0,0,0.08)` | Matches bordered-card weight |

**When to use a shadow instead of a border:** Only on card hover (`.sona-card:hover` adds `0 4px 24px rgba(0,0,0,0.06)`). Static cards use border only. No other surfaces use box-shadow in the standard pattern.

**When to use neither:** Dark pill buttons, dark banner cards, and the nav bar (which uses backdrop blur to separate from content) need no border.

**Avoid:** Solid grey borders like `1px solid #e5e5e5`. They are heavier and cruder than the `rgba` equivalents.

### 3.6 Status colours

These are not brand colours. Use them only inside badge pill elements:

```
Success / Live:    color #2a7c4f    background rgba(42,124,79,0.08)
In review:         color #b08850    background #fef9ef
Save confirmation: color #1a7a5a    background rgba(26,122,90,0.07)
```

Never use these in body text, headings, or as background fills for sections.

---

## 4. Spacing and Layout System

### 4.1 Spacing scale

Sona uses a base-4 spacing scale derived consistently across the codebase:

| Token | px | Common uses |
|---|---|---|
| 2 | 2px | Tight badge padding (top/bottom) |
| 4 | 4px | Inline gap between icon and label |
| 6 | 6px | Subtitle margin below heading, gap in button group |
| 8 | 8px | Input padding, stat label margin |
| 10 | 10px | Form label margin-bottom, list row padding (top/bottom) |
| 12 | 12px | Card grid gap (minimum), row gap in lists |
| 14 | 14px | Checklist item gap, padded filter input |
| 16 | 16px | Card interior gap, filter tab padding (vertical 15px, horizontal 14px), section label margin |
| 20 | 20px | Card grid gap (standard, explore page), avatar margin-bottom in card |
| 24 | 24px | Standard card padding, search/sort gap, section spacing within dashboard card |
| 28 | 28px | Banner card padding (horizontal) |
| 32 | 32px | Between form fields, heading → first section, save banner margin |
| 40 | 40px | Page heading margin-bottom (settings), heading area padding |
| 48 | 48px | Grid top padding, major section separation |
| 56 | 56px | Nav bar height; page header top padding |
| 64 | 64px | Page bottom padding (minimum) |
| 96 | 96px | Empty state vertical padding, page bottom padding (explore) |

Do not introduce arbitrary spacing values. Every gap or padding should resolve to a value in this scale.

### 4.2 Page container widths

| Context | maxWidth | Notes |
|---|---|---|
| Auth pages | 320px | Login, signup — centered vertically in viewport |
| Dashboard settings | 520px | Narrow form — prevents long lines in underline inputs |
| Dashboard overview | 680px | Slightly wider — stats grid, checklist |
| Home / circle | 720px | Conversation-oriented |
| Dashboard shell | 1080px | Outer shell including sub-nav |
| Platform pages (explore, landing) | 1200px | Full-width content grids |

All containers use `margin: '0 auto'`. Page-level horizontal padding: `clamp(24px, 4vw, 48px)`.

### 4.3 Responsive strategy

Sona uses fluid sizing with `clamp()` rather than hard breakpoints wherever possible:

```tsx
// Typography — fluid
fontSize: 'clamp(2.5rem, 4vw, 3.25rem)'

// Padding — fluid
padding: '56px clamp(24px, 4vw, 48px) 40px'
```

Card grids use `auto-fill` with `minmax()` so column count adjusts automatically:

```tsx
// Portrait card grid (explore)
gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'

// Home value prop cards
gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'

// Stats (always 2-up)
gridTemplateColumns: '1fr 1fr'
```

For the sticky filter bar: `top: 56` (the nav height). The filter bar `position: sticky; top: 56` assumes the nav is always 56px tall — do not change nav height without updating all sticky sub-elements.

### 4.4 Card and container patterns

**Static card (non-interactive):**
```tsx
{
  backgroundColor: '#fff',
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 16,   // or 18 for the dashboard's larger cards
  padding: '24px',
}
```

**Interactive card (linked):**
```tsx
// Add className="sona-card" — hover adds border darkening and shadow
// borderRadius stays in inline style (Tailwind v4 strips it from class)
```

**Dark banner card:**
```tsx
{
  background: '#1a1a1a',
  borderRadius: 18,
  padding: '24px 28px',
}
```

**Border radius values in use:**
- `10px` — save success banner, checklist row hover pill
- `12px` — bordered textarea
- `14–16px` — standard cards (stats, unlock list)
- `18px` — larger dashboard cards (setup checklist, next-action banner)
- `980px` — all pill buttons and badges (use this exact value)

---

## 5. Component Decision Tree

Use these rules to decide which component pattern to reach for.

### 5.1 Interactive affordance: button vs. link vs. arrow link

**Use a dark pill button (`sona-btn-dark`)** when:
- The action is the primary CTA on the page (one per page)
- The action submits a form or triggers a significant state change
- The button is full-width inside a form (auth pages)

**Use an outline pill button (`sona-btn-outline`)** when:
- The action is secondary — navigating to a related page, viewing something
- The button appears alongside a dark pill button as a lower-priority option
- In nav contexts (small variant: `font-size: 0.875rem`, `padding: 8px 20px`)

**Use a `sona-link` (text link)** when:
- The action is tertiary — a footer link, an "already have an account?" escape
- Navigation links within the app (SonaNav, filter sort options)
- The link is inline within a paragraph or description

**Use a `sona-arrow-link`** when:
- The link carries a directional arrow (`↗` or `→`) as part of its affordance
- External links that navigate away (the "View public page ↗" pattern)

**Use a `sona-row-hover` row** when:
- The entire row is clickable but is not visually a button (checklist steps, list rows)
- The interaction is navigational, not a primary action

Decision summary:
```
Primary action → dark pill button
Secondary navigation → outline pill or sona-link
External link → sona-arrow-link + arrow glyph
Row-level navigation → sona-row-hover
```

### 5.2 Container: bordered card vs. row hover vs. plain container

**Use a bordered card** when:
- The content is a distinct unit (a stat block, a checklist, an unlock list)
- The content has internal structure (multiple elements that belong together)
- The card might become interactive in a future state (add `sona-card` class if so)

**Use `sona-row-hover`** when:
- The element is one item in a vertical list of similar items
- The item links to a sub-page or triggers a contextual action
- Adding a card border would create too many nested borders

**Use a plain container (no card, no border)** when:
- The section is a page heading + subtitle
- The content is a full-width grid (the explore card grid)
- The content is the page itself (no need to card-wrap the page)

**Never nest `.sona-card` inside another `.sona-card`.**

### 5.3 When to use a coral accent vs. leaving it monochrome

Use coral when:
- An item has transitioned to a *done* or *active* state that the user should notice
- A navigation tab is currently selected (active underline)
- A dot represents a category (SonaCard footer)

Leave it monochrome (ink/muted/dim/ghost) when:
- The item is in its default, neutral state
- The item is interactive but not currently selected
- You are displaying meta information (counts, dates, labels)

**The test:** if removing the coral leaves the UI still fully functional and legible, it should probably not have been coral.

### 5.4 When to use Cormorant vs. Geist

| Situation | Font |
|---|---|
| Page heading | Cormorant |
| A person's name | Cormorant |
| A large meaningful number | Cormorant |
| Confirmation/success heading | Cormorant |
| Section label (UPPERCASE) | Geist 500 |
| Button text | Geist 500 |
| Body description | Geist 300 |
| Form label | Geist 500 (uppercase, Dim colour) |
| Input value | Geist 300 |
| Navigation link | Geist 400 |
| Badge / status pill | Geist 500 |
| Meta (counts, dates) | Geist 400 or Ghost colour |

---

## 6. Tier Visual Language

### 6.1 The four tiers

| DB enum | Display name | Access level |
|---|---|---|
| `public` | Discovery | Free — base personality, public content |
| `acquaintance` | Perspective | Paid — deeper knowledge, curated content |
| `colleague` | Wisdom | Future — reserved |
| `family` | Legacy | Future — reserved |

Currently, paying subscribers receive `acquaintance` (Perspective). Wisdom and Legacy are reserved for creator-assigned future tiers.

### 6.2 Visual differentiation principle

Sona does not use colour to distinguish tiers. Colour complexity would undermine the single-accent system. Instead, tier depth is communicated through:

1. **Typography scale** — higher tiers unlock access to content that carries more Cormorant-weighted display text (more substantive, more personal)
2. **Content availability** — locked content is visually present but gated; unlocked content is fully rendered
3. **Border weight and radius** — use consistent card borders; do not create visual "premium" chrome for paid tiers

### 6.3 Tier badge rendering

When a tier badge must appear (content library, content source list):

```tsx
// Pattern: Geist 500, uppercase, pill shape
// No colour coding — use ink for active tiers, ghost for locked
<span style={{
  fontFamily: 'var(--font-geist-sans)',
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: isAccessible ? '#1a1a1a' : '#c0c0c0',
  backgroundColor: isAccessible ? 'rgba(0,0,0,0.05)' : 'transparent',
  border: isAccessible ? 'none' : '1px solid rgba(0,0,0,0.08)',
  padding: '2px 8px',
  borderRadius: '980px',
}}>
  {tierLabel}
</span>
```

**Active/accessible tier:** solid near-black fill, ink text.
**Locked tier:** outlined, ghost text — present but clearly inactive.

Do not use coral to indicate premium tiers. Coral is reserved for completion states, not for marketing hierarchy.

### 6.4 Tier selector in forms (content add form)

Use the chevron select pattern (`sona-input` class + inline SVG data URI arrow) with the tier's display name (`TIER_LABELS` from `src/lib/tiers.ts`). The selector itself has no tier-specific visual treatment — the label change is the entire signal.

---

## 7. Motion and Interaction Principles

### 7.1 The transition inventory

From `globals.css` — these are the only transitions in the system:

| Class | Property | Duration | Easing | Use |
|---|---|---|---|---|
| `.sona-link` | `color` | 150ms | ease | Text links darkening to ink on hover |
| `.sona-btn-dark` | `opacity` | 150ms | ease | Dark pill button fading on hover |
| `.sona-btn-outline` | `background-color` | 150ms | ease | Outline button gaining fill on hover |
| `.sona-arrow-link` | `opacity` | 150ms | ease | Arrow link fading on hover |
| `.sona-filter-tab` | `color`, `border-color` | 150ms | ease | Inactive filter tabs on hover |
| `.sona-input` | `border-color` | 150ms | ease | Underline input focusing |
| `.sona-row-hover` | `background-color` | 150ms | ease | List rows gaining fill on hover |
| `.sona-card` | `border-color`, `box-shadow` | 200ms | ease | Portrait cards on hover |

One keyframe animation exists:
```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50%       { transform: translateY(-4px); opacity: 1; }
}
```
This is used exclusively for the chat streaming indicator (three bouncing dots). It is not reused for other purposes.

### 7.2 What should feel instant

These interactions must have no transition — the response should feel immediate:

- Page navigation (Next.js router — already instant)
- Form submission feedback (server actions redirect or append `?saved=1`)
- Toggle state changes (open/closed, show/hide)
- Focus rings appearing on inputs

### 7.3 What should have a transition

These interactions benefit from the `0.15s ease` transition:

- Any element that changes `color`, `background-color`, or `opacity` on hover
- Input borders changing on `:focus`
- Filter tabs changing active state

Use `0.2s ease` (slightly longer) for:
- Card border darkening and shadow appearing on hover (`.sona-card`)

This extra 50ms for cards acknowledges that they are larger surfaces — the transition needs to feel weighted rather than snappy.

### 7.4 What must never animate

- Page section entrance (no fade-in, slide-in, or stagger effects)
- Layout shifts (no animated height changes)
- Avatar images loading (no fade-in — use the initial fallback)
- Any motion that could interfere with `prefers-reduced-motion`

The codebase does not currently respect `prefers-reduced-motion` in its transition classes. This is a known gap. When adding new animated elements, wrap them:

```css
@media (prefers-reduced-motion: reduce) {
  .sona-card { transition: none; }
}
```

### 7.5 Loading and empty states

**Loading (data fetching):** Sona uses server components wherever possible — pages load with data or redirect. For client-side loading, show a skeleton approach using the `rgba(0,0,0,0.04)` background fill that matches the avatar fallback pattern, not a spinner.

**Empty state pattern (from explore page):**
```tsx
<div style={{ textAlign: 'center', padding: '96px 0' }}>
  {/* Coral mark — faded radial gradient, 36x36 */}
  <p style={{
    fontFamily: CORMORANT, fontSize: '1.5rem', fontStyle: 'italic',
    fontWeight: 400, color: '#6b6b6b', margin: '0 0 10px',
  }}>
    No Sonas found.
  </p>
  <p style={{
    fontFamily: GEIST, fontSize: '0.875rem',
    fontWeight: 300, color: '#b0b0b0', margin: 0,
  }}>
    Try a different category or search term.
  </p>
</div>
```

Structure: coral mark (faded, 25% opacity) → Cormorant italic message (Muted colour) → Geist guidance (Dim colour). No buttons in a truly empty state unless there is a direct action the user can take (e.g., "Add content" when the content library is empty).

---

## 8. Iconography and Visual Elements

### 8.1 Icon system rules

Sona uses **inline SVG only**. There is no icon library import. All icons are defined at the point of use.

Rules:
- Stroke-based, single-path icons only — no filled icons (except the checkmark circle and coral mark, which are intentionally filled)
- Default stroke: `#c0c0c0` (Ghost) or `rgba(0,0,0,0.18)` for arrow glyphs
- Stroke width: `1.5` for navigation/chevron icons; `2.5` for the large white checkmark; `3` for the small white checkmark
- Size: 16×16 for inline navigation icons; size-matched to context for anything else

### 8.2 The icon inventory

```tsx
// Navigation affordance (right arrow — inline glyph, not SVG)
<span style={{ color: 'rgba(0,0,0,0.18)', fontSize: '0.875rem' }}>→</span>

// External link (inline glyph)
<span aria-hidden>↗</span>

// Chevron right (list row)
<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
  stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round">
  <path d="M6 3l5 5-5 5" />
</svg>

// Chevron down (select element — SVG data URI, see settings page pattern)

// Checkmark (large, in coral circle — 48px container)
<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
  stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
  <path d="M5 13l4 4L19 7" />
</svg>

// Checkmark (small, in coral circle — 20px container)
<svg width="10" height="10" viewBox="0 0 24 24" fill="none"
  stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
  <path d="M5 13l4 4L19 7" />
</svg>
```

### 8.3 When to use an icon vs. text vs. nothing

**Use an icon when:**
- A directional affordance is needed and text would over-explain it (right-arrow on a list row)
- A completion state must be communicated at a glance (coral checkmark circle)
- A chevron is needed inside a `<select>` element to replace the native OS arrow

**Use text instead of an icon when:**
- The label alone is sufficient (buttons with text CTAs need no icon)
- The action is a primary CTA — text is always clearer than an icon for primary actions

**Use nothing when:**
- The element is navigable and its label is self-explanatory
- Adding an icon would create visual competition with adjacent Cormorant content

### 8.4 The coral circle + white checkmark pattern

This pattern communicates: **a significant action is complete and requires no further user intervention.**

Use it for:
- Login link sent confirmation (48px circle)
- Interview request submitted confirmation
- Setup checklist steps (20px circle, inline with list row)
- Any "done" state where the user should feel a moment of satisfaction before moving on

Do not use it for:
- Inline success feedback inside a form (use the green save banner instead)
- Indicating that a toggle is "on" (use opacity or weight changes)
- Anything that needs to be undone or edited — the checkmark implies finality

### 8.5 The coral mark (decorative gradient circle)

The radial gradient SVG circle appears on the landing page (120px, full opacity) and in empty states (36px, 25% opacity via `opacity="0.25"`). It is purely decorative — always `aria-hidden`.

The gradient always fades from full coral at the centre to transparent at the edge. Never use a flat coral fill for the coral mark.

```tsx
// Empty state variant — use opacity 0.25 on the circle element
<circle cx="36" cy="36" r="36" fill="url(#grad)" opacity="0.25" />
```

Give each gradient a unique `id` per page (e.g., `emptyGrad`, `sonaGrad`) to avoid SVG namespace collisions when multiple instances appear on the same page.

---

## 9. Responsive Breakpoints

### 9.1 The breakpoint strategy

Sona primarily uses `clamp()` for fluid typography and `auto-fill` grids for fluid layouts. Explicit media queries are minimal. The codebase currently has no `@media` breakpoints in component CSS — responsive behaviour is handled through:

1. `clamp()` for font sizes
2. `minmax()` grid definitions for card grids
3. `clamp(24px, 4vw, 48px)` for horizontal padding

This means the layout adapts gracefully across screen widths without explicit breakpoints. The card grid (explore page) goes from 1 column on narrow mobile to 4+ columns on large desktop without any breakpoints.

### 9.2 Effective breakpoints from the grid definitions

The `minmax(240px, 1fr)` grid on the explore page produces:

| Columns | Approx. container width |
|---|---|
| 1 | < ~316px |
| 2 | ~316px – ~556px |
| 3 | ~556px – ~796px |
| 4 | ~796px – ~1036px |
| 5 | 1036px+ (within 1200px container) |

The home empty state uses `minmax(260px, 1fr)` producing 2 columns from ~584px up.

### 9.3 Portrait-heavy context considerations

Portrait cards have a fixed minimum width of 240px. On mobile:
- A 320px viewport fits exactly 1 card per row within the standard `clamp(24px, 4vw, 48px)` padding
- The card grid does not need a hard mobile breakpoint
- Horizontal scroll is not a risk because `auto-fill` handles column count automatically

Filter bar horizontal scroll on mobile: the explore filter bar uses `overflowX: 'auto'` on the category nav. On narrow screens, users can scroll the category list. No explicit breakpoint handling is needed; this is intentional.

### 9.4 Sticky elements and their `top` values

| Element | `top` value | Why |
|---|---|---|
| SonaNav | `0` | Primary nav, always at viewport top |
| Explore filter bar | `56` | Sits below the 56px nav |
| Dashboard sub-nav | N/A (not sticky) | Scrolls with content |

If the SonaNav height ever changes from 56px, update all sticky child elements to match.

### 9.5 Mobile-first rules

- Design all new pages from 320px width upward
- Never use fixed pixel widths for content containers below 520px
- Touch targets for interactive elements: minimum 44×44px effective area (pill buttons and list rows already meet this)
- Avoid `hover`-only states for critical information disclosure — all states must be accessible on touch devices

---

## 10. Anti-patterns

Ten specific patterns that break the Sona aesthetic, each with its correction.

---

### 10.1 Coral buttons

**Anti-pattern.** Using `backgroundColor: '#DE3E7B'` for a button or CTA because it feels "on brand."

**Instead.** Primary CTAs are always `#1a1a1a` (dark pill). Coral appears only as a small filled circle or a 2px underline. Coral buttons do not exist in this design system.

---

### 10.2 Cormorant upright

**Anti-pattern.** Using Cormorant Garamond without `fontStyle: 'italic'` — for example, `fontFamily: CORMORANT, fontStyle: 'normal'` or omitting the `fontStyle` property.

**Instead.** Every Cormorant instance is italic. No exceptions. If you have removed the italic style and the text looks wrong, it is not wrong — it is correct. Cormorant upright is not part of this system.

---

### 10.3 Introducing new colours

**Anti-pattern.** Adding a colour not in the palette — blue for links, a different green for success, purple for a tier indicator — because the existing greyscale feels insufficient.

**Instead.** Use the weight/opacity/size hierarchy within the greyscale system to create differentiation. Status colours (`#2a7c4f`, `#b08850`) are only for badge pills and not for general use. If you feel you need a new colour, the answer is almost always to adjust typography weight or opacity instead.

---

### 10.4 Base styles in CSS classes

**Anti-pattern.** Relying on a CSS class to set a `color`, `border`, or `border-radius` for the default (non-hover) state — for example, adding `color: #6b6b6b` inside `.sona-link` rather than as an inline style.

**Instead.** Tailwind v4 strips `color` and `border-*` from custom class base rules. Always put base-state visual properties in inline `style` props. CSS classes (`.sona-link`, `.sona-card`, etc.) are for transitions and `:hover` pseudo-class only.

```tsx
// Correct
<a className="sona-link" style={{ color: '#6b6b6b' }}>Link</a>

// Wrong — color will be stripped by Tailwind v4
// .sona-link { color: #6b6b6b; }  ← do not do this
```

---

### 10.5 Inconsistent border radius

**Anti-pattern.** Using arbitrary border radius values like `8px`, `20px`, `24px`, `9999px`, or `rounded-full` because they look similar on screen.

**Instead.** Use values from the established scale: `10`, `12`, `14`, `16`, `18` for cards and containers; `980px` for all pill buttons and badges. Consistency here is invisible when right and jarring when wrong.

---

### 10.6 Entrance animations

**Anti-pattern.** Adding `@keyframes fadeIn` or CSS transitions on mount to make page sections or cards "appear" gracefully when the page loads.

**Instead.** Sona pages load server-side with their data and render instantly. No entrance animation is needed. If data is loading client-side, use a skeleton fill pattern (not a spinner, not a fade-in).

---

### 10.7 Icon libraries

**Anti-pattern.** Importing Heroicons, Lucide, Phosphor, or any icon library because it is faster than writing inline SVGs.

**Instead.** Write inline SVG at the point of use. The icon inventory in Section 8.2 covers all current icons. New icons should be simple, single-stroke paths. An icon library adds visual inconsistency (varying stroke weights and styles) and a dependency.

---

### 10.8 Geist for page headings

**Anti-pattern.** Using Geist Sans for an `h1` or `h2` page heading because "it looks cleaner" or to match a dashboard data-heavy context.

**Instead.** Page headings are always Cormorant italic — including in the dashboard. The contrast between the display heading and the operational content beneath it is structural. The settings page `h1` ("Settings") is Cormorant. The dashboard overview `h1` (the portrait name) is Cormorant. No exceptions.

---

### 10.9 Solid grey borders

**Anti-pattern.** Using `border: '1px solid #e5e5e5'` or Tailwind's `border-gray-200` because they are the "standard" card border.

**Instead.** Use `rgba(0,0,0,0.07)` for all standard card borders. The alpha-based value reads lighter and more refined than a solid grey. At different zoom levels and on different displays, solid grey borders look coarser than their alpha equivalents.

---

### 10.10 Marketing superlatives in copy

**Anti-pattern.** Writing button text or UI labels with superlatives, exclamation marks, or excessive enthusiasm: "Start your amazing journey!", "You're all set! 🎉", "Unlock unlimited potential."

**Instead.** Sona's copy is precise and understated. "Get started." "Changes saved." "Interview requested." The product communicates quality through restraint, not enthusiasm. Remove every exclamation mark. Remove all emoji from UI strings. Use the approved headline copy verbatim where it applies (see Brand Guidelines Section 10).

---

## Reference: Class + Pattern Quick Index

| Need | Class / Pattern |
|---|---|
| Text link that darkens on hover | `className="sona-link"` + `style={{ color: '#6b6b6b' }}` |
| Primary CTA button | `className="sona-btn-dark"` + ink background inline style |
| Secondary / outline button | `className="sona-btn-outline"` + border inline style |
| External / arrow link | `className="sona-arrow-link"` + `↗` glyph |
| Inactive filter tab | `className="sona-filter-tab"` + inline border transparent |
| Active filter tab | No class — inline `borderBottom: '2px solid #DE3E7B'` |
| List row that highlights on hover | `className="sona-row-hover"` |
| Portrait card (hover border + shadow) | `className="sona-card"` + border + borderRadius inline |
| Underline form input | `className="sona-input"` + inline borderBottom style |
| Completion state | Coral circle (20px or 48px) + white SVG checkmark |
| Page heading | Cormorant italic, clamp size, `letterSpacing: '-0.02em'` |
| Section label | Geist 500, 0.6875rem, uppercase, `letterSpacing: '0.09em'`, `#b0b0b0` |

---

*Design System Rules version: March 2026. Derived from the live codebase. Update when new component patterns are established.*
