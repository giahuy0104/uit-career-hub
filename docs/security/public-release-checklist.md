# Public repository release checklist

Complete every item before changing GitHub visibility to **Public**.

- [ ] Java backend build and tests pass.
- [ ] Production frontend bundle contains no demo credential.
- [ ] Render uses secret environment variables; no `.env` file is committed.
- [ ] Production database has no active demo account and has never run the development seed.
- [ ] Git history has been scanned for credentials and private keys.
- [ ] Thesis documents, generated PDFs and personal metadata have been reviewed for public release.
- [ ] Repository history has been rewritten or a new sanitized public repository has been created if private documents or secrets existed in earlier commits.
- [ ] All external credentials exposed in any earlier commit have been rotated.
- [ ] A license has been selected intentionally. Without a license, source is visible but reuse is not granted.
- [ ] GitHub private vulnerability reporting is enabled.
- [ ] Branch protection and required CI checks are enabled for `main`.

Changing or deleting a file in the latest commit does not remove it from Git history. Do not make this repository public until the history decision is complete.
