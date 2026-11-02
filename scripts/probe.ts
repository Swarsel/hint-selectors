import { stripTypeScriptTypes } from "node:module";
import { match_pattern_regex } from "../src/resolve.ts";
import { read_site_files, resolve_source, type Site } from "./sites.ts";

const domain = process.argv[2];
const site = (await read_site_files())
  .map(({ json }) => json as Site)
  .find((candidate) => candidate.domain === domain);

if (!site) {
  console.error("usage: npm run probe <domain>  (a domain with a file in sites/)");
  process.exit(1);
}

function probe(rules: Site["rules"]) {
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

  const url = location.href.split("#")[0]!;
  const rows: Array<Record<string, unknown>> = [];
  rules.forEach((rule, index) => {
    const applies =
      !rule.match || rule.match.some((pattern) => match_pattern_regex(pattern).test(url));
    const fields = [
      ["include", rule.include],
      ...Object.entries(rule.sets ?? {}).map(([name, selector]) => [`sets.${name}`, selector]),
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    for (const [field, list] of fields) {
      for (const selector of list.split(/,(?![^(]*\))/).map((part) => part.trim())) {
        const elements = matching(selector);
        for (const element of elements) {
          (element as HTMLElement).style.outline = "2px solid magenta";
        }
        rows.push({ rule: index, applies, field, selector, matches: elements.length });
      }
    }
  });
  console.table(rows);
}

const snippet = stripTypeScriptTypes(
  `{\n${await resolve_source()}\n(${probe.toString()})(${JSON.stringify(site.rules)});\n}`,
);
console.error(
  `Open a ${site.domain} page, paste this into the devtools console and check the table:\n`,
);
console.log(snippet);
