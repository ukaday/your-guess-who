# Manual Bootstrap Instructions

These steps are one-time only and cannot be automated. Complete them in order before running any CI/CD or CDK commands.

---

## 1. GitHub Repository

1. Create a new GitHub repo named `your-guess-who` (or your preferred name)
2. Push the local code:
   ```bash
   git remote add origin git@github.com:<your-username>/your-guess-who.git
   git push -u origin main
   ```

---

## 2. AWS Account & IAM

1. Create (or log into) an AWS account at https://aws.amazon.com
2. In the IAM console, create a new user named `deploy-bot`
3. Attach the following managed policies:
   - `AdministratorAccess` (for bootstrapping; can be tightened later)
4. Create access keys for that user (Access key ID + Secret access key)
5. Save the credentials — you will not see the secret again

---

## 3. CDK Bootstrap

Run once per AWS account/region. This creates the S3 bucket and IAM roles CDK needs to operate.

```bash
cd infrastructure
npm install
npx cdk bootstrap aws://<account-id>/<region>
```

Replace `<account-id>` and `<region>` (e.g. `us-east-1`) with your values.

---

## 4. ECR Repository

App Runner pulls from ECR. Create the repository before the first backend deploy:

```bash
aws ecr create-repository \
  --repository-name your-guess-who-backend \
  --region <region>
```

Note the repository URI — it will be referenced in the CDK stack and CI/CD workflow.

---

## 5. GitHub Actions Secrets

In the GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret name             | Value                                      |
|-------------------------|--------------------------------------------|
| `AWS_ACCESS_KEY_ID`     | Access key ID from step 2                  |
| `AWS_SECRET_ACCESS_KEY` | Secret access key from step 2              |
| `AWS_REGION`            | e.g. `us-east-1`                           |
| `AWS_ACCOUNT_ID`        | Your 12-digit AWS account ID               |

---

## 6. Verify

After completing the above, confirm:

- `git remote -v` shows the GitHub remote
- `aws sts get-caller-identity` returns the `deploy-bot` user
- The CDK bootstrap S3 bucket (`cdk-hnb659fds-assets-*`) exists in your region
- The ECR repository appears in the AWS console
