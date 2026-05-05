# Ortus Club QuickConnect v2.2 — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v2.2 redesign of the Ortus Club QuickConnect Chrome extension — Editorial Luxury aesthetic, italic-O monogram icon, Hybrid scope (live dossier on profiles, tabbed setup off LinkedIn), and a strict name matcher that connects the open LinkedIn profile to the right sheet row.

**Architecture:** The extension stays MV3 vanilla JS — no bundler, no framework. Pure-function modules (`matcher.js`) are loaded as classic scripts before `popup.js` so they can be unit-tested in Node without changing the Chrome runtime. Visual logic lives in `popup.html` (CSS + structure) and `popup.js` (state machine + DOM wiring). Tab/profile detection is a one-shot message from popup → content script.

**Tech Stack:** Chrome MV3, vanilla JS, vanilla CSS, Node + Jest (test-only, dev dependency), Python + Pillow (icon rendering, dev-only).

**Source of truth:** `design.md` at the repo root. If anything in this plan contradicts `design.md`, `design.md` wins — open an issue.

---

## File Structure

| Path                                      | Action  | Responsibility                                   |
| ----------------------------------------- | ------- | ------------------------------------------------ |
| `matcher.js`                              | Create  | Pure-function name matcher; loadable in Node + browser |
| `popup.html`                              | Rewrite | New shell, CSS, tab markup, dossier states       |
| `popup.js`                                | Rewrite | State machine, tab IPC, render selection         |
| `content.js`                              | Modify  | Add `getActiveProfileName` action                |
| `background.js`                           | Inspect | No code change expected                          |
| `manifest.json`                           | Modify  | Bump to 2.2.0, swap icon paths, rename app       |
| `icons/ortus-club-{16,32,48,128}.png`     | Create  | New toolbar icon set                             |
| `icons/source/ortus-club.svg`             | Create  | SVG source committed for re-rendering            |
| `icons/source/Newsreader-Italic.ttf`      | Create  | Font asset for icon rendering                    |
| `icons/source/build-icons.py`             | Create  | Pillow render script                             |
| `icons/f1-*.png`                          | Delete  | Old F1 icon set                                  |
| `icons/ortus-*.png`                       | Delete  | Old "OR"/"CC" icon set (stale brand)             |
| `package.json`                            | Create  | Jest dev-dependency only                         |
| `tests/matcher.test.js`                   | Create  | Unit tests for matcher                           |
| `.gitignore`                              | Modify  | Add `node_modules/`                              |

The keystroke handlers in `content.js` (paste, connect, add note, send-without-note) are **not** rewritten — they keep working as in v2.1. The Hybrid scope adds tab inspection on top.

---

## TDD Discipline

Vanilla Chrome extensions don't have a test runner. We add Jest **only** for `matcher.js` because it's a pure function with edge cases (accents, hyphens, multi-word names) where regressions are silent and dangerous. Visual changes and DOM wiring are verified manually by reloading the unpacked extension and clicking through. Each non-matcher task ends with an explicit manual smoke-test step before commit.

---

## Task 1 — Test runner + matcher stub

**Files:**
- Create: `package.json`
- Create: `matcher.js`
- Create: `tests/matcher.test.js`
- Modify: `.gitignore` — append `node_modules/`

- [ ] **Step 1.1 — Write `package.json`**

```json
{
  "name": "ortus-club-quickconnect",
  "version": "2.2.0",
  "private": true,
  "description": "Ortus Club QuickConnect — LinkedIn outreach helper",
  "scripts": {
    "test": "jest --colors"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 1.2 — Append `node_modules/` to `.gitignore`**

The file already exists with `.superpowers/` and `.DS_Store`. Add a third line:

```
node_modules/
```

- [ ] **Step 1.3 — Write the matcher stub at `matcher.js`**

```js
"use strict";

function normalizeName(value) {
  return null;
}

function matchContact(linkedinName, contacts) {
  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { matchContact, normalizeName };
}
```

The browser side will not see the `module` export — it accesses
`matchContact` and `normalizeName` from the global scope when the script
is loaded via `<script src="matcher.js">`.

- [ ] **Step 1.4 — Write the failing tests at `tests/matcher.test.js`**

```js
const { matchContact, normalizeName } = require("../matcher");

describe("normalizeName", () => {
  test("lowercases and trims", () => {
    expect(normalizeName("  Helena Voss  ")).toBe("helena voss");
  });
  test("strips diacritics", () => {
    expect(normalizeName("José García")).toBe("jose garcia");
  });
  test("collapses non-alphanumerics into single spaces", () => {
    expect(normalizeName("Anne-Marie  O'Neill")).toBe("anne marie o neill");
  });
  test("returns empty for null/empty input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
  });
});

const contacts = [
  { firstName: "Helena", lastName: "Voss",      fields: { sector: "FinTech" } },
  { firstName: "José",   lastName: "García",    fields: { sector: "SaaS" } },
  { firstName: "Anne-Marie", lastName: "Smith", fields: { sector: "Health" } },
  { firstName: "Helena", lastName: "von Berg",  fields: { sector: "Legal" } },
  { firstName: "John",   lastName: "Smith",     fields: { sector: "IT" } }
];

