import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Dataset, Rule } from "../src/resolve.ts";

export const ROOT = join(import.meta.dirname, "..");
export const SITES_DIR = join(ROOT, "sites");

export type SiteFile = { file: string; json: unknown };

export type Site = { domain: string; rules: Rule[] };

export async function read_site_files(): Promise<SiteFile[]> {
  const files = (await readdir(SITES_DIR)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      json: JSON.parse(await readFile(join(SITES_DIR, file), "utf8")),
    })),
  );
}

export function to_dataset(sites: Site[]): Dataset {
  return {
    format: 1,
    sites: Object.fromEntries(
      [...sites]
        .sort((a, b) => a.domain.localeCompare(b.domain))
        .map(({ domain, rules }) => [domain, rules]),
    ),
  };
}
