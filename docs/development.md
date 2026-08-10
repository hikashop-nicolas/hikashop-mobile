# Development

Node 22 or newer.

```sh
npm ci
npm run dev        # the app, against a shop you have paired
npm run build      # the web build, in dist/
npm run typecheck
npm run lint
npm test           # unit tests, including palette contrast and screen-reader output
```

The Android app is the same web build wrapped with Capacitor:

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

See [../android/RELEASE.md](../android/RELEASE.md) for signed builds and the release script.

## Tests that need a shop

The end-to-end suite, the accessibility audit and the screenshots drive the real app against a
real HikaShop, because a mock would prove none of the things they are there to prove. They need
a paired shop: copy `cypress.env.example.json` to `cypress.env.json` and fill it in, and have
`npm run dev` running.

```sh
npm run e2e          # end-to-end suite
npm run a11y         # accessibility audit: axe over 32 screen states, both themes
npm run screenshots  # regenerates the images in the README
```

To fill a local HikaShop with a shop that looks like a shop (products, categories, customers,
a year of orders), use the seeder in the HikaShop repository:

```sh
php tools/demo-shop/seed-demo-shop.php --site=/path/to/joomla
```

## Languages

English and French are written by hand in `src/i18n/en.ts` and `fr.ts`. The other 56 are built
from HikaShop's own translation files:

```sh
node tools/build-locales.mjs [--hikashop=../hikashop]
```

It maps the app's keys onto HikaShop's, by identical English and by the hand-written pairs in
`src/i18n/hikashop-keys.json`, and reads the translation out of each `.ini`. Nothing is
invented: a string either has an official HikaShop translation or it is left out, and the app
falls back to English for that one string.

That means the app uses the same words as the merchant's own backend, and it inherits
HikaShop's wording exactly, quirks included. HikaShop's German for `PRODUCTS` is "Produkt", so
the app's menu says "Produkt"; fix it in HikaShop's `de-DE.com_hikashop.ini`, regenerate, and
the app follows.

Coverage is about 150 of 514 strings per language, which is the visible vocabulary: the menu,
the buttons, the listing labels, the status words. The rest is app-specific wording that
HikaShop has no equivalent for. To improve a language, add pairs to `hikashop-keys.json` rather
than translating by hand, so all 56 gain at once.

Each catalogue is a separate lazy chunk of a few KB, so a merchant downloads the one they read.

## What runs in CI

`.github/workflows/ci.yml` runs typecheck, lint, unit tests and the build on every push, and
builds the Android app. `pages.yml` publishes the web version. The suites above are not in CI,
because CI has no shop; see [accessibility.md](accessibility.md) for how that gap is covered.

## Layout

| | |
| --- | --- |
| `src/core` | The connector client, models, cache and storage. No React. |
| `src/app` | Cross-cutting app concerns: stores, i18n, theme, shortcuts, polling. |
| `src/ui` | Atoms and molecules, built from the tokens in `src/ui/tokens.css`. |
| `src/screens` | One file per screen or dialog. |
| `android` | The Capacitor shell. |

The server side is a plugin in the HikaShop repository,
`plugins/plg_system_hikashop_connector`, and ships inside the Business package.

## Accessibility

The app targets WCAG 2.2 AA. [accessibility.md](accessibility.md) records what is checked
automatically, what was fixed, and what still needs a person and a screen reader.