describe("matchContact — exact normalized match", () => {
  test("matches a clean first+last", () => {
    const m = matchContact("Helena Voss", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Helena");
    expect(m.lastName).toBe("Voss");
  });
  test("matches across diacritic difference", () => {
    const m = matchContact("Jose Garcia", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("José");
  });
  test("matches across hyphen normalisation", () => {
    const m = matchContact("Anne Marie Smith", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Anne-Marie");
  });
});

describe("matchContact — token containment fallback", () => {
  test("matches when LinkedIn has noise tokens (Jr., suffix)", () => {
    const m = matchContact("John Smith Jr.", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("John");
  });
  test("matches when LinkedIn has middle name not in sheet", () => {
    const m = matchContact("Helena Maria Voss", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Helena");
    expect(m.lastName).toBe("Voss");
  });
});

describe("matchContact — refuses on ambiguity", () => {
  test("returns null when token containment hits multiple rows", () => {
    const ambiguous = [
      { firstName: "John", lastName: "Smith", fields: {} },
      { firstName: "John", lastName: "Smithson", fields: {} }
    ];
    expect(matchContact("John Smith", ambiguous)).not.toBeNull();
    expect(matchContact("John Smithson Esquire", ambiguous)).toBeNull();
  });
  test("returns null when the linkedin name is empty", () => {
    expect(matchContact("", contacts)).toBeNull();
    expect(matchContact(null, contacts)).toBeNull();
  });
  test("returns null on no match at all", () => {
    expect(matchContact("Mystery Person", contacts)).toBeNull();
  });
});
```

- [ ] **Step 1.5 — Install Jest and run tests**

Run: `npm install` (creates `node_modules/` and `package-lock.json`)
Run: `npm test`
Expected: all matcher tests FAIL (`normalizeName` returns `null`, not a string).

- [ ] **Step 1.6 — Commit**

```bash
git add package.json .gitignore matcher.js tests/matcher.test.js
git commit -m "Add Jest harness and failing matcher tests"
```

Do NOT commit `node_modules/` or `package-lock.json` yet — `package-lock.json` should also be committed in the next task once tests are green.

---

## Task 2 — Implement the matcher

**Files:**
- Modify: `matcher.js`

- [ ] **Step 2.1 — Replace the stub with the real algorithm**

Open `matcher.js` and replace its body with:

```js
"use strict";

function normalizeName(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rowJoinedName(contact) {
  return normalizeName(`${contact.firstName || ""} ${contact.lastName || ""}`);
}

function matchContact(linkedinName, contacts) {
  const normalizedLi = normalizeName(linkedinName);
  if (!normalizedLi) return null;
  if (!Array.isArray(contacts) || contacts.length === 0) return null;

  // Step 2: exact normalized match
  const exact = contacts.filter(
    (c) => rowJoinedName(c) === normalizedLi
  );
  if (exact.length === 1) return exact[0];

  // Step 3: token containment fallback
  const liTokens = new Set(normalizedLi.split(" ").filter(Boolean));
  const tokenMatches = contacts.filter((c) => {
    const first = normalizeName(c.firstName);
    const last  = normalizeName(c.lastName);
    if (!first || !last) return false;
    const firstTokens = first.split(" ").filter(Boolean);
    const lastTokens  = last.split(" ").filter(Boolean);
    const allFirstIn = firstTokens.every((t) => liTokens.has(t));
    const allLastIn  = lastTokens.every((t)  => liTokens.has(t));
    return allFirstIn && allLastIn;
  });
  if (tokenMatches.length === 1) return tokenMatches[0];

  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { matchContact, normalizeName };
}
```

- [ ] **Step 2.2 — Run the test suite**

Run: `npm test`
Expected: all tests PASS.

If a token-containment test fails because both `Helena Voss` and `Helena von Berg` match `Helena Voss`, that's a real bug — the row `Helena von Berg` has a *two-token* last name (`von berg`), so token containment for that row requires both `von` AND `berg` tokens in the LinkedIn name. The provided test case `Helena Voss` only has `helena` and `voss` tokens, so `Helena von Berg` should fail token containment for missing `von` and `berg`. Verify this is the actual behaviour, not a coincidence.

- [ ] **Step 2.3 — Commit**

```bash
git add matcher.js package-lock.json
git commit -m "Implement strict normalize → exact → token-containment matcher"
```

---

## Task 3 — Generate the toolbar icon set

**Files:**
- Create: `icons/source/ortus-club.svg`
- Create: `icons/source/build-icons.py`
- Create: `icons/source/Newsreader-Italic.ttf`
- Create: `icons/ortus-club-16.png`
- Create: `icons/ortus-club-32.png`
- Create: `icons/ortus-club-48.png`
- Create: `icons/ortus-club-128.png`

- [ ] **Step 3.1 — Download the Newsreader Italic font**

```bash
curl -L -o "icons/source/Newsreader-Italic.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader-Italic%5Bopsz%2Cwght%5D.ttf"
ls -la icons/source/Newsreader-Italic.ttf
```

Expected: a 200KB+ TTF file. If the download fails or returns HTML, the
GitHub path may have changed — fall back to the Google Fonts API:
`curl -L -o icons/source/Newsreader-Italic.ttf "https://fonts.google.com/download?family=Newsreader" && unzip -p ... ` and pick the italic variable file.

- [ ] **Step 3.2 — Write `icons/source/ortus-club.svg`** (reference, not used by the renderer)

```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="0" y="0" width="128" height="128" rx="22" fill="#16140F"/>
  <text x="64" y="84"
        font-family="Newsreader, Charter, Georgia, serif"
        font-style="italic"
        font-weight="500"
        font-size="88"
        fill="#FDFBF7"
        text-anchor="middle"
        letter-spacing="-1.5">O</text>
  <circle cx="100" cy="100" r="6" fill="#C99046"/>
</svg>
```

This is the canonical reference. The actual rasterization uses Pillow
(next step) which gives reproducible output regardless of system font
availability.

- [ ] **Step 3.3 — Write the Pillow renderer at `icons/source/build-icons.py`**

```python
"""Render the Ortus Club QuickConnect toolbar icon at 16/32/48/128 px."""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # icons/
FONT = HERE / "Newsreader-Italic.ttf"

INK = (22, 20, 15, 255)        # #16140F
PAPER = (253, 251, 247, 255)   # #FDFBF7
GOLD = (201, 144, 70, 255)     # #C99046

# size: (canvas px, corner radius px, font size px, pip radius px (0 = omit))
SIZES = {
    16:  (16,  3,  12, 0),
    32:  (32,  6,  24, 0),  # pip omitted at 32 too — too small to read cleanly
    48:  (48,  9,  36, 4),
    128: (128, 22, 88, 6),
}

def render(size_px: int, radius: int, font_size: int, pip_r: int) -> Image.Image:
    img = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, size_px, size_px), radius=radius, fill=INK)

    font = ImageFont.truetype(str(FONT), font_size)
    bbox = draw.textbbox((0, 0), "O", font=font)
    glyph_w = bbox[2] - bbox[0]
    glyph_h = bbox[3] - bbox[1]
    x = (size_px - glyph_w) / 2 - bbox[0]
    # optical adjustment: the italic O sits slightly above its baseline; nudge up by 4%
    y = (size_px - glyph_h) / 2 - bbox[1] - max(1, size_px * 0.04)
    draw.text((x, y), "O", fill=PAPER, font=font)

    if pip_r > 0:
        cx = size_px - pip_r - max(2, size_px * 0.08)
        cy = size_px - pip_r - max(2, size_px * 0.08)
        draw.ellipse((cx - pip_r, cy - pip_r, cx + pip_r, cy + pip_r), fill=GOLD)
    return img

def main():
    for n, (size_px, radius, font_size, pip_r) in SIZES.items():
        img = render(size_px, radius, font_size, pip_r)
        out = ROOT / f"ortus-club-{n}.png"
        img.save(out, "PNG", optimize=True)
        print(f"wrote {out} ({size_px}x{size_px})")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3.4 — Run the renderer**

```bash
python3 -m pip install --user pillow >/dev/null 2>&1 || pip3 install --user pillow
python3 icons/source/build-icons.py
ls -la icons/ortus-club-*.png
```

Expected: four PNGs are written. File sizes roughly: 16 → ~500 B, 32 → ~1 KB, 48 → ~2 KB, 128 → ~6 KB.

- [ ] **Step 3.5 — Visually verify the icons**

Open each PNG in Preview / Finder QuickLook:
- 128 px should clearly show a black square, white italic `O`, gold pip lower-right.
- 48 px should still show all three elements legibly.
- 32 px and 16 px should show only the dark square and white `O` — no pip, no muddy edges.

If the `O` is clipped, sits too low/high, or the pip overlaps the glyph at 48 px, adjust the optical-nudge constants in `build-icons.py` and re-run.

- [ ] **Step 3.6 — Commit**

```bash
git add icons/source/ icons/ortus-club-*.png
git commit -m "Add Ortus Club toolbar icon set (16/32/48/128) with SVG + Pillow source"
```

The font TTF is committed deliberately — re-rendering the icons later (e.g. tweaks to glyph kerning) must be reproducible without re-fetching from GitHub.

---

## Task 4 — Rebuild `popup.html` shell

**Files:**
- Rewrite: `popup.html`

This is a single large rewrite. The existing `popup.html` keeps the same DOM hooks (`#sheetUrlInput`, `#templateInput`, `#variableTokenRow`, `#templatePreview`, `#extensionToggle`, `#syncSheetBtn`, `#clearSheetBtn`, `#saveBtn`, `#resetBtn`, `#diagnoseBtn`, `#status`, `#sheetStatus`, `#diagnoseStatus`, `#contactCount`, `#templateTokenCount`) **plus** new ones for the dossier and tab states. We do NOT rename existing IDs in this task — keeping them constant means `popup.js` keeps working in the next task.

- [ ] **Step 4.1 — Replace the entire content of `popup.html`** with:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ortus Club QuickConnect</title>
  <style>
    :root {
      color-scheme: light;
      --ink:        #16140F;
      --ink-2:      #2C2A24;
      --ink-soft:   #6B6557;
      --ink-faint:  #A39B89;
      --paper:      #FDFBF7;
      --paper-2:    #F6F2E9;
      --paper-warm: #F1ECDF;
      --rule:       #E5DFD0;
      --rule-2:     #C9C0AC;
      --gold:       #C99046;
      --gold-deep:  #9B6A26;
      --gold-warm:  #F0CE89;
      --gold-tint:  #F6E8C8;
      --ok:         #4F7A4D;
      --err:        #8B3A2E;
      --serif:      "Newsreader", "Charter", "Iowan Old Style", Georgia, serif;
      --sans:       "Geist", "InterDisplay", system-ui, sans-serif;
      --mono:       "Geist Mono", "JetBrains Mono", "SFMono-Regular", monospace;
      --ease:       cubic-bezier(0.32, 0.72, 0, 1);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }

    body {
      width: 390px;
      font-family: var(--sans);
      font-size: 13px;
      color: var(--ink-2);
      background: linear-gradient(180deg, #ECE5D2 0%, #DCD3BC 100%);
      padding: 8px;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, p { margin: 0; }
    button { font: inherit; cursor: pointer; }

    .popup {
      background: var(--paper);
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.9) inset,
        0 0 0 1px rgba(60,40,10,0.04);
    }

    .popup::before {
      content: "";
      position: absolute; inset: 0;
      pointer-events: none;
      opacity: 0.5;
      mix-blend-mode: multiply;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.32  0 0 0 0 0.27  0 0 0 0 0.18  0 0 0 0.07 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
    }

    .popup.paused { opacity: 0.6; filter: grayscale(0.4); }
    .popup.paused .dossier-name { text-decoration: line-through; }

    /* ── Masthead ── */
    .masthead {
      padding: 18px 20px 16px;
      display: grid; grid-template-columns: 1fr auto;
      align-items: center; gap: 12px;
      border-bottom: 1px solid var(--rule);
      background: linear-gradient(180deg, var(--paper) 0%, var(--paper-2) 100%);
      position: relative;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .ortus-mark {
      position: relative;
      width: 24px; height: 24px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--ink);
      font-family: var(--serif); font-style: italic; font-weight: 500;
      font-size: 21px; line-height: 1; letter-spacing: -0.02em;
    }
    .ortus-mark::after {
      content: "";
      position: absolute; right: -5px; bottom: 4px;
      width: 4px; height: 4px;
      border-radius: 50%; background: var(--gold);
    }
    .brand-name {
      font-family: var(--serif); font-weight: 500;
      font-size: 14px; color: var(--ink);
    }
    .brand-sub {
      font-family: var(--mono); font-size: 9px;
      letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--ink-faint); margin-top: 1px;
      display: flex; align-items: center; gap: 6px;
    }
    .live-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 2px 7px 2px 5px;
      border-radius: 999px;
      background: var(--gold-tint);
      border: 1px solid var(--gold-deep);
      color: #6F4715;
      font-family: var(--mono); font-size: 9px;
      letter-spacing: 0.12em; text-transform: uppercase;
      font-weight: 600;
    }
    .live-badge[data-state="standby"] {
      background: transparent; border-color: var(--rule-2); color: var(--ink-soft);
    }
    .live-badge[data-state="nomatch"] {
      background: var(--paper-2); border-color: var(--rule-2); color: var(--ink-soft);
    }
    .live-badge .dot {
      width: 5px; height: 5px; border-radius: 50%; background: var(--gold-deep);
    }
    .live-badge[data-state="standby"] .dot { background: var(--ink-faint); }
    .live-badge[data-state="nomatch"] .dot { background: var(--ink-soft); }
    .toggle-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px 4px 8px;
      border-radius: 999px;
      background: transparent; border: 1px solid var(--rule-2);
      color: var(--ink-2);
      font-size: 9.5px; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase;
      transition: all 220ms var(--ease);
    }
    .toggle-pill .dot {
      width: 5px; height: 5px; border-radius: 50%; background: var(--gold);
      box-shadow: 0 0 0 2.5px rgba(201, 144, 70, 0.18);
    }
    .toggle-pill[aria-pressed="false"] .dot { background: var(--ink-faint); box-shadow: none; }
    .toggle-pill:hover { border-color: var(--ink); }

    /* ── Dossier ── */
    .dossier {
      padding: 22px 22px 22px;
      border-bottom: 1px solid var(--rule);
    }
    .dossier .eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: 9.5px;
      letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--gold-deep);
      margin-bottom: 12px;
    }
    .dossier .eyebrow::before {
      content: ""; width: 16px; height: 1px; background: var(--gold-deep);
    }
    .dossier-name {
      font-family: var(--serif); font-weight: 500;
      font-size: 26px; line-height: 1.05;
      letter-spacing: -0.018em; color: var(--ink);
      text-wrap: balance;
    }
    .dossier-name em { font-style: italic; font-weight: 400; }
    .dossier-role {
      margin-top: 4px;
      font-size: 12px; line-height: 1.5;
      color: var(--ink-soft);
    }
    .dossier-role .sep { color: var(--ink-faint); margin: 0 6px; }
    .preview {
      margin-top: 16px;
      padding: 14px 16px 14px 18px;
      border-radius: 10px;
      background: var(--paper-2);
      border: 1px solid var(--rule);
      border-left: 2px solid var(--gold);
      font-size: 13px; line-height: 1.55; color: var(--ink-2);
      white-space: pre-wrap;
    }
    .preview .var {
      background: var(--gold-tint); color: #6F4715;
      border-radius: 3px; padding: 0 4px; font-weight: 500;
    }

    /* Empty state inside dossier shell (Standby) */
    .dossier.standby .preview { display: none; }
    .dossier.standby .dossier-role { display: none; }
    .dossier.standby .actions { display: none; }
    .dossier.standby .dossier-name {
      font-size: 22px; line-height: 1.15;
    }

    /* ── CTA ── */
    .actions {
      display: flex; align-items: center; gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .cta {
      display: inline-flex; align-items: center; gap: 8px;
      height: 40px; padding: 4px 4px 4px 18px;
      border-radius: 999px;
      background: var(--ink); color: var(--paper); border: 0;
      font: 500 13px/1 var(--sans);
      transition: transform 320ms var(--ease), background 320ms var(--ease);
      box-shadow: 0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 28px -10px rgba(20,15,5,0.55);
    }
    .cta:hover { transform: translateY(-1px); background: #000; }
    .cta:active { transform: translateY(0) scale(0.98); }
    .cta:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .cta .label-sub {
      color: rgba(255,255,255,0.5);
      margin-left: 4px; font-size: 11px;
      font-family: var(--mono); letter-spacing: 0.06em;
    }
    .cta .icon-pod {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--gold); color: var(--ink);
      display: inline-flex; align-items: center; justify-content: center;
      transition: transform 380ms var(--ease);
    }
    .cta:hover .icon-pod { transform: translate(2px, -1px) scale(1.06); }
    .ghost {
      height: 40px; padding: 0 16px;
      border-radius: 999px;
      background: transparent; color: var(--ink-2);
      border: 1px solid var(--rule-2);
      font: 500 12px/1 var(--sans);
      transition: all 280ms var(--ease);
    }
    .ghost:hover { border-color: var(--ink); color: var(--ink); background: rgba(0,0,0,0.02); }

    /* ── Tabs ── */
    .tabs {
      display: flex; gap: 0;
      padding: 0 20px;
      border-bottom: 1px solid var(--rule);
      background: var(--paper);
    }
    .tab {
      background: transparent; border: 0;
      padding: 12px 0; margin-right: 18px;
      font-family: var(--mono); font-size: 9.5px;
      letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--ink-faint);
      border-bottom: 1.5px solid transparent;
      margin-bottom: -1px;
      transition: color 220ms var(--ease), border-color 220ms var(--ease);
    }
    .tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--gold); }
    .tab:hover { color: var(--ink); }

    .tab-body { padding: 18px 20px 18px; background: var(--paper); }
    .tab-body[hidden] { display: none; }
    .tab-body h3 {
      margin: 0 0 6px;
      font-family: var(--serif); font-weight: 500;
      font-size: 17px; letter-spacing: -0.012em; color: var(--ink);
    }
    .tab-body .desc {
      margin: 0 0 10px;
      color: var(--ink-soft);
      font-size: 12px; line-height: 1.5;
    }
    .tab-body .eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--mono); font-size: 9.5px;
      letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--gold-deep);
      margin-bottom: 10px;
    }
    .tab-body .eyebrow::before {
      content: ""; width: 16px; height: 1px; background: var(--gold-deep);
    }

    label {
      display: block;
      font-family: var(--mono); font-size: 9px;
      letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--ink-faint);
      margin: 12px 0 6px;
    }
    input[type="url"], input[type="text"] {
      width: 100%; height: 38px; padding: 0 12px;
      border-radius: 6px;
      border: 1px solid var(--rule);
      background: var(--paper);
      font-family: var(--mono); font-size: 11px;
      color: var(--ink-2);
      transition: all 220ms var(--ease);
    }
    input[type="url"]:focus, input[type="text"]:focus {
      outline: none; border-color: var(--ink);
      box-shadow: 0 0 0 3px rgba(201,144,70,0.18);
    }
    textarea {
      width: 100%; min-height: 96px;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid var(--rule);
      background: var(--paper);
      font: 13px/1.55 var(--sans);
      color: var(--ink-2); resize: vertical;
      transition: all 220ms var(--ease);
    }
    textarea:focus {
      outline: none; border-color: var(--ink);
      box-shadow: 0 0 0 3px rgba(201,144,70,0.18);
    }

    .button-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .btn {
      height: 32px; padding: 0 14px;
      border-radius: 999px; border: 0;
      font: 500 12px/1 var(--sans);
      transition: all 280ms var(--ease);
    }
    .btn-primary { background: var(--ink); color: var(--paper); }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-ghost { background: transparent; color: var(--ink-2); border: 1px solid var(--rule-2); }
    .btn-ghost:hover { border-color: var(--ink); color: var(--ink); }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    .token-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .token {
      font-family: var(--mono); font-size: 10.5px;
      color: var(--ink-2);
      background: var(--paper-2);
      border: 1px solid var(--rule); border-radius: 3px;
      padding: 3px 8px;
      transition: all 220ms var(--ease);
    }
    .token:hover { border-color: var(--gold-deep); color: var(--gold-deep); background: var(--gold-tint); }

    .status {
      margin-top: 8px;
      font-family: var(--mono); font-size: 11px; letter-spacing: 0.02em;
      color: var(--ink-soft); min-height: 16px;
    }
    .status.ok { color: var(--ok); }
    .status.error { color: var(--err); }

    .sheet-meta {
      display: flex; align-items: baseline; gap: 12px;
      font-size: 12px; color: var(--ink-soft);
      font-feature-settings: "tnum";
      margin-top: 8px;
    }
    .sheet-meta b {
      font-family: var(--serif); font-weight: 600;
      color: var(--ink); font-size: 14px; letter-spacing: -0.005em;
    }
    .sheet-meta .sep { color: var(--rule-2); }

    .keyrow {
      display: grid; grid-template-columns: auto 1fr auto;
      align-items: center; gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--rule);
      font-size: 12px; color: var(--ink-2);
    }
    .keyrow:first-of-type { border-top: 0; padding-top: 4px; }
    .keyrow .kbd { display: inline-flex; align-items: center; gap: 3px; }
    .keyrow .key {
      font-family: var(--mono); font-size: 10px;
      padding: 2px 5px;
      background: var(--paper-2);
      border: 1px solid var(--rule);
      border-bottom-color: var(--rule-2);
      border-radius: 4px;
      box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
      color: var(--ink);
    }
    .keyrow .hint {
      font-size: 10px; font-family: var(--mono);
      letter-spacing: 0.06em; color: var(--ink-faint);
      text-transform: uppercase;
    }
    .keyrow.danger .label, .keyrow.danger .hint { color: var(--err); }

    .footer {
      padding: 10px 20px 14px;
      background: var(--paper-warm);
      border-top: 1px solid var(--rule);
      display: flex; justify-content: space-between; align-items: center;
      font-family: var(--mono); font-size: 9px;
      letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--ink-faint);
    }
    .footer button {
      background: transparent; border: 0;
      color: var(--ink-soft); font: inherit;
      border-bottom: 1px solid transparent;
      padding-bottom: 1px;
      transition: all 220ms var(--ease);
    }
    .footer button:hover { color: var(--ink); border-color: var(--ink); }

    :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(201,144,70,0.35), 0 0 0 1px var(--ink); }
  </style>
