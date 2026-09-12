# Manual Bootstrap Instructions

One-time steps for standing the project up in a fresh AWS account. CI can only deploy once these are done. Complete them in order.

Everything is deployed to `us-east-2`.

---

## 1. GitHub Repository

1. Create a GitHub repo and push the code to `master`. The deploy workflows only run on `master`, and the deploy role only trusts that branch.
2. If the repo is not `ukaday/your-guess-who`, update `githubRepo` in `infrastructure/bin/app.ts`.

No GitHub Actions secrets are needed. The workflows assume the `github-actions-deploy` role through OIDC.

---

## 2. AWS Account & IAM

Do not use the root user for day-to-day work.

1. Sign in as root once: enable MFA on root and delete any root access keys.
2. In IAM, create a user with console access and attach `AdministratorAccess`. Sign in as that user and add MFA.
3. Do **not** create access keys. Sign the CLI in with short-lived console credentials instead:
   ```bash
   aws login
   aws configure set region us-east-2
   aws sts get-caller-identity   # should end in :user/<name>, not :root
   ```

CDK deploys to whichever account and region the CLI is signed in to, so the region setting matters.

---

## 3. CDK Bootstrap

Run once per account/region. It creates the asset bucket and the roles CDK deploys through.

```bash
cd infrastructure
npm ci
npx cdk bootstrap aws://<account-id>/us-east-2
```

Keep the default qualifier (`hnb659fds`). `CicdStack` grants the deploy role access to the bootstrap roles by that name.

---

## 4. ECR Repository and First Image

`BackendStack` imports the repository rather than creating it, and runs its `latest` tag.

```bash
aws ecr create-repository --repository-name your-guess-who-backend --region us-east-2
```

Push an initial image so the service has something to run. These are the same steps as `backend.yml`. Build for `linux/amd64` to match the image CI builds; an Apple Silicon Mac builds `arm64` otherwise.

```bash
REGISTRY=<account-id>.dkr.ecr.us-east-2.amazonaws.com
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin "$REGISTRY"
docker build --platform linux/amd64 -t "$REGISTRY/your-guess-who-backend:latest" backend
docker push "$REGISTRY/your-guess-who-backend:latest"
```

---

## 5. Budget Alert Email

`BudgetStack` reads its alert address from Parameter Store. Create it as a plain `String`, since CloudFormation cannot resolve a `SecureString` here:

```bash
aws ssm put-parameter --region us-east-2 --type String \
  --name /your-guess-who/budget-alert-email --value <you@example.com>
```

---

## 6. First Deploy

The first deploy runs locally, because CI cannot assume `github-actions-deploy` until `CicdStack` exists. Docker must be running: CDK bundles the frontend in a container.

```bash
cd infrastructure
npx cdk deploy --all
```

If this is not account `759542245177`, point the code at the new account and redeploy:

- `frontendOrigin` in `infrastructure/bin/app.ts` → `https://<FrontendStack DistributionDomain output>`
- The account ID in `role-to-assume` in `.github/workflows/backend.yml`, `frontend.yml`, and `infrastructure.yml`

---

## 7. Verify

- `aws cloudformation list-stacks --region us-east-2 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE` lists all eight stacks plus `CDKToolkit`
- A push to `master` runs the deploy workflows green in GitHub Actions
- `https://<DistributionDomain>/api/health` responds
