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

// Editing a library image. The shop serves its own images without a cross-origin header, so
// the pixels come through the API instead: an <img> straight from the shop taints the canvas
// and the export throws. Both halves are checked here, since a mock would prove neither.
describe('Image editor', () => {
	const api = () => `${Cypress.env('storeUrl')}/index.php/hikashop-api/v1`;
	const auth = () => ({ Authorization: `Bearer ${Cypress.env('token')}` });

	// Whatever this test attaches, it takes away again.
	const sweepEdited = (productId: number) => {
		cy.request({ url: `${api()}/products/${productId}`, headers: auth() }).then((r) => {
			for (const img of (r.body.data.images ?? []).filter((i: { name?: string }) => /-edited\.jpg$/.test(i.name ?? ''))) {
				cy.request({ method: 'DELETE', url: `${api()}/products/${productId}/files/${img.id}`, headers: auth(), failOnStatusCode: false });
			}
		});
	};

	it('slides in beside the library rather than opening a second dialog', () => {
		cy.viewport(1440, 900);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.contains('button', 'Browse', { timeout: 20000 }).first().click();
		cy.get('.hk-mb-grid .hk-media-cell', { timeout: 20000 }).first().scrollIntoView().click();

		cy.get('.hk-mbsplit-list').then(($l) => {
			const before = $l[0].getBoundingClientRect().width;
			cy.get('.hk-modal-foot').contains('button', 'Edit').click();
			cy.get('.cr-image', { timeout: 20000 }).should('exist');
			cy.wait(900);

			// One dialog, and the library gave up the width the editor needed.
			cy.get('.hk-modal').should('have.length', 1);
			cy.get('.hk-modal-title').should('have.text', 'Edit image');
			cy.get('.hk-mbsplit-list').then(($after) => {
				expect($after[0].getBoundingClientRect().width, 'library narrower').to.be.lessThan(before);
			});
			cy.get('.hk-mbsplit-edit').then(($e) => {
				const edit = $e[0].getBoundingClientRect();
				const list = Cypress.$('.hk-mbsplit-list')[0].getBoundingClientRect();
				expect(Math.round(list.right), 'side by side, not stacked').to.be.at.most(Math.round(edit.left) + 2);
			});
		});

		// Cancel goes back to the library instead of closing everything.
		cy.get('.hk-modal-foot').contains('button', 'Cancel').click();
		cy.get('.hk-mbsplit-edit').should('not.exist');
		cy.get('.hk-mb-grid').should('be.visible');
		cy.get('.hk-modal-title').should('have.text', 'Media library');
	});

	it('opens a library image, exports it, and attaches it as a new file', () => {
		let productId = 0;
		let before = 0;

		cy.viewport(1440, 900);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
		cy.location('hash').then((h) => { productId = Number(h.split('/').pop()); });
		cy.then(() => cy.request({ url: `${api()}/products/${productId}`, headers: auth() }))
			.then((r) => { before = (r.body.data.images ?? []).length; });

		cy.contains('button', 'Browse', { timeout: 20000 }).first().click();
		cy.get('.hk-mb-grid .hk-media-cell', { timeout: 20000 }).first().scrollIntoView().click();
		cy.get('.hk-modal-foot').contains('button', 'Edit').should('not.be.disabled').click();

		// The pixels arrived. A tainted image would be width 0 here, and the export below would
		// throw rather than produce a file.
		cy.get('.cr-image', { timeout: 20000 }).should(($i) => {
			expect(($i[0] as HTMLImageElement).naturalWidth, 'the image loaded').to.be.greaterThan(0);
		});

		cy.get('.hk-modal-foot').contains('button', 'Save as new image').click();
		cy.get('.hk-imgedit', { timeout: 30000 }).should('not.exist');

		cy.then(() => cy.request({ url: `${api()}/products/${productId}`, headers: auth() })).then((r) => {
			const imgs = r.body.data.images ?? [];
			expect(imgs.length, 'one more image on the product').to.equal(before + 1);
			expect(imgs.some((i: { name?: string }) => /-edited\.jpg$/.test(i.name ?? '')), 'saved under a new name').to.be.true;
		});
		cy.then(() => sweepEdited(productId));
	});
});