</head>
<body>
  <main class="popup" id="popup">

    <header class="masthead">
      <div class="brand">
        <span class="ortus-mark" aria-hidden="true">O</span>
        <div>
          <div class="brand-name">Ortus Club QuickConnect</div>
          <div class="brand-sub">
            <span id="liveBadge" class="live-badge" data-state="standby" role="status" aria-live="polite">
              <span class="dot"></span><span id="liveBadgeText">Standby</span>
            </span>
          </div>
        </div>
      </div>
      <button id="extensionToggle" class="toggle-pill" type="button" aria-pressed="true">
        <span class="dot"></span><span id="extensionToggleText">Live</span>
      </button>
    </header>

    <section id="dossier" class="dossier standby" aria-labelledby="dossierName">
      <div class="eyebrow" id="dossierEyebrow">Open a profile</div>
      <h1 class="dossier-name" id="dossierName">Open a LinkedIn profile to send a note.</h1>
      <p class="dossier-role" id="dossierRole"></p>
      <div class="preview" id="templatePreview" aria-label="Message preview"></div>
      <div class="actions">
        <button id="copyNoteBtn" class="cta" type="button">
          <span>Copy note</span>
          <span class="label-sub">⌥ P</span>
          <span class="icon-pod" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>
          </span>
        </button>
        <button id="addToSheetBtn" class="ghost" type="button" hidden>Add to sheet</button>
      </div>
      <div id="copyStatus" class="status" role="status" aria-live="polite"></div>
    </section>

    <nav class="tabs" role="tablist" aria-label="Setup">
      <button class="tab" role="tab" id="tab-sheet"     aria-selected="true"  aria-controls="panel-sheet">Sheet</button>
      <button class="tab" role="tab" id="tab-template"  aria-selected="false" aria-controls="panel-template">Template</button>
      <button class="tab" role="tab" id="tab-shortcuts" aria-selected="false" aria-controls="panel-shortcuts">Shortcuts</button>
    </nav>

    <section id="panel-sheet" class="tab-body" role="tabpanel" aria-labelledby="tab-sheet">
      <span class="eyebrow">Source</span>
      <h3>Google sheet</h3>
      <p class="desc">First name and last name columns are required; every header becomes a template variable.</p>
      <label for="sheetUrlInput">Sheet URL</label>
      <input id="sheetUrlInput" type="url" placeholder="https://docs.google.com/spreadsheets/d/..." autocomplete="off">
      <div class="button-row">
        <button id="syncSheetBtn" class="btn btn-primary" type="button">Sync sheet</button>
        <button id="clearSheetBtn" class="btn btn-ghost" type="button">Clear</button>
      </div>
      <div class="sheet-meta">
        <span><b id="contactCount">0</b> contacts</span>
        <span class="sep">·</span>
        <span><b id="templateTokenCount">0</b> variables</span>
      </div>
      <div id="sheetStatus" class="status" role="status" aria-live="polite"></div>
    </section>

    <section id="panel-template" class="tab-body" role="tabpanel" aria-labelledby="tab-template" hidden>
      <span class="eyebrow">Message</span>
      <h3>Connection note</h3>
      <p class="desc">Click a variable to insert at cursor. Pasted to LinkedIn with ⌥ P.</p>
      <textarea id="templateInput" placeholder="Hi {first name}, I wanted to connect."></textarea>
      <div id="variableTokenRow" class="token-row" aria-label="Template variables"></div>
      <div class="button-row">
        <button id="saveBtn" class="btn btn-primary" type="button">Save template</button>
        <button id="resetBtn" class="btn btn-ghost" type="button">Reset</button>
      </div>
      <div id="status" class="status" role="status" aria-live="polite"></div>
    </section>

    <section id="panel-shortcuts" class="tab-body" role="tabpanel" aria-labelledby="tab-shortcuts" hidden>
      <span class="eyebrow">Keystrokes</span>
      <h3>Shortcuts</h3>
      <div class="keyrow"><span class="kbd"><span class="key">⌥</span><span class="key">P</span></span><span class="label">Paste personalised note</span><span class="hint">on profile</span></div>
      <div class="keyrow"><span class="kbd"><span class="key">⌥</span><span class="key">C</span></span><span class="label">Click connect</span><span class="hint">on profile</span></div>
      <div class="keyrow"><span class="kbd"><span class="key">⌥</span><span class="key">N</span></span><span class="label">Add note</span><span class="hint">in modal</span></div>
      <div class="keyrow danger"><span class="kbd"><span class="key">⌥</span><span class="key">S</span></span><span class="label">Send without note</span><span class="hint">careful</span></div>
      <div class="button-row">
        <button id="diagnoseBtn" class="btn btn-ghost" type="button">Run diagnosis</button>
      </div>
      <div id="diagnoseStatus" class="status" role="status" aria-live="polite"></div>
    </section>

    <footer class="footer">
      <span>Ortus Club · 2026</span>
      <span id="versionLabel">v2.2</span>
    </footer>

  </main>
  <script src="matcher.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 4.2 — Manual smoke test**

