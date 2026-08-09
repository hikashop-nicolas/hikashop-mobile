// Screenshots for the README, taken from the real app against a real shop rather than mocked,
// so a stale one is a bug someone can see. Not part of the e2e suite: run `npm run screenshots`,
// which points Cypress at this folder and writes into docs/screenshots.
//
// Needs the dev server and a paired demo shop, the same cypress.env.json the e2e suite uses.

// The runner's browser reports a dark colour scheme, and the app follows the system by
// default, so pin the theme instead of letting the set come out dark by accident.
beforeEach(() => {
	cy.on('window:before:load', (win) => win.localStorage.setItem('hk.theme', 'light'));
});

const DESKTOP: [number, number] = [1280, 860];
const PHONE: [number, number] = [390, 844];

// Cypress adds its own wrapper around the app; capture just the viewport.
const shot = (name: string) => cy.screenshot(name, { capture: 'viewport', overwrite: true });

// The listings animate in, and a screenshot taken mid-transition looks like a rendering bug.
const settle = () => cy.wait(900);

describe('README screenshots', () => {
	it('dashboard', () => {
		cy.viewport(...DESKTOP);
		cy.visitApp('/dashboard');
		cy.get('.hk-chart-svg', { timeout: 20000 }).should('exist');
		cy.get('.hk-bar-row').should('have.length.greaterThan', 0);
		settle();
		shot('01-dashboard');
	});

	it('orders, with one open beside the list', () => {
		cy.viewport(...DESKTOP);
		cy.visitApp('/orders');
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
		cy.get('.hk-rowmain, .hk-row').first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		settle();
		shot('02-orders');
	});

	it('a product being edited', () => {
		cy.viewport(...DESKTOP);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
		cy.get('.hk-rowmain, .hk-row').first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		settle();
		shot('03-product');
	});

	it('the product listing on a phone', () => {
		cy.viewport(...PHONE);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
		settle();
		shot('04-phone-products');
	});

	it('an order on a phone', () => {
		cy.viewport(...PHONE);
		cy.visitApp('/orders');
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
		cy.get('.hk-rowmain, .hk-row').first().click();
		cy.get('.hk-detail-over, .hk-split-detail', { timeout: 20000 }).should('exist');
		settle();
		shot('05-phone-order');
	});

	it('the stores screen, with more than one shop', () => {
		cy.viewport(...PHONE);
		cy.visitApp('/stores');
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
		settle();
		shot('06-phone-stores');
	});
});
