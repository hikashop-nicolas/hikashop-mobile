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

	// A search that matches more than a page must page through its own results, not the whole list.
	it('pages through the results of a search', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').should('have.length', 30);
		cy.get('input').first().type('Vol test product 1');

		// The count is the search's count, not the shop's.
		cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', '100');
		cy.get('.hk-row').should('have.length', 30);

		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		// Still only matching rows.
		cy.get('.hk-row-title').each(($el) => expect($el.text()).to.contain('Vol test product 1'));
	});

	it('returns to the first page of everything when the search is cleared', () => {
		cy.visitApp('/products');
		cy.get('input').first().type('Vol test product 1');
		cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', '100');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);

		// Clearing is just another query change: back to page one, of the full list.
		cy.get('input').first().clear();
		cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', '307');
		cy.get('.hk-row').should('have.length', 30);
	});

	it('returns to the top of the list when the query changes', () => {
		cy.visitApp('/products');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		cy.get('.hk-listfoot').scrollIntoView();
		cy.get('.hk-body').first().its('0.scrollTop').should('be.greaterThan', 0);

		cy.get('input').first().type('Vol test product 5');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.lessThan', 60);
		cy.get('.hk-body').first().its('0.scrollTop').should('equal', 0);
	});
});
