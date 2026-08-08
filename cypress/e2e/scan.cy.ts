// Barcode lookup against the real connector. Cypress has no camera, so this drives the typed /
// keyboard-wedge path, which is the same resolve() and the one HID scanners actually use.
describe('Barcode scan', () => {
	it('reports an unknown barcode without leaving the entry field', () => {
		cy.visitApp('/products');
		cy.contains('button', 'Scan').click();
		cy.get('.hk-modal').should('be.visible');
		// Fall back from the camera view to manual entry if this browser offers a camera.
		cy.get('.hk-modal').then(($m) => {
			if ($m.find('input').length === 0) cy.contains('.hk-modal button', 'Cancel').click();
		});
		cy.get('.hk-modal input').type('9999999999999{enter}');
		cy.contains('No product matches').should('be.visible');
		cy.get('.hk-modal input').should('exist');
	});

	it('resolves a known SKU and offers its stock', () => {
		// Take a SKU from the list rather than hard-coding one, so the spec suits any store.
		cy.visitApp('/products');
		cy.get('.hk-row').first().find('.hk-row-sub').invoke('text').then((sub) => {
			const sku = sub.split('·')[0].trim();
			expect(sku, 'a SKU to scan').to.not.equal('');

			cy.contains('button', 'Scan').click();
			cy.get('.hk-modal').then(($m) => {
				if ($m.find('input').length === 0) cy.contains('.hk-modal button', 'Cancel').click();
			});
			cy.get('.hk-modal input').type(`${sku}{enter}`);

			// The match view offers the stock field and the follow-up actions.
			cy.contains('.hk-modal', 'Stock').should('be.visible');
			cy.contains('.hk-modal button', 'Open product').should('be.visible');
			cy.contains('.hk-modal button', 'Scan another').should('be.visible');
		});
	});
});
