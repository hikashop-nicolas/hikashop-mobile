#!/usr/bin/env node
// Drive the app on a real phone, against a shop hatched for the occasion.
//
//   node tools/device/run.mjs                 build, install, hatch a shop, pair, test, clean up
//   node tools/device/run.mjs --keep          leave the shop and the pairing in place
//   node tools/device/run.mjs --site mysite   reuse a shop already hatched under that name
//   node tools/device/run.mjs --skip-build    use the debug build already on the phone
//
// The phone does not need to be on the same network as the shop: `adb reverse` tunnels the
// phone's own localhost:8080 back to this machine over the USB cable, so the app talks to
// http://localhost:8080/<site> as if the shop were running on the phone itself.
//
// Cleartext and the http scheme are turned on for the debug build only, in the copy of
// capacitor.config.json that goes into the APK, so nothing here can reach a release build.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { attach } from './cdp.mjs';

const exec = promisify(execFile);
const REPO = path.resolve(import.meta.dirname, '../..');
const HIKASHOP = process.env.HIKASHOP_REPO ?? path.join(homedir(), 'dev/hikashop');
const ADB = process.env.ADB ?? path.join(homedir(), 'Library/Android/sdk/platform-tools/adb');
const JAVA_HOME = process.env.JAVA_HOME ?? '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const ANDROID_HOME = process.env.ANDROID_HOME ?? path.join(homedir(), 'Library/Android/sdk');
const APP_ID = 'com.hikashop.app';
const SHOTS = path.join(REPO, 'tools/device/screenshots');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SITE = opt('--site', 'apptest');
const KEEP = flag('--keep');
const SKIP_BUILD = flag('--skip-build');
const REUSE_SITE = args.includes('--site');

const say = (s) => console.log(s);
const step = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const run = async (cmd, cmdArgs, opts = {}) => {
	const { stdout } = await exec(cmd, cmdArgs, { maxBuffer: 64 * 1024 * 1024, ...opts });
	return stdout.trim();
};
const adb = (...a) => run(ADB, a);

// ---------------------------------------------------------------- the phone

async function onePhone() {
	const out = await adb('devices');
	const devices = out.split('\n').slice(1).filter((l) => l.trim() && !l.includes('offline'));
	if (devices.length === 0) throw new Error('no phone connected (adb devices is empty)');
	if (devices.length > 1) throw new Error(`more than one device attached:\n${out}`);
	if (devices[0].includes('unauthorized')) throw new Error('the phone has not accepted this computer for debugging');
	return devices[0].split(/\s+/)[0];
}

// ---------------------------------------------------------------- the build

async function buildAndInstall() {
	step('Building the app and installing the debug build');
	await run('npm', ['run', 'build'], { cwd: REPO });
	await run('npx', ['cap', 'sync', 'android'], { cwd: REPO });

	// cap sync rewrites this from capacitor.config.ts, so the test-only server settings are
	// added afterwards, on the copy that goes into the APK and nowhere else.
	const assets = path.join(REPO, 'android/app/src/main/assets/capacitor.config.json');
	const config = JSON.parse(await readFile(assets, 'utf8'));
	config.server = { ...(config.server ?? {}), cleartext: true, androidScheme: 'http' };
	await writeFile(assets, JSON.stringify(config, null, 2));
	say('  capacitor.config.json patched for the test build (cleartext, http scheme)');

	await run('./gradlew', ['assembleDebug', '-q', '--no-daemon'], {
		cwd: path.join(REPO, 'android'),
		env: { ...process.env, JAVA_HOME, ANDROID_HOME },
	});
	const apk = path.join(REPO, 'android/app/build/outputs/apk/debug/app-debug.apk');
	if (!existsSync(apk)) throw new Error('the debug APK was not produced');
	await adb('install', '-r', apk);
	say('  installed');
}

// ---------------------------------------------------------------- the shop

async function hatchSite() {
	step(`Hatching the shop "${SITE}"`);
	const hatch = path.join(HIKASHOP, 'tools/hatch/hatch.sh');
	if (!existsSync(hatch)) throw new Error(`hatch.sh not found at ${hatch}; set HIKASHOP_REPO`);
	if (REUSE_SITE) {
		const list = await run(hatch, ['list']);
		if (list.includes(SITE)) { say('  reusing the one already there'); return; }
	}
	await run(hatch, ['new', 'joomla', 'latest', '--name', SITE], { cwd: HIKASHOP });
	say('  hatched, with HikaShop installed and its demo content');
}

