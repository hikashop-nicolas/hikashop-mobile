/// <reference types="cypress" />

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Cypress {
		interface Chainable {
			/** Open the app at a hash route with a store pre-paired from cypress.env.json. */
			visitApp(hash?: string): Chainable<void>;
		}
	}
}

// Seed a paired store into localStorage (from cypress.env.json) and open the app at a hash route,
// so tests hit the real connector without going through the interactive pairing flow. The keys
// mirror the app's storage layout (hk.data.* for the registry, hk.secret.* for tokens).
Cypress.Commands.add('visitApp', (hash = '/') => {
	const store = {
		id: Cypress.env('storeId'),
		name: Cypress.env('storeName'),
		baseUrl: Cypress.env('storeUrl'),
		role: 'admin',
		createdAt: 0,
	};
	cy.visit('/#' + hash, {
		onBeforeLoad(win) {
			win.localStorage.setItem('hk.data.stores', JSON.stringify([store]));
			win.localStorage.setItem('hk.data.activeStore', String(store.id));
			win.localStorage.setItem('hk.secret.token.' + store.id, Cypress.env('token'));
			win.localStorage.setItem('hk.locale', 'en');
		},
	});
});

export {};
