// The list/detail split. The same routes have to serve a phone, where only one pane can be on
// screen at a time, and a laptop, where both are. The breakpoint is 1100px.
const NARROW = { w: 430, h: 900 };   // phone
const WIDE = { w: 1400, h: 900 };    // laptop / PWA

describe('Split layout', () => {
	it('shows one pane at a time on a phone', () => {
		cy.viewport(NARROW.w, NARROW.h);
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		cy.get('.hk-split-list').should('be.visible');
		// Not merely hidden: the pane that is off screen is not mounted, so it holds no data
		// and does not keep re-fetching a listing nobody can see.
		cy.get('.hk-split-detail').should('not.exist');

		// Opening a row replaces the list rather than sitting beside it.
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		cy.get('.hk-split-detail').should('be.visible');
		cy.get('.hk-split-list').should('not.exist');
	});

	it('shows both panes on a wide screen, and marks the open row', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		// Nothing selected yet: the list is up and the detail pane invites a choice.
		cy.get('.hk-split-list').should('be.visible');
		cy.get('.hk-split-empty').should('be.visible');

		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		// Both panes, and the list keeps its place.
		cy.get('.hk-split-list').should('be.visible');
		cy.get('.hk-split-detail').should('be.visible');
		cy.get('.hk-split-empty').should('not.exist');
		// The row whose detail is open is the marked one, and only it.
		cy.get('.hk-split-list .hk-row--on').should('have.length', 1);
		cy.get('.hk-row').first().should('have.class', 'hk-row--on');
	});

	it('keeps a long value from running under the right-hand column', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		cy.get('.hk-split-list .hk-row').should('have.length.greaterThan', 0);
		// The title truncates rather than overflowing its column, whatever it contains.
		cy.get('.hk-split-list .hk-row-title').first().then(($el) => {
			const el = $el[0];
			expect(getComputedStyle(el).textOverflow).to.equal('ellipsis');
			expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
		});
	});

	it('splits the other sections too', () => {
		cy.viewport(WIDE.w, WIDE.h);
		for (const path of ['/products', '/customers', '/discounts']) {
			cy.visitApp(path);
			cy.get('.hk-split-list').should('be.visible');
			cy.get('.hk-split-empty').should('be.visible');
		}
	});
});
