# Device tests

Runs the app on a phone plugged into this machine, against a shop hatched for the run, and
walks its screens. What the Cypress suite proves in a browser, this proves on the thing
merchants actually hold: the real WebView, the real Android build, the real keystore-backed
storage.

```sh
npm run test:device                 # build, install, hatch a shop, pair, check, clean up
npm run test:device -- --skip-build # use the debug build already on the phone
npm run test:device -- --keep       # leave the shop and the pairing behind to poke at
npm run test:device -- --site foo   # reuse (or create) a shop under that name
```

## How the phone reaches the shop

The phone is not on the same network as this machine, and it does not need to be.
`adb reverse tcp:8080 tcp:8080` makes the phone's *own* localhost:8080 come out of the USB
cable and arrive here, so the app talks to `http://localhost:8080/<site>` and the shop
answers. Nothing is exposed to the network in the process.

Two things make that work in the debug build only:

- `android/app/src/debug/` carries a network security config permitting cleartext to
  localhost, and the manifest entry pointing at it. Release builds never see that source set.
- The runner patches the copy of `capacitor.config.json` that goes into the APK, adding
  `cleartext` and the `http` scheme, after `cap sync` and before `assembleDebug`. Serving the
  app itself from `http://localhost` is what keeps the shop from being a mixed-content
  request; the release build stays on `https`.

## How it drives the app

The debug build exposes its WebView on a devtools socket. The runner forwards it
(`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) and speaks the DevTools
protocol directly, in `cdp.mjs`, which is enough to evaluate, fill, click, wait and take a
screenshot. A failing check leaves a screenshot in `tools/device/screenshots/`.

## Pairing

A pairing code is normally minted by hand in System > App Devices. The runner writes the same
row into the shop's database and types the code into the connect screen, so the pairing screen
itself is exercised rather than bypassed by seeding a token.

## What it needs

`adb` with one phone attached and USB debugging accepted, Java and the Android SDK for the
build, `mysql -uroot` over the local socket, and the HikaShop repository next door for
`tools/hatch/hatch.sh` (override with `HIKASHOP_REPO`).
