// The category tree is fetched a level at a time, so a shop with thousands of them neither
// downloads the lot nor renders it in one list.
describe('Category tree', () => {
	it('pages the top level instead of loading the whole tree', () => {
		cy.visitApp('/categories');
		cy.get('.hk-row').should('have.length', 50);
		// The count is of the top level, not of every category in the shop.
		cy.get('.hk-listfoot').should('contain', 'of');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length.greaterThan', 50);
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
		cy.get('input').first().type('Booths');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length', 2);
		cy.get('input').first().clear();
		cy.get('.hk-row', { timeout: 10000 }).should('have.length', 50);
		cy.get('.hk-disclose').should('have.length.greaterThan', 0);
	});
});
