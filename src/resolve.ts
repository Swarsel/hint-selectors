export type SetName = "primary";

export type Rule = {
  match?: string[];
  include?: string;
  sets?: Partial<Record<SetName, string>>;
};

export type Sites = Record<string, Rule[]>;

export type Dataset = { format: 1; sites: Sites };

export type Resolved = {
  include?: string;
  sets: Partial<Record<SetName, string>>;
};

export const SET_NAMES: SetName[] = ["primary"];

const MATCH_PATTERN = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*:]+)(\/.*)$/;

const pattern_cache = new Map<string, RegExp>();

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
  const cached = pattern_cache.get(pattern);
  if (cached) {
    return cached;
  }
  const { scheme, host, path } = parse_match_pattern(pattern);
  const host_regex =
    host === "*"
      ? "[^/:]+"
      : host.startsWith("*.")
        ? `(?:[^/:]+\\.)?${escape_regex(host.slice(2))}`
        : escape_regex(host);
  const regex = new RegExp(
    `^${scheme === "*" ? "https?" : scheme}://${host_regex}(?::\\d+)?${path.split("*").map(escape_regex).join(".*")}$`,
    "i",
  );
  pattern_cache.set(pattern, regex);
  return regex;
}

export function host_in_domain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function merge_sites(...all: Sites[]): Sites {
  const merged: Sites = {};
  for (const sites of all) {
    for (const [domain, rules] of Object.entries(sites)) {
      merged[domain] = [...(merged[domain] ?? []), ...rules];
    }
  }
  return merged;
}

export function resolve(sites: Sites, url: string): Resolved | null {
  const parts = /^(https?:\/\/)(?:[^@/?#]*@)?([^/:?#]+)/i.exec(url);
  if (!parts) {
    return null;
  }
  const host = parts[2]!.toLowerCase();
  const target = url.split("#")[0]!;
  const include: string[] = [];
  const sets: Partial<Record<SetName, string[]>> = {};
  let matched = false;
  for (const [domain, rules] of Object.entries(sites)) {
    if (!host_in_domain(host, domain)) {
      continue;
    }
    for (const rule of rules) {
      if (rule.match && !rule.match.some((pattern) => match_pattern_regex(pattern).test(target))) {
        continue;
      }
      matched = true;
      if (rule.include) {
        include.push(rule.include);
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
  return {
    include: include.length > 0 ? include.join(", ") : undefined,
    sets: Object.fromEntries(
      Object.entries(sets).map(([name, selectors]) => [name, selectors.join(", ")]),
    ),
  };
}
