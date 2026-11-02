import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { read_site_files, resolve_source, ROOT, to_dataset, type Site } from "./sites.ts";

const DIST = join(ROOT, "dist");

function replace_once(text: string, search: RegExp | string, replacement: string): string {
  const found = typeof search === "string" ? search : search.exec(text)?.[0];
  const index = found === undefined ? -1 : text.indexOf(found);
  if (found === undefined || index === -1 || text.indexOf(found, index + 1) !== -1) {
    throw new Error(`expected exactly one occurrence of: ${search}`);
  }
  return text.slice(0, index) + replacement + text.slice(index + found.length);
}

const dataset = to_dataset((await read_site_files()).map(({ json }) => json as Site));
const template = await readFile(
  join(ROOT, "integrations", "glide", "hint-selectors.glide.ts"),
  "utf8",
);

const glide_integration = replace_once(
  replace_once(
    template,
    /^import [^;]+ from "\.\.\/\.\.\/src\/resolve\.ts";\n/m,
    `${await resolve_source()}\n`,
  ),
  "const BUNDLED: Dataset = { format: 1, sites: {} };",
  `const BUNDLED: Dataset = ${JSON.stringify(dataset)};`,
);

await mkdir(DIST, { recursive: true });
await writeFile(join(DIST, "selectors.json"), `${JSON.stringify(dataset, null, 2)}\n`);
await writeFile(join(DIST, "hint-selectors.glide.ts"), glide_integration);
console.log(`built ${Object.keys(dataset.sites).length} sites into ${DIST}`);
