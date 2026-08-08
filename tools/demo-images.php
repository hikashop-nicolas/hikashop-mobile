<?php
/**
 * Product images for the demo shop, drawn rather than downloaded.
 *
 * A management app's lists are mostly thumbnails, and a shop with none of them looks broken in a
 * screenshot. The images are generated here for three reasons: nothing has to be fetched, so the
 * seeder works offline and gives the same shop every time; there is no licence to honour, which
 * matters for pictures that end up in marketing screenshots; and nothing is added to the repo.
 *
 * They are deliberately abstract. A stock photo picked at random shows a beach for a cast iron
 * skillet, which reads as a mistake; a composition in the department's colours reads as a product
 * shot that has not been taken yet, which is what it is.
 *
 * Each department has its own palette, and each product varies within it by a hash of its name,
 * so a listing looks composed rather than uniform and the same product always gets the same
 * picture.
 */

final class DemoImages
{
	/** Palettes, one per department: a pair of related colours to run the background between. */
	private const PALETTES = [
		'Kitchen'      => [[0x2F, 0x4A, 0x5C], [0x8E, 0xB8, 0xC4]],
		'Clothing'     => [[0x4A, 0x3B, 0x52], [0xC3, 0xA5, 0xB4]],
		'Outdoor'      => [[0x25, 0x4B, 0x3A], [0x9C, 0xC0, 0x8F]],
		'Home'         => [[0x5C, 0x4A, 0x35], [0xD6, 0xBE, 0x9C]],
		'Stationery'   => [[0x33, 0x3E, 0x52], [0xA9, 0xB4, 0xC7]],
		'Coffee & Tea' => [[0x4A, 0x33, 0x28], [0xC9, 0xA1, 0x84]],
	];

	private const DEFAULT_PALETTE = [[0x3A, 0x3F, 0x45], [0xB0, 0xB6, 0xBD]];

	private int $size;
	private array $palettes;

	/** A theme brings its own palette per department; the defaults are the general store's. */
	public function __construct(int $size = 800, array $palettes = [])
	{
		$this->size = $size;
		$this->palettes = [];
		foreach ($palettes as $dept => $pair) {
			$from = self::hexToRgb($pair[0]);
			$to = self::hexToRgb($pair[1]);
			if ($from && $to) $this->palettes[$dept] = [$from, $to];
		}
		if (!$this->palettes) $this->palettes = self::PALETTES;
	}

	private static function hexToRgb(string $hex): ?array
	{
		$hex = ltrim($hex, '#');
		if (strlen($hex) !== 6 || !ctype_xdigit($hex)) return null;
		return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
	}

	private static function mix(array $a, array $b, float $t): array
	{
		return [
			(int)round($a[0] + ($b[0] - $a[0]) * $t),
			(int)round($a[1] + ($b[1] - $a[1]) * $t),
			(int)round($a[2] + ($b[2] - $a[2]) * $t),
		];
	}

	/**
	 * Draw one product's image and write it as a PNG. Returns the bytes written, or 0 on failure.
	 */
	public function write(string $path, string $department, string $seedText, ?string $tintHex = null): int
	{
		// Everything about the picture comes from the seed text, so it is stable across runs and
		// a second view or another colour of the same product differs from the first.
		mt_srand(crc32($seedText));

		[$from, $to] = $this->palettes[$department] ?? self::DEFAULT_PALETTE;
		// A variant's picture leans towards the colour it is sold in, so the swap is visible.
		if ($tintHex !== null) {
			$tint = self::hexToRgb($tintHex);
			if ($tint !== null) {
				$from = self::mix($from, $tint, 0.55);
				$to = self::mix($to, $tint, 0.35);
			}
		}
		$im = imagecreatetruecolor($this->size, $this->size);
		imagealphablending($im, true);

		$this->gradient($im, $from, $to);
		$this->composition($im, $from, $to);
		// A soft vignette stops the corners looking flat next to a white listing.
		$this->vignette($im);

		$ok = imagepng($im, $path, 6);
		return $ok && is_file($path) ? (int)filesize($path) : 0;
	}

	/** A diagonal wash between the palette's two colours. */
	private function gradient($im, array $from, array $to): void
	{
		$n = $this->size;
		for ($y = 0; $y < $n; $y++) {
			$t = $y / max(1, $n - 1);
			$c = imagecolorallocate($im,
				(int)round($from[0] + ($to[0] - $from[0]) * $t),
				(int)round($from[1] + ($to[1] - $from[1]) * $t),
				(int)round($from[2] + ($to[2] - $from[2]) * $t)
			);
			imageline($im, 0, $y, $n, $y, $c);
		}
	}

	/**
	 * A few large translucent shapes. Kept to circles and bars on purpose: anything more
	 * representational starts to look like it is trying to be the product and failing.
	 */
	private function composition($im, array $from, array $to): void
	{
		$n = $this->size;
		$light = [min(255, $to[0] + 40), min(255, $to[1] + 40), min(255, $to[2] + 40)];
		$dark = [max(0, $from[0] - 20), max(0, $from[1] - 20), max(0, $from[2] - 20)];

		$shapes = mt_rand(2, 4);
		for ($i = 0; $i < $shapes; $i++) {
			$useLight = (mt_rand(0, 1) === 1);
			$rgb = $useLight ? $light : $dark;
			// 127 is fully transparent in GD, 0 opaque.
			$alpha = mt_rand(88, 112);
			$colour = imagecolorallocatealpha($im, $rgb[0], $rgb[1], $rgb[2], $alpha);

			$cx = mt_rand((int)($n * 0.15), (int)($n * 0.85));
			$cy = mt_rand((int)($n * 0.15), (int)($n * 0.85));
			if (mt_rand(0, 2) === 0) {
				$w = mt_rand((int)($n * 0.12), (int)($n * 0.3));
				$h = mt_rand((int)($n * 0.45), (int)($n * 0.8));
				imagefilledrectangle($im, $cx - $w, (int)($cy - $h / 2), $cx + $w, (int)($cy + $h / 2), $colour);
			} else {
				$r = mt_rand((int)($n * 0.22), (int)($n * 0.52));
				imagefilledellipse($im, $cx, $cy, $r * 2, $r * 2, $colour);
			}
		}
	}

	/** Darkens the edges slightly, so a pale thumbnail still has an outline against white. */
	private function vignette($im): void
	{
		$n = $this->size;
		$edge = max(2, (int)($n * 0.012));
		$shade = imagecolorallocatealpha($im, 0, 0, 0, 105);
		for ($i = 0; $i < $edge; $i++) {
			imagerectangle($im, $i, $i, $n - 1 - $i, $n - 1 - $i, $shade);
		}
	}
}
