/**
 * Security Rules Verification Suite for the "Dirty Dozen" Adversarial Payloads.
 * Intended to run against the Firebase Firestore Emulator via @firebase/rules-unit-testing.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    path: 'classes/kls_1',
    operation: 'create',
    auth: null,
    payload: { nama: 'X IPA 1', ownerId: 'anon' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Email Spoofing (Unverified Email)',
    path: 'settings/main',
    operation: 'create',
    auth: { uid: 'spoofUid', email: 'robiromadona06@guru.smk.belajar.id', email_verified: false },
    payload: { sekolah: 'Spoofed School', ownerId: 'spoofUid' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Identity Spoofing',
    path: 'classes/kls_1',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { nama: 'X MIPA 1', jurusan: 'MIPA', mapel: '', ownerId: 'userB' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Self-Assigned Admin Escalation',
    path: 'admins/userA',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { uid: 'userA', email: 'userA@example.com', displayName: 'Fake Admin' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Shadow / Ghost Field Injection',
    path: 'subjects/mp_1',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { nama: 'Fisika', isApproved: true, ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'ID Poisoning (Invalid Characters)',
    path: 'classes/bad$id!poison',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { nama: 'X MIPA 1', jurusan: 'MIPA', mapel: '', ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Value Poisoning (Oversized String)',
    path: 'classes/kls_1',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { nama: 'A'.repeat(2000), jurusan: 'MIPA', mapel: '', ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'PII Blanket Read',
    path: 'students/sis_01/private/contact',
    operation: 'get',
    auth: { uid: 'userB', email: 'userB@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Query Trust Bypass (Unfiltered List)',
    path: 'students',
    operation: 'list',
    auth: { uid: 'userB', email: 'userB@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Orphaned Subcollection Write',
    path: 'cbtExams/nonexistent_exam/pgQuestions/pg_1',
    operation: 'create',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { pertanyaan: 'Test?', kunci: 'A', ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Immortal Field & Timestamp Forgery',
    path: 'classes/kls_1',
    operation: 'update',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { nama: 'Updated', jurusan: 'MIPA', mapel: '', ownerId: 'userA', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Terminal State Mutation',
    path: 'cbtResults/hcbt_final',
    operation: 'update',
    auth: { uid: 'userA', email: 'userA@example.com', email_verified: true },
    payload: { statusNilai: 'Menunggu Nilai Uraian', skorAkhir: '100', ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  }
];

export function verifyRulesFileExists(): boolean {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const content = fs.readFileSync(rulesPath, 'utf8');
  return (
    content.includes("rules_version = '2';") &&
    content.includes('match /{document=**}') &&
    content.includes('email_verified == true')
  );
}
