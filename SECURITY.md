# Security policy

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected vulnerability, leaked credential, or personal-data exposure. Use GitHub's private vulnerability reporting feature for this repository. Include the affected endpoint or file, reproduction steps, impact, and any suggested mitigation.

Do not include real passwords, access tokens, database URLs, CVs, transcripts, or other personal data in the report.

## Public demo data

Data and credentials under development/E2E fixtures are non-production test material. Production must use a separate database, must not run `db:seed` or `db:demo:reset`, and must have all known demo accounts suspended or removed before public access is enabled.