Open `chrome://extensions`, toggle developer mode, click `Reload` on the Ortus Club QuickConnect entry. Click the toolbar icon. The popup should open with:
- Black wordmark "Ortus Club QuickConnect" with the italic O monogram
- "Standby" live badge, "Live" toggle pill
- Dossier in the empty state ("Open a LinkedIn profile to send a note.")
- Tabs row showing Sheet / Template / Shortcuts with the Sheet tab active
- Sheet form with the existing sync/clear buttons
- Footer with "Ortus Club · 2026" and "v2.2"

The popup will look correct but be functionally broken (popup.js still references the old DOM layout). That's fine — Task 5 fixes it.

- [ ] **Step 4.3 — Commit**

```bash
git add popup.html
git commit -m "Replace popup.html with v2.2 Editorial Luxury shell — dossier + tabs"
```

---

## Task 5 — Refactor `popup.js` to the new DOM (preserve v2.1 functionality)

**Files:**
- Rewrite: `popup.js`

The existing popup.js does five things: load/save extension toggle state, load/sync/clear the Google sheet, load/save/reset the template, render variable chips and live preview, run diagnosis. We preserve all five behaviours and add three new behaviours:
- Tab switching (Sheet / Template / Shortcuts persisted to storage)
- Copy-note button (renders the active template against the sample row OR the matched row, copies to clipboard)
- Tab/profile detection (added in Task 6 — we leave a hook here)

