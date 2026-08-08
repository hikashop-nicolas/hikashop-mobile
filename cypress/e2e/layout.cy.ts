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

		// Opening a row covers the list rather than sitting beside it.
		cy.get('.hk-row').first().click();
		cy.hash().should('match', /#\/orders\/\d+/);
		// One pane on screen: the record is over the list, and there is no second column.
		cy.get('.hk-detail-over').should('be.visible');
		cy.get('.hk-split-list').should('not.exist');
	});

	it('shows both panes on a wide screen, and marks the open row', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length.greaterThan', 0);
		// Nothing selected yet: the list has the whole width, with no pane held empty beside it.
		cy.get('.hk-split-detail').should('not.exist');
		cy.get('.hk-split-list').invoke('outerWidth').should('be.greaterThan', WIDE.w - 400);
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
		// The title truncates rather than overflowing its column. Its content being wider than the
		// box is what truncation IS, so the thing to check is that what is drawn stays inside the
		// row -- not that the text happens to be short enough to fit.
		cy.get('.hk-split-list .hk-row').first().then(($row) => {
			const title = $row[0].querySelector('.hk-row-title') as HTMLElement;
			const style = getComputedStyle(title);
			expect(style.textOverflow, 'truncates').to.equal('ellipsis');
			expect(style.overflow, 'clips').to.not.equal('visible');
			expect(style.whiteSpace, 'stays on one line').to.equal('nowrap');
			expect(title.getBoundingClientRect().right, 'stays inside the row')
				.to.be.at.most($row[0].getBoundingClientRect().right + 1);
		});
	});

	it('splits the other sections too', () => {
		cy.viewport(WIDE.w, WIDE.h);
		for (const path of ['/products', '/customers', '/discounts']) {
			cy.visitApp(path);
			cy.get('.hk-split-detail').should('not.exist');
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
		// The record slides away and is gone; the list has the width back.
		cy.get('.hk-split-detail').should('not.exist');
	});

	it('loads the record you opened, not the one before it', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/products');
		cy.get('.hk-row').eq(3).click();
		cy.get('.hk-split-detail input.hk-input').first().invoke('val').should('not.be.empty');

		// Straight from one record to another: the form must follow, not keep the first one.
		cy.get('.hk-split-list .hk-row').eq(5).then(($row) => {
			const name = $row.find('.hk-row-title').text();
			cy.wrap($row).click();
			cy.get('.hk-split-detail input.hk-input').first()
				.invoke('val').should((v) => expect(name).to.contain(String(v)));
		});
	});

	it('asks before dropping unsaved changes, and only when there are some', () => {
		cy.viewport(WIDE.w, WIDE.h);
		cy.visitApp('/products');
		const name = () => cy.get('.hk-split-detail input.hk-input').first();
		// The form is showing the row that is marked open, rather than one still on its way out.
		const settled = (i: number) => {
			cy.get('.hk-split-list .hk-row').eq(i).should('have.class', 'hk-row--on');
			cy.get('.hk-split-list .hk-row').eq(i).find('.hk-row-title').invoke('text').then((title) => {
				name().should(($el) => expect(title).to.contain(String($el.val())));
			});
		};

		cy.get('.hk-row').eq(3).click();
		settled(3);

		// Nothing typed: switching must not nag.
		cy.get('.hk-split-list .hk-row').eq(5).click();
		cy.get('.hk-modal').should('not.exist');
		settled(5);

		// With a change pending, switching asks and stays put with the change intact.
		name().type('X');
		cy.get('.hk-split-list .hk-row').eq(2).click();
		cy.get('.hk-modal').should('be.visible');
		cy.contains('.hk-modal button', /Keep editing/i).click();
		cy.get('.hk-modal').should('not.exist');
		cy.get('.hk-split-list .hk-row').eq(5).should('have.class', 'hk-row--on');
		name().should(($el) => expect(String($el.val())).to.match(/X$/));

		// Discarding moves on to the row that was clicked, on the record it belongs to.
		cy.get('.hk-split-list .hk-row').eq(2).click();
		cy.contains('.hk-modal button', /Discard/i).click();
		cy.get('.hk-modal').should('not.exist');
		settled(2);
		name().should(($el) => expect(String($el.val())).to.not.match(/X$/));
	});
});
