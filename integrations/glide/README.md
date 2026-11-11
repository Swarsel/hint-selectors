# Glide

You need [`hint-selectors.glide.ts`](https://raw.githubusercontent.com/Swarsel/hint-selectors/dist/hint-selectors.glide.ts). Then:

```typescript
glide.include("hint-selectors.glide.ts").then(() => glide.g.hint_selectors!.setup());
```

## Configuration

By default, `f` and `F` show the default hints plus the site's `include`, minus its `exclude` and
minus image-only links whose target also has a text link.

`setup` can be customized:

- `keys.include`: keys showing the default hints plus `include` minus `exclude` + optional hint
  action
- `keys.primary`: key hinting only the `primary` set, unbound by default
- `hint`: receives `{ selector?, include?, exclude?, action? }`, to route through your own hint function
- `dedupe`: drop image-only links whose target also has a text link, on by default
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
