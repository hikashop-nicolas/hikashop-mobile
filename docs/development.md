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
