#!/bin/sh
# Exercise the Pexels source against a server that really answers, including a real 429.
#
# Worth having a harness for: this is network code whose failure mode is silent. Every way it can
# go wrong -- no key, a bad word, a spent quota -- ends in the same drawn tile, so a bug here looks
# like a shop that simply has no photographs. The fake server is what makes the difference between
# those cases observable.
#
#   sh tools/tests/run-stock-test.sh
set -e
cd "$(dirname "$0")"

php -S 127.0.0.1:8099 fake-pexels.php >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT

# Wait for it rather than sleeping a guessed amount.
i=0
while [ $i -lt 40 ]; do
	if curl -sf http://127.0.0.1:8099/count >/dev/null 2>&1; then break; fi
	i=$((i + 1))
done

php stock-test.php
