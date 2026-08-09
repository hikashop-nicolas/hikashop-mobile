# HikaShop mobile

Run your [HikaShop](https://www.hikashop.com) store from a phone, a tablet or a browser. Follow
your sales, take care of your orders, and edit your catalogue without opening the backend.

The app talks to your own site directly. There is no account to create, no service in the
middle, and nothing about your shop is stored anywhere but on your server and on your device.

![The dashboard](docs/screenshots/01-dashboard.png)

## What it does

- **Orders.** Read them, search and filter them, change their status, edit the addresses, the
  products and the shipping and payment fees, or create an order by hand.
- **Products.** Full editing: images, prices, variants, characteristics, related products,
  files, and your own custom fields.
- **Categories, customers, discounts and coupons.**
- **A dashboard** of revenue, orders, average basket and customers, over the day, week, month
  or year, with your best sellers.
- **Notifications** when an order arrives or a product runs low on stock.
- **Barcodes**, scanned with the camera or with a barcode reader, to find a product and correct
  its stock.
- **Your own mass actions.** Any mass action you set to appear on a backend listing appears in
  the app too, so your bulk operations come with you.
- **Several shops** in one app, switched from the menu.

|  |  |
| --- | --- |
| ![Orders](docs/screenshots/02-orders.png) | ![Editing a product](docs/screenshots/03-product.png) |

Press `Cmd`/`Ctrl`+`K` for the command palette, which works even while you are typing, or `?`
for the shortcut list: `g p` for products, `g o` for orders, `/` to search, `n` for new, `Esc`
to close.

## Requirements

- **HikaShop Business 6.6.0 or newer**, on Joomla or on WordPress. The app talks to the
  connector plugin that ships inside the Business package; Essential and Starter sites do not
  answer it.
- HTTPS on your site. Pairing sends a one-time code and the reply carries the key for that
  device, and every later request carries it too, so a shop served over plain HTTP exposes it to
  anyone on the same network.

## Installing it

- **Android:** sideload the APK from the [latest release](../../releases/tag/android-latest).
  Android will warn about installing from an unknown source. A Google Play listing is on its way.
- **Browser or desktop:** open the [web version](https://hikashop-nicolas.github.io/hikashop-mobile/).
  It installs as a normal app from the browser's menu, and works the same as the Android build.

## Connecting it to your shop

1. In your site's backend, open **System > App Devices** and add a device.
2. A QR code appears, valid for a few minutes and usable once.
3. Scan it with the app, or type the code by hand.

The app receives its own key, so your password is never typed into it. Each device is listed in
the backend with the date it was last used, and can be revoked on its own, which is what you do
when a phone is lost or somebody leaves.

What each device is allowed to see and change follows the access levels of your Joomla or
WordPress site and the **Access levels** tab of the HikaShop configuration, so a device paired
for an employee is limited to what they need.

|  |  |  |
| --- | --- | --- |
| ![Products on a phone](docs/screenshots/04-phone-products.png) | ![An order on a phone](docs/screenshots/05-phone-order.png) | ![Several shops](docs/screenshots/06-phone-stores.png) |

## Building it yourself

Node 22 or newer.

```sh
npm ci
npm run dev        # the app, against a shop you have paired
npm run build      # the web build, in dist/
npm run typecheck
npm test           # unit tests
```

The Android app is the same web build wrapped with Capacitor:

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

See [android/RELEASE.md](android/RELEASE.md) for signed builds.

The end-to-end suite and the screenshots drive the real app against a real shop, so they need a
paired store: copy `cypress.env.example.json` to `cypress.env.json` and fill it in.

```sh
npm run e2e          # end-to-end suite
npm run a11y         # accessibility audit, axe-core over every screen
npm run screenshots  # regenerates the images in this README
```

The app targets WCAG 2.2 AA; see [docs/accessibility.md](docs/accessibility.md) for what is
covered, what was fixed and what is still missing.

## Reporting something

Bugs and ideas go in the [issues](../../issues). For help with HikaShop itself, the
[HikaShop forum](https://www.hikashop.com/forum.html) will get you a faster answer.

## Privacy

The app holds your shop's address and a key per shop, on the device. The key is kept in the
platform's secure storage on Android. Nothing is sent anywhere except to your own site, and
there is no analytics of any kind in the app.

## Licence

GPL-3.0-or-later, the same licence as HikaShop and as Joomla. See [LICENSE](LICENSE).
