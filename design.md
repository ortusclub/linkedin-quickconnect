# Ortus Club QuickConnect — Design System

Locked: 2026-04-29. Direction is **Hybrid scope · Editorial Luxury aesthetic**.

This document is the source of truth for every visual and UX decision in the
extension. Brand cues drawn from ortusclub.com (April 2026), tuned and
re-pitched for a 390 px Chrome popup that doubles as an operator's tool.

---

## 1. Brand Posture

The Ortus Club is an invitation-led network for senior executives. The voice
is *measured, confident, hospitable* — closer to an editor's letter than a
landing page. The interface inherits that posture. Quietly premium. Never
loud. The tool earns trust through clarity, restraint, and obvious
professionalism.

The popup user is an Ortus operator running outreach. Time-poor and
judgmental. They open the popup dozens of times a day, almost always on a
LinkedIn profile.

---

## 2. Functional Scope (Hybrid)

The popup has **two postures**, switched automatically by detecting the
active tab.

### Matched (on a LinkedIn profile, contact found in sheet)
- **Top half = dossier hero.** Eyebrow ("From the open tab"), large serif
  name with italic surname, role line, personalised note in an inset card,
  primary "Copy note" CTA + "Edit template" ghost. The button copies the
  rendered note to the clipboard; the operator pastes it into LinkedIn's
  "Add a note" textarea via ⌥ P or manually. (Chrome can't fire LinkedIn's
  send button from outside the page; we will not pretend otherwise.)
- **Bottom half = tabs** (Sheet · Template · Shortcuts) — only one tab body
  visible at a time, defaults to the most recently used.
- Live badge in the masthead reads `Matched · row 47`.

### Unmatched on profile (contact name not in sheet)
- Same dossier shell, but the name shows the LinkedIn-detected name and the
  preview falls back to the *raw* template (no substitution, tokens shown as
  pill chips).
- Live badge reads `Profile detected · no match`.
- CTA changes to "Copy raw template" + "Add to sheet".

### Off LinkedIn / no profile open
- Dossier collapses to a single empty-state line:
  *"Open a LinkedIn profile to send a note."*
- Tabs become the primary surface. Default tab = `Sheet` if no sheet
  configured, otherwise `Template`.
- Live badge reads `Standby`.

### Always present
- Masthead with Ortus mark + name + version + Live/Paused toggle.
- Footer with `Diagnose` link and copyright.
- Pause toggle — when paused, the entire popup desaturates to ~60% opacity
  and the dossier hero shows a strike-through state.

### Name matcher (popup → sheet row)

The popup gets the active LinkedIn profile name from `content.js`
(reading the H1 of `linkedin.com/in/<slug>` pages). It then walks the
loaded sheet contacts looking for a single match.

**Algorithm — strict, no fuzzy:**

