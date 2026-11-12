const SET_NAMES = ["primary"] as const;

type SetName = (typeof SET_NAMES)[number];

type Rule = {
  match?: string[];
  include?: string;
  exclude?: string;
  sets?: Partial<Record<SetName, string>>;
};

type Sites = Record<string, Rule[]>;

type Dataset = { format: 1; sites: Sites };

type Resolved = {
  include?: string;
  exclude?: string;
  sets: Partial<Record<SetName, string>>;
};

const MATCH_PATTERN = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*:]+)(\/.*)$/;

function escape_regex(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function parse_match_pattern(pattern: string): {
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

function match_pattern_regex(pattern: string): RegExp {
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

function host_in_domain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function merge_sites(base: Sites, extra: Sites): Sites {
  const merged = { ...base };
  for (const [domain, rules] of Object.entries(extra)) {
    merged[domain] = [...(merged[domain] ?? []), ...rules];
  }
  return merged;
}

function resolve(sites: Sites, url: string): Resolved | null {
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

type HintInfo = { hidden: boolean; href: string | null; text: boolean };

type Duplicates = "drop-duplicates" | "keep-duplicates";

function is_navigation(href: string): boolean {
  return !href.startsWith("javascript:") && !href.endsWith("#");
}

function filter_hints(infos: HintInfo[], duplicates: Duplicates): boolean[] {
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


const BUNDLED: Dataset = {"format":1,"sites":{"arxiv.org":[{"match":["*://arxiv.org/list/*"],"sets":{"primary":"dt a[title=\"Abstract\"], dt a[title=\"Download PDF\"]"}},{"match":["*://arxiv.org/search/*"],"sets":{"primary":".list-title a"}},{"match":["*://arxiv.org/abs/*"],"sets":{"primary":"a.abs-button"}}],"askubuntu.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"codeberg.org":[{"sets":{"primary":"#repo-files-table td.name a, a.issue-title, a.text.primary.name"}}],"crates.io":[{"sets":{"primary":".crate-spec a.name"}}],"docs.rs":[{"match":["*://docs.rs/releases/*"],"sets":{"primary":"a.release"}}],"duckduckgo.com":[{"sets":{"primary":"a[data-testid=\"result-title-a\"], a.result__a:not(.related-searches__link)"}}],"github.com":[{"sets":{"primary":".GlobalNav a, .GlobalNav button, .AppHeader-globalBar a, .AppHeader-globalBar button, dialog [class*=\"ActionListItem-label\"], [role=\"dialog\"] [class*=\"ActionListItem-label\"], [class*=\"ActionList-ItemLabel\"], [data-filterable-for=\"dashboard-repos-filter-left\"] a, a.Link--primary:not(.author):not(.assignee), [data-listview-item-title-container] a, [class*=\"TreeView-item-content-text\"], a[itemprop=\"name codeRepository\"], .pinned-item-list-item a.Link, .search-title a, .Box-row h2 a, h3.f3 a.text-bold, a.width-full[href*=\"/actions/runs/\"]"}}],"gitlab.com":[{"sets":{"primary":"a[data-testid=\"issuable-title-link\"], a[data-testid=\"file-name-link\"]"}}],"google.com":[{"match":["*://www.google.com/search*"],"sets":{"primary":"#search a:has(> h3), a.fl, #pnnext"}}],"haskell.org":[{"match":["*://hackage.haskell.org/*"],"sets":{"primary":"td a[href^=\"/package/\"]"}}],"lobste.rs":[{"sets":{"primary":"a.u-url, .comments_label > a, .morelink a, .comment .byline a[href^=\"/s/\"]"}}],"mathoverflow.net":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"nixos.org":[{"match":["*://search.nixos.org/*"],"include":".search-result-title a","sets":{"primary":".search-result-title a"}},{"match":["*://discourse.nixos.org/*"],"sets":{"primary":"a.raw-topic-link"}}],"reddit.com":[{"sets":{"primary":"a.title, a.bylink.comments, .tabmenu a, a[slot=\"title\"], a.post-link, a[data-testid=\"post-title\"]"}}],"serverfault.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"stackapps.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"stackexchange.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"stackoverflow.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"superuser.com":[{"sets":{"primary":".s-post-summary--content-title a, a.question-hyperlink"}}],"tildes.net":[{"sets":{"primary":".topic-title a, .topic-info-comments a"}}],"wikipedia.org":[{"match":["*://*.wikipedia.org/w/index.php*"],"sets":{"primary":".mw-search-result-heading a"}},{"match":["*://*.wikipedia.org/wiki/Category:*"],"sets":{"primary":"#mw-pages a, #mw-subcategories a"}}],"ycombinator.com":[{"match":["*://news.ycombinator.com/*"],"sets":{"primary":".titleline > a, .age > a, a.morelink"}}],"youtube.com":[{"sets":{"primary":"a#video-title-link, a#video-title, a.ytLockupMetadataViewModelTitle, a.shortsLockupViewModelHostOutsideMetadataEndpoint"}}]}};

type HintOptions = {
  selector?: string;
  include?: string;
  action?: glide.HintAction;
  pick?: glide.HintPicker;
};

type Refresh = "if-stale" | "force";

type HintSelectorsOptions = {
  keys?: {
    include?: Array<{ key: string; action?: glide.HintAction }>;
  } & Partial<Record<SetName, string>>;
  hint?: (opts: HintOptions) => void;
  dedupe?: boolean;
  extra?: Sites;
  remote?: boolean | { url?: string; refresh_hours?: number };
};

declare global {
  interface GlideGlobals {
    hint_selectors?: {
      setup(opts?: HintSelectorsOptions): void;
    };
  }
}

const DEFAULT_REMOTE_URL =
  "https://raw.githubusercontent.com/Swarsel/hint-selectors/dist/selectors.json";
const CACHE_PATH = glide.path.join(glide.path.profile_dir, "hint-selectors", "selectors.json");
const HIDDEN_TEXT = ".sr-only, .visually-hidden, .visuallyhidden, .screen-reader-text";

let remote_data: Dataset | null = null;
let fetched_at = 0;
let updating: Promise<void> | null = null;

function is_dataset(value: unknown): value is Dataset {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Dataset).format === 1 &&
    typeof (value as Dataset).sites === "object"
  );
}

async function read_cache() {
  if (!(await glide.fs.exists(CACHE_PATH))) {
    return;
  }
  try {
    const cached = JSON.parse(await glide.fs.read(CACHE_PATH, "utf8"));
    if (is_dataset(cached.data)) {
      remote_data = cached.data;
      fetched_at = cached.fetched_at ?? 0;
    }
  } catch (err) {
    console.warn("hint-selectors: ignoring unreadable cache", err);
  }
}

async function update(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`hint-selectors: ${url} returned HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!is_dataset(data)) {
    throw new Error(`hint-selectors: ${url} has an unsupported data format`);
  }
  remote_data = data;
  fetched_at = Date.now();
  await glide.fs.write(CACHE_PATH, JSON.stringify({ fetched_at, data }));
}

function picker(exclude: string | undefined, duplicates: Duplicates): glide.HintPicker {
  const hidden = exclude ? `element.closest(${JSON.stringify(exclude)}) !== null` : "false";
  const source = `(element) => {
  let text = element.innerText ?? element.textContent ?? "";
  for (const node of element.querySelectorAll(${JSON.stringify(HIDDEN_TEXT)})) {
    text = text.replace(node.innerText ?? node.textContent ?? "", "");
  }
  return {
    hidden: ${hidden},
    href: typeof element.href === "string" ? element.href : null,
    text: text.trim() !== "",
  };
}`;
  const describe = (_element: HTMLElement): HintInfo => ({ hidden: false, href: null, text: true });
  describe.toString = () => source;
  return async ({ hints, content }) => {
    const keep = filter_hints(await content.map(describe), duplicates);
    return hints.filter((_, index) => keep[index]);
  };
}

function setup(opts: HintSelectorsOptions = {}) {
  const duplicates: Duplicates = opts.dedupe === false ? "keep-duplicates" : "drop-duplicates";
  const hint = opts.hint ?? ((hint_opts: HintOptions) => glide.hints.show(hint_opts));
  const include_keys = opts.keys?.include ?? [{ key: "f" }, { key: "F", action: "newtab-click" }];
  const remote = opts.remote
    ? { url: DEFAULT_REMOTE_URL, refresh_hours: 24, ...(opts.remote === true ? {} : opts.remote) }
    : null;
  const cache_read = remote ? read_cache() : Promise.resolve();

  function refresh(mode: Refresh) {
    if (!remote || updating) {
      return updating ?? Promise.resolve();
    }
    updating = cache_read
      .then(() => {
        if (mode === "force" || Date.now() - fetched_at > remote.refresh_hours * 3_600_000) {
          return update(remote.url);
        }
      })
      .catch((err) => console.warn("hint-selectors: update failed", err))
      .finally(() => {
        updating = null;
      });
    return updating;
  }

  glide.autocmds.create("UrlEnter", /^https?:\/\//, ({ url }) => {
    void refresh("if-stale");
    const resolved = resolve(
      merge_sites(remote_data?.sites ?? BUNDLED.sites, opts.extra ?? {}),
      url,
    );
    const include = resolved?.include;
    const pick = picker(resolved?.exclude, duplicates);
    for (const { key, action } of include_keys) {
      glide.buf.keymaps.set("normal", key, () => hint({ include, action, pick }));
    }
    if (!resolved) {
      return;
    }
    for (const name of SET_NAMES) {
      const key = opts.keys?.[name];
      const selector = resolved.sets[name];
      if (key && selector) {
        glide.buf.keymaps.set("normal", key, () => hint({ selector, pick }));
      }
    }
  });

  if (remote) {
    glide.excmds.create(
      { name: "hint_selectors_update", description: "Fetch the latest hint selectors" },
      () => refresh("force"),
    );
  }
}

glide.g.hint_selectors = { setup };
