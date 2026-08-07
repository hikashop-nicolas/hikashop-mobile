// Smoke coverage for the orders flow against the real connector.
describe('Orders', () => {
	it('lists orders and opens a detail with its key sections', () => {
		cy.visitApp('/orders');
		cy.get('.hk-title').should('contain', 'Orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		// Items section + its "Add product" action, and the status dropdown.
		cy.contains('.hk-card', 'Items').should('exist');
		cy.contains('button', 'Add product').should('be.visible');
		cy.get('select').should('exist');
	});
});
