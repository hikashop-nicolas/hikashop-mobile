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
- **Not tested with a real screen reader.** A pass with VoiceOver and with TalkBack remains the
  only way to know whether what is announced is *useful* rather than merely present, and to
  meet real quirks. The simulated announcement tests below cover the regressions; they do not
  cover this.
- **The chart** is a picture of a series with no text alternative. The figures beside it carry
  the same information, but the shape does not.

## Screen reader testing

Three layers, cheapest first, and only the last one needs a person.

**1. Names exist.** The audit walks every button, link, field and option on the main screens
and computes the accessible name a browser would hand a screen reader. Any control that comes
out blank fails the run.

**2. What is announced** (`src/ui/announced.test.tsx`). `@guidepup/virtual-screen-reader`
reads the accessibility tree the way a screen reader does and reports the phrases it would
speak, so the tests assert the words rather than the markup. It is a simulator, headless and
cross-platform, so it runs in CI on any runner and in the ordinary `npm test`.

Its worth was checked rather than assumed: with the pre-audit `Field`, the label test reports
`textbox, Hand-Thrown Mug`, which is what someone would have heard, with no idea what the
field was for. With the fix it reports the label.

**3. A real screen reader**, which is still the only way to judge whether a phrase reads well.

*On tooling for layer 3.* `web-test-runner-voiceover` was turned down on 2026-08-09: macOS
VoiceOver only, so nothing for Android where most of these users are, no CI support, and a
third test runner beside Vitest and Cypress.

**Guidepup itself can drive the real thing in CI**, which is worth knowing when layer 3 is
scheduled: `guidepup/setup-action` configures a GitHub Actions runner for real VoiceOver on
macOS and real NVDA on Windows. Neither is free (a macOS runner costs about ten times a Linux
one) and neither covers TalkBack, so the sensible shape is a nightly or pre-release job rather
than a per-pull-request one. Between them, NVDA and VoiceOver reach roughly 80 to 85% of
screen reader users, and TalkBack stays a manual pass on a device.

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
