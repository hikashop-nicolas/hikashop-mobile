/// <reference types="cypress" />

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Cypress {
		interface Chainable {
			/** Open the app at a hash route with a store pre-paired from cypress.env.json. */
			visitApp(hash?: string): Chainable<void>;
			/** Remove every product whose name matches, straight through the API. */
			sweepProducts(name: string): Chainable<void>;
			/** Remove one product by id, straight through the API. */
			deleteProductById(id: number): Chainable<void>;
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
	// The read cache lives in IndexedDB and outlives a visit, so a test that stubs an endpoint
	// leaves its answer behind for the next one. Each test starts from the shop instead.
	cy.window({ log: false }).then((w) => w.indexedDB?.deleteDatabase('hikashop-cache'));
	cy.visit('/#' + hash, {
		onBeforeLoad(win) {
			win.indexedDB?.deleteDatabase('hikashop-cache');
			for (const k of Object.keys(win.localStorage)) if (k.startsWith('hk.cache.')) win.localStorage.removeItem(k);
			win.localStorage.setItem('hk.data.stores', JSON.stringify([store]));
			win.localStorage.setItem('hk.data.activeStore', String(store.id));
			win.localStorage.setItem('hk.secret.token.' + store.id, Cypress.env('token'));
			win.localStorage.setItem('hk.locale', 'en');
		},
	});
});

// Tests that create records clean up after themselves through the UI, but a delete that races a
// re-render leaves one behind and the next run then works against a shop it did not expect. This
// sweeps by name through the API, which cannot race anything.
Cypress.Commands.add('sweepProducts', (name: string) => {
	const base = `${Cypress.env('storeUrl')}/index.php/hikashop-api/v1`;
	const auth = { Authorization: `Bearer ${Cypress.env('token')}` };
	cy.request({ url: `${base}/products?limit=100&search=${encodeURIComponent(name)}`, headers: auth })
		.then((res) => {
			const items: { id: number; name: string }[] = res.body?.data ?? [];
			for (const p of items.filter((x) => x.name === name)) {
				cy.request({ method: 'DELETE', url: `${base}/products/${p.id}`, headers: auth, failOnStatusCode: false });
			}
		});
});

// Delete exactly the product a test created. Deleting "whatever the detail pane is showing" is
// how a test ends up removing a fixture product when a click does not land where it expected.
Cypress.Commands.add('deleteProductById', (id: number) => {
	const base = `${Cypress.env('storeUrl')}/index.php/hikashop-api/v1`;
	cy.request({
		method: 'DELETE',
		url: `${base}/products/${id}`,
		headers: { Authorization: `Bearer ${Cypress.env('token')}` },
		failOnStatusCode: false,
	});
});

export {};
