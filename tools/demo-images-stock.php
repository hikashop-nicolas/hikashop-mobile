<?php
/**
 * Product photographs from Pexels.
 *
 * Real photographs beat generated ones for a screenshot, they cost nothing, and the Pexels licence
 * explicitly allows using them as part of a template you distribute -- which is the case that rules
 * out paid stock, where shipping an image inside something end users install needs an Extended
 * licence at roughly $80 an image.
 *
 * Two things it cannot do, which is why it does not replace the other two sources:
 *
 *   Colours. The point of a variant image is the SAME boot in seven colours, so the frontend swaps
 *   the photo when a customer picks one. A search gives seven different boots. So this returns null
 *   for anything with a colour and lets the caller fall through to the model, which can hold a
 *   product's identity across a palette.
 *
 *   Ambiguous names. "Shoe Trees" returns shoes hanging from trees in a forest. Searching is only
 *   as good as the word, so a theme can name a better query per thing, and every pick is written to
 *   a contact sheet so the bad ones can be found by looking once rather than by noticing later in a
 *   screenshot.
 */

final class DemoImagesStock
{
	private const ENDPOINT = 'https://api.pexels.com/v1/search';

	private string $apiKey;
	private string $cacheDir;
	private int $timeout;

	/** query => the API's photo list, so several views of one thing cost one call. */
	private array $results = [];

	/** What was chosen for what, for the contact sheet and for crediting photographers. */
	public array $picks = [];

	public array $stats = ['fetched' => 0, 'cached' => 0, 'missed' => 0, 'skipped' => 0];

	public function __construct(string $apiKey, string $cacheDir = '', int $timeout = 30)
	{
		$this->apiKey = $apiKey;
		$this->cacheDir = $cacheDir !== '' ? rtrim($cacheDir, '/') : __DIR__.'/cache/stock';
		$this->timeout = $timeout;
		if (!is_dir($this->cacheDir)) @mkdir($this->cacheDir, 0775, true);
	}

	/** Does the key work? Checked once, so 48 lookups do not each discover it does not. */
	public function reachable(): bool
	{
		if ($this->apiKey === '') return false;
		[$raw, $code] = $this->get(self::ENDPOINT.'?query=shoe&per_page=1');
		return $raw !== false && $code === 200;
	}

	/**
	 * JPEG bytes for one kind of product, or null if stock cannot serve this one.
	 *
	 * $query lets a theme override the search where the product's own name is ambiguous. $view
	 * picks a different photo from the same search, which is what the thumbnail slider wants: a
	 * second angle on the same kind of thing rather than the same picture twice.
	 */
	public function imageFor(string $department, string $thing, ?string $colour = null, string $view = 'front', ?string $query = null): ?string
	{
		// A colour needs the same product recoloured, which a search cannot do. Say so and let the
		// caller try the model instead of returning a different boot and calling it a variant.
		if ($colour !== null && $colour !== '') {
			$this->stats['skipped']++;
			return null;
		}

		$search = $query !== null && $query !== '' ? $query : $thing;
		$index = $this->indexFor($view);

		$cacheFile = $this->cacheDir.'/'.sha1(strtolower($search)).'-'.$index.'.jpg';
		if (is_file($cacheFile) && filesize($cacheFile) > 0) {
			$this->stats['cached']++;
			$this->note($search, $index, $department, $thing, $cacheFile);
			return file_get_contents($cacheFile);
		}

		$photos = $this->search($search);
		if (!isset($photos[$index])) {
			$this->stats['missed']++;
			return null;
		}

		$photo = $photos[$index];
		// "large" is around 940px wide, comfortably above the 800px the seeder writes and far
		// smaller than the original, which can be 6000px of nothing useful.
		$url = $photo['src']['large'] ?? $photo['src']['medium'] ?? $photo['src']['original'] ?? null;
		if (!is_string($url)) {
			$this->stats['missed']++;
			return null;
		}

		[$bytes, $code] = $this->get($url, false);
		if ($bytes === false || $code < 200 || $code >= 300 || !$this->looksLikeImage((string)$bytes)) {
			$this->stats['missed']++;
			return null;
		}

		@file_put_contents($cacheFile, $bytes);
		$this->stats['fetched']++;
		$this->note($search, $index, $department, $thing, $cacheFile, $photo);
		return (string)$bytes;
	}

	/**
	 * A view maps to a stable slot in the results, so a re-run picks the same photographs and a
	 * product's second image is a different photograph from its first.
	 *
	 * The views are a closed set, so this is a list rather than a hash: hashing collided, and three
	 * views landing on one result put the same picture in the slider twice.
	 */
	private const VIEWS = ['front', 'three-quarter view', 'detail'];

	private function indexFor(string $view): int
	{
		$at = array_search($view, self::VIEWS, true);
		return $at !== false ? (int)$at : count(self::VIEWS);
	}

