<?php
/**
 * Product photographs from an image model, through any OpenAI-compatible images endpoint.
 *
 * Written against LocalAI first, but the same three fields are what Together, fal and OpenAI
 * itself expect, so the endpoint is a URL and a key rather than a product. On this machine the
 * local route is not viable -- an Intel Mac gets no GPU acceleration, and a CPU image takes twelve
 * minutes -- so a hosted endpoint is the realistic one. The cache means it makes no difference
 * afterwards: images generated anywhere land in the same directory.
 *
 * This is the optional half of the seeder's imagery. The drawn tiles in demo-images.php cost
 * nothing and always work; these look like actual product shots, which is what you want when the
 * screenshot is going somewhere people will see it.
 *
 * Two things make it practical rather than an overnight job:
 *
 *   One image per THING, not per product. "Cast Iron Skillet — 24 cm" and "Copper Skillet — 26 cm"
 *   are the same photograph as far as a listing is concerned. That is 48 images for a 300-product
 *   shop rather than 300: minutes instead of hours on a CPU.
 *
 *   Cached on disk by prompt. A second run costs nothing, and the cache can be kept between
 *   machines if you want the same shop everywhere without regenerating.
 *
 * Anything that goes wrong -- no server, a slow model, an unexpected response -- falls back to the
 * drawn tile. A fixture script must not fail because an optional service is not running.
 */

final class DemoImagesAi
{
	private string $endpoint;
	private string $model;
	private string $cacheDir;
	private int $timeout;
	private int $size;
	private string $style;
	private string $apiKey;

	/** Which way this endpoint wants the dimensions: 'size', or 'wh'. Learned on the first call. */
	private ?string $dialect = null;

	public array $stats = ['generated' => 0, 'cached' => 0, 'failed' => 0];

	public function __construct(string $baseUrl, string $model = '', string $cacheDir = '', int $timeout = 180, int $size = 768, string $style = '', string $apiKey = '')
	{
		$this->style = $style !== '' ? $style : 'plain light background, soft studio lighting, centred, sharp focus, e-commerce catalogue photo';
		$this->endpoint = rtrim($baseUrl, '/').'/v1/images/generations';
		$this->model = $model;
		$this->cacheDir = $cacheDir !== '' ? rtrim($cacheDir, '/') : __DIR__.'/cache/images';
		$this->timeout = $timeout;
		$this->size = $size;
		$this->apiKey = $apiKey;
		if (!is_dir($this->cacheDir)) @mkdir($this->cacheDir, 0775, true);
	}

