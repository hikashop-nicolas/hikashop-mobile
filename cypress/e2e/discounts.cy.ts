// Smoke coverage for the discounts CRUD (both coupons and automatic discounts).
describe('Discounts', () => {
	it('lists discounts with its type filters', () => {
		cy.visitApp('/discounts');
		cy.get('.hk-title').should('contain', 'Discounts');
		cy.contains('button', 'New').should('be.visible');
		cy.contains('.hk-chip', 'Coupons').should('exist');
		cy.contains('.hk-chip', 'Automatic').should('exist');
	});

	it('creates a coupon and deletes it again', () => {
		const code = `E2E${Date.now()}`;
		cy.visitApp('/discounts');
		cy.contains('button', 'New').click();
		cy.hash().should('include', '/discounts/new');

		// Coupon is the default type, so the code field is shown.
		cy.get('input').first().type(code);
		cy.contains('.hk-seg', 'Percentage').click();
		cy.get('input[type=number]').first().type('12');
		cy.contains('button', 'Save').click();

		cy.hash().should('match', /#\/discounts$/);
		cy.contains('.hk-row', code.toUpperCase()).should('contain', '12%');

		// Delete needs a confirmation step.
		cy.contains('.hk-row', code.toUpperCase()).click();
		cy.hash().should('match', /#\/discounts\/\d+\/edit/);
		cy.contains('button', 'Delete discount').click();
		cy.contains('Delete this discount?').should('be.visible');
		cy.contains('button', /^Delete$/).click();
		cy.hash().should('match', /#\/discounts$/);
		cy.contains('.hk-row', code.toUpperCase()).should('not.exist');
	});

	it('creates an automatic discount with no code, then deletes it', () => {
		cy.visitApp('/discounts');
		cy.contains('button', 'New').click();

		// Switching to Automatic swaps the customer-facing code for an internal reference.
		cy.contains('.hk-seg', 'Automatic').click();
		cy.contains('.hk-label', 'Code').should('not.exist');
		cy.contains('.hk-label', 'Reference').should('be.visible');
		cy.get('input[type=number]').first().type('9');
		cy.contains('button', 'Save').click();

		cy.hash().should('match', /#\/discounts$/);
		cy.contains('.hk-row', 'Automatic').should('contain', '9%');

		cy.contains('.hk-row', 'Automatic').first().click();
		cy.contains('button', 'Delete discount').click();
		cy.contains('button', /^Delete$/).click();
		cy.hash().should('match', /#\/discounts$/);
	});
});