	private function search(string $query): array
	{
		$key = strtolower($query);
		if (isset($this->results[$key])) return $this->results[$key];

		// Square-ish photographs sit better in a grid of thumbnails than landscape ones do.
		$url = self::ENDPOINT.'?'.http_build_query([
			'query' => $query,
			'per_page' => 10,
			'orientation' => 'square',
		]);
		[$raw, $code] = $this->get($url);
		$photos = [];
		if ($raw !== false && $code === 200) {
			$json = json_decode((string)$raw, true);
			if (is_array($json['photos'] ?? null)) $photos = $json['photos'];
		}
		// A square-only search comes up empty on narrow terms; widen rather than give up on it.
		if (!$photos) {
			[$raw, $code] = $this->get(self::ENDPOINT.'?'.http_build_query(['query' => $query, 'per_page' => 10]));
			if ($raw !== false && $code === 200) {
				$json = json_decode((string)$raw, true);
				if (is_array($json['photos'] ?? null)) $photos = $json['photos'];
			}
		}

		return $this->results[$key] = $photos;
	}

	/** Pexels wants the key bare in Authorization, without a Bearer prefix. */
	private function get(string $url, bool $authenticated = true): array
	{
		$ch = curl_init($url);
		curl_setopt_array($ch, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_TIMEOUT => $this->timeout,
			CURLOPT_FOLLOWLOCATION => true,
			CURLOPT_HTTPHEADER => $authenticated ? ['Authorization: '.$this->apiKey] : [],
		]);
		$raw = curl_exec($ch);
		return [$raw, (int)curl_getinfo($ch, CURLINFO_HTTP_CODE)];
	}

	private function note(string $search, int $index, string $department, string $thing, string $file, ?array $photo = null): void
	{
		$this->picks[$search.'#'.$index] = [
			'query' => $search,
			'index' => $index,
			'department' => $department,
			'thing' => $thing,
			'file' => $file,
			'alt' => $photo['alt'] ?? ($this->picks[$search.'#'.$index]['alt'] ?? ''),
			'photographer' => $photo['photographer'] ?? ($this->picks[$search.'#'.$index]['photographer'] ?? ''),
			'url' => $photo['url'] ?? ($this->picks[$search.'#'.$index]['url'] ?? ''),
		];
	}

	/**
	 * One page showing every photograph that was chosen, next to the query that chose it.
	 *
	 * This is the answer to searching being only as good as the word: 48 pictures on one screen,
	 * so a wrong one is obvious in the time it takes to scroll, and the fix is a 'stock' key in the
	 * theme rather than a discovery made later in a screenshot.
	 */
	public function writeContactSheet(string $path): bool
	{
		if (!$this->picks) return false;
		$rows = '';
		foreach ($this->picks as $pick) {
			$rows .= sprintf(
				'<figure><img src="%s" alt=""><figcaption><b>%s</b><span>%s</span>'
				.'<span>%s</span><small>%s</small></figcaption></figure>',
				htmlspecialchars('file://'.$pick['file'], ENT_QUOTES),
				htmlspecialchars($pick['query'].($pick['index'] ? ' #'.$pick['index'] : ''), ENT_QUOTES),
				htmlspecialchars($pick['thing'].' · '.$pick['department'], ENT_QUOTES),
				htmlspecialchars((string)$pick['alt'], ENT_QUOTES),
				htmlspecialchars($pick['photographer'] !== '' ? 'Photo: '.$pick['photographer'].' / Pexels' : '', ENT_QUOTES)
			);
		}
		$html = '<!doctype html><meta charset="utf-8"><title>Stock picks</title><style>'
			.'body{font:14px/1.4 system-ui,sans-serif;margin:2rem;background:#faf9f7;color:#22201d}'
			.'h1{font-size:1.2rem;font-weight:600}p{color:#6b6660;max-width:60ch}'
			.'div{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.5rem;margin-top:2rem}'
			.'figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#e8e4de}'
			.'figcaption{display:flex;flex-direction:column;gap:.15rem;margin-top:.5rem}'
			.'span{color:#6b6660}small{color:#948f88}</style>'
			.'<h1>What stock chose, and for what</h1>'
			.'<p>Anything that does not look like the product it is under wants a <code>stock</code> '
			.'key on that thing in its theme file, naming a better search.</p>'
			.'<div>'.$rows.'</div>';
		return @file_put_contents($path, $html) !== false;
	}

	private function looksLikeImage(string $bytes): bool
	{
		if (strlen($bytes) < 100) return false;
		return str_starts_with($bytes, "\xFF\xD8\xFF")            // jpeg
			|| str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
			|| str_starts_with($bytes, 'RIFF');                    // webp
	}
}
