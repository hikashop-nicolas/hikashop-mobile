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

	// Stubbed rather than relying on a quiet period in the shop: whether today happens to have
	// orders is a property of the fixture, and this is about what an empty range looks like.
	it('says so plainly when a range has nothing in it', () => {
		cy.intercept({ method: 'GET', url: /stats\/dashboard/ }, {
			statusCode: 200,
			body: {
				data: {
					range: 'today',
					currency_id: 1,
					totals: { revenue: 0, orders: 0, average_order: 0, customers: 0 },
					previous: { revenue: 0, orders: 0, average_order: 0, customers: 0 },
					revenue_series: [],
					top_products: [],
				},
				meta: null,
			},
		}).as('stats');
		cy.visitApp('/dashboard');
		cy.wait('@stats');

		// No chart drawn for an empty series, a sentence instead, and nothing claiming movement.
		cy.get('.hk-chart-svg').should('not.exist');
		cy.get('.hk-empty').should('have.length', 2);
		cy.get('.hk-delta').should('not.exist');
	});

	it('redraws when the range changes', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-chart-x span').first().invoke('text').then((weekStart) => {
			cy.contains('.hk-chip', 'Year').click();
			cy.get('.hk-chart-x span', { timeout: 15000 }).first()
				.should(($el) => expect($el.text()).to.not.equal(weekStart));
		});
	});

	it('shows each figure against the period before it', () => {
		cy.visitApp('/dashboard');
		cy.get('.hk-delta').should('have.length.greaterThan', 0);

		// Every indicator carries its direction in the text as well as the colour, so the meaning
		// does not depend on telling green from red.
		cy.get('.hk-delta').each(($d) => {
			const text = $d.text().trim();
			const cls = $d.attr('class') ?? '';
			if (cls.includes('hk-delta--up')) {
				expect(text, 'a rise reads as + or as new').to.match(/^(\+\d+%|new)$/);
			} else {
				expect(cls, 'the only other direction').to.contain('hk-delta--down');
				expect(text, 'a fall reads as -').to.match(/^-\d+%$/);
			}
		});
	});

	it('says a figure is new when there is nothing to compare it with', () => {
		cy.visitApp('/dashboard');
		// The shop's data starts a year ago, so the year before it holds nothing.
		cy.contains('.hk-chip', 'Year').click();
		cy.get('.hk-delta', { timeout: 15000 }).first().should('contain', 'new');
	});

	it('groups a year by week so the line reads as a trend', () => {
		cy.visitApp('/dashboard');
		cy.contains('.hk-chip', 'Year').click();
		// 52 weekly points rather than 365 daily ones: the path has to stay legible.
		cy.get('.hk-chart-line', { timeout: 15000 }).invoke('attr', 'd').then((d) => {
			const points = String(d).split(/[ML]/).length - 1;
			expect(points, 'weekly buckets, not daily').to.be.lessThan(80);
			expect(points, 'still a real series').to.be.greaterThan(10);
		});
	});

	it('plots today hour by hour, not as a single point', () => {
		cy.visitApp('/dashboard');
		cy.contains('.hk-chip', 'Today').click();
		// Labelled as times, and covering the day so far rather than one dot.
		cy.get('.hk-chart-x span', { timeout: 15000 }).first().invoke('text').should('match', /^\d{1,2}[:h]/);
		cy.get('.hk-chart-line').invoke('attr', 'd').then((d) => {
			const points = String(d).split(/[ML]/).length - 1;
			expect(points, 'an hour each').to.be.greaterThan(1);
			expect(points, 'no more than a day of them').to.be.at.most(25);
		});
	});

	it('covers the whole range, including the quiet parts', () => {
		// A day with no orders has to be a zero in the line, not a missing point: leaving it out
		// joins the line across it and hides that nothing happened.
		cy.intercept({ method: 'GET', url: /stats\/dashboard/ }, {
			statusCode: 200,
			body: {
				data: {
					range: 'week', currency_id: 1, series_granularity: 'day',
					totals: { revenue: 30, orders: 2, average_order: 15, customers: 2 },
					previous: { revenue: 10, orders: 1, average_order: 10, customers: 1 },
					revenue_series: [
						{ date: '2026-08-01', revenue: 10 },
						{ date: '2026-08-02', revenue: 0 },
						{ date: '2026-08-03', revenue: 20 },
					],
					top_products: [],
				},
				meta: null,
			},
		}).as('stats');
		cy.visitApp('/dashboard');
		cy.wait('@stats');
		cy.get('.hk-chart-line').invoke('attr', 'd').then((d) => {
			expect(String(d).split(/[ML]/).length - 1, 'the zero day is drawn').to.equal(3);
		});
	});
});
