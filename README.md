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

## Troubleshooting

Run the health check at any time:

```powershell
npm run doctor
```

If setup fails, fix the first error printed by `npm ci`. Do not copy `node_modules`
between computers and do not commit it. Prefer cloning outside OneDrive to avoid
file-locking and partial-sync issues.
