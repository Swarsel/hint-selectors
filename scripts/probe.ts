import { stripTypeScriptTypes } from "node:module";
import { parse, stringify } from "css-what";
import { match_pattern_regex } from "../src/resolve.ts";
import { read_site_files, resolve_source, type Site } from "./sites.ts";

type Field = { rule: number; match?: string[]; field: string; selectors: string[] };

const domain = process.argv[2];
const site = (await read_site_files())
  .map(({ json }) => json as Site)
  .find((candidate) => candidate.domain === domain);

if (!site) {
  console.error("usage: npm run probe <domain>  (a domain with a file in sites/)");
  process.exit(1);
}

const fields: Field[] = site.rules.flatMap((rule, index) =>
  [
    ["include", rule.include],
    ["exclude", rule.exclude],
    ...Object.entries(rule.sets ?? {}).map(([name, selector]) => [`sets.${name}`, selector]),
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([field, list]) => ({
      rule: index,
      match: rule.match,
      field,
      selectors: parse(list).map((selector) => stringify([selector])),
    })),
);

function probe(fields: Field[]) {
  function matching(selector: string): Element[] {
    const found: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const element of root.querySelectorAll("*")) {
        if (element.matches(selector)) {
          found.push(element);
        }
        if (element.shadowRoot) {
          walk(element.shadowRoot);
        }
      }
    };
    walk(document);
    return found;
  }

  const url = new URL(location.href);
  url.hash = "";
  const rows: Array<Record<string, unknown>> = [];
  for (const { rule, match, field, selectors } of fields) {
    const applies = !match || match.some((pattern) => match_pattern_regex(pattern).test(url.href));
    for (const selector of selectors) {
      const elements = matching(selector);
      for (const element of elements) {
        (element as HTMLElement).style.outline =
          field === "exclude" ? "2px dashed red" : "2px solid magenta";
      }
      rows.push({ rule, applies, field, selector, matches: elements.length });
    }
  }
  console.table(rows);
}

const snippet = stripTypeScriptTypes(
  `{\n${await resolve_source()}\n(${probe.toString()})(${JSON.stringify(fields)});\n}`,
);
console.error(
  `Open a ${site.domain} page, paste this into the devtools console and check the table:\n`,
);
console.log(snippet);