- [ ] **Step 5.1 — Replace `popup.js`** with:

```js
"use strict";

const DEFAULT_TEMPLATE = "Hi {first name}, I wanted to connect.";
const TEMPLATE_KEY      = "messageTemplate";
const SHEET_URL_KEY     = "sheetUrl";
const CONTACTS_KEY      = "sheetContacts";
const HEADERS_KEY       = "sheetHeaders";
const ENABLED_KEY       = "extensionEnabled";
const ACTIVE_TAB_KEY    = "activeSetupTab";
const CONTENT_VERSION   = "2.2";

const $ = (id) => document.getElementById(id);

const dom = {
  popup:                $("popup"),
  liveBadge:            $("liveBadge"),
  liveBadgeText:        $("liveBadgeText"),
  toggle:               $("extensionToggle"),
  toggleText:           $("extensionToggleText"),
  dossier:              $("dossier"),
  dossierEyebrow:       $("dossierEyebrow"),
  dossierName:          $("dossierName"),
  dossierRole:          $("dossierRole"),
  preview:              $("templatePreview"),
  copyBtn:              $("copyNoteBtn"),
  addToSheetBtn:        $("addToSheetBtn"),
  copyStatus:           $("copyStatus"),
  tabSheet:             $("tab-sheet"),
  tabTemplate:          $("tab-template"),
  tabShortcuts:         $("tab-shortcuts"),
  panelSheet:           $("panel-sheet"),
  panelTemplate:        $("panel-template"),
  panelShortcuts:       $("panel-shortcuts"),
  sheetUrl:             $("sheetUrlInput"),
  syncSheet:            $("syncSheetBtn"),
  clearSheet:           $("clearSheetBtn"),
  sheetStatus:          $("sheetStatus"),
  contactCount:         $("contactCount"),
  templateTokenCount:   $("templateTokenCount"),
  template:             $("templateInput"),
  saveTemplate:         $("saveBtn"),
  resetTemplate:        $("resetBtn"),
  templateStatus:       $("status"),
  variableTokenRow:     $("variableTokenRow"),
  diagnose:             $("diagnoseBtn"),
  diagnoseStatus:       $("diagnoseStatus")
};

let state = {
  contacts: [],
  headers:  [],
  matched:  null,    // contact when name match exists
  detectedName: "",  // raw H1 from active tab when no match
};

// ───────────── helpers ─────────────

function setStatus(el, message, type) {
  el.textContent = message || "";
  el.className = `status${type === "ok" ? " ok" : type === "error" ? " error" : ""}`;
}

function updateExtensionToggle(isEnabled) {
  dom.toggleText.textContent = isEnabled ? "Live" : "Paused";
  dom.toggle.setAttribute("aria-pressed", String(isEnabled));
  dom.popup.classList.toggle("paused", !isEnabled);
}

function setLiveBadge(stateName, label) {
  dom.liveBadge.dataset.state = stateName;
  dom.liveBadgeText.textContent = label;
}

// ───────────── csv parsing (lifted from v2.1) ─────────────

function parseCsvRows(csvText) {
  const rows = [];
  let row = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      row.push(current); current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current);
      if (row.some((v) => v.trim())) rows.push(row.map((v) => v.trim()));
      row = []; current = "";
    } else { current += ch; }
  }
  row.push(current);
  if (row.some((v) => v.trim())) rows.push(row.map((v) => v.trim()));
  return rows;
}

function normalizeHeaderKey(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeUniqueHeaders(headerRow) {
  const counts = new Map();
  return headerRow.map((raw) => {
    const base = (raw || "").trim();
    if (!base) return "";
    const key = base.toLowerCase();
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function findHeaderIndex(normalized, aliases) {
  return normalized.findIndex((h) => aliases.includes(h));
}

function parseContactsCsv(csvText) {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return { contacts: [], headers: [] };
  const headerNames = makeUniqueHeaders(rows[0]);
  const headers = headerNames.map(normalizeHeaderKey);
  const firstIdx = findHeaderIndex(headers, ["firstname", "first"]);
  const lastIdx  = findHeaderIndex(headers, ["lastname", "last", "surname"]);
  const titleIdx = findHeaderIndex(headers, ["title", "jobtitle", "position", "role"]);
  const compIdx  = findHeaderIndex(headers, ["company", "companyname", "accountname", "organization", "organisation", "employer"]);
  if (firstIdx === -1 || lastIdx === -1) {
    throw new Error("Missing required headers. Need: first name and last name.");
  }
  const contacts = rows.slice(1).map((r) => {
    const fields = {};
    headerNames.forEach((h, i) => { if (h) fields[h] = (r[i] || "").trim(); });
    return {
      firstName: (r[firstIdx] || "").trim(),
      lastName:  (r[lastIdx]  || "").trim(),
      title:     titleIdx === -1 ? "" : (r[titleIdx] || "").trim(),
      company:   compIdx  === -1 ? "" : (r[compIdx]  || "").trim(),
      fields
    };
  }).filter((c) => c.firstName && c.lastName);
  return { contacts, headers: headerNames.filter(Boolean) };
}

function toCsvExportUrl(sheetUrl) {
  const url = new URL(sheetUrl);
  if (url.hostname !== "docs.google.com") {
    throw new Error("Use a docs.google.com spreadsheet URL.");
  }
  const m = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error("Invalid Google Sheet URL.");
  const gid = url.searchParams.get("gid") || "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

// ───────────── template rendering ─────────────

function getFieldValue(contact, tokenName) {
  if (!contact) return "";
  const fields = contact.fields && typeof contact.fields === "object" ? contact.fields : contact;
  const targetKey = normalizeHeaderKey(tokenName);
  const found = Object.keys(fields).find((k) => normalizeHeaderKey(k) === targetKey);
  return found ? String(fields[found] || "").trim() : "";
}

function renderTemplate(template, contact) {
  return (template || DEFAULT_TEMPLATE).replace(/\{([^{}]+)\}/g, (full, name) => {
    const v = getFieldValue(contact, name);
    return v || full;
  }).trim();
}

function renderTemplateAsHtml(template, contact) {
  // For the dossier preview: substituted variables get a highlighted span.
  const escape = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return (template || DEFAULT_TEMPLATE).replace(/\{([^{}]+)\}/g, (full, name) => {
    const v = getFieldValue(contact, name);
    if (v) return `<span class="var">${escape(v)}</span>`;
    return `<span class="var" style="background:transparent;color:var(--ink-faint);border:1px dashed var(--rule-2)">${escape(full)}</span>`;
  });
}

// ───────────── persistence ─────────────

async function loadEnabled() {
  const r = await chrome.storage.sync.get({ [ENABLED_KEY]: true });
  updateExtensionToggle(r[ENABLED_KEY] !== false);
}
async function toggleEnabled() {
  const r = await chrome.storage.sync.get({ [ENABLED_KEY]: true });
  const next = r[ENABLED_KEY] === false;
  await chrome.storage.sync.set({ [ENABLED_KEY]: next });
  updateExtensionToggle(next);
}

async function loadTemplate() {
  const r = await chrome.storage.sync.get({ [TEMPLATE_KEY]: DEFAULT_TEMPLATE });
  dom.template.value = r[TEMPLATE_KEY] || DEFAULT_TEMPLATE;
  refreshDossierPreview();
}
async function saveTemplate() {
  const next = (dom.template.value || "").trim() || DEFAULT_TEMPLATE;
  await chrome.storage.sync.set({ [TEMPLATE_KEY]: next });
  dom.template.value = next;
  refreshDossierPreview();
  setStatus(dom.templateStatus, "Template saved.", "ok");
}
async function resetTemplate() {
  dom.template.value = DEFAULT_TEMPLATE;
  await saveTemplate();
}

async function loadSheet() {
  const sync = await chrome.storage.sync.get({ [SHEET_URL_KEY]: "" });
  const local = await chrome.storage.local.get({
    [CONTACTS_KEY]: [],
    [HEADERS_KEY]:  []
  });
  dom.sheetUrl.value = sync[SHEET_URL_KEY] || "";
  state.contacts = Array.isArray(local[CONTACTS_KEY]) ? local[CONTACTS_KEY] : [];
  state.headers = Array.isArray(local[HEADERS_KEY])
    ? local[HEADERS_KEY].filter(Boolean)
    : inferHeadersFromContacts(state.contacts);
  dom.contactCount.textContent = String(state.contacts.length);
  renderTokenRow();
  setStatus(
    dom.sheetStatus,
    state.contacts.length
      ? `${state.contacts.length} contacts · ${state.headers.length} variables loaded.`
      : "No sheet data yet.",
    state.contacts.length ? "ok" : ""
  );
}

async function syncSheet() {
  const url = (dom.sheetUrl.value || "").trim();
  if (!url) { setStatus(dom.sheetStatus, "Paste a Google Sheet URL first.", "error"); return; }
  setStatus(dom.sheetStatus, "Syncing sheet…");
  setSheetLoading(true);
  try {
    const res = await fetch(toCsvExportUrl(url));
    if (!res.ok) throw new Error(`Fetch failed (${res.status}). Check sharing permissions.`);
    const { contacts, headers } = parseContactsCsv(await res.text());
    await chrome.storage.sync.set({ [SHEET_URL_KEY]: url });
    await chrome.storage.local.set({ [CONTACTS_KEY]: contacts, [HEADERS_KEY]: headers });
    state.contacts = contacts; state.headers = headers;
    dom.contactCount.textContent = String(contacts.length);
    renderTokenRow();
    refreshDossierPreview();
    setStatus(dom.sheetStatus, `Synced ${contacts.length} contacts · ${headers.length} variables.`, "ok");
  } catch (err) {
    setStatus(dom.sheetStatus, err.message || "Could not sync sheet.", "error");
  } finally {
    setSheetLoading(false);
  }
}

async function clearSheet() {
  await chrome.storage.local.set({ [CONTACTS_KEY]: [], [HEADERS_KEY]: [] });
  await chrome.storage.sync.set({ [SHEET_URL_KEY]: "" });
  dom.sheetUrl.value = "";
  state.contacts = []; state.headers = [];
  dom.contactCount.textContent = "0";
  renderTokenRow();
  refreshDossierPreview();
  setStatus(dom.sheetStatus, "Sheet data cleared.", "ok");
}

function setSheetLoading(loading) {
  dom.syncSheet.disabled  = loading;
  dom.clearSheet.disabled = loading;
  dom.sheetUrl.disabled   = loading;
  dom.syncSheet.textContent = loading ? "Syncing…" : "Sync sheet";
}

function inferHeadersFromContacts(contacts) {
  const c = contacts.find((x) => x && typeof x === "object");
  if (!c) return [];
  if (c.fields && typeof c.fields === "object") return Object.keys(c.fields);
  return [];
}

function renderTokenRow() {
  dom.variableTokenRow.replaceChildren();
  state.headers.forEach((h) => {
    const btn = document.createElement("button");
    const tk  = `{${h}}`;
    btn.type = "button"; btn.className = "token variable-btn";
    btn.dataset.token = tk; btn.textContent = tk;
    dom.variableTokenRow.appendChild(btn);
  });
  updateTemplateMeta();
}

function updateTemplateMeta() {
  const tpl = dom.template.value || "";
  const available = new Set(state.headers.map(normalizeHeaderKey));
  const used = new Set(
    Array.from(tpl.matchAll(/\{([^{}]+)\}/g))
      .map((m) => normalizeHeaderKey(m[1]))
      .filter((t) => !available.size || available.has(t))
  );
  dom.templateTokenCount.textContent = String(used.size);
  refreshDossierPreview();
}

function insertTokenAtCursor(tk) {
  const el = dom.template;
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd   ?? el.value.length;
  el.value = el.value.slice(0, start) + tk + el.value.slice(end);
  el.focus();
  el.setSelectionRange(start + tk.length, start + tk.length);
  updateTemplateMeta();
}

// ───────────── dossier render (Standby / Matched / Detected-no-match) ─────────────

function refreshDossierPreview() {
  const tpl = dom.template ? (dom.template.value || DEFAULT_TEMPLATE) : DEFAULT_TEMPLATE;

  if (state.matched) {
    dom.dossier.classList.remove("standby");
    setLiveBadge("matched", "Matched");
    dom.dossierEyebrow.textContent = "From the open tab";
    dom.dossierName.innerHTML = formatNameHtml(state.matched.firstName, state.matched.lastName);
    dom.dossierRole.innerHTML = formatRole(state.matched);
    dom.preview.innerHTML = renderTemplateAsHtml(tpl, state.matched);
    dom.copyBtn.disabled = false;
    dom.copyBtn.querySelector("span").textContent = "Copy note";
    dom.addToSheetBtn.hidden = true;
    return;
  }

  if (state.detectedName) {
    dom.dossier.classList.remove("standby");
    setLiveBadge("nomatch", "No match");
    dom.dossierEyebrow.textContent = "Profile detected";
    dom.dossierName.textContent = state.detectedName;
    dom.dossierRole.textContent = "Not in your sheet — copy the raw template or add this contact.";
    dom.preview.innerHTML = renderTemplateAsHtml(tpl, null);
    dom.copyBtn.disabled = false;
    dom.copyBtn.querySelector("span").textContent = "Copy raw template";
    dom.addToSheetBtn.hidden = false;
    return;
  }

  // Standby
  dom.dossier.classList.add("standby");
  setLiveBadge("standby", "Standby");
  dom.dossierEyebrow.textContent = "Open a profile";
  dom.dossierName.textContent = "Open a LinkedIn profile to send a note.";
  dom.dossierRole.textContent = "";
  dom.preview.innerHTML = "";
  dom.copyBtn.disabled = true;
  dom.copyBtn.querySelector("span").textContent = "Copy note";
  dom.addToSheetBtn.hidden = true;
}

function formatNameHtml(first, last) {
  const f = (first || "").trim();
  const l = (last  || "").trim();
  if (!f && !l) return "";
  if (!l) return escapeHtml(f);
  return `${escapeHtml(f)} <em>${escapeHtml(l)}</em>`;
}

function formatRole(c) {
  const parts = [];
  if (c.title)   parts.push(escapeHtml(c.title));
  if (c.company) parts.push(escapeHtml(c.company));
  const city = getFieldValue(c, "city");
  if (city) parts.push(escapeHtml(city));
  return parts.join(`<span class="sep">·</span>`);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// ───────────── copy note ─────────────

async function copyNote() {
  const tpl = dom.template.value || DEFAULT_TEMPLATE;
  const text = renderTemplate(tpl, state.matched || null);
  try {
    await navigator.clipboard.writeText(text);
    setStatus(dom.copyStatus, "Copied to clipboard.", "ok");
    setTimeout(() => setStatus(dom.copyStatus, ""), 2400);
  } catch (e) {
    setStatus(dom.copyStatus, "Could not copy. Click in the popup and retry.", "error");
  }
}

// ───────────── tab switcher ─────────────

const PANELS = [
  { tab: "tabSheet",     panel: "panelSheet",     name: "sheet" },
  { tab: "tabTemplate",  panel: "panelTemplate",  name: "template" },
  { tab: "tabShortcuts", panel: "panelShortcuts", name: "shortcuts" }
];

async function loadActiveTab() {
  const r = await chrome.storage.sync.get({ [ACTIVE_TAB_KEY]: "sheet" });
  selectTab(r[ACTIVE_TAB_KEY]);
}
async function selectTab(name) {
  const target = PANELS.find((p) => p.name === name) || PANELS[0];
  PANELS.forEach((p) => {
    const isActive = p === target;
    dom[p.tab].setAttribute("aria-selected", String(isActive));
    dom[p.panel].hidden = !isActive;
  });
  await chrome.storage.sync.set({ [ACTIVE_TAB_KEY]: target.name });
}

// ───────────── diagnose (preserve v2.1) ─────────────

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\/([^/]+\.)?linkedin\.com\//i.test(tab.url || "")) {
    throw new Error("Open a LinkedIn profile tab first.");
  }
  return tab;
}

async function ensureContentScript(tabId) {
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__ORTUS_F1_CONNECTION_VERSION__ || null
  });
  if (loaded === CONTENT_VERSION) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function runDiagnosis() {
  dom.diagnose.disabled = true;
  setStatus(dom.diagnoseStatus, "Running diagnosis…");
  try {
    const tab = await getActiveLinkedInTab();
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: `quickconnect:${CONTENT_VERSION}`,
      action: "diagnoseProfile"
    });
    if (!response?.ok) throw new Error(response?.error || "Diagnosis failed.");
    const report = JSON.stringify(response.report, null, 2);
    await navigator.clipboard.writeText(report);
    console.log("Ortus Club diagnosis", response.report);
    setStatus(dom.diagnoseStatus, "Diagnosis copied to clipboard.", "ok");
  } catch (e) {
    setStatus(dom.diagnoseStatus, e.message || "Could not run diagnosis.", "error");
  } finally {
    dom.diagnose.disabled = false;
  }
}

// ───────────── wiring ─────────────

dom.toggle.addEventListener("click", toggleEnabled);
dom.saveTemplate.addEventListener("click", saveTemplate);
dom.resetTemplate.addEventListener("click", resetTemplate);
dom.template.addEventListener("input", updateTemplateMeta);
dom.syncSheet.addEventListener("click", syncSheet);
dom.clearSheet.addEventListener("click", clearSheet);
dom.diagnose.addEventListener("click", runDiagnosis);
dom.copyBtn.addEventListener("click", copyNote);
dom.variableTokenRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".variable-btn");
  const tk = btn?.dataset?.token;
  if (tk) insertTokenAtCursor(tk);
});
PANELS.forEach((p) => dom[p.tab].addEventListener("click", () => selectTab(p.name)));

// ───────────── boot ─────────────

(async function boot() {
  await loadEnabled();
  await loadTemplate();
  await loadSheet();
  await loadActiveTab();
  refreshDossierPreview();
  // Tab/profile detection wired in Task 6.
})();
```

