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
4. Check the selectors on the live page:

   ```sh
   npm run probe <domain>
   ```

## Checks

The flake and npm scripts run the same checks:

| npm             | Nix               | What                                                     |
| --------------- | ----------------- | -------------------------------------------------------- |
| `npm ci`        | `nix develop`     | set up the tooling                                       |
| `npm run check` | `nix flake check` | schema, file names, match pattern hosts, selector syntax |
| `npm test`      | `nix flake check` | unit tests for URL matching and rule merging             |
| `npm run build` | `nix build`       | build `dist/selectors.json` and the Glide integration    |
| `npm run fmt`   | `nix fmt`         | format JSON, TypeScript, Markdown and Nix                |

Node 22.18 or newer is required, the TypeScript sources run without a build step.

## Changing the format

`src/resolve.ts` holds the matching logic shared by the build, the probe and the Glide
integration. Changes to the data format need a schema update, tests and, if old consumers would
break, a bump of `format` in the built dataset.
