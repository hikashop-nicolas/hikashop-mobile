// Keyboard shortcuts.
//
// Two rules shape the plain ones. They never fire while you are typing, because a shop's
// product names contain every letter they use. And they are single keys or one leading key,
// because most modifier combinations are already taken: Cmd+N, Cmd+T and Cmd+W never reach a
// page at all, and the ones that do (Cmd+P, Cmd+F, Cmd+S, Cmd+D) are ones a merchant uses,
// printing an invoice being the obvious one. Option+letter is worse still, since on macOS it
// types accented characters, inside the very fields where it would need to work.
//
// The cost of that is real: with a plain key you cannot jump anywhere while the caret is in the
// search box. So there is one modifier shortcut, Cmd/Ctrl+K, which works from anywhere
// including a field, and opens a palette that can run any of the others. It is the one
// combination the browser leaves alone and that people already reach for.
//
// Discoverable through "?" as well, which is the other convention people expect.

export type Shortcut = {
	/** The key, or "g p" for a two-key sequence. */
	keys: string;
	/** Translation key for what it does. */
	label: string;
	group: 'go' | 'act' | 'help';
	run: (ctx: ShortcutContext) => void;
};

export type ShortcutContext = {
	navigate: (to: string) => void;
	/** Focus the search box of the current listing, if it has one. */
	focusSearch: () => void;
	/** Trigger the current screen's "new" action, if it has one. */
	createNew: () => void;
	/** Close whatever is open: a record, a modal. */
	close: () => void;
	toggleHelp: () => void;
};

// Where a key press means text, not a command.
export function isTyping(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el || !el.tagName) return false;
	const tag = el.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	return el.isContentEditable === true;
}

export const SHORTCUTS: Shortcut[] = [
	{ keys: 'g d', label: 'shortcut.goDashboard', group: 'go', run: (c) => c.navigate('/dashboard') },
	{ keys: 'g o', label: 'shortcut.goOrders', group: 'go', run: (c) => c.navigate('/orders') },
	{ keys: 'g p', label: 'shortcut.goProducts', group: 'go', run: (c) => c.navigate('/products') },
	{ keys: 'g c', label: 'shortcut.goCategories', group: 'go', run: (c) => c.navigate('/categories') },
	{ keys: 'g u', label: 'shortcut.goCustomers', group: 'go', run: (c) => c.navigate('/customers') },
	{ keys: 'g r', label: 'shortcut.goDiscounts', group: 'go', run: (c) => c.navigate('/discounts') },
	{ keys: 'g s', label: 'shortcut.goStores', group: 'go', run: (c) => c.navigate('/stores') },

	{ keys: '/', label: 'shortcut.search', group: 'act', run: (c) => c.focusSearch() },
	{ keys: 'n', label: 'shortcut.new', group: 'act', run: (c) => c.createNew() },
	{ keys: 'Escape', label: 'shortcut.close', group: 'act', run: (c) => c.close() },

	{ keys: '?', label: 'shortcut.help', group: 'help', run: (c) => c.toggleHelp() },
	{ keys: 'Cmd K', label: 'shortcut.palette', group: 'help', run: (c) => c.toggleHelp() },
];

// A tiny state machine, so "g" then "p" is one shortcut and "p" on its own is not.
export class ShortcutMatcher {
	private pending = '';
	private at = 0;
	private timeoutMs: number;
	private now: () => number;

	/** timeoutMs is how long a leading key waits for its second. */
	constructor(timeoutMs = 1200, now: () => number = () => Date.now()) {
		this.timeoutMs = timeoutMs;
		this.now = now;
	}

	/** Returns the shortcut to run, or null. */
	press(key: string): Shortcut | null {
		if (this.pending && this.now() - this.at > this.timeoutMs) this.pending = '';

		const combined = this.pending ? `${this.pending} ${key}` : key;
		const exact = SHORTCUTS.find((s) => s.keys === combined);
		if (exact) { this.pending = ''; return exact; }

		// A key that begins a longer shortcut waits for the rest of it.
		if (!this.pending && SHORTCUTS.some((s) => s.keys.startsWith(`${key} `))) {
			this.pending = key;
			this.at = this.now();
			return null;
		}

		this.pending = '';
		return null;
	}

	get waiting(): string { return this.pending; }
}