- [ ] **Step 5.2 — Manual smoke test**

Reload the extension. Click the toolbar icon. Verify:
- Toggle switches between "Live" and "Paused" (popup desaturates when paused)
- Sheet tab shows existing URL + contact count if previously synced
- Template tab loads the previous template; clicking variable chips inserts at cursor
- Save / Reset buttons update the status line
- Tab switching works and persists across reopens
- Shortcuts tab shows the keystroke list
- Run diagnosis works on a LinkedIn tab

The dossier still shows "Standby" — Task 6 wires the live detection.

- [ ] **Step 5.3 — Commit**

```bash
git add popup.js
git commit -m "Refactor popup.js to v2.2 DOM with state machine and tab switcher"
```

---

## Task 6 — Tab + profile name detection

**Files:**
- Modify: `content.js` — add `getActiveProfileName` action
- Modify: `popup.js` — query active tab on boot

- [ ] **Step 6.1 — Inspect `content.js` to find the message handler**

Run: `grep -n "addListener\|onMessage\|action ==" content.js`
Expected: an existing `chrome.runtime.onMessage.addListener` and an action dispatcher (`diagnoseProfile`, `pasteMessage`, etc.). Identify the function that handles incoming actions.

- [ ] **Step 6.2 — Add a `getActiveProfileName` handler in `content.js`**

