// The list/detail split. The same routes have to serve a phone, where only one pane can be on
// screen at a time, and a laptop, where both are. The breakpoint is 1100px.
const NARROW = { w: 430, h: 900 };   // phone
const WIDE = { w: 1400, h: 900 };    // laptop / PWA

describe('Split layout', () => {
	it('shows one pane at a time on a phone', () => {
		cy.viewport(NARROW.w, NARROW.h);
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		cy.get('.hk-split').should('not.exist');
		cy.get('.hk-row').should('be.visible');

		// Opening a row replaces the list rather than sitting beside it.
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		// The detail replaces the list rather than sitting beside a hidden copy of it.
		cy.get('.hk-split').should('not.exist');
		cy.get('.hk-split-list').should('not.exist');
	});

	it('shows both panes on a wide screen, and marks the open row', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		// Nothing selected yet: the list has the whole width, with no pane held empty beside it.
		cy.get('.hk-split').should('not.exist');
		cy.get('.hk-row').should('be.visible');

		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		// Both panes, and the list keeps its place.
		cy.get('.hk-split-list').should('be.visible');
		cy.get('.hk-split-detail').should('be.visible');
		// The row whose detail is open is the marked one, and only it.
		cy.get('.hk-split-list .hk-row--on').should('have.length', 1);
		cy.get('.hk-row').first().should('have.class', 'hk-row--on');
	});

	it('keeps a long value from running under the right-hand column', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		// The narrow list pane only exists beside an open detail, which is where the squeeze is.
		cy.get('.hk-row').first().click();
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
			cy.get('.hk-split').should('not.exist');
			cy.get('.hk-row').should('exist');
		}
	});

	it('shows the phone tabs as icons, still named for assistive tech', () => {
		cy.viewport(NARROW.w, NARROW.h);
		cy.visitApp('/orders');
		cy.get('.hk-tabbar').should('be.visible');
		cy.get('.hk-tab').should('have.length.greaterThan', 2);

		// No painted label: at this width the words sat too close together to read.
		cy.get('.hk-tab').first().then(($b) => {
			expect($b[0].getBoundingClientRect().height).to.be.greaterThan(0);
			// The only visible content is the icon; the text is clipped out of view.
			const sr = $b[0].querySelector('.hk-sr-only') as HTMLElement;
			expect(sr, 'label kept in the markup').to.exist;
			expect(sr.getBoundingClientRect().width).to.be.at.most(1);
		});

		// Every tab is still named, and the current one is announced.
		cy.get('.hk-tab').each(($b) => {
			expect($b.attr('aria-label'), 'accessible name').to.be.a('string').and.not.equal('');
		});
		cy.get('.hk-tab[aria-current="page"]').should('have.length', 1);
	});

	it('closes the detail rather than stepping back through the rows opened before', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		// Open three rows in turn, as you would when working through a list.
		cy.get('.hk-row').eq(0).click();
		cy.hash().should('match', /#\/orders\/\d+/);
		cy.get('.hk-row').eq(1).click();
		cy.get('.hk-row').eq(2).click();
		cy.hash().should('match', /#\/orders\/\d+/);

		// Back means "close this", not "reopen the one before".
		cy.get('.hk-split-detail .hk-appbar button').first().click();
		cy.hash().should('match', /#\/orders$/);
		cy.get('.hk-split').should('not.exist');
	});
});
