# DisasterLink Mobile

## First-time setup

Install Node `22.23.1`, clone the repository, switch to the required branch, and run:

```powershell
npm run setup
npm start
```

`npm run setup` performs a clean installation from `package-lock.json`. The setup
automatically checks the Node version, Expo/React versions, lockfile consistency,
React JSX runtime, and assets referenced by `app.json`.

Use `npm start` instead of `npx expo start`. It runs the project check before
starting Expo, so a stale or incomplete installation fails with a useful message.
The launcher gives Metro a 4 GB JavaScript heap limit to support web and server
bundling. An explicit heap limit in `NODE_OPTIONS` takes precedence.

## Troubleshooting

Run the health check at any time:

```powershell
npm run doctor
```

If setup fails, fix the first error printed by `npm ci`. Do not copy `node_modules`
between computers and do not commit it. Prefer cloning outside OneDrive to avoid
file-locking and partial-sync issues.

## Continuous integration

The `Project health` GitHub Actions workflow runs on pushes, pull requests, and
manual runs from the Actions tab. It checks three areas:

| Check | What it verifies |
| --- | --- |
| Code checks | A clean lockfile install, the existing project health check, Expo dependency compatibility, unit tests, TypeScript, and application/Edge Function linting. |
| Database checks | A disposable local Supabase database built from all migrations, public-schema SQL linting, and the existing database/RLS tests. |
| Bundle (android/ios/web) | Production JavaScript and asset exports for each platform, after code checks pass. These do not build APKs/IPAs or test device interactions. |

Database checks run independently of code checks. Each bundle platform runs
separately so one failure does not hide another platform's result. New commits
cancel older checks for the same pull request or branch; jobs also have timeouts.

CI uses Node from `.nvmrc`, dependencies and the Supabase CLI from
`package-lock.json`, and Deno `2.8.3` for Edge Function linting. `npm run test:rls`
uses that installed CLI and explicitly targets the local database.

No repository secrets are required. Expo ignores local `.env` files during CI and
uses deliberately unusable public configuration for bundle checks. Database
tests use synthetic fixtures in the runner's local database, which is stopped
afterward. This workflow does not deploy application bundles, Edge Functions, or
database migrations to a hosted environment.

To enforce CI before merging, configure the default branch's GitHub ruleset or
branch protection to require a pull request and the **CI passed** status check.
Run the workflow once so GitHub can list the check, then select it in the branch
settings. The workflow defines the status; branch protection is a separate
repository setting.

For local code checks, run `npm test` (Node and Deno are required). For database
checks, use Docker and the local Supabase stack, apply migrations, then run:

```powershell
npx --no-install supabase db lint --local --schema public --level error --fail-on error
npm run test:rls
```

CI checks complement phone testing. They do not verify native keyboards,
permissions, touch interactions, or visual layout.