Locate the handler function (likely a `switch (action)` or `if (action === ...)` chain). Add a new branch that returns the profile H1 if the page is a LinkedIn profile.

```js
// near the top of content.js or near other DOM helpers — DO NOT duplicate if already exists
function getProfileNameFromPage() {
  if (!/\/in\//.test(location.pathname)) return "";
  const h1 = document.querySelector("main h1")
          || document.querySelector("h1.text-heading-xlarge")
          || document.querySelector("h1");
  return (h1?.textContent || "").trim();
}
```

In the message handler, alongside `diagnoseProfile`, add:

```js
if (action === "getActiveProfileName") {
  sendResponse({ ok: true, name: getProfileNameFromPage(), url: location.href });
  return true; // keep channel open for async sendResponse
}
```

If your existing handler uses `async` + `await` returns instead of `sendResponse`, mirror that pattern:

```js
case "getActiveProfileName":
  return { ok: true, name: getProfileNameFromPage(), url: location.href };
```

- [ ] **Step 6.3 — Wire detection into `popup.js`**

Open `popup.js` and replace the `// Tab/profile detection wired in Task 6.` comment block with:

```js
async function detectActiveProfile() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\/([^/]+\.)?linkedin\.com\/in\//i.test(tab.url || "")) {
      state.matched = null;
      state.detectedName = "";
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: `quickconnect:${CONTENT_VERSION}`,
      action: "getActiveProfileName"
    });
    const name = (response?.name || "").trim();
    if (!name) {
      state.matched = null;
      state.detectedName = "";
      return;
    }
    const matched = (typeof matchContact === "function")
      ? matchContact(name, state.contacts)
      : null;
    state.matched = matched;
    state.detectedName = matched ? "" : name;
  } catch (err) {
    console.warn("Ortus Club: profile detection failed", err);
    state.matched = null;
    state.detectedName = "";
  }
}
```

