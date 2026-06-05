# Language Pack: Terraform / HCL

Load when the review scope contains `.tf` or `.tfvars` files. This pack sharpens the six generic rubric dimensions for infrastructure-as-code; read it fully before scoring.

> IaC remaps the rubric: "Correctness" is dominated by state/drift and resource-replacement hazards, "Performance" is largely N/A (note it and move on), and "Security" carries extra weight because a misconfigured resource is a live exposure, not a latent bug. Detect the provider (aws/gcp/azure) from `provider` blocks and resource prefixes, and adapt examples accordingly.

## Standing audits — run these in paths/whole-config mode, not just on diffs

Many footguns below are phrased as "a change that…". That framing fits a `diff` review, but in a `paths` or `repo` review there is no diff — you audit the configuration **as it stands**. The most-missed Terraform classes hide exactly here, because a property that's simply *absent* never shows up as a "change". Run these as explicit enumerations, tied to Sweep A — judge *every* matching resource, not the first one that catches your eye:

- **Stateful-resource protection.** For every S3 bucket, RDS/Aurora instance, EBS volume, DynamoDB table, EFS, or other stateful resource, confirm each protection is present or flag its absence — independent of any diff:
  - `lifecycle { prevent_destroy = true }` on anything whose loss is unrecoverable.
  - Versioning (`aws_s3_bucket_versioning`) and backups (`deletion_protection`, RDS backup retention, snapshots).
  - Encryption at rest (SSE/KMS) and a public-access block.
  A stateful bucket carrying none of these is an accidental-`terraform destroy` or fat-fingered-delete away from unrecoverable data loss, in any scope.
- **S3 per-bucket checklist.** For *each* bucket, walk the whole list: public-access-block, SSE encryption, versioning, an SSL-enforcing bucket policy (`aws:SecureTransport`), and access logging. Catching one bucket's gap and missing the identical gap on the bucket declared 20 lines down is the classic enumeration miss.
- **Container-image supply chain.** `image_tag_mutability = "MUTABLE"` on a production ECR repo lets a pushed tag be overwritten — a published image can change underneath you (supply-chain + rollback hazard). A `:latest` or otherwise unpinned image tag in an ECS/EKS task definition makes deploys non-reproducible and rollback unreliable; prefer an immutable tag pinned to a digest.
- **Scoped-resource validation.** A wildcard *action* isn't the only over-broad shape. A *narrow* action on `resources = ["*"]` (e.g. `ecr:InitiateLayerUpload`, `s3:PutObject`) that could be scoped to a specific ARN is still a finding — sweep for `resources = ["*"]` and ask whether each statement could name the resource it actually needs.

## Idiom & formatter

- `terraform fmt` clean; `terraform validate` / `tflint` / `tfsec`/`checkov` in the toolchain. Snake_case names; one resource concern per module. Variables typed and described; outputs documented.
- Pin provider and module versions (`required_providers` with `~>`); pin the Terraform version.

## Security (×2.0) — weighted heavily for IaC

- **Secrets in code/state:** credentials, keys, or passwords hardcoded in `.tf`/`.tfvars`, or committed `terraform.tfvars` with secrets. Sensitive values not marked `sensitive = true`. Secrets sourced inline instead of from a secret manager / `data` source.
- **Public exposure:** security group / firewall `0.0.0.0/0` ingress on admin ports (22/3389/db ports); S3 bucket / GCS / blob without public-access-block; storage/object ACL `public-read`.
- **Encryption:** unencrypted storage, EBS/disk, RDS, or S3 (`server_side_encryption` missing); TLS not enforced; KMS key omitted where the org standard requires CMK.
- **IAM over-permission:** `"*"` actions or `"*"` resources in policies; service-level action wildcards (`ecr:*`, `s3:*`, `ecs:*`) on a named resource; wildcard principals; `AdministratorAccess`/`*FullAccess` managed policies attached broadly. **Read every statement and every action in it** — the obvious over-broad grant (`IAMFullAccess`) often sits next to a subtler one in the same policy. Don't stop at the first wildcard you spot.
- **`iam:PassRole` — named escalation footgun.** `iam:PassRole` lets the holder hand a role to a service (ECS task, Lambda, EC2). On a non-deploy principal (an application/task role), or scoped to `*` / a broad resource, it's a privilege-escalation path: the holder can pass a more-privileged role to a task it launches. Flag it whenever it appears, name it as escalation, and check (a) which principal holds it, (b) whether the `resources` list is scoped to exactly the role ARN(s) that legitimately need passing. This is easy to miss because it reads like a routine action in a list — sweep for it explicitly.
- **Missing observability resources:** a `aws_cloudwatch_log_group` referenced by a task/Lambda/service (`awslogs-group`, `log_group_name`) but never declared in scope — logging silently fails or the group is auto-created with no retention (unbounded cost). Treat a referenced-but-undeclared log group as a finding, not an omission.
- **Logging/audit disabled:** flow logs, access logs, or CloudTrail/audit logging turned off on resources that should have it.
- **State backend:** remote state bucket unencrypted or without access controls (state contains plaintext secrets).

## Correctness & Hidden Bugs (×2.0)

