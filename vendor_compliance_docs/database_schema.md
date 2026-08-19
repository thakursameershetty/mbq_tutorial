# Database Schema (Redacted)

The database schema enforces a strict separation of PII (Personally Identifiable Information) and genetic data.

## `users` Table (PII)
- `id` (UUID, Primary Key)
- `email` (String, Encrypted)
- `phone_number` (String, Encrypted)
- `created_at` (Timestamp)

## `kits` Table (Pseudonymized Mapping)
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key) -> maps to `users.id`
- `barcode_id` (String, Unique) -> physical sample identifier
- `status` (Enum)

## `genetic_results` Table (Anonymized Data)
- `id` (UUID, Primary Key)
- `barcode_id` (String, Foreign Key) -> links to `kits.barcode_id` (NO direct link to `user_id`)
- `marker_rsid` (String)
- `genotype` (String)
- `raw_data` (JSONB, Encrypted at rest)

> **Note**: Genetic processing services and lab technicians only interact with `barcode_id`. They do not have access to the `users` table.
