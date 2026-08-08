<?php
/**
 * Store an API key for the seeder, without it passing through anything that keeps a record.
 *
 * Run this yourself in a terminal. It reads the key with the echo turned off, so it is not shown,
 * not in the shell history, and not in the command line other processes can see through ps. The
 * key is never an argument to this script for that last reason.
 *
 *   php tools/set-api-key.php pexels
 *   php tools/set-api-key.php image        # the OpenAI-compatible image endpoint
 *
 * It lands in tools/.keys/<name>, readable only by you, and git-ignored. The seeder prefers the
 * matching environment variable if one is set, so CI can supply it that way instead.
 */

$keys = [
	'pexels' => ['env' => 'PEXELS_API_KEY', 'what' => 'Pexels API key', 'where' => 'https://www.pexels.com/api/'],
	'image'  => ['env' => 'DEMO_IMAGE_API_KEY', 'what' => 'image endpoint API key', 'where' => 'Together, fal, OpenAI, …'],
];

$name = $argv[1] ?? '';
if (!isset($keys[$name])) {
	fwrite(STDERR, "usage: php tools/set-api-key.php <".implode('|', array_keys($keys)).">\n");
	exit(1);
}

$dir = __DIR__.'/.keys';
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
	fwrite(STDERR, "cannot create $dir\n");
	exit(1);
}
@chmod($dir, 0700);

echo $keys[$name]['what'].' ('.$keys[$name]['where'].")\n";
echo "paste it and press return; it will not be shown: ";

// Turn off the terminal echo so the key is never displayed. Restore it whatever happens, or the
// terminal is left silently swallowing everything the user types afterwards.
$wasTty = stream_isatty(STDIN);
$stty = $wasTty ? shell_exec('stty -g 2>/dev/null') : null;
if ($wasTty && $stty !== null) shell_exec('stty -echo 2>/dev/null');
register_shutdown_function(function () use ($wasTty, $stty) {
	if ($wasTty && $stty !== null) shell_exec('stty '.escapeshellarg(trim($stty)).' 2>/dev/null');
});

$key = trim((string)fgets(STDIN));
if ($wasTty && $stty !== null) shell_exec('stty '.escapeshellarg(trim($stty)).' 2>/dev/null');
echo "\n";

if ($key === '') {
	fwrite(STDERR, "nothing entered; no key stored\n");
	exit(1);
}

$file = $dir.'/'.$name;
if (@file_put_contents($file, $key) === false) {
	fwrite(STDERR, "cannot write $file\n");
	exit(1);
}
@chmod($file, 0600);

// Say whether it works, without ever repeating the key back.
if ($name === 'pexels') {
	require __DIR__.'/demo-images-stock.php';
	$stock = new DemoImagesStock($key);
	if ($stock->reachable()) {
		echo "stored in $file, and Pexels accepted it";
		$quota = $stock->quotaLine();
		echo $quota !== null ? " ($quota)\n" : "\n";
	} else {
		fwrite(STDERR, "stored in $file, but Pexels did not accept it\n");
		exit(1);
	}
} else {
	echo "stored in $file\n";
}

echo "the seeder will use it from there; nothing to export.\n";
