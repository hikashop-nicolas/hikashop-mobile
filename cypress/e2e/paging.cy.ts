// A shop with a few hundred rows must be reachable past the first page.
describe('Listing pagination', () => {
	const LISTS = [
		{ path: '/products', name: 'products' },
		{ path: '/orders', name: 'orders' },
		{ path: '/customers', name: 'customers' },
		{ path: '/discounts', name: 'discounts' },
	];

	it('loads the next page when the foot of the list is reached', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').should('have.length', 30);
		// The foot says how much of the list is loaded, out of how many there are.
		cy.get('.hk-listfoot').should('contain', 'of');

		// Scrolling to the end pulls the next page in without asking.
		cy.get('.hk-listfoot').scrollIntoView();
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.greaterThan', 30);
	});

	it('loads more from the button too, for anyone not scrolling', () => {
		cy.visitApp('/orders');
		cy.get('.hk-row').should('have.length', 30);
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length.greaterThan', 30);
	});

	it('offers more on every listing that has more', () => {
		for (const l of LISTS) {
			cy.visitApp(l.path);
			cy.get('.hk-row').should('have.length.greaterThan', 0);
			cy.get('.hk-listfoot').invoke('text').should('match', /\d+\D+\d+/);
		}
	});

	it('starts again from the first page when the query changes', () => {
		cy.visitApp('/products');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		// A search is a different list: it must not keep the rows of the previous one.
		cy.get('input').first().type('DEMO-011');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.lessThan', 60);
	});

	// A search that matches more than a page must page through its own results, not the whole list.
	it('pages through the results of a search', () => {
		cy.visitApp('/products');
		cy.get('.hk-row').should('have.length', 30);
		cy.get('input').first().type('DEMO-01');

		// The count is the search's count, not the shop's.
		cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', '100');
		cy.get('.hk-row').should('have.length', 30);

		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		// Still only matching rows.
		// Every row still belongs to the search: the codes are shown under the name.
		cy.get('.hk-row-sub').each(($el) => expect($el.text()).to.contain('DEMO-01'));
	});

	it('returns to the first page of everything when the search is cleared', () => {
		cy.visitApp('/products');
		// Remember the shop's own total rather than hard-coding it; the fixture shop grows.
		cy.get('.hk-listfoot').invoke('text').then((full) => {
			const shopTotal = full.match(/(\d+)\s*$/)?.[1];
			expect(shopTotal, 'shop total').to.be.a('string');

			cy.get('input').first().type('DEMO-01');
			cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', '100');
			cy.get('.hk-listfoot button').click();
			cy.get('.hk-row').should('have.length', 60);

			// Clearing is just another query change: back to page one, of the full list.
			cy.get('input').first().clear();
			cy.get('.hk-listfoot', { timeout: 10000 }).should('contain', shopTotal!);
			cy.get('.hk-row').should('have.length', 30);
		});
	});

	it('returns to the top of the list when the query changes', () => {
		cy.visitApp('/products');
		cy.get('.hk-listfoot button').click();
		cy.get('.hk-row').should('have.length', 60);
		cy.get('.hk-listfoot').scrollIntoView();
		cy.get('.hk-body').first().its('0.scrollTop').should('be.greaterThan', 0);

		cy.get('input').first().type('DEMO-02');
		cy.get('.hk-row', { timeout: 10000 }).should('have.length.lessThan', 60);
		cy.get('.hk-body').first().its('0.scrollTop').should('equal', 0);
	});
});

// A record edited in the detail pane changes how its row reads, and the list is still on screen.
describe('Listing freshness', () => {
	// A product created by these tests is deleted through the UI, which can race a re-render;
	// sweep by name so a leftover never changes what the next run sees.
	afterEach(() => cy.sweepProducts('New product'));

	it('shows an edit made beside it', () => {
		cy.viewport(1400, 900);
		cy.visitApp('/products');
		// Whichever product is first: the test is about the list following an edit, not about a
		// particular product, and the demo catalogue can be re-themed.
		cy.get('.hk-row').first().find('.hk-row-title').invoke('text').then((original) => {
			cy.get('.hk-row').first().click();
			cy.hash().should('match', /#\/products\/\d+/);

			// Change the name and save; the row must follow.
			const suffix = ` Z${Date.now() % 1000}`;
			cy.get('.hk-split-detail input.hk-input').first().type(suffix);
			cy.contains('.hk-split-detail button', /Save/i).click();
			// Saving returns to the list, so the split collapses and the row stands on its own.
			cy.contains('.hk-row', suffix.trim(), { timeout: 10000 }).should('exist');

			// Put it back so the fixture shop stays as it was.
			cy.contains('.hk-row', suffix.trim()).click();
			cy.get('.hk-split-detail input.hk-input').first().clear().type(original.trim());
			cy.contains('.hk-split-detail button', /Save/i).click();
			cy.contains('.hk-row', original.trim(), { timeout: 10000 }).should('exist');
		});
	});

	// The listing stays mounted beside the product it opens, so a flag left set by the create
	// disables the button for the rest of the session.
	//
	// Neither of these deletes anything itself. Deleting "the product the URL points at" looked
	// safe and was not: the assertion that the URL names a product passes on the URL from before
	// the click, so a slow navigation means the test removes whatever was already open. The
	// afterEach sweep removes by exact name instead, which can only ever match what the app
	// itself creates.
	it('can create more than once without the button sticking', () => {
		cy.viewport(1400, 900);
		cy.visitApp('/products');

		cy.contains('button', /New/i).should('not.be.disabled').click();
		cy.get('.hk-split-detail input.hk-input', { timeout: 10000 }).first().should('have.value', 'New product');

		// The second one is the point: before, the button stayed disabled after the first.
		cy.contains('.hk-split-list button', /New/i).should('not.be.disabled').click();
		cy.get('.hk-split-detail input.hk-input', { timeout: 10000 }).first().should('have.value', 'New product');
	});

	it('creates a product while another one is open', () => {
		cy.viewport(1400, 900);
		cy.visitApp('/products');
		cy.get('.hk-row').eq(2).click();
		cy.hash().should('match', /#\/products\/\d+/);

		cy.contains('.hk-split-list button', /New/i).click();
		// It opens the product it just created, rather than silently doing nothing.
		cy.get('.hk-split-detail input.hk-input', { timeout: 10000 }).first().should('have.value', 'New product');
		cy.get('.hk-split-list .hk-error-note').should('not.exist');
	});
});
