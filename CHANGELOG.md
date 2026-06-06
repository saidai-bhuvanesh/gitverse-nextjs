# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- Initial changelog created
- Real `pg_dump`-based database backup endpoint at `GET /api/cron/db-backup`
- `lib/services/backupService.ts` — pg_dump execution, gzip compression, optional S3 upload, retention cleanup
- `docs/infrastructure/database-backup.md` — backup architecture documentation with env var reference, restore procedure, and production considerations
- Cron schedule for db-backup in `vercel.json` (daily at 06:00 UTC)
- Environment variable documentation for backup in `.env.example`

### Changed

### Deprecated

### Removed

### Fixed
- TOCTOU race condition in checkRateLimit — replaced non-atomic count-then-create with atomic upsert on a @@unique([key, expiresAt]) constraint
- P2002 catch block is no longer dead code; it enforces limits under concurrent writes
- Switched from sliding-window per-request entries to fixed-window single-entry upsert for atomicity

### Security
