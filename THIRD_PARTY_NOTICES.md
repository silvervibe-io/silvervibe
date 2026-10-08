# Third-party notices

Silver Vibe source code is licensed under the [MIT License](./LICENSE).

This project **depends on** many open-source packages. Those packages are
**not** re-licensed by Silver Vibe. Their copyrights and licenses remain with
their respective authors and are typically MIT, Apache-2.0, BSD, or similar.
After `npm ci`, inspect:

- `node_modules/<package>/LICENSE*`
- `package-lock.json` → each package’s resolved metadata
- Python AI app: `apps/ai` dependency lock / package metadata

## Major stack (non-exhaustive)

| Component                   | Typical license (verify in package)                       |
| --------------------------- | --------------------------------------------------------- |
| Angular                     | MIT                                                       |
| NestJS                      | MIT                                                       |
| Nx                          | MIT                                                       |
| RxJS                        | Apache-2.0                                                |
| NgRx                        | MIT                                                       |
| Prisma                      | Apache-2.0                                                |
| daisyUI                     | MIT                                                       |
| Tailwind CSS                | MIT                                                       |
| OpenFeature SDKs            | Apache-2.0                                                |
| GrowthBook providers / SDKs | see package                                               |
| Firebase JS / Admin         | see package (Apache-2.0 / proprietary terms for services) |
| Playwright                  | Apache-2.0                                                |
| LangGraph / related AI libs | see package                                               |

## Generating a full attribution report

From the repo root (optional, for releases or compliance audits):

```bash
npx license-checker --production --summary
npx license-checker --production --customPath licenses/customFormat.json --out licenses/THIRD_PARTY_LICENSES.txt
```

Commit generated full dumps only when you intentionally cut a release
attribution artifact; day-to-day development does not require committing
`node_modules` license trees.

## Service terms (not OSS licenses)

Cloudflare, Neon, Firebase, Google Cloud, GrowthBook, and similar **hosted
services** are governed by their own Terms of Service and DPAs, separate from
this repository’s MIT license.
