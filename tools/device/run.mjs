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
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
	// The app remembers a search per shop, so leaving it set would empty every later list.
	await p.fill('[data-hk-search] input, input[data-hk-search], .hk-search input', '');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'the list to come back' });
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

// ---- actions that change something, each putting the shop back as it found it ----

// The record being edited, whichever side of the split breakpoint the screen is on. A comma
// separates whole selectors, so each part has to carry the suffix itself.
const rec = (suffix = '') => `.hk-detail-over ${suffix}, .hk-split-detail ${suffix}`.replace(/\s+,/, ',');

check('a product can be renamed, and the list follows', async (p) => {
	await p.go('/products');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'products' });
	const original = await p.text('.hk-row .hk-row-title');
	const suffix = ` Z${Date.now() % 1000}`;

	await p.click('.hk-row .hk-rowmain, .hk-row a');
	await p.waitFor(`!!document.querySelector("${rec('input.hk-input')}")`, { label: 'the product form' });
	await p.fill(rec('input.hk-input'), original + suffix);
	await p.clickText('button', 'save');
	await p.waitFor(`[...document.querySelectorAll('.hk-row-title')].some((e) => e.textContent.includes(${JSON.stringify(suffix.trim())}))`,
		{ timeout: 20000, label: 'the renamed product in the list' });

	// Put the catalogue back, so a reused shop does not drift with every run.
	await p.evaluate(`
		const row = [...document.querySelectorAll('.hk-row')].find((r) => r.textContent.includes(${JSON.stringify(suffix.trim())}));
		row.querySelector('.hk-rowmain, a').click();
		return true;
	`);
	await p.waitFor(`!!document.querySelector("${rec('input.hk-input')}")`, { label: 'the product form again' });
	await p.fill(rec('input.hk-input'), original);
	await p.clickText('button', 'save');
	await p.waitFor(`![...document.querySelectorAll('.hk-row-title')].some((e) => e.textContent.includes(${JSON.stringify(suffix.trim())}))`,
		{ timeout: 20000, label: 'the original name back' });
});

check("an order's status can be changed, and changed back", async (p) => {
	await p.go('/orders');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'orders' });
	await p.click('.hk-row .hk-rowmain, .hk-row a');
	await p.waitFor(`!!document.querySelector('select.hk-select')`, { timeout: 20000, label: 'the status dropdown' });

	const pick = (value) => p.evaluate(`
		const sel = document.querySelector('select.hk-select');
		Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(value)});
		sel.dispatchEvent(new Event('change', { bubbles: true }));
		return ${JSON.stringify(value)};
	`);

	const before = await p.evaluate(`return document.querySelector('select.hk-select').value;`);
	const options = await p.evaluate(`return [...document.querySelector('select.hk-select').options].map((o) => o.value).filter(Boolean);`);
	const after = options.find((o) => o !== before);
	if (!after) throw new Error(`only one status offered: ${options.join(', ')}`);
	await pick(after);
	await p.waitFor(`document.querySelector('select.hk-select')?.value === ${JSON.stringify(after)}`,
		{ timeout: 20000, label: `the status to become ${after}` });

	await pick(before);
	await p.waitFor(`document.querySelector('select.hk-select')?.value === ${JSON.stringify(before)}`,
		{ timeout: 20000, label: 'the status to go back' });
});

check('a coupon can be created and deleted', async (p) => {
	const code = `DEV${Date.now() % 100000}`;
	await p.go('/discounts');
	await p.waitFor(`!!document.querySelector('.hk-title')`, { label: 'the discounts screen' });
	await p.clickText('button', 'new');
	await p.waitFor(`location.hash.includes('/discounts/new')`, { label: 'the new discount form' });
	// The form slides in, and the button that commits it sits in the app bar above; clicking
	// before the transition ends hits a bar that is still off screen. A new record says Create,
	// an existing one says Save.
	await p.waitFor(`[...document.querySelectorAll('button')].some((b) => /save|create/i.test(b.textContent || ''))`,
		{ timeout: 20000, label: 'the button that commits the form' });
	await p.fill(rec('input'), code);
	await p.clickText('.hk-seg', 'percentage').catch(() => {});
	await p.evaluate(`
		const n = document.querySelector('.hk-detail-over input[type=number], .hk-split-detail input[type=number]');
		if (n) {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(n, '12');
			n.dispatchEvent(new Event('input', { bubbles: true }));
		}
		return true;
	`);
	await p.clickText('button', 'save');
	await p.waitFor(`document.body.textContent.includes(${JSON.stringify(code)})`, { timeout: 20000, label: 'the coupon in the list' });

	await p.evaluate(`
		const row = [...document.querySelectorAll('.hk-row')].find((r) => r.textContent.includes(${JSON.stringify(code)}));
		if (!row) throw new Error('the coupon left the list');
		(row.querySelector('.hk-rowmain, a') ?? row).click();
		return true;
	`);
	await p.waitFor(`/\\/discounts\\/\\d+/.test(location.hash)`, { label: 'the coupon to open' });
	await p.waitFor(`[...document.querySelectorAll('button')].some((b) => /delete/i.test(b.textContent || ''))`,
		{ timeout: 20000, label: 'the delete button' });
	await p.clickText('button', 'delete');
	await p.sleep(400);
	// Deleting asks first, and the confirmation is a second button saying just that.
	await p.evaluate(`
		const el = [...document.querySelectorAll('button')].reverse()
			.find((b) => /^\\s*delete\\s*$/i.test(b.textContent || ''));
		if (el) el.click();
		return true;
	`);
	await p.waitFor(`!document.body.textContent.includes(${JSON.stringify(code)})`, { timeout: 20000, label: 'the coupon to disappear' });
});

