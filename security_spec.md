# Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: No document outside explicitly matched paths can ever be read or written (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Authentication & Identity Integrity**: Every read or write requires `request.auth != null && request.auth.token.email_verified == true`. On `create`, `ownerId` must strictly equal `request.auth.uid`. On `update`, `ownerId` and `createdAt` are immutable.
3. **Bootstrapped Admin Integrity**: Only the runtime bootstrapped admin (`robiromadona06@guru.smk.belajar.id` with `email_verified == true`) or a document registered in `/admins/{uid}` is granted admin privileges. Clients cannot self-assign `admin` roles on `/admins` or `/users`.
4. **Master Gate & Global Consistency**: Subcollections (`/users/{userId}/private/{docId}`, `/students/{studentId}/private/{docId}`, `/cbtExams/{cbtId}/pgQuestions/{qId}`, `/cbtExams/{cbtId}/essayQuestions/{qId}`) validate parent document existence (`exists()`/`get()`) and parent ownership (`ownerId == request.auth.uid` or `isAdmin()`).
5. **PII Isolation**: Sensitive user email (`/users/{userId}/private/{docId}`) and student contact/health info (`/students/{studentId}/private/{docId}`) are isolated in private subcollections readable/writable only by the owner or verified admin.
6. **Strict Schema & No Shadow Fields**: Every collection uses a standalone `isValid[Entity](data)` helper enforcing `data.keys().hasAll([...]) && data.keys().hasOnly([...])`, strict types, string `.size()` bounds, enum checks, and regex ID checks (`^[a-zA-Z0-9_\-]+$`).
7. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update; `createdAt` is immutable on update.
8. **Terminal State Locking**: Finalized `cbtResults` (`statusNilai == 'Final'`) cannot be modified by non-admin owners.
9. **Secure List Queries**: Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid || isBootstrappedAdmin()` with zero `get()`/`exists()` calls inside `list`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Category | Target Path | Malicious Payload | Expected Result |
|---|---|---|---|---|
| 1 | Unauthenticated Write | `/classes/kls_1` | `{ "nama": "X IPA 1", "ownerId": "anon", ... }` (no auth) | `PERMISSION_DENIED` |
| 2 | Email Spoofing (Unverified Email) | `/settings/main` | Token with `email: "robiromadona06@guru.smk.belajar.id"`, `email_verified: false` | `PERMISSION_DENIED` |
| 3 | Identity Spoofing | `/classes/kls_1` | Authenticated as `userA`, payload `{ "nama": "X", "ownerId": "userB", ... }` | `PERMISSION_DENIED` |
| 4 | Self-Assigned Admin Escalation | `/admins/userA` | Authenticated as `userA` (non-admin), `create` `{ "uid": "userA", "email": "a@b.com", ... }` | `PERMISSION_DENIED` |
| 5 | Shadow / Ghost Field Injection | `/subjects/mp_1` | `{ "nama": "Fisika", "isApproved": true, "ownerId": "userA", ... }` | `PERMISSION_DENIED` |
| 6 | ID Poisoning (Oversized/Invalid ID) | `/classes/bad$id!...` | Valid payload on docId containing `$` or >128 chars | `PERMISSION_DENIED` |
| 7 | Value Poisoning (Oversized String) | `/classes/kls_1` | `{ "nama": "<150KB string>", "ownerId": "userA", ... }` | `PERMISSION_DENIED` |
| 8 | PII Blanket Read | `/students/sis_01/private/contact` | Authenticated as `userB` reading `userA`'s student private info | `PERMISSION_DENIED` |
| 9 | Query Trust Bypass (Unfiltered List) | `/students` | `userB` issuing unfiltered collection `list` query | `PERMISSION_DENIED` |
| 10 | Orphaned Subcollection Write | `/cbtExams/nonexistent/pgQuestions/q1` | Creating question under non-existent parent `cbtExams/nonexistent` | `PERMISSION_DENIED` |
| 11 | Immortal Field & Timestamp Forgery | `/classes/kls_1` | Updating `createdAt` or setting `updatedAt` to client ISO timestamp instead of `request.time` | `PERMISSION_DENIED` |
| 12 | Terminal State Mutation | `/cbtResults/res_1` | Non-admin owner modifying a `cbtResults` doc whose existing `statusNilai == 'Final'` | `PERMISSION_DENIED` |
