// The category tree is fetched a level at a time, so a shop with thousands of them neither
// downloads the lot nor renders it in one list.
describe('Category tree', () => {
	it('loads the top level only, not the whole tree', () => {
		cy.visitApp('/categories');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		// The count is of the top level. A shop with six departments and thirty-five
		// sub-categories shows six here, not forty-one.
		cy.get('.hk-listfoot').invoke('text').then((text) => {
			const [shown, total] = (text.match(/(\d+)\D+(\d+)/) ?? []).slice(1).map(Number);
			expect(shown, 'everything on this level is shown').to.equal(total);
			cy.get('.hk-row').should('have.length', shown);
		});
		// Nothing from a deeper level has been fetched.
		cy.get('.hk-branch').should('not.exist');
	});

	// The paging path itself, stubbed: whether the fixture shop has more than a page of
	// top-level categories is a property of the fixture, not of the app.
	it('offers more when a level runs past one page', () => {
		const level = Array.from({ length: 50 }, (_, i) => ({
			id: i + 1, name: `Category ${i + 1}`, parent_id: 0, published: true, has_children: false,
		}));
		cy.intercept({ method: 'GET', url: /\/categories(\?|$)/ }, {
			statusCode: 200,
			body: { data: level, meta: { total: 120, start: 0, limit: 50 } },
		}).as('level');
		cy.visitApp('/categories');
		cy.wait('@level');
		cy.get('.hk-row').should('have.length', 50);
		cy.get('.hk-listfoot button').should('exist');
	});

	it('fetches a branch only when it is opened', () => {
		cy.visitApp('/categories');
		cy.get('.hk-disclose').should('have.length.greaterThan', 0);
		cy.get('.hk-branch').should('not.exist');

		cy.get('.hk-disclose').first().click();
		cy.get('.hk-branch .hk-row', { timeout: 10000 }).should('have.length.greaterThan', 0);

		// Closing hides it again.
		cy.get('.hk-disclose').first().click();
		cy.get('.hk-branch').should('not.exist');
	});

	it('shows a search as flat results, each with the path it sits under', () => {
		cy.visitApp('/categories');
		// Open a branch first: its rows must not survive into the results.
		cy.get('.hk-disclose').first().click();
		cy.get('.hk-branch .hk-row').should('have.length.greaterThan', 0);

		cy.get('input').first().type('Booths');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length', 2);
		// Flat: no branch, no disclosure, and every result names its ancestors.
		cy.get('.hk-branch').should('not.exist');
		cy.get('.hk-disclose').should('not.exist');
		cy.get('.hk-row').first().find('.hk-row-sub').should('contain', '›');
	});

	it('goes back to the tree when the search is cleared', () => {
		cy.visitApp('/categories');
		cy.get('.hk-row').its('length').then((topLevel) => {
			cy.get('input').first().type('Booths');
			cy.get('.hk-row', { timeout: 10000 }).should('have.length.lessThan', topLevel);
			cy.get('input').first().clear();
			// Back to the level it started on, with its branches openable again.
			cy.get('.hk-row', { timeout: 10000 }).should('have.length', topLevel);
			cy.get('.hk-disclose').should('have.length.greaterThan', 0);
		});
	});

	// The picker on a product form browses the same way, rather than holding the tree in memory.
	it('picks a category by browsing, without loading the whole tree', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/products\/\d+/);

		// What is already chosen shows as a chip, resolved by id.
		cy.contains('.hk-label', 'Categories').parents('.hk-field').first().as('field');
		cy.get('@field').find('.hk-chip.hk-on').should('have.length.greaterThan', 0);

		// Browsing opens one level, with a trail of where you are.
		cy.get('@field').contains('.hk-chip', /Add|Choose/).click();
		cy.get('.hk-picker-list .hk-row').should('have.length.greaterThan', 0);
		cy.get('.hk-crumbs').should('contain', 'All');

		// Drilling in follows the trail.
		cy.get('.hk-picker-list .hk-row .hk-iconbtn').first().click();
		cy.get('.hk-crumbs .hk-linkbtn').should('have.length.greaterThan', 1);
	});

	it('searches the whole tree from the picker and shows the path', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').first().click();
		cy.contains('.hk-label', 'Categories').parents('.hk-field').first()
			.contains('.hk-chip', /Add|Choose/).click();

		cy.get('.hk-modal input.hk-input').type('Booths');
		cy.get('.hk-picker-list .hk-row', { timeout: 10000 }).should('have.length', 2);
		// Flat results: no drilling, and each says where it sits.
		cy.get('.hk-picker-list .hk-row .hk-iconbtn').should('not.exist');
		cy.get('.hk-picker-list .hk-row-sub').first().should('contain', '›');
	});
});