// A pairing code is normally minted by a person in System > App Devices. The suite writes the
// same row itself, which is what that screen does, so no browser is needed on this side.
async function mintPairingCode() {
	step('Minting a pairing code on the shop');
	const code = randomBytes(4).toString('hex').toUpperCase();
	const hash = createHash('sha256').update(code).digest('hex');
	const now = Math.floor(Date.now() / 1000);
	const prefix = await run('mysql', ['-uroot', '-N', '-B', '-e',
		`SELECT SUBSTRING_INDEX(TABLE_NAME, 'hikashop_api_pairing', 1) FROM information_schema.tables
		 WHERE TABLE_SCHEMA = '${SITE}' AND TABLE_NAME LIKE '%hikashop_api_pairing' LIMIT 1`]);
	if (!prefix) throw new Error(`no connector table in the ${SITE} database; is HikaShop Business installed?`);
	const admin = await run('mysql', ['-uroot', '-N', '-B', '-e',
		`SELECT id FROM ${SITE}.${prefix}users ORDER BY id LIMIT 1`]);
	await run('mysql', ['-uroot', '-e',
		`INSERT INTO ${SITE}.${prefix}hikashop_api_pairing
		 (pairing_code_hash, pairing_scopes, pairing_user_id, pairing_created, pairing_expires, pairing_used, pairing_attempts, pairing_created_by)
		 VALUES ('${hash}', 'read,write', ${admin}, ${now}, ${now + 900}, 0, 0, ${admin})`]);
	say(`  code ${code}, valid for fifteen minutes, scopes read and write`);
	return code;
}

// ---------------------------------------------------------------- the checks

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('the app opens on the connect screen', async (p) => {
	// Pin the language, so a check can look for a word and the phone's own locale does not
	// decide whether the suite passes.
	await p.evaluate(`localStorage.setItem('hk.locale', 'en'); return true;`);
	await p.evaluate(`location.reload(); return true;`).catch(() => {});
	await p.sleep(2500);
	await p.waitFor(`document.querySelectorAll('input.hk-input').length >= 2`, { label: 'the connect form' });
});

check('it pairs with the shop', async (p, ctx) => {
	await p.evaluate(`
		const inputs = document.querySelectorAll('input.hk-input');
		const set = (el, v) => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		};
		set(inputs[0], ${JSON.stringify(ctx.storeUrl)});
		set(inputs[1], ${JSON.stringify(ctx.code)});
		return true;
	`);
	// The pairing button is the last one on the screen, which holds whatever the app's language
	// calls it; matching on its text would only test the translation of the day.
	await p.evaluate(`
		const buttons = [...document.querySelectorAll('button')].filter((b) => !b.disabled);
		const el = buttons[buttons.length - 1];
		if (!el) throw new Error('no button to pair with');
		el.click();
		return true;
	`);
	await p.waitFor(`!location.hash.includes('/connect') || !!document.querySelector('.hk-error-note')`, { timeout: 30000, label: 'the pairing to answer' });
	const err = await p.text('.hk-error-note');
	if (err) throw new Error(`the app refused the pairing: ${err}`);
});

check('the dashboard shows its figures and its chart', async (p) => {
	await p.go('/dashboard');
	await p.waitFor(`document.querySelectorAll('.hk-stat').length >= 3`, { label: 'the dashboard tiles' });
	await p.waitFor(`!!document.querySelector('.hk-stat .hk-money')`, { label: 'money on a tile' });
	await p.waitFor(`!!document.querySelector('.hk-chart-svg')`, { timeout: 20000, label: 'the revenue chart' });
});

check('the orders list fills and an order opens', async (p, ctx) => {
	await p.go('/orders');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'orders' });
	ctx.orders = await p.count('.hk-row');
	await p.click('.hk-row .hk-rowmain, .hk-row a');
	await p.waitFor(`/\\/orders\\/\\d+/.test(location.hash)`, { label: 'an order to open' });
	await p.waitFor(`!!document.querySelector('.hk-detail-over, .hk-split-detail')`, { label: 'the order detail' });
});

check('the products list fills and a product opens', async (p, ctx) => {
	await p.go('/products');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'products' });
	ctx.products = await p.count('.hk-row');
	await p.click('.hk-row .hk-rowmain, .hk-row a');
	await p.waitFor(`/\\/products\\/\\d+/.test(location.hash)`, { label: 'a product to open' });
	await p.waitFor(`!!document.querySelector('.hk-detail-over input.hk-input, .hk-split-detail input.hk-input')`, { label: 'the product form' });
});

