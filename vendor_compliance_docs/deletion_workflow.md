# Deletion Workflow Document

In compliance with DPDPA "Right to Erasure", the system supports verified deletion of a specific customer's data within 30 days of the request.

## Workflow:
1. **User Request**: User submits a data deletion request via the portal or support channel.
2. **Identity Verification**: Support verifies the user's identity via OTP/Email confirmation.
3. **Soft Delete (0-7 Days)**: Account is deactivated. Data remains in the database but is inaccessible to the application layer.
4. **Hard Delete (7-30 Days)**: 
   - A background CRON job permanently deletes the user's PII from the `users` table.
   - Associated `kits` records are anonymized (user_id set to null).
   - Genetic data in `genetic_results` is purged if legally required, or retained fully anonymized (without any link to the user) for statistical purposes, per MBQ's data policy.
5. **Confirmation**: A final confirmation log is generated (without PII) for audit purposes.
