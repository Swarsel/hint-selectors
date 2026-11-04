# hint-selectors

A community "database" of CSS selectors for "hints" in keyboard-based browsing :)

## Format

Every domain is handled by a `sites/<domain>.json` file that holds all rules for it and its subdomains:

```json
{
  "domain": "github.com",
  "rules": [
    { "include": "[class*=\"TreeView-item-content-text\"]" },
    { "exclude": "footer" },
    {
      "match": ["*://github.com/*/issues*"],
      "sets": { "primary": "[data-listview-item-title-container] a" }
    }
  ]
}
```

- `include`: hinted in addition to the default hintable elements
- `exclude`: removed from the default hintable elements and from `include`
- `sets.primary`: hinted exclusively, the main links of a page
- `match`: optional [match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) limiting a rule to some pages

## Usage

Currently only the Glide browser is supported, but contributions for Tridactyl, qutebrowser, ... etc. are very welcome :)

### Glide

You need [`hint-selectors.glide.ts`](https://raw.githubusercontent.com/Swarsel/hint-selectors/dist/hint-selectors.glide.ts). Then:

```typescript
glide.include("hint-selectors.glide.ts").then(() => glide.g.hint_selectors!.setup());
```

#### Configuration

By default, `f` and `F` show the default hints plus the site's `include`.

`setup` can be customized:

- `keys.include`: keys showing the default hints plus `include` minus `exclude` + optional hint
  action
- `keys.primary`: key hinting only the `primary` set, unbound by default
- `hint`: receives `{ selector?, include?, exclude?, action? }`, to route through your own hint function
- `extra`: local rules, keyed by domain
- `remote`: fetch updates instead of only using only the bundled data (off by default)

For example, it might look something like:

```typescript
setup({
  keys: {
    include: [{ key: "f" }, { key: "F", action: "newtab-click" }],
    primary: "c",
  },
  hint: ({ selector, include, action }) => start_hints({ selector, include, action }),
  extra: {
    "about.example": [{ include: ".clickable-row" }],
  },
  remote: {
    url: "https://raw.githubusercontent.com/Swarsel/hint-selectors/dist/selectors.json",
    refresh_hours: 24,
  },
});
```