Then update the boot sequence:

```js
(async function boot() {
  await loadEnabled();
  await loadTemplate();
  await loadSheet();
  await loadActiveTab();
  await detectActiveProfile();
  refreshDossierPreview();
})();
```

- [ ] **Step 6.4 — Manual smoke test**

1. Open `chrome://extensions`, reload the extension.
2. Open a LinkedIn profile that exists in your synced sheet (e.g. for testing add a row "Helena Voss" to your sheet, then visit any profile and pretend the H1 is "Helena Voss" — or test on a real profile that's already in the sheet).
3. **Refresh the LinkedIn tab** (the content script must reload to pick up the new handler).
4. Click the Ortus toolbar icon.
5. Expected — Matched: live badge says `Matched`, dossier shows `First *Last*`, role from the sheet, preview is personalized.
6. Open a LinkedIn profile that is NOT in the sheet.
7. Refresh the tab. Click the toolbar icon.
8. Expected — No match: live badge says `No match`, dossier shows the LinkedIn name as a single string (no italic surname split), preview shows the raw template with token placeholders shown dashed.
9. Open a non-LinkedIn tab. Click the toolbar icon.
10. Expected — Standby: dossier shows the empty-state line.

- [ ] **Step 6.5 — Commit**

```bash
git add content.js popup.js
git commit -m "Wire active-tab profile detection and matcher into dossier render"
```

---

## Task 7 — Update `manifest.json` and clean up old icons

**Files:**
- Modify: `manifest.json`
- Delete: `icons/f1-*.png`
- Delete: `icons/ortus-*.png` (the old "OR"/"CC" mark)

- [ ] **Step 7.1 — Replace `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Ortus Club QuickConnect",
  "version": "2.2.0",
  "description": "LinkedIn outreach helper for Ortus Club operators — personalised connection notes from a Google Sheet, triggered by keystroke.",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["https://docs.google.com/*", "*://*.linkedin.com/*"],
  "background": { "service_worker": "background.js" },
  "icons": {
    "16":  "icons/ortus-club-16.png",
    "32":  "icons/ortus-club-32.png",
    "48":  "icons/ortus-club-48.png",
    "128": "icons/ortus-club-128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16":  "icons/ortus-club-16.png",
      "32":  "icons/ortus-club-32.png",
      "48":  "icons/ortus-club-48.png",
      "128": "icons/ortus-club-128.png"
    }
  },
  "commands": {
    "paste-message": {
      "suggested_key": { "default": "Alt+P", "mac": "Alt+P" },
      "description": "Paste the personalised connection note"
    },
    "connect-profile": {
      "suggested_key": { "default": "Alt+C", "mac": "Alt+C" },
      "description": "Click the visible LinkedIn Connect action"
    },
    "add-note": {
      "suggested_key": { "default": "Alt+N", "mac": "Alt+N" },
      "description": "Click Add a note in the connection flow"
    },
    "send-invite": {
      "suggested_key": { "default": "Alt+S", "mac": "Alt+S" },
      "description": "Click Send without a note"
    }
  },
  "content_scripts": [
    { "matches": ["*://*.linkedin.com/*"], "js": ["content.js"] }
  ]
}
```

- [ ] **Step 7.2 — Delete the old icon sets**

```bash
rm icons/f1-16.png icons/f1-32.png icons/f1-48.png icons/f1-128.png
rm icons/ortus-16.png icons/ortus-32.png icons/ortus-48.png icons/ortus-128.png
ls icons/
```

Expected: only `ortus-club-{16,32,48,128}.png` and the `source/` directory remain.

- [ ] **Step 7.3 — Manual smoke test**

1. `chrome://extensions` → reload.
2. The toolbar icon should now be the new dark italic-O monogram with the gold pip.
3. Right-click the icon → "Inspect popup" — check console for missing-asset warnings; should be none.
4. The extension card on `chrome://extensions` should show the new 48 px icon and read "Ortus Club QuickConnect" with version 2.2.0.

- [ ] **Step 7.4 — Commit**

```bash
git add manifest.json
git rm icons/f1-*.png icons/ortus-16.png icons/ortus-32.png icons/ortus-48.png icons/ortus-128.png
git commit -m "Bump to v2.2.0, rename to Ortus Club QuickConnect, swap icon set"
```

---

## Task 8 — End-to-end verification

**Files:** none modified.

- [ ] **Step 8.1 — Full regression sweep**

Verify each item below. Mark ✅ or note the issue.

| State / Path                                 | Expected behaviour                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| Reload extension cold                        | Popup opens in Standby, default tab Sheet, Live toggle on                   |
| Sync a known sheet                           | Contact count updates; status `Synced N contacts · K variables.`            |
| Open LinkedIn profile that's in sheet, refresh tab, open popup | Matched dossier with personalised preview; Copy note enabled |
| Click Copy note                              | Status `Copied to clipboard.` for ~2.4 s, then clears                       |
| Paste into LinkedIn note modal               | Personalised note pasted                                                    |
| ⌥ P on profile page                          | Pastes note into the modal (existing v2.1 behavior)                         |
| ⌥ C on profile page                          | Clicks the visible Connect button                                           |
| ⌥ N in the connect modal                     | Clicks Add a note                                                           |
| ⌥ S in the connect modal                     | Sends without a note                                                        |
| Open a LinkedIn profile NOT in sheet         | Live badge `No match`; preview shows raw template with token placeholders   |
| Open a non-LinkedIn tab                      | Live badge `Standby`; dossier shows empty-state line                        |
| Toggle to Paused                             | Popup desaturates; dossier name strikes through                             |
| Toggle back to Live                          | Visual restored                                                             |
| Switch tabs Sheet → Template → Shortcuts     | Each panel renders; selection persists across popup re-opens                |
| Run diagnosis on a LinkedIn page             | Status `Diagnosis copied to clipboard.`                                     |
| Run diagnosis on a non-LinkedIn page         | Status `Open a LinkedIn profile tab first.`                                 |

- [ ] **Step 8.2 — Confirm `npm test` still passes**

```bash
npm test
```

Expected: all matcher tests pass.

- [ ] **Step 8.3 — Final commit (only if regressions surfaced fixes)**

If Step 8.1 caught issues that needed code changes, commit the fixes individually with messages like `Fix dossier role rendering when sheet has no city column`. Do NOT bundle multiple fixes into a single commit.

If everything passed cleanly: no commit needed; move to PR.

---

## Self-Review Notes

**Spec coverage check:**
- §2 Functional scope (Matched / No-match / Standby / Pause) → Tasks 5 + 6
- §3 Type system → Task 4 (CSS)
- §4 Color → Task 4 (CSS variables)
- §5 Materials (paper grain, double-bezel) → Task 4 (CSS)
- §6 Components (mark, toggle, live badge, dossier, CTA, ghost, tabs, inputs, keyrow) → Task 4 + 5
- §7 Motion (cubic-bezier transitions) → Task 4 (CSS)
- §8 Toolbar icon set → Task 3
- §10 UX flow → Tasks 5 + 6
- §11 Accessibility (aria-pressed, role=status, focus rings) → Task 4 + 5
- Name matcher (§2 nested) → Tasks 1 + 2

**Open risks the engineer should know about:**
- Newsreader and Geist are NOT bundled in v2.2 — popups render with system serif/sans fallbacks. If the team complains about FOUT, file a v2.3 ticket.
- Profile name detection relies on a `<h1>` selector. LinkedIn changes its DOM frequently; the selector list in `getProfileNameFromPage()` is best-effort. If it breaks, the matcher silently returns null and the popup falls back to Standby.
- Token containment requires *both* sheet first and last name tokens to appear in the LinkedIn name. If the operator's sheet has a multi-word last name (`von Berg`) but LinkedIn shows a shortened version, no match — by design.
- The Copy note button writes to clipboard, not into LinkedIn's textarea directly. The user still needs to ⌥ P or paste manually. This is honest but means the UI has two ways to get the note in: keystroke and copy-then-paste.
