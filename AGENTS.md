# Deployment workflow

- The user authorizes pushing and deploying after each new commit in this project unless a later request says otherwise.
- Prefer `npm run deploy -- -m "Describe the changes"`: it stages pending changes, commits when necessary, pushes `main` and deploys to Oracle in one command.
- The user explicitly requests fast publication without tests. This command runs only the production Vite build, with no test suite, typecheck, npm prebuild hook or browser review.
- For an already committed clean checkout, use `npm run deploy -- --no-commit`.
- See `docs/deploy.md`. Do not recreate dated `.tmp/release-*` publisher copies or upload the complete build manually.
- Deployment logs and the last published build/URLs are recorded under ignored `.tmp/deploy/`.
