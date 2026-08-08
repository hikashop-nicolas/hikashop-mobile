// Smoke coverage for the coupons CRUD against the real connector.
describe('Coupons', () => {
	it('lists coupons', () => {
		cy.visitApp('/discounts');
		cy.get('.hk-title').should('contain', 'Coupons');
		cy.contains('button', 'New').should('be.visible');
	});

	it('creates a coupon and deletes it again', () => {
		const code = `E2E${Date.now()}`;
		cy.visitApp('/discounts');
		cy.contains('button', 'New').click();
		cy.hash().should('include', '/discounts/new');

		cy.get('input').first().type(code);           // code (uppercased by the field)
		cy.contains('.hk-seg', 'Percentage').click();
		cy.get('input[type=number]').first().type('12');
		cy.contains('button', 'Save').click();

		// Back on the list, the new coupon shows with its value.
		cy.hash().should('match', /#\/discounts$/);
		cy.contains('.hk-row', code.toUpperCase()).should('contain', '12%');

		// Open it and delete it, leaving the site clean.
		cy.contains('.hk-row', code.toUpperCase()).click();
		cy.hash().should('match', /#\/discounts\/\d+\/edit/);
		cy.contains('button', 'Delete coupon').click();
		cy.hash().should('match', /#\/discounts$/);
		cy.contains('.hk-row', code.toUpperCase()).should('not.exist');
	});
});
