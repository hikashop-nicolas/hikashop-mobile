// @vitest-environment jsdom
//
// Which language the app asks the store for. This was wrong for months in a way nothing caught:
// the map knew only en and fr, so a Japanese operator's shop dictionary arrived in English and
// overrode the app's own Japanese labels. Order statuses read "created" on a Japanese screen.
import { describe, it, expect } from 'vitest';
import { hikaTag } from './versions';
import { LOCALES } from '../i18n';

describe('the language asked of the store', () => {
	it('asks under the tag the store installs its pack as', () => {
		expect(hikaTag('ja-JP')).toBe('ja-JP');
		expect(hikaTag('de-DE')).toBe('de-DE');
		expect(hikaTag('pt-BR')).toBe('pt-BR');
		// The two written by hand here are short; HikaShop files them under a region.
		expect(hikaTag('en')).toBe('en-GB');
		expect(hikaTag('fr')).toBe('fr-FR');
	});

	it('never sends a tag the connector would refuse', () => {
		// The connector accepts xx-XX only, and falls back to the site's language for anything
		// else, which is how a translated app ends up showing a language nobody chose.
		for (const tag of Object.keys(LOCALES)) {
			expect(hikaTag(tag), `${tag} asks for ${hikaTag(tag)}`).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
		}
		// Flemish is the one locale whose own tag does not fit, so it asks as its base.
		expect(hikaTag('nl-NL-flemish')).toBe('nl-NL');
	});

	it('falls back to English only when there is nothing better', () => {
		expect(hikaTag('zz')).toBe('en-GB');
	});
});
