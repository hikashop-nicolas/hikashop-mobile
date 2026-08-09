// The shortcuts, driven the way someone would use them.
describe('Keyboard shortcuts', () => {
	it('goes to a section with a two-key sequence', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-appbar', { timeout: 20000 }).should('exist');
		cy.get('body').type('g').type('p');
		cy.location('hash').should('eq', '#/products');
		cy.get('body').type('g').type('o');
		cy.location('hash').should('eq', '#/orders');
	});

	it('focuses the search box on /', () => {
		cy.visitApp('/products');
		cy.get('[data-hk-search]', { timeout: 20000 }).should('exist').should('not.be.focused');
		cy.get('body').type('/');
		cy.get('[data-hk-search]').should('be.focused');
	});

	it('does nothing while you are typing, so a product name is never eaten', () => {
		cy.visitApp('/products');
		cy.get('[data-hk-search]', { timeout: 20000 }).click().type('gopher');
		cy.location('hash').should('eq', '#/products');
		cy.get('[data-hk-search]').should('have.value', 'gopher');
	});

	it('opens and closes the shortcut list', () => {
		cy.visitApp('/orders');
		cy.get('.hk-appbar', { timeout: 20000 }).should('exist');
		cy.get('body').type('?');
		cy.get('.hk-modal').should('be.visible').and('contain', 'Keyboard shortcuts');
		// Escape reaches the modal, which handles its own.
		cy.get('.hk-modal').type('{esc}');
		cy.get('.hk-modal').should('not.exist');
	});

	it('closes an open record with Escape', () => {
		cy.visitApp('/orders');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.get('body').type('{esc}');
		cy.get('.hk-split-detail, .hk-detail-over').should('not.exist');
	});
});
