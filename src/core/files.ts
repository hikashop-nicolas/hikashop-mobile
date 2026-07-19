// Read a File as a data URL (base64) for JSON upload to the connector.
export function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = () => reject(new Error('read'));
		r.readAsDataURL(file);
	});
}
