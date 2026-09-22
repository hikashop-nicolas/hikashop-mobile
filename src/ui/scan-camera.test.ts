import { describe, it, expect, vi } from 'vitest';
import { isBackCamera, nextCamera, openScanCamera } from './scan-camera';

// A phone as the browser sees it: each camera has an id, a label and maybe a flash.
function phone(cams: { id: string; label: string; torch?: boolean }[], defaultId: string) {
	const open = vi.fn(async (video: MediaTrackConstraints) => {
		const want = (video.deviceId as { exact?: string } | undefined)?.exact ?? defaultId;
		const cam = cams.find((c) => c.id === want);
		if (!cam) throw new DOMException('gone', 'NotFoundError');
		const track = {
			getCapabilities: () => ({ torch: !!cam.torch }),
			getSettings: () => ({ deviceId: cam.id }),
			stop: vi.fn(),
		};
		return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
	});
	const list = async () => cams.map((c) => ({ kind: 'videoinput', deviceId: c.id, label: c.label }) as MediaDeviceInfo);
	const idOf = (s: MediaStream) => s.getVideoTracks()[0].getSettings().deviceId;
	return { open, list, idOf };
}

const CAMS = [
	{ id: 'main', label: 'camera2 0, facing back', torch: true },
	{ id: 'front', label: 'camera2 1, facing front' },
	{ id: 'tele', label: 'camera2 2, facing back' },
	{ id: 'wide', label: 'camera2 3, facing back' },
];

describe('scan camera', () => {
	it('keeps the default back camera when it drives the flash', async () => {
		const p = phone(CAMS, 'main');
		expect(p.idOf(await openScanCamera(null, p.open, p.list))).toBe('main');
		expect(p.open).toHaveBeenCalledTimes(1);
	});

	it('moves off a telephoto to the back camera with the flash', async () => {
		const p = phone(CAMS, 'tele');
		expect(p.idOf(await openScanCamera(null, p.open, p.list))).toBe('main');
	});

	it('goes back to the default when no back camera has a flash', async () => {
		const p = phone(CAMS.map((c) => ({ ...c, torch: false })), 'tele');
		expect(p.idOf(await openScanCamera(null, p.open, p.list))).toBe('tele');
	});

	it('opens the camera the operator chose, even without a flash', async () => {
		const p = phone(CAMS, 'main');
		expect(p.idOf(await openScanCamera('wide', p.open, p.list))).toBe('wide');
	});

	it('picks again when the chosen camera is gone', async () => {
		const p = phone(CAMS, 'tele');
		expect(p.idOf(await openScanCamera('usb-cam', p.open, p.list))).toBe('main');
	});

	it('recognises back cameras by their label', () => {
		expect(isBackCamera('camera2 0, facing back')).toBe(true);
		expect(isBackCamera('Back Triple Camera')).toBe(true);
		expect(isBackCamera('Rear camera')).toBe(true);
		expect(isBackCamera('camera2 1, facing front')).toBe(false);
	});

	it('cycles through the cameras for the switch button', () => {
		const cams = [{ deviceId: 'a' }, { deviceId: 'b' }, { deviceId: 'c' }];
		expect(nextCamera(cams, 'a')).toBe('b');
		expect(nextCamera(cams, 'c')).toBe('a');
		expect(nextCamera(cams, null)).toBe('a');
		expect(nextCamera([{ deviceId: 'a' }], 'a')).toBeNull();
	});
});
