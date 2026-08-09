// The media browser against a folder with hundreds of files, which is what a real shop has.
describe('Media browser', () => {
	const open = () => {
		cy.viewport(1440, 900);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.contains('button', 'Browse', { timeout: 20000 }).first().click();
		cy.get('.hk-modal', { timeout: 20000 }).should('be.visible');
		cy.get('.hk-mb-grid .hk-media-cell', { timeout: 20000 }).should('have.length.greaterThan', 0);
	};

	it('asks for a page at a time rather than the whole folder', () => {
		open();
		// Not all of them: the folder holds hundreds.
		cy.get('.hk-mb-grid .hk-media-cell').should('have.length', 60);
		cy.get('.hk-listfoot').should('exist');
	});

	it('loads the next page when the foot comes into view', () => {
		open();
		cy.get('.hk-mb-grid .hk-media-cell').should('have.length', 60);
		cy.get('.hk-mb-grid').scrollTo('bottom');
		cy.get('.hk-mb-grid .hk-media-cell', { timeout: 20000 }).should('have.length.greaterThan', 60);
	});

	it('searches the whole folder, not the page in hand', () => {
		open();
		// A name that sorts well past the first page, so a local filter could not find it.
		cy.get('.hk-mb-grid .hk-media-cell').first().should('have.attr', 'title', 'demo-0001.png');
		cy.get('.hk-mb-search input').type('demo-01');
		cy.get('.hk-mb-grid .hk-media-cell', { timeout: 20000 })
			.first().should('have.attr', 'title').and('match', /^demo-01/);
	});

	it('is wide enough to be a picker rather than a column', () => {
		open();
		cy.get('.hk-modal').then(($m) => {
			expect($m[0].getBoundingClientRect().width).to.be.greaterThan(900);
		});
		// More than the three columns a 560px dialog could fit.
		cy.get('.hk-mb-grid .hk-media-cell').then(($cells) => {
			const top = Math.round($cells[0].getBoundingClientRect().top);
			const perRow = [...$cells].filter((c) => Math.round(c.getBoundingClientRect().top) === top).length;
			expect(perRow, 'columns').to.be.greaterThan(3);
		});
	});
});
