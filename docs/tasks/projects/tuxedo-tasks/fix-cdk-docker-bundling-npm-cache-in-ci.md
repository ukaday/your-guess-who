# Infra step 1 of 6, fix CDK Docker bundling in CI, frontend asset bundling runs as runner UID with no home so npm cannot create its cache dir and every deploy fails before reaching AWS

## Metadata

- Priority: B
- Created: 2026-08-02
- Due: 2026-08-03
- Projects: +cicd
- Contexts: @blocker

## Task

```todo.txt
(B) 2026-08-02 Infra step 1 of 6, fix CDK Docker bundling in CI, frontend asset bundling runs as runner UID with no home so npm cannot create its cache dir and every deploy fails before reaching AWS +cicd @blocker due:2026-08-03 note:projects/tuxedo-tasks/fix-cdk-docker-bundling-npm-cache-in-ci.md
```

## My notes

Spec: `docs/technical-design.md`. Ships first and independently of the ECS
Express migration — a broken pipeline should not be diagnosed at the same time
as a platform change.

### Symptom

Both the frontend and infrastructure deploy workflows fail. Backend deploy
passes, which rules out OIDC and the trust policy.

```
npm error code EACCES
npm error syscall mkdir
npm error path /.npm
npm error errno -13
...
«FailedToBundleAsset» Failed to bundle asset
  FrontendStack/AssetsDeployment/Asset1/Stage:
  CommandExecutionFailed: docker exited with status 243
```

### Cause

CDK bundles the frontend asset by running the build inside a container as the
CI runner's numeric user:

```
docker run --rm -u "1001:1001" ... node:22-alpine \
  sh -c "npm ci && npm run build && cp -r dist/. /asset-output/"
```

UID 1001 has no home directory inside that image, so `HOME` resolves to `/` and
npm tries to create its cache at `/.npm`, which it cannot write. It fails before
any AWS call.

Reproduces locally with the same `docker run -u` invocation — no AWS access
needed to verify a fix.

### Fix

Give the bundling step a writable cache location. Either set a cache path under
the asset-output or a tmp dir via npm's cache environment variable, or set
`HOME` to a writable path, in the bundling options where the build command is
declared. Prefer whichever keeps the build command itself unchanged.

### Acceptance

- Frontend deploy workflow completes green.
- Infrastructure deploy workflow completes green.
- Local `cdk synth` still bundles successfully.
- No change to the produced bundle contents.

### Watch out

The infrastructure workflow runs `cdk deploy --all` on push. Once this is fixed
it will deploy for real, including any pending stack changes. Confirm local
diffs are clean before pushing the fix.
