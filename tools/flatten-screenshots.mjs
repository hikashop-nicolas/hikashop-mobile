// Cypress nests its screenshots one folder per spec. The README links to plain paths, so lift
// them out and drop the folder.
import { readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = 'docs/screenshots';
if (!existsSync(root)) process.exit(0);

for (const entry of readdirSync(root, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const dir = join(root, entry.name);
	for (const file of readdirSync(dir)) renameSync(join(dir, file), join(root, file));
	rmSync(dir, { recursive: true, force: true });
}