1. **Normalize** both the LinkedIn name and each row's `firstName + " " +
   lastName` by:
   - Unicode NFD-decompose then strip combining marks (`José` → `Jose`).
   - Lowercase.
   - Replace any run of non-alphanumeric characters with a single space.
   - Collapse whitespace and trim.
2. **Exact match first.** If the normalized LinkedIn name equals the
   normalized `first last` for exactly one row, that's the match.
3. **Token-containment fallback.** Split the normalized LinkedIn name on
   whitespace into a token set; for each row, check that the row's
   normalized `firstName` *and* normalized `lastName` are both present in
   the token set. If exactly one row passes, that's the match.
4. **Otherwise → Detected-no-match.** Multiple matches, zero matches, or
   any ambiguity → no match. We do not guess. `content.js` returns the
   raw H1 string; popup renders the Unmatched state.

We deliberately reject Levenshtein, Jaro-Winkler, and substring-only
matches: an outreach tool sending the wrong contact's note is worse than
falling back to the unmatched state. The operator has the sheet open;
adding a row or correcting a name is cheap.

Edge cases handled by the rules above:
- `Anne-Marie Smith` (hyphenated) → `anne marie smith`, matches a row with
  `Anne-Marie` / `Smith` because step 1 strips the hyphen identically on
  both sides.
- `José García` (diacritics) → `jose garcia`, matches `Jose` / `Garcia`.
- `John Smith Jr.` (suffix) → `john smith jr`. Token-containment passes if
  the row is `John` / `Smith` (Jr. is extra noise but both name tokens are
  present). If the operator includes "Jr." in the sheet's last name, the
  exact-match step still works.
- `Helena von Berg` (multi-word last name) → token-containment requires
  *both* the first and last name tokens to be present; `helena` and
  `berg` would match a row of `Helena` / `Berg` even if the row drops
  the `von`. If the row is `Helena` / `von Berg`, normalize both sides
  and step 1 produces `helena von berg` either way → exact match wins.

---

## 3. Type System

Three families. No Helvetica. No Inter. No Arial.

```
--serif: "Newsreader", "Charter", "Iowan Old Style", Georgia, serif;
--sans:  "Geist", "InterDisplay", system-ui, sans-serif;
--mono:  "Geist Mono", "JetBrains Mono", "SFMono-Regular", monospace;
```

Newsreader and Geist are free Google Fonts. **For v2.2 we ship with system
fallbacks only** — Charter / Georgia for the serif (macOS, Windows have
both), San Francisco / system-ui for the sans, SFMono / system mono for
mono. This keeps popup-open instantaneous (no font flash, no network).
The actual Newsreader / Geist WOFF2 bundle is deferred to v2.3 once we've
measured FOUT impact.

| Role               | Family    | Size  | Weight | Tracking | Style     |
| ------------------ | --------- | ----- | ------ | -------- | --------- |
| Dossier name       | Newsreader| 26 px | 500    | -0.018em | roman + italic surname |
| Section heading    | Newsreader| 17 px | 500    | -0.012em | roman |
| Brand wordmark     | Newsreader| 14 px | 500    | 0        | roman |
| Sub-rail number    | Newsreader| 13 px | 600    | -0.005em | roman, tabular |
| Body               | Geist     | 12.5 px | 400  | 0        | roman |
| Body emphasis      | Geist     | 12.5 px | 600  | 0        | roman |
| Note text          | Geist     | 12.5 px | 400  | 0        | with `ss01` |
| Button label       | Geist     | 12-13 px | 500 | 0        | sentence case |
| Eyebrow tag        | Geist Mono| 9.5 px | 600   | 0.18em   | UPPERCASE |
| Keystroke / kbd    | Geist Mono| 10 px  | 500   | 0        | UPPERCASE |
| Field label        | Geist Mono| 9 px   | 500   | 0.16em   | UPPERCASE |
| Footer chrome      | Geist Mono| 9 px   | 500   | 0.16em   | UPPERCASE |
| Status (success)   | Geist Mono| 11 px  | 500   | 0.02em   | sentence  |

Rules:
- Eyebrow tags are the only place letter-spacing > 0.05em is allowed.
- Button labels and microcopy are **sentence case**, never SHOUTING CAPS.
- Numbers in stat positions use `font-feature-settings: "tnum"`.
- The dossier name uses `text-wrap: balance`. Body paragraphs use
  `text-wrap: pretty`.
- Italic is reserved for the surname, the brand "O" monogram, and the
  occasional emphasis word in section headings — not used decoratively.

---

## 4. Color

Single accent palette. Warm cream paper, warm ink, one antique gold.

| Token             | Hex       | Usage                                          |
| ----------------- | --------- | ---------------------------------------------- |
| `--ink`           | `#16140F` | Primary text, masthead glyph, primary buttons  |
| `--ink-2`         | `#2C2A24` | Body text                                      |
| `--ink-soft`      | `#6B6557` | Captions, secondary text                       |
| `--ink-faint`     | `#A39B89` | Disabled, placeholder, micro-labels            |
| `--paper`         | `#FDFBF7` | Card / popup interior surface                  |
| `--paper-2`       | `#F6F2E9` | Inset card surface, masthead gradient terminus |
| `--paper-warm`    | `#F1ECDF` | Footer surface                                 |
| `--rule`          | `#E5DFD0` | Hairlines, input border                        |
| `--rule-2`        | `#C9C0AC` | Stronger borders, kbd shadow                   |
| `--gold`          | `#C99046` | The accent. CTA icon-pod, dossier left rule    |
| `--gold-deep`     | `#9B6A26` | Eyebrow text, hover, link underline            |
| `--gold-warm`     | `#F0CE89` | Live indicator dot, on-dark accents            |
| `--gold-tint`     | `#F6E8C8` | Variable highlight in note text                |
| `--ok`            | `#4F7A4D` | Success status text only                       |
| `--err`           | `#8B3A2E` | Error status text only, danger row             |

