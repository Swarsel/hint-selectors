import {
  filter_hints,
  merge_sites,
  resolve,
  SET_NAMES,
  type Dataset,
  type Duplicates,
  type HintInfo,
  type SetName,
  type Sites,
} from "../../src/resolve.ts";

const BUNDLED: Dataset = { format: 1, sites: {} };

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