	/** Is anything answering at all? Checked once so 48 requests do not each wait for a timeout. */
	public function reachable(): bool
	{
		$base = preg_replace('#/v1/images/generations$#', '', $this->endpoint);
		$ch = curl_init($base.'/v1/models');
		curl_setopt_array($ch, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_TIMEOUT => 10,
			CURLOPT_FAILONERROR => false,
			CURLOPT_HTTPHEADER => $this->headers(),
		]);
		curl_exec($ch);
		$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
		return $code >= 200 && $code < 500 && $code !== 404;
	}

	/** The key never reaches a command line or this file; it comes from the environment. */
	private function headers(): array
	{
		$h = ['Content-Type: application/json'];
		if ($this->apiKey !== '') $h[] = 'Authorization: Bearer '.$this->apiKey;
		return $h;
	}

	/**
	 * PNG bytes for one kind of product, or null if the model could not supply them.
	 *
	 * The prompt describes a catalogue photograph rather than a scene, because a listing wants the
	 * object on a plain ground, and names what to avoid: a shop's own photographs do not have
	 * captions, watermarks or hands in them.
	 */
	public function imageFor(string $department, string $thing, ?string $colour = null, string $view = 'front'): ?string
	{
		// Kept short and concrete. A long prompt naming the department, the angle and a style
		// phrase made Stable Diffusion 1.5 produce an extreme close-up of a texture rather than
		// the object -- the first thing tried here came back as a blurry orange blob. Subject
		// first, ground second, and a short negative list reads far better.
		$subject = strtolower($thing);
		if ($colour !== null && $colour !== '') $subject = strtolower($colour).' '.$subject;
		$article = in_array(substr($subject, 0, 1), ['a', 'e', 'i', 'o', 'u'], true) ? 'an' : 'a';

		$prompt = sprintf(
			'%s %s on a plain white background, studio product photo%s|blurry, extreme close-up, '
			.'cropped, text, watermark, logo, people, hands, cluttered background',
			$article,
			$subject,
			$view === 'front' ? '' : ', '.$view
		);

		$cacheFile = $this->cacheDir.'/'.sha1($prompt.'|'.$this->model.'|'.$this->size).'.png';
		if (is_file($cacheFile) && filesize($cacheFile) > 0) {
			$this->stats['cached']++;
			return file_get_contents($cacheFile);
		}

		// The two dialects differ only in how they take the dimensions: OpenAI and LocalAI want
		// "size", Together and fal want width and height, and each rejects the other's field. So
		// try one, fall back to the other, and remember which answered.
		$order = $this->dialect !== null ? [$this->dialect] : ['size', 'wh'];
		$raw = false;
		$code = 0;
		foreach ($order as $dialect) {
			[$raw, $code] = $this->post($this->body($prompt, $dialect));
			if ($raw !== false && $code >= 200 && $code < 300) {
				$this->dialect = $dialect;
				break;
			}
		}

		if ($raw === false || $code < 200 || $code >= 300) {
			$this->stats['failed']++;
			return null;
		}

		$json = json_decode((string)$raw, true);
		$entry = $json['data'][0] ?? null;
		if (!is_array($entry)) {
			$this->stats['failed']++;
			return null;
		}

		$bytes = null;
		if (!empty($entry['b64_json'])) {
			$bytes = base64_decode($entry['b64_json'], true) ?: null;
		} elseif (!empty($entry['url'])) {
			$bytes = $this->fetch($this->absolute($entry['url']));
		}

		if ($bytes === null || $bytes === '' || !$this->looksLikeImage($bytes)) {
			$this->stats['failed']++;
			return null;
		}

		@file_put_contents($cacheFile, $bytes);
		$this->stats['generated']++;
		return $bytes;
	}

	private function body(string $prompt, string $dialect): array
	{
		$body = ['prompt' => $prompt, 'n' => 1];
		if ($this->model !== '') $body['model'] = $this->model;
		// Ask for the bytes directly. Some endpoints answer with a URL anyway, handled above.
		$body['response_format'] = 'b64_json';
		if ($dialect === 'wh') {
			$body['width'] = $this->size;
			$body['height'] = $this->size;
		} else {
			$body['size'] = $this->size.'x'.$this->size;
		}
		return $body;
	}

	/** @return array{0: string|false, 1: int} */
	private function post(array $body): array
	{
		$ch = curl_init($this->endpoint);
		curl_setopt_array($ch, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_POST => true,
			CURLOPT_HTTPHEADER => $this->headers(),
			CURLOPT_POSTFIELDS => json_encode($body),
			CURLOPT_TIMEOUT => $this->timeout,
		]);
		$raw = curl_exec($ch);
		return [$raw, (int)curl_getinfo($ch, CURLINFO_HTTP_CODE)];
	}

	/** LocalAI answers with a path under its own host, so make it absolute against the endpoint. */
	private function absolute(string $url): string
	{
		if (preg_match('#^https?://#i', $url)) return $url;
		$base = preg_replace('#/v1/images/generations$#', '', $this->endpoint);
		return $base.'/'.ltrim($url, '/');
	}

	private function fetch(string $url): ?string
	{
		$ch = curl_init($url);
		curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $this->timeout, CURLOPT_FOLLOWLOCATION => true]);
		$data = curl_exec($ch);
		$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
		return ($data !== false && $code >= 200 && $code < 300) ? $data : null;
	}

	/** A guard against writing an error page to disk as though it were a picture. */
	private function looksLikeImage(string $bytes): bool
	{
		if (strlen($bytes) < 100) return false;
		$png = "\x89PNG\r\n\x1a\n";
		return str_starts_with($bytes, $png)
			|| str_starts_with($bytes, "\xFF\xD8\xFF")            // jpeg
			|| str_starts_with($bytes, 'RIFF');                    // webp
	}
}