Rules:
- Gold appears in **at most three places per popup state**: dossier left
  rule, CTA icon-pod, live indicator dot. No gold buttons (the gold lives
  *inside* the black button).
- No gradients, except the masthead's vertical paper-to-paper-2 wash and
  the outer-shell tray gradient.
- Tinted shadows only — `rgba(20, 15, 5, 0.55)` for the popup tray drop, never
  `rgba(0, 0, 0, *)`.
- Status colors only inline; never as backgrounds, borders, or accents.

---

## 5. Materials

### Paper grain overlay
Every popup surface gets a fixed-position SVG turbulence overlay at
`opacity: 0.5`, `mix-blend-mode: multiply`, with brown-tinted noise
(`<feColorMatrix>` mapping to `0.32 0.27 0.18`). It's `pointer-events: none`
and lives on a `::before` pseudo of `.popup`.

### Double-bezel shell
The popup itself sits inside a 8 px tray (`shell`) with:
- `linear-gradient(180deg, #ECE5D2 0%, #DCD3BC 100%)` background
- 22 px outer radius
- Inset 1 px white highlight, inset 1 px ink lowlight
- 30 px tinted drop shadow

The inner `.popup` has:
- `--paper` background
- 16 px radius (concentric: outer 22 minus 8 padding minus implicit 1.5 = ~16)
- Inset 1 px white highlight, 0 0 0 1 px hairline
- Paper grain `::before`

### Hairlines vs cards
Sections are separated by `1 px solid var(--rule)` hairlines, **not** by
nested cards. The popup is a single physical object internally; the only
"card-within-card" elements are the dossier note inset and the textarea.

---

## 6. Components

### 6.1 Brand mark / Ortus monogram

The wordmark is rendered live in HTML, not as an image:

```html
<span class="ortus-mark">O</span>
```

Newsreader italic, 21 px, with a 4 px gold pip absolutely positioned at
`right: -5px; bottom: 4px`. The same glyph appears in the toolbar icon
(see §8) — they are visually the same letterform.

### 6.2 Toggle pill (Live / Paused)

- 4 × 10/8 px padding, fully rounded
- 5 px gold dot when Live, 5 px ink-faint dot when Paused
- 1 px `--rule-2` border, hover → border `--ink`
- Eyebrow type, 9.5 px

### 6.3 Live badge (in masthead sub-line)

- Live: `Matched · row 47` with gold pip on `--gold-tint` background, 1 px
  `--gold-deep` border, `#6F4715` text.
- Detected, no match: `Profile detected · no match` — same shape, dot is
  `--ink-soft` instead of gold.
- Standby: `Standby` — same shape, dot `--ink-faint`.

### 6.4 Dossier hero

- 22 px padding, hairline below.
- Eyebrow ("Now sending", "From the open tab", or "Profile detected").
- Name in 26 px Newsreader 500, surname italic 400.
- Role line: 12 px Geist `--ink-soft`, separated by `· ` in `--ink-faint`.
- Note inset: `--paper-2` background, 1 px `--rule`, 2 px `--gold` left
  border, 8 px radius. Variables highlighted with `--gold-tint` background
  and `#6F4715` text in a 3 px-radius pill.

### 6.5 Primary CTA (button-in-button)

The most distinctive component. **Black pill with embedded keystroke and
trailing gold icon-pod.**

```
┌─────────────────────────────────────┐
│ Copy note  ⌥ P    ⦿                 │   ← icon-pod is gold circle
└─────────────────────────────────────┘
```

