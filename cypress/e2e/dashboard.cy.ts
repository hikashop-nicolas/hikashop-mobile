// The dashboard's figures are money and its shapes are drawn from the same series.
describe('Dashboard', () => {
	it('shows the totals as money, not bare numbers', () => {
		cy.visitApp('/dashboard');
		cy.contains('.hk-stat', 'Revenue').find('.hk-money').should('exist');
		cy.contains('.hk-stat', 'Avg. order').find('.hk-money').should('exist');
		// A count is not money and must not gain a symbol.
		cy.contains('.hk-stat', 'Orders').find('.hk-money').should('not.exist');
	});

	it('charts the revenue series and ranks the top products', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-chart-svg', { timeout: 15000 }).should('exist');
		// An area, a line and a baseline, all drawn from the series.
		cy.get('.hk-chart-line').should('exist');
		cy.get('.hk-chart-axis').should('exist');
		// The ends of the range are labelled.
		cy.get('.hk-chart-x span').should('have.length', 2);
		// The peak is money, so the scale is readable.
		cy.get('.hk-chart-peak .hk-money').should('exist');

		cy.get('.hk-bar-row').should('have.length.greaterThan', 0);
		// The widest bar belongs to the highest count.
		cy.get('.hk-bar-fill').then(($bars) => {
			const widths = [...$bars].map((b) => parseFloat((b as HTMLElement).style.width));
			expect(widths[0], 'first bar is the widest').to.equal(Math.max(...widths));
		});
	});

	it('says so plainly when a range has nothing in it', () => {
		cy.visitApp('/dashboard');
		cy.contains('.hk-chip', 'Today').click();
		// No chart drawn for an empty series, and a sentence instead.
		cy.get('.hk-chart-svg').should('not.exist');
		cy.get('.hk-empty').should('have.length.greaterThan', 0);
	});

	it('redraws when the range changes', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-chart-x span').first().invoke('text').then((weekStart) => {
			cy.contains('.hk-chip', 'Year').click();
			cy.get('.hk-chart-x span', { timeout: 15000 }).first()
				.should(($el) => expect($el.text()).to.not.equal(weekStart));
		});
	});
});
