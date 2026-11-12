export const SET_NAMES = ["primary"] as const;

export type SetName = (typeof SET_NAMES)[number];

export type Rule = {
  match?: string[];
  include?: string;
  exclude?: string;
  sets?: Partial<Record<SetName, string>>;
};

export type Sites = Record<string, Rule[]>;

export type Dataset = { format: 1; sites: Sites };

export type Resolved = {
  include?: string;
  exclude?: string;
  sets: Partial<Record<SetName, string>>;
};

const MATCH_PATTERN = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*:]+)(\/.*)$/;

function escape_regex(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

export function parse_match_pattern(pattern: string): {
  scheme: string;
  host: string;
  path: string;
} {
  const parts = MATCH_PATTERN.exec(pattern);
  if (!parts) {
    throw new Error(`invalid match pattern: ${pattern}`);
  }
  return { scheme: parts[1]!, host: parts[2]!, path: parts[3]! };
}

export function match_pattern_regex(pattern: string): RegExp {
  const { scheme, host, path } = parse_match_pattern(pattern);
  const host_regex =
    host === "*"
      ? "[^/:]+"
      : host.startsWith("*.")
        ? `(?:[^/:]+\\.)?${escape_regex(host.slice(2))}`
        : escape_regex(host);
  return new RegExp(
    `^${scheme === "*" ? "https?" : scheme}://${host_regex}(?::\\d+)?${path.split("*").map(escape_regex).join(".*")}$`,
    "i",
  );
}

export function host_in_domain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function merge_sites(base: Sites, extra: Sites): Sites {
  const merged = { ...base };
  for (const [domain, rules] of Object.entries(extra)) {
    merged[domain] = [...(merged[domain] ?? []), ...rules];
  }
  return merged;
}

export function resolve(sites: Sites, url: string): Resolved | null {
  const target = URL.parse(url);
  if (!target || !["http:", "https:"].includes(target.protocol)) {
    return null;
  }
  target.hash = "";
  const include: string[] = [];
  const exclude: string[] = [];
  const sets: Partial<Record<SetName, string[]>> = {};
  let matched = false;
  for (const [domain, rules] of Object.entries(sites)) {
    if (!host_in_domain(target.hostname, domain)) {
      continue;
    }
    for (const rule of rules) {
      if (
        rule.match &&
        !rule.match.some((pattern) => match_pattern_regex(pattern).test(target.href))
      ) {
        continue;
      }
      matched = true;
      if (rule.include) {
        include.push(rule.include);
      }
      if (rule.exclude) {
        exclude.push(rule.exclude);
      }
      for (const name of SET_NAMES) {
        const selector = rule.sets?.[name];
        if (selector) {
          (sets[name] ??= []).push(selector);
        }
      }
    }
  }
  if (!matched) {
    return null;
  }
  const resolved: Resolved = {
    sets: Object.fromEntries(
      Object.entries(sets).map(([name, selectors]) => [name, selectors.join(", ")]),
    ),
  };
  if (include.length > 0) {
    resolved.include = include.join(", ");
  }
  if (exclude.length > 0) {
    resolved.exclude = exclude.join(", ");
  }
  return resolved;
}

export type HintInfo = { hidden: boolean; href: string | null; text: boolean };

export type Duplicates = "drop-duplicates" | "keep-duplicates";

function is_navigation(href: string): boolean {
  return !href.startsWith("javascript:") && !href.endsWith("#");
}

export function filter_hints(infos: HintInfo[], duplicates: Duplicates): boolean[] {
  const linked_by_text = new Set<string>();
  if (duplicates === "drop-duplicates") {
    for (const { hidden, href, text } of infos) {
      if (!hidden && text && href && is_navigation(href)) {
        linked_by_text.add(href);
      }
    }
  }
  return infos.map(
    ({ hidden, href, text }) => !hidden && !(href !== null && !text && linked_by_text.has(href)),
  );
}
