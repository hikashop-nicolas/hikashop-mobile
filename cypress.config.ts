import { defineConfig } from 'cypress';

// End-to-end smoke suite. It drives the real app (Vite dev server) against a real connector,
// so it needs both running plus a cypress.env.json with a paired store's token (see
// cypress.env.example.json). Point baseUrl at the dev server; the connector URL + token come
// from the env file and are seeded into localStorage by the visitApp command.
export default defineConfig({
	e2e: {
		baseUrl: 'http://localhost:5173',
		supportFile: 'cypress/support/e2e.ts',
		specPattern: 'cypress/e2e/**/*.cy.ts',
		fixturesFolder: false,
		video: false,
		screenshotOnRunFailure: false,
		defaultCommandTimeout: 10000,
	},
});