check('a category can be created and deleted', async (p) => {
	const name = `Dev ${Date.now() % 100000}`;
	await p.go('/categories');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 20000, label: 'categories' });
	await p.clickText('button', 'new');
	await p.waitFor(`location.hash.includes('/categories/new')`, { label: 'the new category form' });
	// The form slides in, and the button that commits it sits in the app bar above; clicking
	// before the transition ends hits a bar that is still off screen. A new record says Create,
	// an existing one says Save.
	await p.waitFor(`[...document.querySelectorAll('button')].some((b) => /save|create/i.test(b.textContent || ''))`,
		{ timeout: 20000, label: 'the button that commits the form' });
	await p.fill(rec('input.hk-input'), name);
	await p.evaluate(`
		const el = [...document.querySelectorAll('button')].find((b) => /save|create/i.test(b.textContent || ''));
		if (!el) throw new Error('nothing to commit the form with');
		el.click();
		return true;
	`);
	await p.waitFor(`document.body.textContent.includes(${JSON.stringify(name)})`, { timeout: 20000, label: 'the category in the list' });

	await p.evaluate(`
		const row = [...document.querySelectorAll('.hk-row')].find((r) => r.textContent.includes(${JSON.stringify(name)}));
		if (!row) throw new Error('the category left the list');
		(row.querySelector('.hk-row-btn, .hk-rowmain, a, button') ?? row).click();
		return true;
	`);
	await p.waitFor(`/\\/categories\\/\\d+/.test(location.hash)`, { timeout: 20000, label: 'the category to open' });
	await p.waitFor(`[...document.querySelectorAll('button')].some((b) => /delete/i.test(b.textContent || ''))`,
		{ timeout: 20000, label: 'the delete button' });
	await p.clickText('button', 'delete');
	await p.sleep(400);
	await p.evaluate(`
		const el = [...document.querySelectorAll('button')].reverse()
			.find((b) => /^\\s*delete\\s*$/i.test(b.textContent || ''));
		if (el) el.click();
		return true;
	`);
	await p.waitFor(`!document.body.textContent.includes(${JSON.stringify(name)})`, { timeout: 20000, label: 'the category to disappear' });
});

check('the interface follows a change of language', async (p) => {
	await p.go('/dashboard');
	const labels = `[...document.querySelectorAll('.hk-stat')].map((e) => e.textContent.trim()).join(' | ') || null`;
	const english = await p.waitFor(labels, { timeout: 25000, label: 'the dashboard tiles' });
	await p.evaluate(`localStorage.setItem('hk.locale', 'fr'); location.reload(); return true;`);
	await p.sleep(3000);
	const french = await p.waitFor(labels, { timeout: 25000, label: 'the dashboard tiles in French' });
	if (french === english) throw new Error(`the tiles did not change with the language (still "${english}")`);
	await p.evaluate(`localStorage.setItem('hk.locale', 'en'); location.reload(); return true;`);
	await p.sleep(3000);
});

// Only a real device can be sent away and brought back, which is where a token kept in the
// keystore either survives or does not.
check('the shop is still paired after the app is closed and reopened', async (p, ctx) => {
	await ctx.restart();
	await p.waitFor(`!location.hash.includes('/connect')`, { timeout: 30000, label: 'the app to come back paired' });
	await p.go('/dashboard');
	await p.waitFor(`document.querySelectorAll('.hk-stat').length >= 3`, { timeout: 25000, label: 'the dashboard after the restart' });
});

check('a shop it cannot reach is reported, not left blank', async (p, ctx) => {
	await ctx.tunnel(false);
	await p.evaluate(`location.reload(); return true;`);
	await p.sleep(3000);
	await p.go('/orders');
	await p.waitFor(
		`(document.body.textContent || '').length > 40 && !!document.querySelector('.hk-error-note, .hk-empty, .hk-banner, .hk-toast, .hk-row')`,
		{ timeout: 25000, label: 'something on screen rather than nothing' });
	await ctx.tunnel(true);
	await p.evaluate(`location.reload(); return true;`);
	await p.sleep(3000);
	await p.go('/orders');
	await p.waitFor(`document.querySelectorAll('.hk-row').length > 0`, { timeout: 25000, label: 'the orders to come back' });
});

check('nothing was logged as an error', async (p) => {
	const bad = p.logs.filter((l) => l.level === 'error'
		&& !/favicon|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch/i.test(l.text));
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
	let page = await attach(9222);
	say(`  attached to ${page.pageUrl}`);

	await mkdir(SHOTS, { recursive: true });
	const ctx = {
		code,
		storeUrl: `http://localhost:8080/${SITE}`,
		// Close and reopen the app, then attach to the WebView it comes back with.
		async restart() {
			await adb('shell', 'am', 'force-stop', APP_ID);
			await new Promise((r) => setTimeout(r, 1500));
			await adb('shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`);
			await new Promise((r) => setTimeout(r, 6000));
			const sock = (await adb('shell', 'cat', '/proc/net/unix')).match(/webview_devtools_remote_\d+/)?.[0];
			await adb('forward', '--remove-all').catch(() => {});
			await adb('forward', 'tcp:9222', `localabstract:${sock}`);
			const fresh = await attach(9222);
			Object.assign(page, fresh);
		},
		// Open or close the cable the shop arrives through.
		async tunnel(on) {
			if (on) await adb('reverse', 'tcp:8080', 'tcp:8080');
			else await adb('reverse', '--remove', 'tcp:8080').catch(() => {});
		},
	};
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
