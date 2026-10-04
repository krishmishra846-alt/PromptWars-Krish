# Database Setup (Supabase)

This folder contains the complete PostgreSQL database configuration for the **Enterprise Platform**.

## Files
- `schema.sql`: Contains the complete SQL for:
  - `profiles` table with automatic sync trigger from `auth.users`.
  - `entity_schemas` table for dynamic metadata (fields, labels, types).
  - `generic_entities` table with JSONB storage, full-text search index, and AI summary column.
  - `audit_log` table for audit/compliance tracking.
  - Row Level Security (RLS) policies for user vs admin separation.

## How to Apply:
1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **SQL Editor** -> **New Query**.
3. Paste the contents of `schema.sql` and click **Run**.
4. Go to **Storage** -> **New Bucket** named `uploads` (set to Public) if file attachments are required.
