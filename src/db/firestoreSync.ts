import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

function safeId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned || `${fallbackPrefix}_${Date.now().toString(36)}`;
}

function clampStr(v: any, maxLen: number): string {
  return String(v == null ? '' : v).slice(0, maxLen);
}

function clampNonEmpty(v: any, fallback: string, maxLen: number): string {
  const s = clampStr(v, maxLen).trim();
  return s || fallback;
}

function safeParseMap(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const p = JSON.parse(String(raw));
    return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}

type BatchOp = {
  type: 'set' | 'delete';
  ref: ReturnType<typeof doc>;
  data?: Record<string, any>;
};

async function commitOpsInChunks(ops: BatchOp[], contextPath: string): Promise<void> {
  const CHUNK_SIZE = 350;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set' && op.data) {
        batch.set(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, contextPath);
    }
  }
}

async function fetchOwnedDocs(colPath: string, uid: string): Promise<Array<{ id: string; data: Record<string, any> }>> {
  try {
    const q = query(collection(db, colPath), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, data: d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

const inFlightUserSync = new Map<string, Promise<void>>();

export async function ensureUserProfileInFirestore(user: User): Promise<void> {
  if (!user || !user.emailVerified) return;
  const uid = safeId(user.uid, 'usr');
  const pending = inFlightUserSync.get(uid);
  if (pending) return pending;

  const task = (async () => {
    const userRef = doc(db, 'users', uid);
    const privRef = doc(db, 'users', uid, 'private', 'info');

    try {
      const [existing, privExisting] = await Promise.all([getDoc(userRef), getDoc(privRef)]);
      const nowTs = serverTimestamp();
      const batch = writeBatch(db);
      if (!existing.exists()) {
        batch.set(userRef, {
          uid,
          displayName: clampNonEmpty(user.displayName || user.email, 'Pengguna', 150),
          role: 'guru',
          ownerId: uid,
          createdAt: nowTs,
          updatedAt: nowTs
        });
      } else {
        batch.update(userRef, {
          displayName: clampNonEmpty(user.displayName || user.email, 'Pengguna', 150),
          updatedAt: nowTs
        });
      }

      if (!privExisting.exists()) {
        batch.set(privRef, {
          email: clampNonEmpty(user.email, 'user@example.com', 200),
          ownerId: uid,
          createdAt: nowTs,
          updatedAt: nowTs
        });
      } else {
        batch.update(privRef, {
          email: clampNonEmpty(user.email, 'user@example.com', 200),
          updatedAt: nowTs
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    } finally {
      inFlightUserSync.delete(uid);
    }
  })();

  inFlightUserSync.set(uid, task);
  return task;
}

async function replaceSimpleCollection(
  colName: string,
  uid: string,
  desiredDocs: Array<{ id: string; payload: Record<string, any> }>
): Promise<void> {
  const existing = await fetchOwnedDocs(colName, uid);
  const existingMap = new Map<string, Record<string, any>>();
  existing.forEach(d => existingMap.set(d.id, d.data));

  const desiredIds = new Set<string>();
  const ops: BatchOp[] = [];

  for (const item of desiredDocs) {
    const id = safeId(item.id, colName);
    desiredIds.add(id);
    const prev = existingMap.get(id);
    const createdAt = prev?.createdAt instanceof Timestamp ? prev.createdAt : serverTimestamp();
    ops.push({
      type: 'set',
      ref: doc(db, colName, id),
      data: {
        ...item.payload,
        ownerId: uid,
        createdAt,
        updatedAt: serverTimestamp()
      }
    });
  }

  for (const old of existing) {
    if (!desiredIds.has(old.id)) {
      ops.push({
        type: 'delete',
        ref: doc(db, colName, old.id)
      });
    }
  }

  if (ops.length) {
    await commitOpsInChunks(ops, colName);
  }
}

export async function syncPengaturanToFirestore(pengaturan: Record<string, any>, uid: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const settingId = `main_${safeId(uid, 'u')}`;
  const ref = doc(db, 'settings', settingId);
  let prevCreatedAt: any = serverTimestamp();
  try {
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().createdAt instanceof Timestamp) {
      prevCreatedAt = snap.data().createdAt;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `settings/${settingId}`);
  }

  const rawJurusanLogos = safeParseMap(pengaturan.jurusanLogos) || {};
  const jurusanLogos: Record<string, string> = {};
  Object.entries(rawJurusanLogos)
    .slice(0, 30)
    .forEach(([k, v]) => {
      const key = String(k || '').trim().slice(0, 80);
      const val = String(v || '').trim();
      if (key && val.startsWith('data:image/') && val.length <= 250000) {
        jurusanLogos[key] = val;
      }
    });

  const payload = {
    sekolah: clampNonEmpty(pengaturan.sekolah, 'Sekolah', 200),
    jurusan: clampStr(pengaturan.jurusan, 500),
    waInfo: clampStr(pengaturan.waInfo, 40),
    guru: clampStr(pengaturan.guru, 150),
    wali: clampStr(pengaturan.wali, 150),
    semester: clampStr(pengaturan.semester, 80),
    mulai: clampStr(pengaturan.mulai, 20),
    kkm: clampStr(pengaturan.kkm || '75', 10),
    b_sikap: clampStr(pengaturan.b_sikap || '10', 10),
    b_tugas: clampStr(pengaturan.b_tugas || '20', 10),
    b_proyek: clampStr(pengaturan.b_proyek || '20', 10),
    b_uts: clampStr(pengaturan.b_uts || '20', 10),
    b_uas: clampStr(pengaturan.b_uas || '30', 10),
    logo: clampStr(pengaturan.logo, 600000),
    jurusanLogos,
    kaldikAutoSync: pengaturan.kaldikAutoSync === '0' ? '0' : '1',
    kaldikWilayah: clampStr(pengaturan.kaldikWilayah || 'Provinsi Jawa Barat', 80),
    kaldikTahunAjaran: clampStr(pengaturan.kaldikTahunAjaran || '2026/2027', 30),
    kaldikLastSync: clampStr(pengaturan.kaldikLastSync || '', 40),
    ownerId: uid,
    createdAt: prevCreatedAt,
    updatedAt: serverTimestamp()
  };

  await commitOpsInChunks([{ type: 'set', ref, data: payload }], `settings/${settingId}`);
}

async function syncStudentsToFirestore(rows: any[], uid: string): Promise<void> {
  const existing = await fetchOwnedDocs('students', uid);
  const existingMap = new Map<string, Record<string, any>>();
  existing.forEach(d => existingMap.set(d.id, d.data));

  const desiredIds = new Set<string>();
  const ops: BatchOp[] = [];

  for (const s of rows || []) {
    const id = safeId(s.ID, 'sis');
    desiredIds.add(id);
    const prev = existingMap.get(id);
    const createdAt = prev?.createdAt instanceof Timestamp ? prev.createdAt : serverTimestamp();
    ops.push({
      type: 'set',
      ref: doc(db, 'students', id),
      data: {
        kelas: safeId(s.Kelas, 'kls'),
        nama: clampNonEmpty(s.Nama, 'Siswa', 150),
        nis: clampStr(s.NIS, 40),
        ownerId: uid,
        createdAt,
        updatedAt: serverTimestamp()
      }
    });

    const privRef = doc(db, 'students', id, 'private', 'contact');
    let privCreatedAt: any = serverTimestamp();
    let prevPinHash = '';
    if (prev) {
      try {
        const pSnap = await getDoc(privRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          if (pData.createdAt instanceof Timestamp) privCreatedAt = pData.createdAt;
          if (typeof pData.pinHash === 'string') prevPinHash = pData.pinHash;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `students/${id}/private/contact`);
      }
    }
    ops.push({
      type: 'set',
      ref: privRef,
      data: {
        noSiswa: clampStr(s.NoSiswa, 40),
        noOrtu: clampStr(s.NoOrtu, 40),
        alamat: clampStr(s.Alamat, 400),
        kesehatan: clampStr(s.Kesehatan, 300),
        pinHash: clampStr(s.PinHash || prevPinHash, 128),
        ownerId: uid,
        createdAt: privCreatedAt,
        updatedAt: serverTimestamp()
      }
    });
  }

  for (const old of existing) {
    if (!desiredIds.has(old.id)) {
      ops.push({ type: 'delete', ref: doc(db, 'students', old.id, 'private', 'contact') });
      ops.push({ type: 'delete', ref: doc(db, 'students', old.id) });
    }
  }

  if (ops.length) {
    await commitOpsInChunks(ops, 'students');
  }
}

async function syncCbtToFirestore(rows: any[], uid: string): Promise<void> {
  const existing = await fetchOwnedDocs('cbtExams', uid);
  const existingMap = new Map<string, Record<string, any>>();
  existing.forEach(d => existingMap.set(d.id, d.data));

  const desiredIds = new Set<string>();
  const ops: BatchOp[] = [];

  for (const c of rows || []) {
    const id = safeId(c.ID, 'cbt');
    desiredIds.add(id);
    const prev = existingMap.get(id);
    const createdAt = prev?.createdAt instanceof Timestamp ? prev.createdAt : serverTimestamp();
    const validStatus = ['Draft', 'Aktif', 'Selesai'].includes(c.Status) ? c.Status : 'Draft';

    ops.push({
      type: 'set',
      ref: doc(db, 'cbtExams', id),
      data: {
        kelas: safeId(c.Kelas, 'kls'),
        judul: clampNonEmpty(c.Judul, 'Paket CBT', 250),
        mapel: clampStr(c.Mapel, 120),
        durasi: clampStr(c.Durasi || '30', 10),
        status: validStatus,
        acak: c.Acak === '1' ? '1' : '0',
        sumberMateri: clampStr(c.SumberMateri, 50000),
        namaFileMateri: clampStr(c.NamaFileMateri, 250),
        tanggalBuat: clampStr(c.TanggalBuat, 40),
        ownerId: uid,
        createdAt,
        updatedAt: serverTimestamp()
      }
    });

    const soalObj = safeParseMap(c.SoalJSON) || { soalPG: [], soalUraian: [] };
    const pgList = Array.isArray(soalObj.soalPG) ? soalObj.soalPG : [];
    const urList = Array.isArray(soalObj.soalUraian) ? soalObj.soalUraian : [];

    const existingPg = await fetchOwnedDocs(`cbtExams/${id}/pgQuestions`, uid);
    const desiredPgIds = new Set<string>();
    pgList.forEach((q: any, idx: number) => {
      const qId = safeId(q.id || `pg_${idx + 1}`, 'pg');
      desiredPgIds.add(qId);
      const prevPg = existingPg.find(x => x.id === qId);
      ops.push({
        type: 'set',
        ref: doc(db, 'cbtExams', id, 'pgQuestions', qId),
        data: {
          pertanyaan: clampNonEmpty(q.pertanyaan, 'Pertanyaan', 2000),
          opsiA: clampStr(q.opsiA, 500),
          opsiB: clampStr(q.opsiB, 500),
          opsiC: clampStr(q.opsiC, 500),
          opsiD: clampStr(q.opsiD, 500),
          opsiE: clampStr(q.opsiE, 500),
          kunci: ['A', 'B', 'C', 'D', 'E'].includes(String(q.kunci).toUpperCase())
            ? String(q.kunci).toUpperCase()
            : 'A',
          pembahasan: clampStr(q.pembahasan, 2000),
          kutipanMateri: clampStr(q.kutipanMateri, 1000),
          order: idx,
          ownerId: uid,
          createdAt: prevPg?.data.createdAt instanceof Timestamp ? prevPg.data.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      });
    });
    existingPg.forEach(old => {
      if (!desiredPgIds.has(old.id)) {
        ops.push({ type: 'delete', ref: doc(db, 'cbtExams', id, 'pgQuestions', old.id) });
      }
    });

    const existingUr = await fetchOwnedDocs(`cbtExams/${id}/essayQuestions`, uid);
    const desiredUrIds = new Set<string>();
    urList.forEach((q: any, idx: number) => {
      const qId = safeId(q.id || `ur_${idx + 1}`, 'ur');
      desiredUrIds.add(qId);
      const prevUr = existingUr.find(x => x.id === qId);
      ops.push({
        type: 'set',
        ref: doc(db, 'cbtExams', id, 'essayQuestions', qId),
        data: {
          pertanyaan: clampNonEmpty(q.pertanyaan, 'Pertanyaan Uraian', 2000),
          kunciRubrik: clampStr(q.kunciRubrik, 3000),
          poinMaksimal: Number(q.poinMaksimal) || 50,
          kutipanMateri: clampStr(q.kutipanMateri, 1000),
          order: idx,
          ownerId: uid,
          createdAt: prevUr?.data.createdAt instanceof Timestamp ? prevUr.data.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      });
    });
    existingUr.forEach(old => {
      if (!desiredUrIds.has(old.id)) {
        ops.push({ type: 'delete', ref: doc(db, 'cbtExams', id, 'essayQuestions', old.id) });
      }
    });
  }

  for (const old of existing) {
    if (!desiredIds.has(old.id)) {
      const oldPg = await fetchOwnedDocs(`cbtExams/${old.id}/pgQuestions`, uid);
      oldPg.forEach(q => ops.push({ type: 'delete', ref: doc(db, 'cbtExams', old.id, 'pgQuestions', q.id) }));
      const oldUr = await fetchOwnedDocs(`cbtExams/${old.id}/essayQuestions`, uid);
      oldUr.forEach(q => ops.push({ type: 'delete', ref: doc(db, 'cbtExams', old.id, 'essayQuestions', q.id) }));
      ops.push({ type: 'delete', ref: doc(db, 'cbtExams', old.id) });
    }
  }

  if (ops.length) {
    await commitOpsInChunks(ops, 'cbtExams');
  }
}

export async function syncSheetToFirestore(sheetName: string, rows: any[], uid: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const list = Array.isArray(rows) ? rows : [];

  switch (sheetName) {
    case 'Kelas':
      await replaceSimpleCollection(
        'classes',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'kls'),
          payload: {
            nama: clampNonEmpty(r.Nama, 'Kelas', 100),
            jurusan: clampStr(r.Jurusan, 100),
            mapel: clampStr(r.Mapel, 500)
          }
        }))
      );
      break;
    case 'Mapel':
      await replaceSimpleCollection(
        'subjects',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'mp'),
          payload: {
            nama: clampNonEmpty(r.Nama, 'Mata Pelajaran', 120)
          }
        }))
      );
      break;
    case 'Siswa':
      await syncStudentsToFirestore(list, uid);
      break;
    case 'Absensi':
      await replaceSimpleCollection(
        'attendance',
        uid,
        list.map(r => ({
          id: safeId(`${r.Kelas}_${r.Tanggal}_${r.SiswaID}`, 'abs'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            tanggal: clampStr(r.Tanggal, 20).trim().length >= 10 ? clampStr(r.Tanggal, 20).trim() : '2026-07-15',
            siswaId: safeId(r.SiswaID, 'sis'),
            kode: ['H', 'S', 'I', 'A', 'T', 'D'].includes(r.Kode) ? r.Kode : 'H',
            keterangan: clampStr(r.Keterangan, 300),
            sumber: clampStr(r.Sumber, 40)
          }
        }))
      );
      break;
    case 'Tugas':
      await replaceSimpleCollection(
        'assignments',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'tug'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            judul: clampNonEmpty(r.Judul, 'Tugas', 200),
            mapel: clampStr(r.Mapel, 120),
            deskripsi: clampStr(r.Deskripsi, 4000),
            tenggat: clampStr(r.Tenggat, 30),
            jenis: clampStr(r.Jenis, 50),
            fileId: clampStr(r.FileID, 128),
            namaFile: clampStr(r.NamaFile, 200)
          }
        }))
      );
      break;
    case 'Pengumpulan':
      await replaceSimpleCollection(
        'submissions',
        uid,
        list.map(r => ({
          id: safeId(`${r.TugasID}_${r.SiswaID}`, 'pg'),
          payload: {
            tugasId: safeId(r.TugasID, 'tug'),
            siswaId: safeId(r.SiswaID, 'sis'),
            status: ['Belum', 'Tepat Waktu', 'Terlambat'].includes(r.Status) ? r.Status : 'Belum',
            nilai: clampStr(r.Nilai, 20),
            fileId: clampStr(r.FileID, 128),
            namaFile: clampStr(r.NamaFile, 200),
            tanggalKumpul: clampStr(r.TanggalKumpul, 40),
            catatanSiswa: clampStr(r.CatatanSiswa, 1000)
          }
        }))
      );
      break;
    case 'Nilai':
      await replaceSimpleCollection(
        'grades',
        uid,
        list.map(r => ({
          id: safeId(`${r.Kelas}_${r.SiswaID}`, 'nil'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            siswaId: safeId(r.SiswaID, 'sis'),
            sikap: clampStr(r.Sikap, 10),
            tugas: clampStr(r.Tugas, 10),
            proyek: clampStr(r.Proyek, 10),
            uts: clampStr(r.UTS, 10),
            uas: clampStr(r.UAS, 10)
          }
        }))
      );
      break;
    case 'Perilaku':
      await replaceSimpleCollection(
        'behaviors',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'per'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            tanggal: clampStr(r.Tanggal, 20),
            siswaId: safeId(r.SiswaID, 'sis'),
            jenis: clampNonEmpty(r.Jenis, 'Catatan', 60),
            level: clampStr(r.Level, 10),
            catatan: clampStr(r.Catatan, 1000),
            tindakLanjut: clampStr(r.TindakLanjut, 500)
          }
        }))
      );
      break;
    case 'Checklist':
      await replaceSimpleCollection(
        'checklists',
        uid,
        list.map(r => ({
          id: safeId(`${r.Kelas}_${r.Item}`, 'chk'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            item: clampNonEmpty(r.Item, '0', 20),
            selesai: r.Selesai === '1' ? '1' : '0'
          }
        }))
      );
      break;
    case 'DenahAtur':
      await replaceSimpleCollection(
        'seatingConfigs',
        uid,
        list.map(r => ({
          id: safeId(r.Kelas, 'dat'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            baris: clampNonEmpty(r.Baris, '4', 10),
            kolom: clampNonEmpty(r.Kolom, '4', 10),
            grup: clampStr(r.Grup, 10)
          }
        }))
      );
      break;
    case 'Denah':
      await replaceSimpleCollection(
        'seating',
        uid,
        list.map(r => ({
          id: safeId(`${r.Kelas}_${r.Baris}_${r.Kolom}`, 'den'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            baris: clampNonEmpty(r.Baris, '1', 10),
            kolom: clampNonEmpty(r.Kolom, '1', 10),
            siswaId: safeId(r.SiswaID, 'sis')
          }
        }))
      );
      break;
    case 'Piket':
      await replaceSimpleCollection(
        'pickets',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'pik'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            hari: clampNonEmpty(r.Hari, 'Senin', 20),
            siswaId: safeId(r.SiswaID, 'sis'),
            tugas: clampStr(r.Tugas, 200)
          }
        }))
      );
      break;
    case 'Struktur':
      await replaceSimpleCollection(
        'structures',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'str'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            jabatan: clampNonEmpty(r.Jabatan, 'Pengurus', 100),
            siswaId: clampStr(r.SiswaID, 128),
            tingkat: clampStr(r.Tingkat, 10)
          }
        }))
      );
      break;
    case 'Jadwal':
      await replaceSimpleCollection(
        'schedules',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'jd'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].includes(r.Hari) ? r.Hari : 'Senin',
            mulai: clampNonEmpty(r.Mulai, '07:00', 10),
            selesai: clampNonEmpty(r.Selesai, '08:00', 10),
            mapel: clampStr(r.Mapel, 120),
            guru: clampStr(r.Guru, 150),
            jenis: clampStr(r.Jenis, 40),
            pekan: clampStr(r.Pekan, 5)
          }
        }))
      );
      break;
    case 'JadwalAtur':
      await replaceSimpleCollection(
        'scheduleConfigs',
        uid,
        list.map(r => ({
          id: safeId(r.Kelas, 'jat'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            sistem: clampNonEmpty(r.Sistem, 'reguler', 20),
            mulai: clampStr(r.Mulai, 10),
            durasi: clampStr(r.Durasi, 10),
            jumlah: clampStr(r.Jumlah, 10),
            istirahat: clampStr(r.Istirahat, 100)
          }
        }))
      );
      break;
    case 'Akademik':
      await replaceSimpleCollection(
        'academicEvents',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'ak'),
          payload: {
            mulai: clampStr(r.Mulai, 20).trim().length >= 10 ? clampStr(r.Mulai, 20).trim() : '2026-07-15',
            selesai: clampStr(r.Selesai, 20),
            kegiatan: clampNonEmpty(r.Kegiatan, 'Agenda Akademik', 300),
            jenis: clampNonEmpty(r.Jenis, 'Kegiatan sekolah', 60),
            sumber: clampStr(r.Sumber || '', 100)
          }
        }))
      );
      break;
    case 'TP':
      await replaceSimpleCollection(
        'learningObjectives',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'tp'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            kode: clampNonEmpty(r.Kode, 'TP', 40),
            tujuan: clampNonEmpty(r.Tujuan, 'Tujuan Pembelajaran', 1000),
            materi: clampStr(r.Materi, 300),
            status: clampStr(r.Status, 40)
          }
        }))
      );
      break;
    case 'Modul':
      await replaceSimpleCollection(
        'modules',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'mod'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            judul: clampNonEmpty(r.Judul, 'Modul Ajar', 250),
            mapel: clampStr(r.Mapel, 120),
            alokasi: clampStr(r.Alokasi, 80),
            tpIds: clampStr(r.TPIDs, 500),
            pembuka: clampStr(r.Pembuka, 4000),
            inti: clampStr(r.Inti, 8000),
            penutup: clampStr(r.Penutup, 4000),
            asesmen: clampStr(r.Asesmen, 4000),
            media: clampStr(r.Media, 500),
            catatan: clampStr(r.Catatan, 2000)
          }
        }))
      );
      break;
    case 'Pemantik':
      await replaceSimpleCollection(
        'starters',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'pem'),
          payload: {
            kelas: safeId(r.Kelas, 'kls'),
            judul: clampNonEmpty(r.Judul, 'Pemantik', 250),
            tautan: clampStr(r.Tautan, 500),
            pertanyaan: clampStr(r.Pertanyaan, 2000),
            slide: clampStr(r.Slide, 15000)
          }
        }))
      );
      break;
    case 'BerkasCloud':
      await replaceSimpleCollection(
        'cloudFiles',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'cld'),
          payload: {
            kelas: clampStr(r.Kelas, 128),
            namaFile: clampNonEmpty(r.NamaFile, 'Berkas', 250),
            tipeMime: clampStr(r.TipeMime, 120),
            ukuran: clampStr(r.Ukuran, 40),
            tanggalUnggah: clampStr(r.TanggalUnggah, 40),
            pengunggah: clampStr(r.Pengunggah, 150),
            statusCloud: clampStr(r.StatusCloud, 120),
            pathSimpan: clampStr(r.PathSimpan, 300),
            analisis: safeParseMap(r.AnalisisJSON)
          }
        }))
      );
      break;
    case 'CBT':
      await syncCbtToFirestore(list, uid);
      break;
    case 'HasilCBT':
      await replaceSimpleCollection(
        'cbtResults',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'hcbt'),
          payload: {
            cbtId: safeId(r.CBTID, 'cbt'),
            kelas: safeId(r.Kelas, 'kls'),
            siswaId: safeId(r.SiswaID, 'sis'),
            mulai: clampStr(r.Mulai, 40),
            selesai: clampStr(r.Selesai, 40),
            jawaban: safeParseMap(r.JawabanJSON),
            skorPG: clampStr(r.SkorPG, 20),
            skorUraian: clampStr(r.SkorUraian, 20),
            skorAkhir: clampStr(r.SkorAkhir, 20),
            feedbackAI: safeParseMap(r.FeedbackAI),
            statusNilai: ['Menunggu Nilai Uraian', 'Dinilai AI', 'Final', 'Selesai'].includes(r.StatusNilai)
              ? r.StatusNilai
              : 'Selesai'
          }
        }))
      );
      break;
    case 'Pengguna':
      await replaceSimpleCollection(
        'staffUsers',
        uid,
        list.map(r => ({
          id: safeId(r.ID, 'usr'),
          payload: {
            nama: clampNonEmpty(r.Nama, 'Guru', 150),
            username: clampNonEmpty(r.Username, 'user_' + safeId(r.ID, 'u'), 60),
            peran: clampNonEmpty(r.Peran, 'guru', 40),
            kelas: clampStr(r.Kelas, 500),
            mapel: clampStr(r.Mapel, 500),
            kelasWali: clampStr(r.KelasWali, 500),
            kelasMengajar: clampStr(r.KelasMengajar, 500)
          }
        }))
      );
      break;
    default:
      break;
  }
}

