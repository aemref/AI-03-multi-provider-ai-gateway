# Release policy

The repository is currently a `0.1.0` development package. No `v1.0.0` release
or registry publication is claimed until every gate below is observed on the
exact commit being tagged.

## Semantic versioning

- `MAJOR` changes when a documented public contract becomes incompatible.
- `MINOR` adds a backward-compatible public capability.
- `PATCH` fixes behavior without changing the documented public contract.
- Pre-1.0 versions may evolve, but every breaking change must still be called
  out explicitly in the changelog.

The version must match in `package.json`, `package-lock.json`, `src/index.ts`,
and `docs/openapi.yaml`. Automated tests reject a mismatch.

## Stable-release gates

1. Start from a clean `main` that is equal to `origin/main`.
2. Run `npm ci` and `npm audit --audit-level=high`.
3. Run `npm run verify`, `npm run coverage:check`, and `npm run pack:check`.
4. Confirm the archive contains runtime code, types, documentation, examples,
   license, and changelog, but excludes tests, source, scripts, secrets, and CI
   internals.
5. Move the relevant `Unreleased` notes under a dated `1.0.0` heading and update
   all four version locations together.
6. Repeat every gate on that exact commit before creating an annotated `v1.0.0`
   tag, GitHub release, or npm publication.

A failed gate stops the release. Tags, release notes, and package publication
must never be used as evidence before their remote state is independently
verified.

## Rollback boundary

Published npm versions and Git tags are immutable. A faulty release is corrected
with a new patch version and a changelog entry; history is never rewritten and a
published version is never reused.
