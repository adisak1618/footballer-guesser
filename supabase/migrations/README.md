# Supabase Migrations

This folder is the single source of truth for the database schema across all environments. All apps in the monorepo (`apps/hub`, `apps/headball`, `apps/insider`) share one Supabase project at any given environment level.

## Environments

Per design doc decision **T-5.C** (eng review), we run on a phased env model:

| Env | Supabase project | Used by |
|---|---|---|
| Local | `bunx supabase start` (Docker) | `bun run dev`, local tests |
| Staging | `headball-staging` (cloud) | All Vercel preview deploys + Vercel production until promoted |
| Production | not yet provisioned | TBD after Insider ships with real users |

Promote staging → real prod only when Insider has real users on it. Until then, "production" effectively means staging.

## Adding a new migration

```bash
# 1. Author the migration locally
bunx supabase migration new <descriptive_name>
# Edit the new file in supabase/migrations/NNNN_<descriptive_name>.sql

# 2. Test locally
bunx supabase db reset    # destroys + reapplies all migrations to local
bunx vitest run           # run integration tests against local

# 3. Push to staging
SUPABASE_DB_PASSWORD='<staging-db-password>' bunx supabase db push --linked

# 4. Verify
bunx supabase migration list --linked
```

## Migration discipline (per T-7 from eng review)

All migrations must be **additive and backward-compatible** so any one of the three Vercel projects (hub, headball, insider) can deploy first or last without breaking the others.

**Required:**
- ✅ Add columns with sensible defaults so existing rows don't break
- ✅ Add new tables freely
- ✅ Add new Postgres functions freely
- ✅ Use `if not exists` for idempotency where possible

**Forbidden without a transition period:**
- ❌ Drop columns that any deployed app version still reads
- ❌ Rename columns/tables (drop = breaking; create new + dual-write + drop later)
- ❌ Change column types in a way that breaks existing values
- ❌ Remove a Postgres function any app version still calls

**Pattern for breaking changes:**
1. Migration A: add new column/function alongside old one
2. Deploy all 3 apps to read/write both
3. Migration B (next release): make new column/function authoritative
4. Deploy all 3 apps to use only new
5. Migration C (release after): drop old column/function

This three-step pattern lets you roll forward without coordinated deploys across 3 Vercel projects.

## Realtime publication discipline (per A4 from eng review)

Every table that clients subscribe to via Supabase Realtime needs an explicit:

```sql
alter publication supabase_realtime add table <table_name>;
```

If your migration creates a table clients won't subscribe to (e.g., lookup data, audit logs), mark it explicitly:

```sql
create table some_lookup (...);
-- no-realtime: clients don't subscribe to this table
```

The `scripts/check-realtime-publication.sh` CI guard greps for this convention and fails the build if a `create table` lacks either the publication line or the `-- no-realtime` comment.

## Releasing migrations

Before pushing a migration to staging or prod:

1. Verify locally: `bunx supabase db reset && bunx vitest run`
2. Check publication discipline: `bash scripts/check-realtime-publication.sh`
3. Push: `bunx supabase db push --linked`
4. Verify remote: `bunx supabase migration list --linked` shows your migration as Applied

## Rollback posture

There is no automatic rollback. If a migration breaks:

1. Author a NEW migration that undoes the breaking change
2. Push it
3. Never edit a migration that has been applied to staging or prod (even if no one has noticed yet)

This is the price of an additive-only model. The upside is fewer surprise breakages mid-release.
