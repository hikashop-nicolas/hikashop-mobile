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
		// Escape reaches the modal, which handles its own. Sent to the focused field, since the
		// palette is a dialog full of buttons and cy.type needs somewhere typeable.
		cy.get('.hk-modal input').type('{esc}');
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

// The point of the modifier binding: it works where the plain keys deliberately do not.
describe('Command palette', () => {
	const mod = Cypress.platform === 'darwin' ? '{cmd}' : '{ctrl}';

	it('opens from inside the search box, where a plain key would be text', () => {
		cy.visitApp('/products');
		cy.get('[data-hk-search]', { timeout: 20000 }).click().type('cera');
		cy.get('.hk-modal').should('not.exist');
		cy.get('[data-hk-search]').type(`${mod}k`);
		cy.get('.hk-modal').should('be.visible');
		// The text typed so far is untouched.
		cy.get('.hk-modal input').type('{esc}');
		cy.get('[data-hk-search]').should('have.value', 'cera');
	});

	it('runs a shortcut from the palette, so it is not only a reference card', () => {
		cy.visitApp('/products');
		cy.get('.hk-appbar', { timeout: 20000 }).should('exist');
		cy.get('body').type(`${mod}k`);
		cy.get('.hk-modal input').type('order');
		cy.get('.hk-modal [role="option"]').first().click();
		cy.location('hash').should('eq', '#/orders');
	});

	it('filters and runs with the keyboard alone', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-appbar', { timeout: 20000 }).should('exist');
		cy.get('body').type(`${mod}k`);
		cy.get('.hk-modal input').type('categor{enter}');
		cy.location('hash').should('eq', '#/categories');
	});

	it('gives focus back to the field it was opened from', () => {
		cy.visitApp('/products');
		cy.get('[data-hk-search]', { timeout: 20000 }).click();
		cy.get('[data-hk-search]').type(`${mod}k`);
		cy.get('.hk-modal').should('be.visible');
		cy.get('.hk-modal input').type('{esc}');
		cy.get('[data-hk-search]').should('be.focused');
	});
});
