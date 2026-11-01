import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { read_site_files, ROOT, to_dataset, type Site } from "./sites.ts";

const DIST = join(ROOT, "dist");

const dataset = to_dataset((await read_site_files()).map(({ json }) => json as Site));

await mkdir(DIST, { recursive: true });
await writeFile(join(DIST, "selectors.json"), `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`built ${Object.keys(dataset.sites).length} sites into ${DIST}`);
