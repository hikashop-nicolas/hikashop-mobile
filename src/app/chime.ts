// The "cha-ching": a short two-note chime for a new sale, synthesized with WebAudio so the app
// ships no audio asset and the sound works offline. Browsers only allow audio after a user
// gesture, so the context is created lazily and a blocked play is simply ignored.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	if (!ctx) ctx = new Ctor();
	return ctx;
}

// One bell-ish note: a triangle tone with a fast attack and an exponential decay.
function note(ac: AudioContext, freq: number, startAt: number, duration: number, gain: number) {
	const osc = ac.createOscillator();
	const amp = ac.createGain();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(freq, startAt);
	amp.gain.setValueAtTime(0.0001, startAt);
	amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
	amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
	osc.connect(amp).connect(ac.destination);
	osc.start(startAt);
	osc.stop(startAt + duration + 0.02);
}

// Play the chime. Safe to call when audio is unavailable or blocked: it just does nothing.
export async function playChime(): Promise<void> {
	const ac = context();
	if (!ac) return;
	try {
		if (ac.state === 'suspended') await ac.resume();
		const now = ac.currentTime;
		// Two rising notes (E6 then B6) — the classic register "cha-ching".
		note(ac, 1318.5, now, 0.12, 0.18);
		note(ac, 1975.5, now + 0.09, 0.22, 0.15);
	} catch {
		// autoplay policy or a closed context: not worth surfacing
	}
}

// Browsers unlock audio only inside a user gesture, so call this from the settings toggle to
// prime the context; afterwards a background poll can play the chime.
export async function primeAudio(): Promise<void> {
	const ac = context();
	if (!ac) return;
	try { if (ac.state === 'suspended') await ac.resume(); } catch { /* ignore */ }
}
