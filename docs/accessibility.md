# Accessibility

Target: **WCAG 2.2 level AA**.

## The automated part

`npm run a11y` runs axe-core over 21 screen states: every listing, a record open, the pairing
screen and the shortcut dialog, at a phone width and at a width where the split layout is in
use, in the light theme and in the dark one. It reports **no violations**.

Worth being blunt about what that is worth: axe finds a minority of what WCAG asks for. It
checks names, roles, contrast and structure. It cannot tell whether a label says something
useful, whether the focus order makes sense, or whether the app can be operated at all without
a mouse. Those are checked by hand and listed below.

Audit both themes when you change the palette. Contrast is a property of the colours in use,
and the two themes fail independently.

## Fixed in the audit of 2026-08-09

- **Every field in the app was unnamed.** `Field` rendered its label as a `<span>` with no
  association, so a screen reader announced 108 fields as bare text boxes. It now renders a
  real `<label>` tied to its control by id, where the control is a native one. A field holding
  something else (a picker button, a row of controls) keeps the plain text, because labelling
  the wrong control, or wrapping the field in a label so that clicking anywhere presses its
  button, would be worse.
- **Three selects had no name at all**: the language and theme pickers, and the order status.
- **The search box was named only by its placeholder**, which disappears as soon as there is a
  value.
- **Contrast.** `--hk-faint` was 2.19:1 against the page, well under the 4.5 needed, and it is
  used for hints, chart labels and secondary rows. The dark theme's was 2.78:1. The status
  pills were also under: 4.36 for confirmed, 3.94 for warnings. All the palette's text pairs
  now clear 4.5, with the muted step darkened as well so the three levels of emphasis stay
  distinguishable rather than collapsing together.
- **Dialogs.** The modal had `role="dialog"` and `aria-modal`, which hides the page behind it
  from a screen reader but does nothing about the tab key, so focus walked out of the dialog
  into a page it could not see. It now traps focus, closes on Escape, returns focus to whatever
  opened it, and is named by its own title. Its close button was labelled in English
  regardless of the language in use.
- **Focus rings on inputs.** `.hk-input:focus` and `.hk-select:focus` set `outline: none` and
  out-specified the global `:focus-visible` ring, leaving only a 1px border colour change.

## Checked by hand

- **Keyboard.** Every screen can be reached and operated from the keyboard, and the shortcuts
  below make the common moves cheaper. Nothing traps focus except dialogs, deliberately, and
  they release it on Escape.
- **Focus visible.** A global `:focus-visible` ring, and now on inputs and selects too.
- **A record covering a listing** on a narrow screen is `inert`, so it is out of the tab order
  and unreachable by a screen reader rather than merely hidden behind something.
- **Language.** `<html lang>` follows the language chosen in the app, not just the build.
- **Motion.** `prefers-reduced-motion` turns off the view transitions.
- **Zoom.** Layouts are built on flexible units and hold together at 200%.

## Known gaps

- **No skip link.** The tab order starts at the navigation on every screen. Worth adding.
- **Landmarks are partial.** The shell is not fully marked up with `<nav>`, `<main>` and
  friends, so "jump to the main content" is not available to a screen reader either.
- **Not tested with a real screen reader.** Everything above is either automated or reasoned
  from the markup. A pass with VoiceOver and with TalkBack remains the only way to find out
  whether the labels say something *useful* rather than merely existing.

  `web-test-runner-voiceover` was considered on 2026-08-09 and turned down. It drives macOS
  VoiceOver only, so it covers nothing on Android, which is where most of these users are; it
  cannot run in CI at all, since GitHub Actions cannot grant the accessibility permissions it
  needs; and it is built on a third test runner beside Vitest and Cypress. What it would give
  us over the accessible-name check below is confirmation of exact phrasing on one platform we
  are not shipping to first.
- **The chart** is a picture of a series with no text alternative. The figures beside it carry
  the same information, but the shape does not.

## The accessible name check

The audit also walks every button, link, field and option on the main screens and computes the
accessible name a browser would hand a screen reader. Any control that comes out blank fails
the run. This is the part of screen-reader testing that can run in CI: it does not tell you
whether a name reads well, but it does tell you when a control has none, which is exactly the
failure that a sighted test never notices.

## Keyboard shortcuts

Press `Cmd`/`Ctrl`+`K` for the palette or `?` for the list. The plain keys never fire while you
are typing, because a shop's product names contain every letter they use.

| | |
| --- | --- |
| `g d` | Dashboard |
| `g o` | Orders |
| `g p` | Products |
| `g c` | Categories |
| `g u` | Customers |
| `g r` | Discounts |
| `g s` | Stores |
| `/` | Focus the search box |
| `n` | New |
| `Esc` | Close what is open |
| `?` | Show the list |
| `Cmd`/`Ctrl` + `K` | Open the palette, **including while typing** |

All but one are single keys or one leading key, because most modifier combinations are already
spoken for. `Cmd+N`, `Cmd+T` and `Cmd+W` never reach a page at all, and the ones that do
(`Cmd+P`, `Cmd+F`, `Cmd+S`, `Cmd+D`) are ones a merchant uses; taking `Cmd+P` from someone
printing an invoice would be a poor trade. `Option`+letter is worse again, since on macOS it
types accented characters, inside the very fields where it would need to work.

The cost of plain keys is that they cannot fire while you are typing. `Cmd`/`Ctrl`+`K` covers
that: it works from inside any field, and the palette it opens can run any of the others, so
you are never more than one binding away from the rest.
