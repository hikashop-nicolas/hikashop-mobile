# Play Console listing

Everything the Play Console asks for, written down so it is reviewed here rather than typed
from memory into a form. Nothing secret belongs in this file.

## Identity

| Field | Value |
| --- | --- |
| Package name | `com.hikashop.app` (set once at creation, never changeable) |
| App name | HikaShop |
| Default language | English (United Kingdom) |
| Type | App, free |
| Category | Business |
| Tags | Business tools, Productivity |
| Contact email | the address of the Hikari Software Play account |
| Website | https://www.hikashop.com |
| Privacy policy | https://hikashop-nicolas.github.io/hikashop-mobile/privacy.html |

Signing: upload key is `~/.keys/hikashop-release.keystore`, alias `hikashop`, SHA-256
`4611eb4a7ac0a780c50abdbfbd2310e36e8379022683175b5e1333c327914df7`. Turn Play App Signing on, so
Google holds the app signing key and this one stays the upload key, which support can reset.

## Short description (80 characters max)

> Follow your sales and run your HikaShop shop from your phone, tablet or browser.

## Full description (4000 characters max)

> Run your HikaShop shop from a phone, a tablet or a browser. Follow your sales, deal with your
> orders and keep your catalogue up to date without opening the Joomla or WordPress backend.
>
> The app talks to your own shop directly. There is no account to create, no service in the middle,
> and nothing about your shop is kept anywhere except on your server and on your device.
>
> WHAT IT DOES
>
> • Orders: read, search and filter them, change the status, edit the addresses, the products and
> the shipping and payment fees, or write an order by hand for a customer on the phone.
> • Products: full editing, with images, prices, variants, characteristics, related products, files
> and your own custom fields. Crop, zoom and rotate an image before attaching it.
> • Categories, customers, discounts and coupons.
> • Translations of what you sell, on a multilingual shop, without leaving the app.
> • A dashboard of revenue, orders, average basket and customers, by day, week, month or year, with
> your best sellers.
> • Notifications when an order arrives or a product runs low.
> • Barcodes, read with the camera or with a barcode reader.
> • Your own mass actions, exactly as they are configured in your backend.
> • Several shops, switched from the menu, each keeping its own key, its own currency and its own
> filters.
>
> IN YOUR OWN LANGUAGE
>
> The app is offered in every language HikaShop is translated into, fifty-eight of them counting the
> regional variants, and it starts in the one your device is set to. What your shop calls things,
> your order statuses and the labels of your custom fields, is read from your shop, so it reads as
> it does in your backend.
>
> WHAT YOU NEED
>
> • HikaShop Business 6.6.0 or newer, on Joomla or on WordPress. The app talks to a plugin that
> ships inside the Business package, so Essential and Starter shops do not answer it.
> • HTTPS on your shop.
>
> CONNECTING IT
>
> In your shop's backend, open System > App Devices and add a device. A QR code appears, it lasts a
> few minutes and works once. Scan it with the app. Your password is never typed into the app: the
> app is given a key of its own, listed in the backend with the date it was last used, and revocable
> on its own the day a phone is lost or somebody leaves.
>
> YOUR DATA
>
> The app keeps your shop's address and one key per shop, on the device, in the phone's secure
> storage. Nothing is sent anywhere except to your own shop. No analytics of any kind, no account,
> nobody in the middle.
>
> The app is free and open source, GPL-3.0-or-later, the same licence as HikaShop and as Joomla:
> github.com/hikashop-nicolas/hikashop-mobile

## Graphics

| Asset | File | Size |
| --- | --- | --- |
| App icon | `docs/play/store-icon-512.png` | 512 x 512 |
| Feature graphic | `docs/play/feature-graphic.png` | 1024 x 500 |
| Phone screenshots | `docs/screenshots/04-phone-products.png`, `05-phone-order.png`, `06-phone-stores.png` | 780 x 1440 |
| Tablet screenshots | `docs/screenshots/01-dashboard.png`, `02-orders.png`, `03-product.png` | 2560 x 1440 |

Regenerate the two Play images with:

```sh
rsvg-convert -w 1024 -h 500 tools/play/feature-graphic.svg -o docs/play/feature-graphic.png
rsvg-convert -w 512 -h 512 public/icon.svg -o docs/play/store-icon-512.png
```

## App access

The app is a client for a shop, so a reviewer cannot see anything past the first screen without
one. Declare **All or some functionality is restricted** and give a demo shop:

> The app manages an existing HikaShop shop (a Joomla or WordPress e-commerce site). It shows
> nothing until it is paired with one.
>
> A demo shop is available at <URL>. To pair:
> 1. Open <URL>/administrator and log in with the account below.
> 2. Go to Components > HikaShop > System > App Devices, and press New.
> 3. A QR code and a short code appear. In the app, press Add a shop, then Scan, or type the code.
> The code lasts five minutes and works once; generate another if it expires.
>
> Username: <demo account>
> Password: <demo password>

That demo shop still has to be set up, with its own account, and it has to stay up while the app
is listed. Put the credentials into the Play form only, never in this repository.

## Data safety

- Does the app collect or share any of the required data types? **No.**
- Is all data encrypted in transit? **Yes**, the app requires HTTPS to the merchant's shop.
- Do you provide a way to delete data? **Yes**, uninstalling removes everything held on the device,
  and the merchant can revoke the device from the shop's backend.

Data handled on the device only, and never sent to us, does not count as collection under Play's
definition, which is what makes every answer above a no. The shop address and the per-shop key stay
on the device; requests carrying them go to the merchant's own server.

## Content rating questionnaire

Category: **Utility, productivity, communication or other**. Everything else answers no: no
violence, no sexuality, no profanity, no drugs, no gambling, no user-to-user communication, no
sharing of location, no purchases inside the app. Expected outcome: rated for everyone (PEGI 3 /
IARC 3+).

## Other declarations

| Question | Answer |
| --- | --- |
| Ads | No ads |
| In-app purchases | None |
| Target audience | 18 and over (a tool for merchants) |
| Designed for families | No |
| News app | No |
| Government app | No |
| Financial features | None. The app does not take payments; it reads and edits orders on the merchant's own shop |
| Health, COVID | No |
| Data deletion URL | Not needed, deletion is by uninstalling and by revoking the device |

## Release

- Track: **open testing** first, per the plan, then production.
- The artifact is the `play-aab` produced by the CI workflow on every push to `main`. Download it
  from the run's artifacts.
- `versionCode` is the GitHub Actions run number, so it rises on its own and is never reused.
  `versionName` is `1.0` in `android/app/build.gradle`, and is what merchants see; set it by hand
  for a release worth a number.
- The APK published on the `android-latest` release is the same build, for sideloading. Play takes
  the AAB.

## Countries and pricing

Free, all countries, no restriction. There is nothing region specific in the app: it follows the
currency, the language and the tax rules of the shop it is connected to.