check('a product search narrows the list', async (p) => {
	await p.go('/products');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'products' });
	const before = await p.count('.hk-row');
	await p.fill('[data-hk-search] input, input[data-hk-search], .hk-search input', 'zzzzzz');
	await p.sleep(1500);
	const after = await p.count('.hk-row');
	if (after >= before) throw new Error(`search did not narrow anything (${before} then ${after})`);
});

check('the categories screen lists something', async (p) => {
	await p.go('/categories');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'categories' });
});

check('the customers screen lists something', async (p) => {
	await p.go('/customers');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'customers' });
});

check('the discounts screen renders', async (p) => {
	await p.go('/discounts');
	await p.waitFor(`!!document.querySelector('.hk-split-list, .hk-listfoot, .hk-empty, .hk-row')`, { label: 'the discounts screen' });
});

check('the stores screen shows the paired shop', async (p) => {
	await p.go('/stores');
	await p.waitFor(`document.body.textContent.includes('${SITE}') || document.querySelectorAll('.hk-row').length > 0`, { label: 'the shop in the list' });
});

check('the notifications screen renders', async (p) => {
	await p.go('/notifications');
	await p.waitFor(`!!document.querySelector('.hk-page, .hk-split-list, .hk-row, .hk-empty')`, { label: 'the notifications screen' });
});

check('nothing was logged as an error', async (p) => {
	const bad = p.logs.filter((l) => l.level === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED/i.test(l.text));
	if (bad.length) throw new Error(`${bad.length} console error(s), first: ${bad[0].text.slice(0, 200)}`);
});

// ---------------------------------------------------------------- the run

async function main() {
	const started = Date.now();
	const serial = await onePhone();
	say(`Phone: ${serial}`);

	if (!SKIP_BUILD) await buildAndInstall();
	await hatchSite();
	const code = await mintPairingCode();

	step('Tunnelling the shop to the phone');
	await adb('reverse', 'tcp:8080', 'tcp:8080');
	say('  phone localhost:8080 now reaches this machine');

	step('Starting the app');
	await adb('shell', 'pm', 'clear', APP_ID);
	await adb('shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`);
	await new Promise((r) => setTimeout(r, 6000));
	const socket = (await adb('shell', 'cat', '/proc/net/unix')).match(/webview_devtools_remote_\d+/)?.[0];
	if (!socket) throw new Error('the app is not exposing a debuggable WebView; is this the debug build?');
	await adb('forward', '--remove-all').catch(() => {});
	await adb('forward', 'tcp:9222', `localabstract:${socket}`);
	const page = await attach(9222);
	say(`  attached to ${page.pageUrl}`);

	await mkdir(SHOTS, { recursive: true });
	const ctx = { code, storeUrl: `http://localhost:8080/${SITE}` };
	const results = [];

	step('Checks');
	for (const c of checks) {
		const t0 = Date.now();
		try {
			await c.fn(page, ctx);
			results.push({ name: c.name, ok: true, ms: Date.now() - t0 });
			say(`  \x1b[32mok\x1b[0m   ${c.name}`);
		} catch (e) {
			const shot = path.join(SHOTS, c.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png');
			await page.screenshot(shot).catch(() => {});
			results.push({ name: c.name, ok: false, ms: Date.now() - t0, error: e.message, shot });
			say(`  \x1b[31mfail\x1b[0m ${c.name}\n       ${e.message}\n       ${shot}`);
		}
	}

	page.close();
	if (!KEEP) {
		step('Cleaning up');
		await adb('reverse', '--remove', 'tcp:8080').catch(() => {});
		if (!REUSE_SITE) {
			await run(path.join(HIKASHOP, 'tools/hatch/hatch.sh'), ['remove', '-y', SITE]).catch(() => {});
			say('  shop removed');
		}
	}

	const failed = results.filter((r) => !r.ok);
	say(`\n${'-'.repeat(64)}`);
	say(`${results.length} checks, ${results.length - failed.length} passed, ${failed.length} failed, ${Math.round((Date.now() - started) / 1000)}s`);
	process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
	console.error(`\n\x1b[31m${e.message}\x1b[0m`);
	process.exit(1);
});
