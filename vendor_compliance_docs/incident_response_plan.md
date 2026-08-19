# Incident Response Plan

This document outlines the standard operating procedure for security incidents and data breaches.

## 1. Preparation
- Active monitoring via Azure Security Center.
- Automated alerts for unauthorized access attempts.

## 2. Identification
- Potential breaches identified via Azure logs, WAF alerts, or internal audits.

## 3. Containment
- Isolate affected instances/databases.
- Revoke compromised credentials and rotate keys via Azure Key Vault.

## 4. Notification (SLA: 24 Hours)
- The vendor commits to notifying the MBQ team within **24 hours** of confirming a security breach involving MBQ data.

## 5. Eradication & Recovery
- Patch vulnerabilities.
- Restore from secure, encrypted daily backups if data integrity is compromised.

## 6. Post-Incident Analysis
- Root cause analysis report generated and shared with MBQ within 5 business days of incident closure.