export async function syncAllToFirestore(appDb: Record<string, any>, uid: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  if (appDb.Pengaturan) {
    await syncPengaturanToFirestore(appDb.Pengaturan, uid);
  }
  const sheetOrder = [
    'Kelas',
    'Mapel',
    'Siswa',
    'Absensi',
    'Tugas',
    'Pengumpulan',
    'Nilai',
    'Perilaku',
    'Checklist',
    'DenahAtur',
    'Denah',
    'Piket',
    'Struktur',
    'Jadwal',
    'JadwalAtur',
    'Akademik',
    'TP',
    'Modul',
    'Pemantik',
    'BerkasCloud',
    'CBT',
    'HasilCBT',
    'Pengguna'
  ];
  for (const name of sheetOrder) {
    if (Array.isArray(appDb[name])) {
      const rows =
        name === 'Siswa' && appDb.pinHashes && typeof appDb.pinHashes === 'object'
          ? appDb[name].map((s: any) => ({
              ...s,
              PinHash: s.PinHash || appDb.pinHashes[s.ID] || ''
            }))
          : appDb[name];
      await syncSheetToFirestore(name, rows, uid);
    }
  }
}

export async function loadWorkspaceFromFirestore(uid: string): Promise<Record<string, any> | null> {
  if (!auth.currentUser?.emailVerified) return null;

  const [
    settingsDocs,
    classesDocs,
    subjectsDocs,
    studentsDocs,
    attendanceDocs,
    assignmentsDocs,
    submissionsDocs,
    gradesDocs,
    behaviorsDocs,
    checklistsDocs,
    seatingConfigsDocs,
    seatingDocs,
    picketsDocs,
    structuresDocs,
    schedulesDocs,
    scheduleConfigsDocs,
    academicDocs,
    tpDocs,
    modulesDocs,
    startersDocs,
    cloudDocs,
    cbtDocs,
    cbtResultsDocs,
    staffDocs
  ] = await Promise.all([
    fetchOwnedDocs('settings', uid),
    fetchOwnedDocs('classes', uid),
    fetchOwnedDocs('subjects', uid),
    fetchOwnedDocs('students', uid),
    fetchOwnedDocs('attendance', uid),
    fetchOwnedDocs('assignments', uid),
    fetchOwnedDocs('submissions', uid),
    fetchOwnedDocs('grades', uid),
    fetchOwnedDocs('behaviors', uid),
    fetchOwnedDocs('checklists', uid),
    fetchOwnedDocs('seatingConfigs', uid),
    fetchOwnedDocs('seating', uid),
    fetchOwnedDocs('pickets', uid),
    fetchOwnedDocs('structures', uid),
    fetchOwnedDocs('schedules', uid),
    fetchOwnedDocs('scheduleConfigs', uid),
    fetchOwnedDocs('academicEvents', uid),
    fetchOwnedDocs('learningObjectives', uid),
    fetchOwnedDocs('modules', uid),
    fetchOwnedDocs('starters', uid),
    fetchOwnedDocs('cloudFiles', uid),
    fetchOwnedDocs('cbtExams', uid),
    fetchOwnedDocs('cbtResults', uid),
    fetchOwnedDocs('staffUsers', uid)
  ]);

  if (!settingsDocs.length && !classesDocs.length && !academicDocs.length) {
    return null;
  }

  const sData = settingsDocs[0]?.data || {};
  const Pengaturan: Record<string, string> = {
    sekolah: sData.sekolah || 'SMA Negeri 1 Nusantara',
    jurusan: sData.jurusan || '',
    waInfo: sData.waInfo || '',
    guru: sData.guru || '',
    wali: sData.wali || '',
    semester: sData.semester || '',
    mulai: sData.mulai || '',
    kkm: sData.kkm || '75',
    b_sikap: sData.b_sikap || '10',
    b_tugas: sData.b_tugas || '20',
    b_proyek: sData.b_proyek || '20',
    b_uts: sData.b_uts || '20',
    b_uas: sData.b_uas || '30',
    logo: sData.logo || '',
    jurusanLogos:
      sData.jurusanLogos && typeof sData.jurusanLogos === 'object'
        ? JSON.stringify(sData.jurusanLogos)
        : '{}',
    kaldikAutoSync: sData.kaldikAutoSync || '1',
    kaldikWilayah: sData.kaldikWilayah || 'Provinsi Jawa Barat',
    kaldikTahunAjaran: sData.kaldikTahunAjaran || '2026/2027',
    kaldikLastSync: sData.kaldikLastSync || ''
  };

  const Siswa = await Promise.all(
    studentsDocs.map(async d => {
      let priv: Record<string, any> = {};
      try {
        const pSnap = await getDoc(doc(db, 'students', d.id, 'private', 'contact'));
        if (pSnap.exists()) priv = pSnap.data();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `students/${d.id}/private/contact`);
      }
      return {
        ID: d.id,
        Kelas: d.data.kelas || '',
        Nama: d.data.nama || '',
        NIS: d.data.nis || '',
        NoSiswa: priv.noSiswa || '',
        NoOrtu: priv.noOrtu || '',
        Alamat: priv.alamat || '',
        Kesehatan: priv.kesehatan || '',
        PinHash: priv.pinHash || ''
      };
    })
  );

  const CBT = await Promise.all(
    cbtDocs.map(async c => {
      const [pgDocs, urDocs] = await Promise.all([
        fetchOwnedDocs(`cbtExams/${c.id}/pgQuestions`, uid),
        fetchOwnedDocs(`cbtExams/${c.id}/essayQuestions`, uid)
      ]);
      const soalPG = pgDocs
        .sort((a, b) => (Number(a.data.order) || 0) - (Number(b.data.order) || 0))
        .map(q => ({
          id: q.id,
          pertanyaan: q.data.pertanyaan || '',
          opsiA: q.data.opsiA || '',
          opsiB: q.data.opsiB || '',
          opsiC: q.data.opsiC || '',
          opsiD: q.data.opsiD || '',
          opsiE: q.data.opsiE || '',
          kunci: q.data.kunci || 'A',
          pembahasan: q.data.pembahasan || '',
          kutipanMateri: q.data.kutipanMateri || ''
        }));
      const soalUraian = urDocs
        .sort((a, b) => (Number(a.data.order) || 0) - (Number(b.data.order) || 0))
        .map(q => ({
          id: q.id,
          pertanyaan: q.data.pertanyaan || '',
          kunciRubrik: q.data.kunciRubrik || '',
          poinMaksimal: Number(q.data.poinMaksimal) || 50,
          kutipanMateri: q.data.kutipanMateri || ''
        }));
      return {
        ID: c.id,
        Kelas: c.data.kelas || '',
        Judul: c.data.judul || '',
        Mapel: c.data.mapel || '',
        Durasi: c.data.durasi || '30',
        Status: c.data.status || 'Draft',
        Acak: c.data.acak || '0',
        SumberMateri: c.data.sumberMateri || '',
        NamaFileMateri: c.data.namaFileMateri || '',
        TanggalBuat: c.data.tanggalBuat || '',
        SoalJSON: JSON.stringify({ soalPG, soalUraian })
      };
    })
  );

  return {
    Pengaturan,
    Kelas: classesDocs.map(d => ({
      ID: d.id,
      Nama: d.data.nama || '',
      Jurusan: d.data.jurusan || '',
      Mapel: d.data.mapel || ''
    })),
    Mapel: subjectsDocs.map(d => ({ ID: d.id, Nama: d.data.nama || '' })),
    Siswa,
    Absensi: attendanceDocs.map(d => ({
      Kelas: d.data.kelas || '',
      Tanggal: d.data.tanggal || '',
      SiswaID: d.data.siswaId || '',
      Kode: d.data.kode || 'H',
      Keterangan: d.data.keterangan || '',
      Sumber: d.data.sumber || ''
    })),
    Tugas: assignmentsDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Judul: d.data.judul || '',
      Mapel: d.data.mapel || '',
      Deskripsi: d.data.deskripsi || '',
      Tenggat: d.data.tenggat || '',
      Jenis: d.data.jenis || '',
      FileID: d.data.fileId || '',
      NamaFile: d.data.namaFile || ''
    })),
    Pengumpulan: submissionsDocs.map(d => ({
      TugasID: d.data.tugasId || '',
      SiswaID: d.data.siswaId || '',
      Status: d.data.status || 'Belum',
      Nilai: d.data.nilai || '',
      FileID: d.data.fileId || '',
      NamaFile: d.data.namaFile || '',
      TanggalKumpul: d.data.tanggalKumpul || '',
      CatatanSiswa: d.data.catatanSiswa || ''
    })),
    Nilai: gradesDocs.map(d => ({
      Kelas: d.data.kelas || '',
      SiswaID: d.data.siswaId || '',
      Sikap: d.data.sikap || '',
      Tugas: d.data.tugas || '',
      Proyek: d.data.proyek || '',
      UTS: d.data.uts || '',
      UAS: d.data.uas || ''
    })),
    Perilaku: behaviorsDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Tanggal: d.data.tanggal || '',
      SiswaID: d.data.siswaId || '',
      Jenis: d.data.jenis || '',
      Level: d.data.level || '',
      Catatan: d.data.catatan || '',
      TindakLanjut: d.data.tindakLanjut || ''
    })),
    Checklist: checklistsDocs.map(d => ({
      Kelas: d.data.kelas || '',
      Item: d.data.item || '',
      Selesai: d.data.selesai || '0'
    })),
    DenahAtur: seatingConfigsDocs.map(d => ({
      Kelas: d.data.kelas || '',
      Baris: d.data.baris || '4',
      Kolom: d.data.kolom || '4',
      Grup: d.data.grup || '2'
    })),
    Denah: seatingDocs.map(d => ({
      Kelas: d.data.kelas || '',
      Baris: d.data.baris || '',
      Kolom: d.data.kolom || '',
      SiswaID: d.data.siswaId || ''
    })),
    Piket: picketsDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Hari: d.data.hari || '',
      SiswaID: d.data.siswaId || '',
      Tugas: d.data.tugas || ''
    })),
    Struktur: structuresDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Jabatan: d.data.jabatan || '',
      SiswaID: d.data.siswaId || '',
      Tingkat: d.data.tingkat || '3'
    })),
    Jadwal: schedulesDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Hari: d.data.hari || '',
      Mulai: d.data.mulai || '',
      Selesai: d.data.selesai || '',
      Mapel: d.data.mapel || '',
      Guru: d.data.guru || '',
      Jenis: d.data.jenis || '',
      Pekan: d.data.pekan || ''
    })),
    JadwalAtur: scheduleConfigsDocs.map(d => ({
      Kelas: d.data.kelas || '',
      Sistem: d.data.sistem || 'reguler',
      Mulai: d.data.mulai || '',
      Durasi: d.data.durasi || '',
      Jumlah: d.data.jumlah || '',
      Istirahat: d.data.istirahat || ''
    })),
    Akademik: academicDocs.map(d => ({
      ID: d.id,
      Mulai: d.data.mulai || '',
      Selesai: d.data.selesai || '',
      Kegiatan: d.data.kegiatan || '',
      Jenis: d.data.jenis || '',
      Sumber: d.data.sumber || ''
    })),
    TP: tpDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Kode: d.data.kode || '',
      Tujuan: d.data.tujuan || '',
      Materi: d.data.materi || '',
      Status: d.data.status || ''
    })),
    Modul: modulesDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Judul: d.data.judul || '',
      Mapel: d.data.mapel || '',
      Alokasi: d.data.alokasi || '',
      TPIDs: d.data.tpIds || '',
      Pembuka: d.data.pembuka || '',
      Inti: d.data.inti || '',
      Penutup: d.data.penutup || '',
      Asesmen: d.data.asesmen || '',
      Media: d.data.media || '',
      Catatan: d.data.catatan || ''
    })),
    Pemantik: startersDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      Judul: d.data.judul || '',
      Tautan: d.data.tautan || '',
      Pertanyaan: d.data.pertanyaan || '',
      Slide: d.data.slide || ''
    })),
    BerkasCloud: cloudDocs.map(d => ({
      ID: d.id,
      Kelas: d.data.kelas || '',
      NamaFile: d.data.namaFile || '',
      TipeMime: d.data.tipeMime || '',
      Ukuran: d.data.ukuran || '',
      TanggalUnggah: d.data.tanggalUnggah || '',
      Pengunggah: d.data.pengunggah || '',
      StatusCloud: d.data.statusCloud || '',
      PathSimpan: d.data.pathSimpan || '',
      AnalisisJSON: d.data.analisis ? JSON.stringify(d.data.analisis) : ''
    })),
    CBT,
    HasilCBT: cbtResultsDocs.map(d => ({
      ID: d.id,
      CBTID: d.data.cbtId || '',
      Kelas: d.data.kelas || '',
      SiswaID: d.data.siswaId || '',
      Mulai: d.data.mulai || '',
      Selesai: d.data.selesai || '',
      JawabanJSON: d.data.jawaban ? JSON.stringify(d.data.jawaban) : '',
      SkorPG: d.data.skorPG || '',
      SkorUraian: d.data.skorUraian || '',
      SkorAkhir: d.data.skorAkhir || '',
      FeedbackAI: d.data.feedbackAI ? JSON.stringify(d.data.feedbackAI) : '',
      StatusNilai: d.data.statusNilai || 'Selesai'
    })),
    Pengguna: staffDocs.map(d => ({
      ID: d.id,
      Nama: d.data.nama || '',
      Username: d.data.username || '',
      Peran: d.data.peran || '',
      Kelas: d.data.kelas || '',
      Mapel: d.data.mapel || '',
      KelasWali: d.data.kelasWali || '',
      KelasMengajar: d.data.kelasMengajar || ''
    }))
  };
}

export async function getFirestoreCollectionCounts(uid: string): Promise<Record<string, number>> {
  if (!auth.currentUser?.emailVerified) return {};
  const cols = [
    'classes',
    'subjects',
    'students',
    'attendance',
    'assignments',
    'submissions',
    'grades',
    'behaviors',
    'schedules',
    'academicEvents',
    'learningObjectives',
    'modules',
    'cloudFiles',
    'cbtExams',
    'cbtResults',
    'staffUsers'
  ];
  const entries = await Promise.all(
    cols.map(async col => {
      const docs = await fetchOwnedDocs(col, uid);
      return [col, docs.length] as const;
    })
  );
  return Object.fromEntries(entries);
}
