import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "css-what";
import { host_in_domain, parse_match_pattern, SET_NAMES } from "../src/resolve.ts";
import { read_site_files, ROOT, type Site } from "./sites.ts";

const schema = JSON.parse(await readFile(join(ROOT, "schema", "site.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true }).compile<Site>(schema);
const errors: string[] = [];

function check_selector(file: string, where: string, selector: string) {
  try {
    parse(selector);
  } catch (err) {
    errors.push(`${file}: ${where}: invalid selector: ${(err as Error).message}`);
  }
}

for (const { file, json } of await read_site_files()) {
  if (!validate(json)) {
    for (const error of validate.errors ?? []) {
      errors.push(`${file}: ${error.instancePath || "/"} ${error.message}`);
    }
    continue;
  }
  if (file !== `${json.domain}.json`) {
    errors.push(`${file}: file name must be ${json.domain}.json`);
  }
  json.rules.forEach((rule, index) => {
    const where = `/rules/${index}`;
    for (const pattern of rule.match ?? []) {
      const { host } = parse_match_pattern(pattern);
      if (!host_in_domain(host.replace(/^\*\./, ""), json.domain)) {
        errors.push(`${file}: ${where}/match: ${pattern} is outside ${json.domain}`);
      }
    }
    if (rule.include) {
      check_selector(file, `${where}/include`, rule.include);
    }
    for (const name of SET_NAMES) {
      const selector = rule.sets?.[name];
      if (selector) {
        check_selector(file, `${where}/sets/${name}`, selector);
      }
    }
  });
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("all site files are valid");
