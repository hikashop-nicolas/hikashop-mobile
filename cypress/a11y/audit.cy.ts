// Accessibility audit. Runs axe-core over the app's screens, at a phone width and at a width
// where the split layout is in use, and writes one report.
//
// Not part of the e2e suite: `npm run a11y`. It needs the dev server and a paired shop, like the
// rest of the Cypress work.
//
// axe finds a minority of what WCAG asks for. What it cannot see (focus order, whether a
// keyboard can reach and operate everything, whether a label says something useful) is checked
// by hand and recorded in docs/accessibility.md.

type Violation = {
	id: string;
	impact: string;
	help: string;
	helpUrl: string;
	nodes: { html: string; target: string[] }[];
};

const findings: Record<string, Violation[]> = {};

// WCAG 2.2 A and AA, which is what a shop is normally asked for.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function audit(label: string) {
	cy.window({ log: false }).then((win) =>
		// @ts-expect-error injected below
		win.axe.run(win.document, { runOnly: { type: 'tag', values: TAGS } }).then((res) => {
			findings[label] = res.violations.map((v: Violation) => ({
				id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
				nodes: v.nodes.slice(0, 3).map((n) => ({ html: n.html.slice(0, 160), target: n.target })),
			}));
		}),
	);
}

function open(hash: string, label: string, width: number, height: number) {
	cy.viewport(width, height);
	cy.visitApp(hash);
	cy.get('.hk-appbar, .hk-body', { timeout: 20000 }).should('exist');
	cy.wait(700);
	cy.window({ log: false }).then((win) => {
		const s = win.document.createElement('script');
		s.textContent = axeSource;
		win.document.head.appendChild(s);
	});
	audit(label);
}

let axeSource = '';

describe('accessibility', () => {
	before(() => {
		cy.readFile('node_modules/axe-core/axe.min.js').then((src) => { axeSource = src; });
	});

	beforeEach(() => {
		cy.on('window:before:load', (win) => win.localStorage.setItem('hk.theme', 'light'));
	});

	const WIDE: [number, number] = [1280, 860];
	const NARROW: [number, number] = [390, 844];

	it('listings and detail screens, wide', () => {
		open('/dashboard', 'dashboard', ...WIDE);
		open('/orders', 'orders', ...WIDE);
		open('/products', 'products', ...WIDE);
		open('/categories', 'categories', ...WIDE);
		open('/customers', 'customers', ...WIDE);
		open('/discounts', 'discounts', ...WIDE);
		open('/stores', 'stores', ...WIDE);
	});

	it('a record open, wide', () => {
		open('/orders', 'orders (before opening)', ...WIDE);
		cy.get('.hk-row').first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.wait(700);
		audit('order detail');

		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.wait(700);
		cy.window({ log: false }).then((win) => {
			const s = win.document.createElement('script');
			s.textContent = axeSource;
			win.document.head.appendChild(s);
		});
		audit('product edit');
	});

	it('the same screens on a phone', () => {
		open('/dashboard', 'dashboard (phone)', ...NARROW);
		open('/orders', 'orders (phone)', ...NARROW);
		open('/products', 'products (phone)', ...NARROW);
		open('/stores', 'stores (phone)', ...NARROW);
	});

	// Contrast is a property of the palette in use, so the dark one has to be audited too.
	it('the same screens in the dark theme', () => {
		cy.on('window:before:load', (win) => win.localStorage.setItem('hk.theme', 'dark'));
		open('/dashboard', 'dashboard (dark)', ...WIDE);
		open('/orders', 'orders (dark)', ...WIDE);
		open('/products', 'products (dark)', ...WIDE);
		open('/stores', 'stores (dark)', ...WIDE);
	});

	it('the shortcut help, which is a dialog', () => {
		open('/orders', 'orders (before help)', ...WIDE);
		cy.get('body').type('?');
		cy.get('.hk-modal', { timeout: 10000 }).should('be.visible');
		cy.wait(400);
		audit('shortcut help');
	});

	it('the pairing screen, which is what a new user meets first', () => {
		cy.viewport(...NARROW);
		cy.visit('/#/connect');
		cy.get('.hk-body', { timeout: 20000 }).should('exist');
		cy.wait(500);
		cy.window({ log: false }).then((win) => {
			const s = win.document.createElement('script');
			s.textContent = axeSource;
			win.document.head.appendChild(s);
		});
		audit('connect');
	});

	after(() => {
		cy.writeFile('/tmp/a11y.json', JSON.stringify(findings, null, 2));
	});
});
