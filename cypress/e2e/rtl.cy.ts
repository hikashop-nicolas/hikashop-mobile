// Right-to-left. The app is offered in Arabic, Hebrew and Persian, where the layout mirrors and
// so must the movement: a record opens from the side you read towards, which is the left.
describe('Right to left', () => {
	const open = (locale: string) => {
		cy.visitApp('/products');
		cy.window().then((w) => w.localStorage.setItem('hk.locale', locale));
		cy.reload();
		cy.viewport(1280, 860);
		cy.get('.hk-row', { timeout: 20000 }).should('have.length.greaterThan', 0);
	};

	it('mirrors the layout and translates the menu', () => {
		open('ar-AA');
		cy.document().its('documentElement.dir').should('eq', 'rtl');
		cy.document().its('documentElement.lang').should('eq', 'ar-AA');
		// From HikaShop's own Arabic, so the app says what the backend says.
		cy.get('.hk-sidenav').should('contain', 'الطلبات');
		// The navigation sits on the right of the screen.
		cy.get('.hk-sidenav').then(($n) => {
			const nav = $n[0].getBoundingClientRect();
			expect(nav.left, 'navigation on the right').to.be.greaterThan(window.innerWidth / 2);
		});
	});

	it('opens a record from the left, and lands flush', () => {
		open('ar-AA');
		cy.get('.hk-row').first().click();
		cy.get('.hk-split-detail', { timeout: 20000 }).should('exist');

		// The pane itself is on the mirrored side.
		cy.get('.hk-split-detail').then(($p) => {
			expect(Math.round($p[0].getBoundingClientRect().left), 'pane on the left').to.equal(0);
		});
		// Caught mid-move: its contents are still off to the left, not the right.
		cy.wait(120);
		cy.get('.hk-split-detail').then(($p) => {
			const pane = $p[0].getBoundingClientRect();
			const slide = $p[0].querySelector('.hk-slide')!.getBoundingClientRect();
			expect(slide.left - pane.left, 'arrives from the left').to.be.lessThan(0);
		});
		// And settles in place rather than beside it.
		cy.wait(700);
		cy.get('.hk-split-detail').then(($p) => {
			const pane = $p[0].getBoundingClientRect();
			const slide = $p[0].querySelector('.hk-slide')!.getBoundingClientRect();
			expect(Math.round(slide.left - pane.left), 'settled').to.equal(0);
		});
	});

	it('opens a record from the right in a left-to-right language', () => {
		open('en');
		cy.document().its('documentElement.dir').should('eq', 'ltr');
		cy.get('.hk-row').first().click();
		cy.get('.hk-split-detail', { timeout: 20000 }).should('exist');
		cy.wait(120);
		cy.get('.hk-split-detail').then(($p) => {
			const pane = $p[0].getBoundingClientRect();
			const slide = $p[0].querySelector('.hk-slide')!.getBoundingClientRect();
			expect(slide.left - pane.left, 'arrives from the right').to.be.greaterThan(0);
		});
	});
});