Specs:
- 40 px tall, fully rounded
- Padding: 4 px right, 4 px top/bottom, 18 px left
- Background `--ink`; text `--paper`
- Inline `.label-sub` for keystroke: mono 11 px, `rgba(255,255,255,0.5)`
- Trailing `.icon-pod`: 32 px circle, `--gold` fill, `--ink` arrow icon
- On hover: button `translateY(-1)`, icon-pod `translate(2, -1) scale(1.06)`
- 320 ms cubic-bezier `(0.32, 0.72, 0, 1)` — never `linear`/`ease-in-out`

The icon-pod is the only place the gold color "bleeds outside its lane." The
hover effect telegraphs that the icon is the action target.

### 6.6 Ghost button

- 32–40 px tall, fully rounded, transparent
- 1 px `--rule-2` border, `--ink-2` text
- Hover: border → `--ink`, text → `--ink`, background `rgba(0,0,0,0.02)`

### 6.7 Tabs (bottom half on Hybrid)

- Anchored under masthead (or under dossier when matched)
- 12 px vertical padding, mono 9.5 px UPPERCASE, 18 px horizontal gutter
  between tabs
- Active tab: 1.5 px `--gold` underline, text `--ink`
- Inactive: text `--ink-faint`, no underline
- Only one tab body visible at a time

### 6.8 Textarea / inputs

- 38–92 px height (input/textarea), 6 px radius, 1 px `--rule` border
- Focus: border `--ink`, ring `0 0 0 3px rgba(201, 144, 70, 0.18)` (gold tint)
- Mono URL input; sans textarea
- Variable token chips (mono 10.5 px, `--paper-2` bg, 1 px `--rule`,
  3 px radius) sit below textarea with 5 px gap

### 6.9 Keystroke row

```
[ ⌥ ][ P ]   Paste personalised note          ON PROFILE
```

- 8 px vertical padding, hairline above
- `.key` chip: mono 10 px, 2 × 5 px padding, `--paper-2` bg, 1 px `--rule`
  with darker `--rule-2` bottom border (skeuomorphic key look), 4 px radius,
  inset 1 px white highlight
- Label: 12 px Geist `--ink-2`
- Right hint: mono 10 px, `--ink-faint`, UPPERCASE
- `.danger` variant turns label and hint to `--err` for "Send without note"

---

## 7. Motion

- All transitions: 220–380 ms `cubic-bezier(0.32, 0.72, 0, 1)`. No
  `linear`, no `ease-in-out`.
- Hover: `transform: translateY(-1px)` on primary CTA; chip color shifts on
  variable chips; ghost border crossfade.
- No popup-open entry animation (popup must feel instant).
- Status text: 120 ms opacity fade-in when text changes.
- Tab switch: 180 ms cross-fade of tab body, no slide.
- Pause toggle: entire `.popup` cross-fades to 60% opacity over 220 ms.
- Live → Matched badge transition: 220 ms color cross-fade only.

GPU rules: animate `transform` and `opacity` only. No layout-triggering
properties.

---

## 8. Toolbar Icon Set

The Chrome action icon. Four sizes: 16 / 32 / 48 / 128 px PNG.

### Concept
Italic `O` from the same Newsreader cut as the wordmark, plus a gold pip
in the lower-right corner. The shape reads as the Ortus monogram at 128 px
and as a confident dark glyph at 16 px (where the pip is omitted).

### Specs

| Size  | Background       | Mark                                | Pip                  |
| ----- | ---------------- | ----------------------------------- | -------------------- |
| 128   | `--ink` square, 22 px corner radius | Newsreader italic O, 88 px, `--paper` | 12 px gold circle, bottom-right |
| 48    | `--ink` square, 9 px radius  | 36 px italic O, `--paper`           | 8 px gold pip        |
| 32    | `--ink` square, 6 px radius  | 24 px italic O, `--paper`           | omitted (too small to read cleanly) |
| 16    | `--ink` square, 3 px radius  | 12 px italic O, `--paper`           | omitted              |

