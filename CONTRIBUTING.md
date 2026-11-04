# Contributing

All proposed changes to the default branch **main** must go through a pull request (PR). Do not push code directly to main.

## Workflow

1. Sync your local `main` with origin.
2. Create a branch, e.g. `feature/trip-member-linking`, `fix/member-actions`, or `chore/update-tests`.
3. Make your changes and run relevant tests locally.
4. Push the branch and open a PR targeting `main`.
5. Complete the PR template, review the diff, and wait for GitHub Actions to pass.
6. Obtain reviewer approval before merging. Prefer squash merge for a clean history.

## CI checks

The existing `.github/workflows/reliability-tests.yml` workflow checks JavaScript syntax and runs finance/date tests on pull requests.

## Supabase and database changes

- Commit SQL/schema/RLS changes to the repository and review them in a PR before applying to production.
- Review destructive or data-changing SQL carefully; back up sensitive data and document rollback procedures.
- Do not paste production database passwords, secret keys, or service-role credentials in commits, PRs, or browser code.
- GitHub branch protection governs *repository code*, not manual edits in the Supabase dashboard. Restrict production database privileges and use a reviewed migration deployment process to enforce database change control.

## Required GitHub repository setting (owner/admin)

This file documents the policy; to **enforce** it, go to Settings → Rules → Rulesets → New branch ruleset (or Settings → Branches → Add branch protection rule, depending on the UI). Target `main`, enable **Require a pull request before merging**, **Require approvals (1)**, **Require status checks to pass** (select the existing `finance-tests` check after it appears), **Block force pushes**, and **Restrict deletions**. Activate the rule, apply it to admins/bypass actors as appropriate, and verify that direct pushes are rejected.

Availability/enforcement of rules on a public repository owned by a personal account depends on GitHub's current plan and policy. Check the settings UI if an option is unavailable.
