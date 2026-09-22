// Which camera to scan with. facingMode 'environment' lets a phone with several back lenses hand
// over its telephoto, which cannot focus on a barcode held close. The main lens is the one that
// drives the flash, so the pick prefers that one, and the operator's own choice beats both.

const CAMERA_KEY = 'hk.scan.camera';

export function savedCamera(): string | null {
	try {
		return localStorage.getItem(CAMERA_KEY);
	} catch {
		return null;
	}
}

export function saveCamera(deviceId: string): void {
	try {
		localStorage.setItem(CAMERA_KEY, deviceId);
	} catch {
		// a convenience only: without storage the pick simply runs again next time
	}
}

export function hasTorch(track: MediaStreamTrack): boolean {
	const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
	return !!caps?.torch;
}

// Android names its cameras "camera2 0, facing back"; other systems say rear or environment.
export function isBackCamera(label: string): boolean {
	return /back|rear|environment/i.test(label);
}

export function stopStream(stream: MediaStream): void {
	stream.getTracks().forEach((t) => t.stop());
}

type Open = (video: MediaTrackConstraints) => Promise<MediaStream>;

const byId = (deviceId: string): MediaTrackConstraints => ({ deviceId: { exact: deviceId } });

export async function openScanCamera(
	deviceId: string | null,
	open: Open = (video) => navigator.mediaDevices.getUserMedia({ video }),
	listDevices: () => Promise<MediaDeviceInfo[]> = () => navigator.mediaDevices.enumerateDevices(),
): Promise<MediaStream> {
	if (deviceId) {
		try {
			return await open(byId(deviceId));
		} catch {
			// that camera is gone, pick again
		}
	}
	const first = await open({ facingMode: 'environment' });
	const track = first.getVideoTracks()[0];
	if (!track || hasTorch(track)) return first;

	const firstId = track.getSettings().deviceId;
	const others = (await listDevices()).filter(
		(d) => d.kind === 'videoinput' && d.deviceId !== firstId && isBackCamera(d.label),
	);
	if (!others.length || !firstId) return first;

	// Many phones cannot open two cameras at once, so the first one is closed while probing.
	stopStream(first);
	for (const d of others) {
		let s: MediaStream;
		try {
			s = await open(byId(d.deviceId));
		} catch {
			continue;
		}
		const t = s.getVideoTracks()[0];
		if (t && hasTorch(t)) return s;
		stopStream(s);
	}
	return open(byId(firstId));
}

// The next camera in the system's list after the one in use, for the switch button.
export function nextCamera(cameras: { deviceId: string }[], activeId: string | null): string | null {
	if (cameras.length < 2) return null;
	const i = cameras.findIndex((c) => c.deviceId === activeId);
	return cameras[(i + 1) % cameras.length].deviceId;
}