- **Destroy/replace hazards:** a change to a `ForceNew` attribute (name, AZ, engine) that silently triggers destroy-and-recreate of a stateful resource (DB, volume) — data loss. Flag any diff that would replace a stateful resource. In paths/whole-config mode there's no diff to inspect — instead confirm each stateful resource carries the protections in *Standing audits* above (`prevent_destroy`, versioning, backups).
- **`count` vs `for_each`:** `count` on a list where removing a middle element shifts indices and destroys/recreates the wrong resources; should be `for_each` over a map/set.
- **Implicit dependencies missing:** resources that need ordering but lack a reference or `depends_on`, causing race/apply failures.
- **Hardcoded values that drift:** region/account/AMI IDs hardcoded instead of `data` sources or variables; an AMI lookup without owners filter picking an unexpected image.
- **`lifecycle` mistakes:** `ignore_changes` hiding real drift; missing `prevent_destroy` on a critical stateful resource; `create_before_destroy` absent where zero-downtime replacement is required.
- **Interpolation/type bugs:** `for_each` over a value unknown at plan time (apply error); string/number coercion in conditionals; ternary returning mismatched types.
- **Module input contract:** required variable with no validation; a default that's unsafe in production (e.g., `deletion_protection = false`).

## Performance (×1.5) — usually N/A

Infra plans don't have a runtime hot path. Note "not applicable to IaC" in the report and don't pad. The nearest real concerns: a monolithic root module that makes `plan` slow and blast-radius huge (raise under Architecture instead), or provisioning oversized/under-sized resources relative to stated need (a cost finding — mention under Architecture/Notes).

## Architecture & Design (×1.5)

Terraform is declarative IaC with no objects, so **SOLID does not apply** — don't force it. This dimension here means *module composition, blast-radius control, environment separation, and DRY*: small composable modules, sensible state boundaries, no copy-pasted resource blocks.

- Monolithic root module mixing networking + compute + data + IAM — large blast radius, hard to reason about. Should be composable modules.
- Copy-pasted resource blocks that should be a module + `for_each`; hardcoded values that should be variables/locals.
- No remote state / state not separated by environment; environments differentiated by copy-paste instead of workspaces or per-env var files.
- Provider/module versions unpinned (reproducibility); outputs not exposing what dependent modules need (tight coupling via direct resource references across modules).

## Error Handling & Resilience (×1.0)

- **Idempotency / rerun safety** is the IaC analog: a config that isn't convergent (perpetual diff every apply); `local-exec`/`null_resource` provisioners with side effects that re-run non-idempotently.
- Missing `prevent_destroy`/backups on stateful resources; no `deletion_protection` on prod DBs.
- Provisioners used where a native resource exists (fragile, no rollback); no handling for partial-apply state.

## Readability & Style (×1.0)

- Untyped/undescribed variables; magic strings/CIDRs inline instead of named locals; resources named generically (`this`, `main`) at scale.
- `terraform fmt` not applied; deeply nested ternaries; missing `description` on variables/outputs.

## Grep patterns worth running

```
0.0.0.0/0                    # open ingress
"\*"|:\*"|FullAccess          # wildcard actions/resources, service-level wildcards, broad managed policies
iam:PassRole                 # privilege-escalation footgun — who holds it, scoped to what?
password|secret|access_key   # hardcoded secrets
sensitive                    # check sensitive values are marked
count                        # count where for_each is safer
prevent_destroy|deletion_protection   # presence on stateful resources
encryption|encrypted         # check it's enabled, not disabled
publicly_accessible|public-read        # public exposure
awslogs-group|log_group_name # referenced log groups — are they declared in scope?
image_tag_mutability         # MUTABLE on a prod ECR repo — image can be overwritten
:latest                      # unpinned image tag in a task def — non-reproducible deploys
versioning                   # check it's enabled on stateful buckets
resources\s*=\s*\["\*"\]      # action scoped to every resource — could it name an ARN?
```

## Calibration hints

- A `0.0.0.0/0` ingress on an admin/DB port, a hardcoded secret, or a `"*":"*"` IAM policy is **Critical** under Security — it's a live exposure, not a latent risk, so Security caps ≤ 5.
- A change that force-replaces a stateful resource (DB/volume) is **Critical** under Correctness (data-loss risk) — call it out as a ship-blocker even if `terraform plan` output isn't in scope; infer it from the changed attribute.
- `count` over a list of stateful resources (index-shift destroy hazard) is **High**.
- `iam:PassRole` on an application/task role, or scoped to `*`/a broad resource, is **High** under Security (escalation path); on a deploy principal scoped to the exact role ARNs it deploys, it's expected — don't flag. A service-level action wildcard (`ecr:*`, `s3:*`) on a named resource is **High**; `"*":"*"` is **Critical**.
- A referenced-but-undeclared CloudWatch log group is **Medium** under Error Handling (silent logging failure + unbounded-cost / no-retention risk), unless clearly owned by another module (then a Notes item). In a multi-workspace repo (sibling `prod/`, `staging/` directories that each `terraform apply` separately), a by-name reference to a resource declared in another workspace is a normal, established pattern — before flagging it as missing, confirm it's genuinely absent repo-wide; if a sibling workspace plausibly owns it, default to a low-confidence Notes item rather than a finding.
- Unpinned provider/module versions is **Medium** (reproducibility), **High** if the module is widely consumed.
- A stateful resource (S3, RDS, EBS, DynamoDB) missing `prevent_destroy` *and* versioning/backups is **High** under Correctness — an accidental delete or `destroy` is unrecoverable. Missing one but not both, or on a non-critical resource, is **Medium**.
- `image_tag_mutability = "MUTABLE"` on a production ECR repo is **Medium–High** (supply-chain / rollback hazard); a `:latest` or unpinned image tag in a task definition is **Medium** (non-reproducible deploys, unreliable rollback).
- A narrow action on `resources = ["*"]` that could be scoped to a named ARN (`ecr:InitiateLayerUpload`, `s3:PutObject`) is **Medium** under Security; raise to **High** when the action is mutating and the blast radius is account-wide.
- Missing SSE encryption or a public-access block on an S3 bucket is **High** under Security (live exposure); missing only versioning is **Medium** under Correctness (recoverability).
