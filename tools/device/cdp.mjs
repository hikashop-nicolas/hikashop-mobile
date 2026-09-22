// A small Chrome DevTools Protocol client, enough to drive the app inside the phone's WebView.
// Puppeteer would do this too, but it wants to manage a browser; here the browser is a WebView
// already running on a phone at the other end of an adb forward, so the protocol is used directly.

export async function attach(port = 9222, { onConsole } = {}) {
	const list = await (await fetch(`http://localhost:${port}/json/list`)).json();
	const page = list.find((p) => p.type === 'page' && p.webSocketDebuggerUrl) ?? list[0];
	if (!page) throw new Error('no debuggable page on the device; is the debug build running?');

	const ws = new WebSocket(page.webSocketDebuggerUrl);
	let seq = 0;
	const pending = new Map();
	const logs = [];

	ws.addEventListener('message', (e) => {
		const m = JSON.parse(e.data);
		if (m.id && pending.has(m.id)) {
			const { resolve, reject } = pending.get(m.id);
			pending.delete(m.id);
			if (m.error) reject(new Error(m.error.message));
			else resolve(m.result);
			return;
		}
		if (m.method === 'Log.entryAdded') {
			const entry = { level: m.params.entry.level, text: m.params.entry.text };
			logs.push(entry);
			onConsole?.(entry);
		}
		if (m.method === 'Runtime.consoleAPICalled') {
			const text = (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
			const entry = { level: m.params.type, text };
			logs.push(entry);
			onConsole?.(entry);
		}
	});

	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++seq;
			pending.set(id, { resolve, reject });
			ws.send(JSON.stringify({ id, method, params }));
			setTimeout(() => {
				if (pending.has(id)) { pending.delete(id); reject(new Error(`${method} timed out`)); }
			}, 30000);
		});

	await new Promise((resolve, reject) => {
		ws.addEventListener('open', resolve);
		ws.addEventListener('error', () => reject(new Error('could not open the devtools socket')));
	});
	await send('Runtime.enable');
	await send('Log.enable');
	await send('Page.enable');

	// Evaluate in the page and return the value. Anything thrown there is thrown here.
	const evaluate = async (expression) => {
		const r = await send('Runtime.evaluate', {
			expression: `(async () => { ${expression} })()`,
			awaitPromise: true,
			returnByValue: true,
		});
		if (r.exceptionDetails) {
			throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
		}
		return r.result?.value;
	};

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	// Wait until an expression returns something truthy, or give up with a readable message.
	const waitFor = async (expression, { timeout = 15000, label = expression } = {}) => {
		const until = Date.now() + timeout;
		let last;
		for (;;) {
			try {
				last = await evaluate(`return ${expression};`);
				if (last) return last;
			} catch (e) {
				last = e.message;
			}
			if (Date.now() > until) throw new Error(`timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
			await sleep(250);
		}
	};

	const count = (sel) => evaluate(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`);
	const text = (sel) => evaluate(`return document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null;`);

	// React listens for input events, so setting .value alone is not enough: set it through the
	// native setter and dispatch, which is what a real keystroke ends up doing.
	const fill = (sel, value) => evaluate(`
		const el = document.querySelector(${JSON.stringify(sel)});
		if (!el) throw new Error('no element for ' + ${JSON.stringify(sel)});
		const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	`);

	const click = (sel, { nth = 0 } = {}) => evaluate(`
		const els = document.querySelectorAll(${JSON.stringify(sel)});
		const el = els[${nth}];
		if (!el) throw new Error('no element ' + ${JSON.stringify(sel)} + ' at index ' + ${nth});
		el.scrollIntoView({ block: 'center' });
		el.click();
		return true;
	`);

	// Click whichever element of a kind carries a given text, which is how a person finds a button.
	const clickText = (sel, needle) => evaluate(`
		const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
			.find((e) => (e.textContent || '').toLowerCase().includes(${JSON.stringify(needle.toLowerCase())}));
		if (!el) throw new Error('no ' + ${JSON.stringify(sel)} + ' containing ' + ${JSON.stringify(needle)});
		el.scrollIntoView({ block: 'center' });
		el.click();
		return true;
	`);

	const go = async (hash) => {
		await evaluate(`location.hash = ${JSON.stringify(hash)}; return true;`);
		await sleep(300);
		// Screens slide in and out; until they settle the old screen's elements are still there to
		// be found and clicked. Endless ones (a loading spinner) never settle, so they are ignored.
		await waitFor(`document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity)`,
			{ timeout: 5000, label: 'the screen transition to end' }).catch(() => {});
		await sleep(150);
	};

	const route = () => evaluate('return location.hash;');

	const screenshot = async (file) => {
		const r = await send('Page.captureScreenshot', { format: 'png' });
		const { writeFile } = await import('node:fs/promises');
		await writeFile(file, Buffer.from(r.data, 'base64'));
		return file;
	};

	return { send, evaluate, waitFor, count, text, fill, click, clickText, go, route, screenshot, sleep, logs, close: () => ws.close(), pageUrl: page.url };
}
