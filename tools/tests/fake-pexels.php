<?php
// A stand-in for the Pexels API, so the throttling path is exercised against a server that really
// answers 429 with the real headers, rather than against a mock that agrees with me.
//
// /v1/search  -> 3 photos, quota headers, and 429 once $BUDGET searches have been served
// /photo.jpg  -> a real one-pixel JPEG
// /count      -> how many search requests have arrived

$counter = sys_get_temp_dir().'/fake-pexels-count';
$budget = 2;

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/count') {
	echo (int)@file_get_contents($counter);
	exit;
}

if ($path === '/photo.jpg') {
	// Smallest valid JPEG.
	header('Content-Type: image/jpeg');
	echo base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
		.'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAA'
		.'Cf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==');
	// Distinct bytes per photo, after the end marker so it is still a valid JPEG, so a test can
	// tell whether three views really picked three different photographs.
	echo str_repeat("\x00", 1 + (int)($_GET['i'] ?? 0));
	exit;
}

if ($path === '/v1/search') {
	$n = (int)@file_get_contents($counter) + 1;
	file_put_contents($counter, (string)$n);

	// As the real API does it: Limit/Remaining are the MONTHLY 20,000 and Reset is the monthly
	// rollover. The 200-an-hour cap is not described by any header, so a 429 can arrive with
	// plenty of monthly allowance left. That is the case worth reproducing.
	header('X-Ratelimit-Limit: 20000');
	header('X-Ratelimit-Remaining: 19995');
	header('X-Ratelimit-Reset: '.(time() + 14 * 86400));

	if ($n > $budget) {
		http_response_code(429);
		echo '{"error":"rate limited"}';
		exit;
	}

	$base = 'http://'.$_SERVER['HTTP_HOST'].'/photo.jpg';
	$photos = [];
	for ($i = 0; $i < 3; $i++) {
		$photos[] = [
			'id' => $i,
			'alt' => 'photo '.$i.' for '.($_GET['query'] ?? ''),
			'photographer' => 'Someone '.$i,
			'url' => 'https://example.com/photo/'.$i,
			'src' => ['large2x' => $base.'?i='.$i, 'large' => $base.'?i='.$i],
		];
	}
	header('Content-Type: application/json');
	echo json_encode(['photos' => $photos]);
	exit;
}

http_response_code(404);
