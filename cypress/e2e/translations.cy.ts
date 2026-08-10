// Content translation: the merchant's own product text in the shop's other languages.
//
// The dev shop publishes English and French, so this runs against the real endpoints and the real
// storage, which here is Joomla language override files rather than Falang rows. Whatever it
// writes, it clears again.
describe('Translations', () => {
	const api = () => `${Cypress.env('storeUrl')}/index.php/hikashop-api/v1`;
	const auth = () => ({ Authorization: `Bearer ${Cypress.env('token')}` });

	const openProduct = () => {
		cy.viewport(1440, 900);
		cy.visitApp('/products');
		cy.get('.hk-row', { timeout: 20000 }).first().click();
		cy.get('.hk-split-detail, .hk-detail-over', { timeout: 20000 }).should('exist');
	};

	// Put the product back to having no French name, whatever the test did.
	const clear = (id: number) => {
		cy.request({ url: `${api()}/languages`, headers: auth() }).then((r) => {
			const french = r.body.data.languages.find((l: { code: string }) => l.code === 'fr-FR');
			if (!french) return;
			cy.request({
				method: 'PUT', url: `${api()}/products/${id}/translations`, headers: auth(),
				body: { [french.id]: { product_name: '' } },
			});
		});
	};

	it('saves into the language the shop publishes, and reads it back', () => {
		openProduct();
		cy.location('hash').then((hash) => {
			const id = Number(hash.split('/')[2]);
			clear(id);

			// Beside Save in the app bar, sized to its own text: it leaves the form rather than
			// filling it in, so it belongs with the actions.
			cy.contains('.hk-appbar button', 'Translations', { timeout: 20000 }).click();
			cy.location('hash').should('include', '/translations');

			// Named in its own language, not by its tag, and the English is shown to translate from.
			cy.contains('button', 'Français', { timeout: 20000 }).should('exist');
			cy.contains('.hk-hint', 'Original').should('exist');

			// The shop's own language is offered but marked, and is never the one the editor opens
			// on: text typed into that slot would be filed as English and look like nothing.
			cy.contains('button', 'shop language').should('exist');
			cy.contains('button', 'Français').should('have.attr', 'aria-selected', 'true');
			cy.contains('button', 'Français').click();

			// By its label, not by position: the screen renders whatever columns the shop offers.
			cy.contains('.hk-field', 'Name', { timeout: 20000 }).find('input.hk-input').clear().type('Appareil photo argentique');
			cy.contains('.hk-appbar button', 'Save').click();

			// The shop kept it: read it back through the API rather than trusting the screen that
			// just wrote it.
			cy.location('hash', { timeout: 20000 }).should('not.include', '/translations');
			cy.request({ url: `${api()}/languages`, headers: auth() }).then((l) => {
				const french = l.body.data.languages.find((x: { code: string }) => x.code === 'fr-FR');
				cy.request({ url: `${api()}/products/${id}/translations`, headers: auth() }).then((r) => {
					// Under French, not merely somewhere: filing it under the shop's own language
					// would read as saved and show nothing to a French customer.
					expect(r.body.data.values[String(french.id)].product_name).to.equal('Appareil photo argentique');
				});
			});

			// And it comes back into the editor rather than an empty field.
			cy.contains('.hk-appbar button', 'Translations').click();
			cy.contains('.hk-field', 'Name', { timeout: 20000 }).find('input.hk-input').should('have.value', 'Appareil photo argentique');

			clear(id);
		});
	});

	it('offers nothing where the shop has nowhere to put a translation', () => {
		// This shop has two languages, so the state cannot be produced here. Stubbed for that
		// reason alone: a shop with one language, or with translation editing off, must not be
		// offered an editor that saves nowhere.
		// The list is cached against a change token, so the app only re-asks when the token moves.
		// Moving it is what makes the stub reachable at all, and is itself worth having covered.
		cy.intercept('GET', '**/hikashop-api/v1/version*', {
			body: { data: { i18n: 'x', statuses: 'x', languages: 'no-languages-test' }, meta: null, error: null },
		}).as('version');
		cy.intercept('GET', '**/hikashop-api/v1/languages', {
			body: { data: { enabled: false, languages: [] }, meta: null, error: null },
		}).as('languages');
		openProduct();
		cy.wait('@languages');
		cy.contains('.hk-card', 'SEO', { timeout: 20000 }).should('exist');
		cy.contains('.hk-appbar button', 'Translations').should('not.exist');
	});
});