Both are PNG with transparent background outside the rounded square (Chrome
auto-rounds at small sizes anyway, but we provide the radius so it reads
consistently in chrome://extensions and the toolbar). Saved at `icons/ortus-club-{16,32,48,128}.png`.

The previous `f1-*.png` and `ortus-*.png` icons are removed.

---

## 9. Layout (390 px popup)

Page padding: 0 (the masthead, sections, and footer self-pad).
Section padding: 18–22 px horizontal, 18 px vertical.
Vertical rhythm: hairline (`--rule`) between sections, no extra gap.

Single column. Asymmetric only inside the dossier (the name and role bleed
toward the right edge against generous left padding). The keystroke list is
a `auto 1fr auto` 3-column grid.

---

## 10. UX Flow

### Matched profile
1. User opens LinkedIn profile.
2. Clicks Ortus toolbar icon.
3. Popup opens already showing dossier with name, role, personalised note,
   `Copy note` CTA.
4. ⌥ P or click → note copied to clipboard / pasted into the LinkedIn
   "Add a note" textarea via content script.
5. ⌥ S sends.

### Unmatched profile
1. Popup detects name from the page, surfaces it in the dossier shell.
2. Note preview falls back to the *raw* template — variables shown as token
   chips ("`{first name}`" etc.) instead of substituted values.
3. CTA pair becomes `Copy raw template` + `Add to sheet`.

### Off LinkedIn
1. Dossier collapses to a single empty-state line:
   *"Open a LinkedIn profile to send a note."*
2. Tabs (Sheet · Template · Shortcuts) become the page.
3. Default tab = `Sheet` if no sheet configured, otherwise `Template`.

### Pause
1. Toggle in masthead — when off, popup desaturates and the dossier shows
   a strike-through.
2. Content script disables keystrokes globally until re-enabled.

### Microcopy
- Sentence case throughout. No exclamation marks.
- Buttons: "Copy note", "Skip", "Re-sync", "Copy raw template", "Add to sheet".
- Status messages ≤ 60 chars.
- Empty states are full sentences with periods, not headlines.
- Error messages name the cause, no "oops".

---

## 11. Accessibility

- Body contrast ≥ 7:1 (`--ink-2` on `--paper-2` is AAA).
- Focus rings: `0 0 0 3px rgba(201, 144, 70, 0.18)` paired with a 1 px
  `--ink` border so monochromatic vision still sees focus.
- All interactive elements are `button` or `input`; variable chips included.
- `aria-pressed` on the toggle, `role="status"` on inline status slots,
  `aria-live="polite"` on the status text.
- Keystroke labels include `aria-label` with the spoken description.

---

## 12. What changes from v2.1

| Area              | v2.1                                    | v2.2 (locked)                              |
| ----------------- | --------------------------------------- | ------------------------------------------ |
| Brand framing     | "Ortus / F1"                            | Pure Ortus Club                            |
| Type              | Aptos Display + mono kicker             | Newsreader serif + Geist sans + Geist Mono |
| Palette           | Cream + tomato red                      | Warm cream + antique gold                  |
| Materials         | Flat panels, paper-grid bg              | Paper grain + double-bezel shell           |
| Hero              | "Refresh LinkedIn" warning banner       | Adaptive dossier hero (matched/standby)    |
| Sheet panel       | Top of popup, always visible            | Tabbed compression below dossier           |
| First fold        | Sheet URL field                         | Active contact (when matched), tabs (when not) |
| Sections          | "01.", "02.", "03." numbered            | Eyebrow tags + serif headings              |
| Toolbar icon      | "OR" red-on-charcoal / "CC" charcoal    | Italic Ortus O on ink with gold pip        |
| Density           | High (paper + grid + heavy borders)     | Calmer; intentional whitespace             |

---

## 13. Out of scope (this milestone)

- Light/dark theme switch.
- Bundling Newsreader / Geist as web fonts (system fallback first; bundle in
  v2.3 if visible at popup-open time).
- Localization.
- Full options page (`chrome.runtime.openOptionsPage`).
- Sequence / cadence tracking — popup is single-action only.
