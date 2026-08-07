// Smoke coverage for the customers flow against the real connector.
describe('Customers', () => {
	it('lists customers and opens a detail', () => {
		cy.visitApp('/customers');
		cy.get('.hk-title').should('contain', 'Customers');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/customers\/\d+/);
		// The detail renders its Orders section card.
		cy.contains('.hk-card', 'Orders').should('exist');
	});

	it('searches customers by name/email', () => {
		cy.visitApp('/customers');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		cy.get('input').first().type('buyer');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.greaterThan', 0);
		cy.get('.hk-row').first().should('contain.text', '@');
	});

	it('creates a new customer and lands on its detail', () => {
		cy.visitApp('/customers');
		cy.contains('button', 'New').click();
		cy.get('.hk-modal').should('be.visible');
		const email = `e2e_${Date.now()}@example.com`;
		cy.get('.hk-modal input').eq(0).type('E2E Tester');
		cy.get('.hk-modal input').eq(1).type(email);
		cy.contains('.hk-modal button', 'Create').click();
		cy.hash().should('match', /#\/customers\/\d+/);
		cy.get('.hk-card').first().should('contain', 'E2E Tester');
		// A guest by default, with an "add a login" action available.
		cy.contains('button', 'Create account').should('exist');
	});
});
