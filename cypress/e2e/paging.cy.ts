// A shop with a few hundred rows must be reachable past the first page.
describe('Listing pagination', () => {
	const LISTS = [
		{ path: '/products', name: 'products' },
		{ path: '/orders', name: 'orders' },
		{ path: '/customers', name: 'customers' },
		{ path: '/discounts', name: 'discounts' },
	];

	it('loads the next page when the foot of the list is reached', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').should('have.length', 30);
		// The foot says how much of the list is loaded, out of how many there are.
		cy.get('.hk-listfoot').should('contain', 'of');

		// Scrolling to the end pulls the next page in without asking.
		cy.get('.hk-listfoot').scrollIntoView();
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.greaterThan', 30);
	});

	it('loads more from the button too, for anyone not scrolling', () => {
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length', 30);
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length.greaterThan', 30);
	});

	it('offers more on every listing that has more', () => {
		for (const l of LISTS) {
			cy.visitApp(l.path);
			cy.get('.hk-row').should('have.length.greaterThan', 0);
			cy.get('.hk-listfoot').invoke('text').should('match', /\d+\D+\d+/);
		}
	});

	it('starts again from the first page when the query changes', () => {
		cy.visitApp('/products');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		// A search is a different list: it must not keep the rows of the previous one.
		cy.get('input').first().type('Vol test product 01');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.lessThan', 60);
	});
});
