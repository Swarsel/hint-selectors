# Contributing

Contributions are very welcome!

## Adding or changing a site

1. Open the page, press your hint key and note what needs changing
2. Inspect that element in the devtools and find a selector for it
3. Add a rule to `sites/<domain>.json`:
   - `include` for elements that should be hinted in addition to the defaults
   - `exclude` for elements, and everything inside them, that should not be hinted
   - `sets.primary` for "only the main links of this page"
   - `match` only when selectors are specific to some pages
4. Test the selectors on page

Also see [Format](./schema/README.md)
