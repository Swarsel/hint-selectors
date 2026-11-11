# Format

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
- `exclude`: removed from every hint set, together with everything inside
- `sets.primary`: hinted exclusively, the main links of a page
- `match`: optional [match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) limiting a rule to some pages
