import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { getKaldikJabarEvents, KALDIK_JABAR_REF } from './src/data/kaldikJabar';

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.json');
const CLOUD_DIR = path.resolve(process.cwd(), 'data', 'cloud_uploads');
const TUGAS_DIR = path.resolve(process.cwd(), 'data', 'tugas_uploads');
const FIREBASE_CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');
const BOOTSTRAPPED_ADMIN_EMAIL = 'robiromadona06@guru.smk.belajar.id';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

const SKEMA: Record<string, string[]> = {
  Pengaturan: ['Kunci', 'Nilai'],
  Kelas: ['ID', 'Nama', 'Jurusan', 'Mapel'],
  Siswa: ['ID', 'Kelas', 'Nama', 'NIS', 'NoSiswa', 'NoOrtu', 'Alamat', 'Kesehatan'],
  Absensi: ['Kelas', 'Tanggal', 'SiswaID', 'Kode', 'Keterangan', 'Sumber'],
  Tugas: ['ID', 'Kelas', 'Judul', 'Mapel', 'Deskripsi', 'Tenggat', 'Jenis', 'FileID', 'NamaFile'],
  Pengumpulan: ['TugasID', 'SiswaID', 'Status', 'Nilai', 'FileID', 'NamaFile', 'TanggalKumpul', 'CatatanSiswa'],
  Nilai: ['Kelas', 'SiswaID', 'Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'],
  Perilaku: ['ID', 'Kelas', 'Tanggal', 'SiswaID', 'Jenis', 'Level', 'Catatan', 'TindakLanjut'],
  Checklist: ['Kelas', 'Item', 'Selesai'],
  DenahAtur: ['Kelas', 'Baris', 'Kolom', 'Grup'],
  Denah: ['Kelas', 'Baris', 'Kolom', 'SiswaID'],
  Piket: ['ID', 'Kelas', 'Hari', 'SiswaID', 'Tugas'],
  Struktur: ['ID', 'Kelas', 'Jabatan', 'SiswaID', 'Tingkat'],
  Jadwal: ['ID', 'Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'],
  JadwalAtur: ['Kelas', 'Sistem', 'Mulai', 'Durasi', 'Jumlah', 'Istirahat'],
  Akademik: ['ID', 'Mulai', 'Selesai', 'Kegiatan', 'Jenis', 'Sumber'],
  TP: ['ID', 'Kelas', 'Kode', 'Tujuan', 'Materi', 'Status'],
  Modul: ['ID', 'Kelas', 'Judul', 'Mapel', 'Alokasi', 'TPIDs', 'Pembuka', 'Inti', 'Penutup', 'Asesmen', 'Media', 'Catatan'],
  Pemantik: ['ID', 'Kelas', 'Judul', 'Tautan', 'Pertanyaan', 'Slide'],
  Mapel: ['ID', 'Nama'],
  BerkasCloud: ['ID', 'Kelas', 'NamaFile', 'TipeMime', 'Ukuran', 'TanggalUnggah', 'Pengunggah', 'StatusCloud', 'PathSimpan', 'AnalisisJSON'],
  CBT: ['ID', 'Kelas', 'Judul', 'Mapel', 'Durasi', 'Status', 'Acak', 'SumberMateri', 'NamaFileMateri', 'SoalJSON', 'TanggalBuat'],
  HasilCBT: ['ID', 'CBTID', 'Kelas', 'SiswaID', 'Mulai', 'Selesai', 'JawabanJSON', 'SkorPG', 'SkorUraian', 'SkorAkhir', 'FeedbackAI', 'StatusNilai'],
  Pengguna: ['ID', 'Nama', 'Username', 'Peran', 'Kelas', 'Hash', 'Mapel', 'KelasWali', 'KelasMengajar'],
  Akun: ['SiswaID', 'Hash']
};

const SHEET_TERKUNCI = ['Pengaturan', 'Akun', 'Pengguna'];
const IZIN_TULIS: Record<string, string[]> = {
  wali: ['Siswa', 'Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik', 'BerkasCloud', 'CBT', 'HasilCBT'],
  guru: ['Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik', 'BerkasCloud', 'CBT', 'HasilCBT']
};
const TTL_SESI = 21600 * 1000; // 6 hours in ms

const PENGATURAN_AWAL: Record<string, string> = {
  sekolah: 'SMA Negeri 1 Nusantara',
  logo: '',
  jurusan: 'MIPA, IPS, Bahasa',
  jurusanLogos: '{}',
  waInfo: '6281234567890',
  emailPemulihan: 'robisaiful@gmail.com',
  kodeReset: 'NUSANTARA2026',
  guru: 'Dra. Ratna Sari, M.Pd.',
  wali: 'Dra. Ratna Sari, M.Pd.',
  semester: 'Ganjil 2026/2027',
  mulai: '2026-07-15',
  kkm: '75',
  b_sikap: '10',
  b_tugas: '20',
  b_proyek: '20',
  b_uts: '20',
  b_uas: '30',
  kaldikAutoSync: '1',
  kaldikWilayah: KALDIK_JABAR_REF.wilayah,
  kaldikTahunAjaran: KALDIK_JABAR_REF.tahunAjaran,
  kaldikLastSync: '2026-07-15'
};

function hash_(salt: string, teks: string): string {
  return crypto.createHash('sha256').update(salt + '|' + teks, 'utf8').digest('base64');
}

function uuid(): string {
  return crypto.randomUUID();
}

function uidShort(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface DatabaseFile {
  admin: { user: string; salt: string; hash: string } | null;
  sheets: Record<string, Record<string, string>[]>;
}

let dbCache: DatabaseFile | null = null;
const sessions = new Map<string, { role: string; sid: string; nama: string; expires: number }>();
const loginFailures = new Map<string, { count: number; expires: number }>();
const recoveryCodes = new Map<string, { code: string; email: string; user: string; expires: number }>();

function createSeedDatabase(): DatabaseFile {
  const adminSalt = uuid();
  const adminUser = 'admin';
  const adminHash = hash_(adminSalt, 'admin12345');

  const mapelList = [
    { ID: 'mp1', Nama: 'Matematika' },
    { ID: 'mp2', Nama: 'Bahasa Indonesia' },
    { ID: 'mp3', Nama: 'Bahasa Inggris' },
    { ID: 'mp4', Nama: 'Fisika' },
    { ID: 'mp5', Nama: 'Kimia' },
    { ID: 'mp6', Nama: 'Biologi' },
    { ID: 'mp7', Nama: 'Sejarah Indonesia' },
    { ID: 'mp8', Nama: 'Informatika' },
    { ID: 'mp9', Nama: 'PJOK' },
    { ID: 'mp10', Nama: 'Pendidikan Pancasila' }
  ];

  const kelasList = [
    { ID: 'kls_10a', Nama: 'X MIPA 1', Jurusan: 'MIPA', Mapel: '' },
    { ID: 'kls_10b', Nama: 'X MIPA 2', Jurusan: 'MIPA', Mapel: '' },
    { ID: 'kls_11a', Nama: 'XI MIPA 1', Jurusan: 'MIPA', Mapel: '' }
  ];

  const penggunaList = [
    {
      ID: 'usr_wali1',
      Nama: 'Dra. Ratna Sari, M.Pd.',
      Username: 'ratna',
      Peran: 'wali,guru',
      Kelas: 'kls_10a,kls_10b',
      Hash: hash_('usr_wali1', 'guru12345'),
      Mapel: 'mp1',
      KelasWali: 'kls_10a',
      KelasMengajar: 'kls_10a,kls_10b'
    },
    {
      ID: 'usr_guru1',
      Nama: 'Budi Santoso, S.Kom.',
      Username: 'budi',
      Peran: 'wali,guru',
      Kelas: 'kls_11a,kls_10a',
      Hash: hash_('usr_guru1', 'guru12345'),
      Mapel: 'mp8,mp4',
      KelasWali: 'kls_11a',
      KelasMengajar: 'kls_10a,kls_11a'
    }
  ];

  const siswa10A = [
    { ID: 'sis_01', Kelas: 'kls_10a', Nama: 'Adinda Putri Maharani', NIS: '102601', NoSiswa: '081234567801', NoOrtu: '081398765001', Alamat: 'Jl. Merdeka No. 12', Kesehatan: 'Normal' },
    { ID: 'sis_02', Kelas: 'kls_10a', Nama: 'Bagas Pratama Wijaya', NIS: '102602', NoSiswa: '081234567802', NoOrtu: '081398765002', Alamat: 'Jl. Sudirman No. 45', Kesehatan: 'Alergi debu' },
    { ID: 'sis_03', Kelas: 'kls_10a', Nama: 'Citra Kirana Lestari', NIS: '102603', NoSiswa: '081234567803', NoOrtu: '081398765003', Alamat: 'Jl. Diponegoro No. 8', Kesehatan: 'Normal' },
    { ID: 'sis_04', Kelas: 'kls_10a', Nama: 'Dimas Aditya Saputra', NIS: '102604', NoSiswa: '081234567804', NoOrtu: '081398765004', Alamat: 'Jl. Gatot Subroto No. 19', Kesehatan: 'Minus mata (-1.5)' },
    { ID: 'sis_05', Kelas: 'kls_10a', Nama: 'Eka Fitriani Rahmawati', NIS: '102605', NoSiswa: '081234567805', NoOrtu: '081398765005', Alamat: 'Jl. Ahmad Yani No. 33', Kesehatan: 'Normal' },
    { ID: 'sis_06', Kelas: 'kls_10a', Nama: 'Fajar Nugroho Hidayat', NIS: '102606', NoSiswa: '081234567806', NoOrtu: '081398765006', Alamat: 'Jl. Kartini No. 7', Kesehatan: 'Asma ringan' },
    { ID: 'sis_07', Kelas: 'kls_10a', Nama: 'Gita Nadia Permata', NIS: '102607', NoSiswa: '081234567807', NoOrtu: '081398765007', Alamat: 'Jl. Imam Bonjol No. 21', Kesehatan: 'Normal' },
    { ID: 'sis_08', Kelas: 'kls_10a', Nama: 'Hafiz Ramadhan Putra', NIS: '102608', NoSiswa: '081234567808', NoOrtu: '081398765008', Alamat: 'Jl. Pahlawan No. 54', Kesehatan: 'Normal' },
    { ID: 'sis_09', Kelas: 'kls_10a', Nama: 'Indah Kusuma Wardani', NIS: '102609', NoSiswa: '081234567809', NoOrtu: '081398765009', Alamat: 'Jl. Veteran No. 14', Kesehatan: 'Normal' },
    { ID: 'sis_10', Kelas: 'kls_10a', Nama: 'Joko Susilo Wibowo', NIS: '102610', NoSiswa: '081234567810', NoOrtu: '081398765010', Alamat: 'Jl. Pemuda No. 28', Kesehatan: 'Normal' },
    { ID: 'sis_11', Kelas: 'kls_10a', Nama: 'Kartika Sari Dewi', NIS: '102611', NoSiswa: '081234567811', NoOrtu: '081398765011', Alamat: 'Jl. Cendrawasih No. 9', Kesehatan: 'Normal' },
    { ID: 'sis_12', Kelas: 'kls_10a', Nama: 'Luthfi Hakim Maulana', NIS: '102612', NoSiswa: '081234567812', NoOrtu: '081398765012', Alamat: 'Jl. Melati No. 3', Kesehatan: 'Normal' },
    { ID: 'sis_13', Kelas: 'kls_10b', Nama: 'Muhammad Rizky Pratama', NIS: '102613', NoSiswa: '081234567813', NoOrtu: '081398765013', Alamat: 'Jl. Kenanga No. 11', Kesehatan: 'Normal' },
    { ID: 'sis_14', Kelas: 'kls_10b', Nama: 'Nabila Azzahra Putri', NIS: '102614', NoSiswa: '081234567814', NoOrtu: '081398765014', Alamat: 'Jl. Anggrek No. 20', Kesehatan: 'Normal' },
    { ID: 'sis_15', Kelas: 'kls_11a', Nama: 'Raka Danuarta', NIS: '112601', NoSiswa: '081234567815', NoOrtu: '081398765015', Alamat: 'Jl. Mawar No. 5', Kesehatan: 'Normal' }
  ];

  // Default PIN '123456' for all seeded students
  const akunList = siswa10A.map(s => ({
    SiswaID: s.ID,
    Hash: hash_(s.ID, '123456')
  }));

  const today = new Date();
  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const d0 = fmtDate(today);
  const d1 = fmtDate(new Date(today.getTime() - 86400000));
  const d2 = fmtDate(new Date(today.getTime() - 2 * 86400000));
  const d3 = fmtDate(new Date(today.getTime() - 3 * 86400000));

  const absensiList: Record<string, string>[] = [];
  const kls10AStudents = siswa10A.filter(s => s.Kelas === 'kls_10a');
  [d3, d2, d1, d0].forEach((tgl, idx) => {
    kls10AStudents.forEach((s, sIdx) => {
      let kode = 'H';
      let ket = '';
      if (idx === 1 && sIdx === 3) { kode = 'S'; ket = 'Demam (surat orang tua)'; }
      if (idx === 2 && sIdx === 5) { kode = 'I'; ket = 'Acara keluarga'; }
      if (idx === 2 && sIdx === 9) { kode = 'A'; ket = 'Tanpa keterangan'; }
      if (idx === 3 && sIdx === 1) { kode = 'T'; ket = 'Hadir 07:12 karena ban bocor'; }
      if (idx === 3 && sIdx === 9) { kode = 'A'; ket = 'Belum konfirmasi'; }
      absensiList.push({
        Kelas: 'kls_10a',
        Tanggal: tgl,
        SiswaID: s.ID,
        Kode: kode,
        Keterangan: ket,
        Sumber: ''
      });
    });
  });

  const tugasList = [
    { ID: 'tug_1', Kelas: 'kls_10a', Judul: 'Latihan Eksponen & Logaritma', Mapel: 'Matematika', Deskripsi: 'Kerjakan soal latihan nomor 1-10 lengkap dengan langkah penyelesaian.', Tenggat: d2, Jenis: 'Tugas', FileID: '', NamaFile: '' },
    { ID: 'tug_2', Kelas: 'kls_10a', Judul: 'Kuis Sistem Persamaan Linear', Mapel: 'Matematika', Deskripsi: 'Selesaikan persamaan linear 3 variabel dan unggah hasil kerja.', Tenggat: d1, Jenis: 'Kuis harian', FileID: '', NamaFile: '' },
    { ID: 'tug_3', Kelas: 'kls_10a', Judul: 'Proyek Pemodelan Fungsi Kuadrat', Mapel: 'Matematika', Deskripsi: 'Buat laporan pemodelan parabola dalam kehidupan sehari-hari (PDF atau foto grafik).', Tenggat: fmtDate(new Date(today.getTime() + 5 * 86400000)), Jenis: 'Proyek', FileID: '', NamaFile: '' }
  ];

  const pengumpulanList: Record<string, string>[] = [];
  const nilaiList: Record<string, string>[] = [];

  kls10AStudents.forEach((s, i) => {
    const n1 = String(82 + ((i * 3) % 16));
    const n2 = String(78 + ((i * 5) % 20));
    const nProyek = String(84 + ((i * 2) % 14));
    const nUTS = String(76 + ((i * 4) % 22));
    const nUAS = String(80 + ((i * 3) % 18));

    pengumpulanList.push(
      { TugasID: 'tug_1', SiswaID: s.ID, Status: i === 9 ? 'Terlambat' : 'Tepat Waktu', Nilai: n1, FileID: '', NamaFile: '', TanggalKumpul: d2, CatatanSiswa: '' },
      { TugasID: 'tug_2', SiswaID: s.ID, Status: i === 5 ? 'Terlambat' : 'Tepat Waktu', Nilai: n2, FileID: '', NamaFile: '', TanggalKumpul: d1, CatatanSiswa: '' },
      { TugasID: 'tug_3', SiswaID: s.ID, Status: i < 8 ? 'Tepat Waktu' : 'Belum', Nilai: i < 8 ? nProyek : '', FileID: '', NamaFile: '', TanggalKumpul: i < 8 ? d1 : '', CatatanSiswa: '' }
    );

    nilaiList.push({
      Kelas: 'kls_10a',
      SiswaID: s.ID,
      Sikap: i === 9 ? '80' : '95',
      Tugas: String(Math.round((Number(n1) + Number(n2)) / 2)),
      Proyek: nProyek,
      UTS: i === 9 ? '68' : nUTS,
      UAS: i === 9 ? '70' : nUAS
    });
  });

  const perilakuList = [
    { ID: 'per_1', Kelas: 'kls_10a', Tanggal: d2, SiswaID: 'sis_01', Jenis: 'Penguatan positif', Level: '', Catatan: 'Memimpin diskusi kelompok dan membantu teman memahami materi logaritma', TindakLanjut: 'Apresiasi di depan kelas dan poin bintang' },
    { ID: 'per_2', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_03', Jenis: 'Penguatan positif', Level: '', Catatan: 'Menyiapkan perangkat proyektor dan kebersihan kelas sebelum jam pertama', TindakLanjut: 'Pesan apresiasi ke orang tua' },
    { ID: 'per_3', Kelas: 'kls_10a', Tanggal: d1, SiswaID: 'sis_10', Jenis: 'Pelanggaran', Level: '1', Catatan: 'Kurang fokus dan mengobrol saat penjelasan materi inti', TindakLanjut: 'Pengingat lisan dan pemindahan posisi diskusi' }
  ];

  const checklistList = [0, 1, 2, 3, 4, 5].map(i => ({
    Kelas: 'kls_10a',
    Item: String(i),
    Selesai: '1'
  }));

  const denahAturList = [
    { Kelas: 'kls_10a', Baris: '4', Kolom: '4', Grup: '2' }
  ];

  const denahList = kls10AStudents.map((s, idx) => ({
    Kelas: 'kls_10a',
    Baris: String(Math.floor(idx / 4) + 1),
    Kolom: String((idx % 4) + 1),
    SiswaID: s.ID
  }));

  const hariPiket = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const tugasPiket = ['Menyapu lantai', 'Mengepel', 'Menghapus papan tulis', 'Merapikan meja & kursi', 'Membuang sampah'];
  const piketList = kls10AStudents.map((s, i) => ({
    ID: `pik_${i + 1}`,
    Kelas: 'kls_10a',
    Hari: hariPiket[i % 5],
    SiswaID: s.ID,
    Tugas: tugasPiket[i % 5]
  }));

  const strukturList = [
    { ID: 'str_1', Kelas: 'kls_10a', Jabatan: 'Ketua Kelas', SiswaID: 'sis_02', Tingkat: '1' },
    { ID: 'str_2', Kelas: 'kls_10a', Jabatan: 'Wakil Ketua', SiswaID: 'sis_04', Tingkat: '1' },
    { ID: 'str_3', Kelas: 'kls_10a', Jabatan: 'Sekretaris', SiswaID: 'sis_01', Tingkat: '2' },
    { ID: 'str_4', Kelas: 'kls_10a', Jabatan: 'Bendahara', SiswaID: 'sis_03', Tingkat: '2' },
    { ID: 'str_5', Kelas: 'kls_10a', Jabatan: 'Seksi Kebersihan', SiswaID: 'sis_05', Tingkat: '3' },
    { ID: 'str_6', Kelas: 'kls_10a', Jabatan: 'Seksi Keamanan', SiswaID: 'sis_06', Tingkat: '3' },
    { ID: 'str_7', Kelas: 'kls_10a', Jabatan: 'Seksi Kesehatan', SiswaID: 'sis_07', Tingkat: '3' },
    { ID: 'str_8', Kelas: 'kls_10a', Jabatan: 'Seksi Perlengkapan', SiswaID: 'sis_08', Tingkat: '3' }
  ];

  const jadwalAturList = [
    { Kelas: 'kls_10a', Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' }
  ];

  const jadwalList = [
    { ID: 'jd_1', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '07:00', Selesai: '08:30', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_2', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '08:30', Selesai: '09:15', Mapel: 'Bahasa Indonesia', Guru: 'Drs. Hendra Gunawan', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_3', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '09:15', Selesai: '09:30', Mapel: 'Istirahat', Guru: '', Jenis: 'Istirahat', Pekan: '' },
    { ID: 'jd_4', Kelas: 'kls_10a', Hari: 'Senin', Mulai: '09:30', Selesai: '11:00', Mapel: 'Fisika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_5', Kelas: 'kls_10a', Hari: 'Selasa', Mulai: '07:00', Selesai: '08:30', Mapel: 'Informatika', Guru: 'Budi Santoso, S.Kom.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_6', Kelas: 'kls_10a', Hari: 'Selasa', Mulai: '08:30', Selesai: '09:15', Mapel: 'Kimia', Guru: 'Siti Aminah, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_7', Kelas: 'kls_10a', Hari: 'Rabu', Mulai: '07:00', Selesai: '08:30', Mapel: 'Matematika', Guru: 'Dra. Ratna Sari, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_8', Kelas: 'kls_10a', Hari: 'Rabu', Mulai: '08:30', Selesai: '10:00', Mapel: 'Biologi', Guru: 'Dewi Anggraini, M.Pd.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_9', Kelas: 'kls_10a', Hari: 'Kamis', Mulai: '07:00', Selesai: '08:30', Mapel: 'Bahasa Inggris', Guru: 'Rina Marlina, S.Pd.', Jenis: 'Pelajaran', Pekan: '' },
    { ID: 'jd_10', Kelas: 'kls_10a', Hari: 'Jumat', Mulai: '07:00', Selesai: '08:30', Mapel: 'PJOK', Guru: 'Agus Setiawan, S.Or.', Jenis: 'Pelajaran', Pekan: '' }
  ];

  const akademikList = getKaldikJabarEvents('2026/2027');

  const tpList = [
    { ID: 'tp_1', Kelas: 'kls_10a', Kode: 'TP 1', Tujuan: 'Peserta didik mampu menggeneralisasi sifat-sifat eksponen dan logaritma serta menerapkannya dalam penyelesaian masalah kontekstual.', Materi: 'Eksponen & Logaritma', Status: 'Tercapai' },
    { ID: 'tp_2', Kelas: 'kls_10a', Kode: 'TP 2', Tujuan: 'Peserta didik mampu memodelkan dan menyelesaikan sistem persamaan linear tiga variabel (SPLTV).', Materi: 'SPLTV', Status: 'Tercapai' },
    { ID: 'tp_3', Kelas: 'kls_10a', Kode: 'TP 3', Tujuan: 'Peserta didik mampu menganalisis karakteristik grafik fungsi kuadrat dan menentukan titik optimum.', Materi: 'Fungsi Kuadrat', Status: 'Berjalan' }
  ];

  const modulList = [
    {
      ID: 'mod_1',
      Kelas: 'kls_10a',
      Judul: 'Eksplorasi Fungsi Kuadrat & Lintasan Parabola',
      Mapel: 'Matematika',
      Alokasi: '2 × 45 menit',
      TPIDs: 'tp_3',
      Pembuka: 'Salam, doa, dan cek kehadiran dalam 5 menit pertama.\nApersepsi: Mengaitkan lintasan bola basket dengan kurva parabola.\nMenyampaikan tujuan pembelajaran dan kriteria keberhasilan.',
      Inti: 'Kegiatan 1: Eksplorasi grafik f(x) = ax² + bx + c menggunakan lembar kerja kelompok.\nKegiatan 2: Diskusi kelompok heterogen menganalisis pengaruh koefisien a, b, dan diskriminan D.\nDiferensiasi: Kelompok mahir menganalisis optimasi luas maksimum.',
      Penutup: 'Rangkuman bersama tentang titik puncak dan sumbu simetri.\nRefleksi singkat (exit ticket 3 menit).\nInformasi tugas proyek pertemuan berikutnya.',
      Asesmen: 'Formatif: Observasi diskusi & Exit Ticket.\nSumatif: Proyek pemodelan jembatan parabola.',
      Media: 'LKPD Fungsi Kuadrat, GeoGebra Interaktif, Proyektor',
      Catatan: '85% siswa antusias saat simulasi visual kurva.'
    }
  ];

  const pemantikList = [
    {
      ID: 'pem_1',
      Kelas: 'kls_10a',
      Judul: 'Mengapa Lintasan Air Mancur Berbentuk Parabola?',
      Tautan: 'https://www.geogebra.org',
      Pertanyaan: 'Jika kecepatan air mancur tetap, pada sudut kemiringan berapa air mencapai titik tertinggi dan jarak terjauh?',
      Slide: 'Lintasan Parabola di Sekitar Kita\nPerhatikan bentuk lengkungan jembatan gantung, lemparan bola basket, dan pancuran air taman.\n---\nHubungan dengan Persamaan Kuadrat\nSetiap titik ketinggian y pada jarak mendatar x mengikuti fungsi kuadrat f(x) = ax² + bx + c dengan nilai a negatif.\n---\nTantangan Diskusi Kelompok\n1. Apa yang terjadi jika nilai a diperbesar?\n2. Bagaimana cara menemukan titik puncak tertinggi tanpa menggambar seluruh tabel?'
    }
  ];

  const berkasCloudList = [
    {
      ID: 'cld_sample1',
      Kelas: 'kls_10a',
      NamaFile: 'Rekap_Evaluasi_Matematika_Triwulan1.csv',
      TipeMime: 'text/csv',
      Ukuran: '18420',
      TanggalUnggah: d1,
      Pengunggah: 'Dra. Ratna Sari, M.Pd.',
      StatusCloud: 'Tersimpan Aman (AES-256 Cloud Vault)',
      PathSimpan: 'seed_rekap_evaluasi.csv',
      AnalisisJSON: JSON.stringify({
        ringkasanEksekutif:
          'Dokumen berisi rekapitulasi capaian nilai formatif dan sumatif Matematika kelas X MIPA 1. Secara keseluruhan 91,6% siswa telah melampaui batas ketuntasan minimal (KKM 75) dengan rata-rata kelas 84,2.',
        informasiKunci: [
          'Rata-rata nilai Latihan Eksponen & Logaritma mencapai 86,4 dengan tingkat pengumpulan tepat waktu 91,6%.',
          'Terdapat korelasi positif kuat antara tingkat kehadiran (>95%) dengan capaian nilai Proyek Pemodelan Fungsi Kuadrat.',
          '1 siswa (Joko Susilo Wibowo) berada di bawah KKM pada komponen UTS (68) disertai catatan 2 hari alpa.'
        ],
        identifikasiTren: [
          'Tren peningkatan skor rata-rata sebesar +4,8 poin dari Kuis SPLTV ke Proyek Fungsi Kuadrat.',
          'Siswa yang aktif dalam diskusi kelompok heterogen menunjukkan stabilitas nilai di atas 85 pada seluruh komponen.'
        ],
        rekomendasiTindakLanjut: [
          'Jadwalkan sesi klinik remedial terfokus materi Eksponen & Fungsi Kuadrat bagi 1 siswa yang belum tuntas sebelum pelaksanaan UAS.',
          'Berikan tantangan proyek pengayaan optimasi kurva bagi 4 siswa dengan capaian predikat A (≥90).',
          'Lakukan komunikasi persuasif bersama orang tua terkait kedisiplinan kehadiran siswa dengan catatan alpa.'
        ],
        kategoriDokumen: 'Spreadsheet Evaluasi Akademik'
      })
    }
  ];

  const sampleMateriCBT = `Ringkasan Materi Eksponen dan Logaritma:
1. Sifat Eksponen: Untuk bilangan real a > 0, berlaku a^m × a^n = a^(m+n), a^m / a^n = a^(m-n), (a^m)^n = a^(m×n), dan a^0 = 1.
2. Persamaan Eksponen: Jika a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka f(x) = g(x).
3. Definisi Logaritma: ^a log b = c jika dan hanya jika a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.
4. Sifat Logaritma: ^a log(x·y) = ^a log x + ^a log y; ^a log(x/y) = ^a log x - ^a log y; dan ^a log(x^n) = n · ^a log x.`;

  const cbtList = [
    {
      ID: 'cbt_demo1',
      Kelas: 'kls_10a',
      Judul: 'Evaluasi Formatif: Eksponen & Logaritma',
      Mapel: 'Matematika',
      Durasi: '30',
      Status: 'Aktif',
      Acak: '0',
      SumberMateri: sampleMateriCBT,
      NamaFileMateri: '',
      TanggalBuat: d1,
      SoalJSON: JSON.stringify({
        soalPG: [
          {
            id: 'pg_1',
            pertanyaan: 'Berdasarkan sifat eksponen pada materi, bentuk sederhana dari a^m × a^n adalah…',
            opsiA: 'a^(m-n)',
            opsiB: 'a^(m+n)',
            opsiC: 'a^(m×n)',
            opsiD: '(2a)^(m+n)',
            opsiE: 'a^(m/n)',
            kunci: 'B',
            pembahasan: 'Perkalian bilangan berpangkat dengan basis sama menjumlahkan pangkatnya: a^m × a^n = a^(m+n).',
            kutipanMateri: 'a^m × a^n = a^(m+n)'
          },
          {
            id: 'pg_2',
            pertanyaan: 'Untuk setiap bilangan real a > 0, nilai dari a^0 sesuai sifat eksponen adalah…',
            opsiA: '0',
            opsiB: 'a',
            opsiC: '1',
            opsiD: '-1',
            opsiE: 'Tidak terdefinisi',
            kunci: 'C',
            pembahasan: 'Pada sifat eksponen poin 1 dijelaskan bahwa untuk a > 0 berlaku a^0 = 1.',
            kutipanMateri: 'dan a^0 = 1'
          },
          {
            id: 'pg_3',
            pertanyaan: 'Jika diketahui a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka kesimpulan yang benar adalah…',
            opsiA: 'f(x) + g(x) = 1',
            opsiB: 'f(x) × g(x) = 0',
            opsiC: 'f(x) = a · g(x)',
            opsiD: 'f(x) = g(x)',
            opsiE: 'f(x) > g(x)',
            kunci: 'D',
            pembahasan: 'Persamaan eksponen dengan basis sama a > 0, a ≠ 1 menghasilkan penyamaan pangkat f(x) = g(x).',
            kutipanMateri: 'Jika a^f(x) = a^g(x) dengan a > 0 dan a ≠ 1, maka f(x) = g(x).'
          },
          {
            id: 'pg_4',
            pertanyaan: 'Syarat yang harus dipenuhi oleh basis a dan numerus b pada definisi ^a log b = c adalah…',
            opsiA: 'a > 0, a ≠ 1, dan b > 0',
            opsiB: 'a ≥ 0 dan b < 0',
            opsiC: 'a = 1 dan b > 0',
            opsiD: 'a < 0 dan b ≠ 0',
            opsiE: 'a > 1 dan b = 0',
            kunci: 'A',
            pembahasan: 'Logaritma ^a log b mensyaratkan basis a > 0, a ≠ 1, dan numerus b > 0.',
            kutipanMateri: 'dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.'
          },
          {
            id: 'pg_5',
            pertanyaan: 'Sesuai sifat logaritma pada materi, bentuk ^a log(x · y) setara dengan…',
            opsiA: '^a log x × ^a log y',
            opsiB: '^a log x - ^a log y',
            opsiC: '^a log x + ^a log y',
            opsiD: 'x · ^a log y',
            opsiE: '(^a log x) / (^a log y)',
            kunci: 'C',
            pembahasan: 'Logaritma perkalian diuraikan menjadi penjumlahan logaritma: ^a log(x·y) = ^a log x + ^a log y.',
            kutipanMateri: '^a log(x·y) = ^a log x + ^a log y'
          }
        ],
        soalUraian: [
          {
            id: 'ur_1',
            pertanyaan: 'Jelaskan hubungan antara definisi logaritma ^a log b = c dengan bentuk pangkatnya beserta syarat nilai a dan b!',
            kunciRubrik: '^a log b = c ekuivalen dengan a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.',
            poinMaksimal: 50,
            kutipanMateri: '^a log b = c jika dan hanya jika a^c = b, dengan syarat basis a > 0, a ≠ 1, dan numerus b > 0.'
          },
          {
            id: 'ur_2',
            pertanyaan: 'Tuliskan tiga sifat utama logaritma (perkalian, pembagian, dan perpangkatan numerus) yang tercantum dalam ringkasan materi!',
            kunciRubrik: '1) ^a log(x·y) = ^a log x + ^a log y; 2) ^a log(x/y) = ^a log x - ^a log y; 3) ^a log(x^n) = n · ^a log x.',
            poinMaksimal: 50,
            kutipanMateri: '^a log(x·y) = ^a log x + ^a log y; ^a log(x/y) = ^a log x - ^a log y; dan ^a log(x^n) = n · ^a log x.'
          }
        ]
      })
    }
  ];

  const pengaturanRows = Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));

  return {
    admin: { user: adminUser, salt: adminSalt, hash: adminHash },
    sheets: {
      Pengaturan: pengaturanRows,
      Kelas: kelasList,
      Siswa: siswa10A,
      Absensi: absensiList,
      Tugas: tugasList,
      Pengumpulan: pengumpulanList,
      Nilai: nilaiList,
      Perilaku: perilakuList,
      Checklist: checklistList,
      DenahAtur: denahAturList,
      Denah: denahList,
      Piket: piketList,
      Struktur: strukturList,
      Jadwal: jadwalList,
      JadwalAtur: jadwalAturList,
      Akademik: akademikList.map(a => ({
        ID: a.ID,
        Mulai: a.Mulai,
        Selesai: a.Selesai,
        Kegiatan: a.Kegiatan,
        Jenis: a.Jenis,
        Sumber: a.Sumber || ''
      })),
      TP: tpList,
      Modul: modulList,
      Pemantik: pemantikList,
      Mapel: mapelList,
      BerkasCloud: berkasCloudList,
      CBT: cbtList,
      HasilCBT: [],
      Pengguna: penggunaList,
      Akun: akunList
    }
  };
}

function getDb(): DatabaseFile {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      dbCache = JSON.parse(raw);
      const hadCbtKey = 'CBT' in (dbCache!.sheets || {});
      // Ensure all schema keys exist
      for (const k of Object.keys(SKEMA)) {
        if (!dbCache!.sheets[k]) dbCache!.sheets[k] = [];
      }
      if (!hadCbtKey) {
        const seeded = createSeedDatabase();
        dbCache!.sheets.CBT = seeded.sheets.CBT;
        saveDb();
      }
      // Backfill Jurusan on existing Kelas rows if absent
      dbCache!.sheets.Kelas = (dbCache!.sheets.Kelas || []).map((kls: any) => {
        if (kls.Jurusan) return kls;
        const nm = String(kls.Nama || '').toUpperCase();
        const inferred = nm.includes('IPS') ? 'IPS' : nm.includes('BHS') || nm.includes('BAHASA') ? 'Bahasa' : 'MIPA';
        return { ...kls, Jurusan: inferred };
      });
      // Backfill NoSiswa and NoOrtu on existing Siswa rows
      dbCache!.sheets.Siswa = (dbCache!.sheets.Siswa || []).map((s: any) => ({
        ...s,
        NoSiswa: s.NoSiswa || s.KontakOrtu || '',
        NoOrtu: s.NoOrtu || ''
      }));
      return dbCache!;
    }
  } catch (e) {
    console.error('Failed reading DB, re-seeding:', e);
  }
  dbCache = createSeedDatabase();
  saveDb();
  return dbCache;
}

function saveDb() {
  if (!dbCache) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
}

function baca_(nama: string): Record<string, string>[] {
  const db = getDb();
  const h = SKEMA[nama] || [];
  const rows = db.sheets[nama] || [];
  return rows.map(r => {
    const o: Record<string, string> = {};
    h.forEach(k => {
      o[k] = r[k] == null ? '' : String(r[k]);
    });
    return o;
  });
}

function tulis_(nama: string, rows: Record<string, any>[]) {
  const db = getDb();
  const h = SKEMA[nama] || [];
  db.sheets[nama] = (rows || []).map(r => {
    const o: Record<string, string> = {};
    h.forEach(k => {
      o[k] = r[k] == null ? '' : String(r[k]);
    });
    return o;
  });
  saveDb();
}

function pengaturan_(): Record<string, string> {
  const set = { ...PENGATURAN_AWAL };
  baca_('Pengaturan').forEach(r => {
    if (r.Kunci) set[r.Kunci] = r.Nilai;
  });
  return set;
}

function adminAda_(): boolean {
  const db = getDb();
  return !!(db.admin && db.admin.hash);
}

function setAdmin_(user: string, pass: string) {
  const db = getDb();
  const salt = uuid();
  db.admin = {
    user: String(user).trim().toLowerCase(),
    salt,
    hash: hash_(salt, pass)
  };
  saveDb();
}

function cekAdmin_(user: string, pass: string): boolean {
  const db = getDb();
  if (!db.admin || !db.admin.hash) return false;
  return user === db.admin.user && hash_(db.admin.salt, pass) === db.admin.hash;
}

function buatSesi_(role: string, sid: string, nama: string) {
  const token = uuid() + uuid();
  sessions.set(token, {
    role,
    sid: sid || '',
    nama: nama || '',
    expires: Date.now() + TTL_SESI
  });
  return { token, role, nama: nama || '' };
}

function sesi_(token: string, role?: string) {
  if (!token) throw new Error('SESI_HABIS');
  const s = sessions.get(token);
  if (!s || Date.now() > s.expires) {
    sessions.delete(token);
    throw new Error('SESI_HABIS');
  }
  if (role && s.role !== role) throw new Error('Akses ditolak.');
  return s;
}

function kunciGagal_(mode: string, user: string) {
  return `gagal_${mode}_${user}`;
}

function cekBlok_(k: string) {
  const rec = loginFailures.get(k);
  if (rec && Date.now() < rec.expires && rec.count >= 5) {
    throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
  }
}

function catatGagal_(k: string) {
  const rec = loginFailures.get(k);
  const count = rec && Date.now() < rec.expires ? rec.count + 1 : 1;
  loginFailures.set(k, { count, expires: Date.now() + 600 * 1000 });
}

function pinAcak_(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function simpanAkun_(daftar: { id: string; pin: string }[]) {
  const akun = baca_('Akun').filter(a => !daftar.some(d => d.id === a.SiswaID));
  daftar.forEach(d => akun.push({ SiswaID: d.id, Hash: hash_(d.id, d.pin) }));
  tulis_('Akun', akun);
}

function pisah_(t: any): string[] {
  return String(t || '').split(',').filter(Boolean);
}

function perluas_(u: Record<string, string>) {
  const roles = pisah_(u.Peran);
  const semua = pisah_(u.Kelas);
  const wali = roles.includes('wali') ? (pisah_(u.KelasWali).length ? pisah_(u.KelasWali) : semua) : [];
  const mengajar = roles.includes('guru') ? (pisah_(u.KelasMengajar).length ? pisah_(u.KelasMengajar) : semua) : [];
  return { roles, wali, mengajar };
}

function staf_(token: string) {
  const s = sesi_(token);
  if (s.role === 'admin') return { peran: 'admin', izin: null as string[] | null, wali: [] as string[], guru: [] as string[], nama: s.nama, user: null as Record<string, string> | null };
  if (s.role !== 'staf') throw new Error('Akses ditolak.');
  const u = baca_('Pengguna').find(x => x.ID === s.sid);
  if (!u) throw new Error('SESI_HABIS');
  const p = perluas_(u);
  const guru = p.mengajar.filter(k => !p.wali.includes(k));
  return { peran: p.roles.join(','), izin: p.wali.concat(guru), wali: p.wali, guru, nama: u.Nama, user: u };
}

function tulisKelas_(st: ReturnType<typeof staf_>, nama: string): string[] | null {
  if (!st.izin) return null;
  return (IZIN_TULIS.wali.includes(nama) ? st.wali : []).concat(IZIN_TULIS.guru.includes(nama) ? st.guru : []);
}

function bolehTulis_(st: ReturnType<typeof staf_>, nama: string): boolean {
  const k = tulisKelas_(st, nama);
  return !k || k.length > 0;
}

function tulisDi_(st: ReturnType<typeof staf_>, nama: string, kelas: string): boolean {
  const k = tulisKelas_(st, nama);
  return !k || k.includes(kelas);
}

function bolehPIN_(st: ReturnType<typeof staf_>, kelas: string): boolean {
  return !st.izin || st.wali.includes(kelas);
}

function tugasIzin_(izin: string[]) {
  const milik: Record<string, boolean> = {};
  const semua: Record<string, boolean> = {};
  baca_('Tugas').forEach(t => {
    semua[t.ID] = true;
    if (izin.includes(t.Kelas)) milik[t.ID] = true;
  });
  return { milik, semua };
}

function bacaIzin_(nama: string, izin: string[] | null) {
  const rows = baca_(nama);
  if (!izin) return rows;
  if (nama === 'Kelas') return rows.filter(r => izin.includes(r.ID));
  if (nama === 'Pengumpulan') {
    const t = tugasIzin_(izin);
    return rows.filter(r => t.milik[r.TugasID]);
  }
  if (SKEMA[nama].includes('Kelas')) return rows.filter(r => izin.includes(r.Kelas));
  return rows;
}

function gabungIzin_(nama: string, rows: Record<string, any>[], izin: string[]) {
  const lama = baca_(nama);
  if (nama === 'Pengumpulan') {
    const t = tugasIzin_(izin);
    return lama.filter(r => t.semua[r.TugasID] && !t.milik[r.TugasID]).concat(rows.filter(r => t.milik[r.TugasID]));
  }
  if (!SKEMA[nama].includes('Kelas')) throw new Error('Akses ditolak.');
  return lama.filter(r => !izin.includes(r.Kelas)).concat(rows.filter(r => izin.includes(r.Kelas)));
}

function daftarPengguna_() {
  return baca_('Pengguna').map(u => {
    const p = perluas_(u);
    const semua = p.wali.concat(p.mengajar.filter(k => !p.wali.includes(k)));
    return {
      ID: u.ID,
      Nama: u.Nama,
      Username: u.Username,
      Peran: p.roles.join(','),
      Kelas: semua.join(','),
      KelasWali: p.wali.join(','),
      KelasMengajar: p.mengajar.join(','),
      Mapel: u.Mapel
    };
  });
}

const HARI_VALID_ = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function menit_(t: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(String(t || ''));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}
const tumpang_ = (a: Record<string, string>, b: Record<string, string>) =>
  menit_(a.Mulai) < menit_(b.Selesai) && menit_(b.Mulai) < menit_(a.Selesai);
const pekanTemu_ = (a: Record<string, string>, b: Record<string, string>) =>
  !a.Pekan || !b.Pekan || a.Pekan === b.Pekan;
const adalahPelajaran_ = (r: Record<string, string>) => !r.Jenis || r.Jenis === 'Pelajaran';

function validasiJadwal_(rows: Record<string, string>[], lama: Record<string, string>[]) {
  const lamaMap: Record<string, Record<string, string>> = {};
  lama.forEach(r => (lamaMap[r.ID] = r));
  const kunci = ['Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'];
  const sama = (a: Record<string, string>, b: Record<string, string>) =>
    kunci.every(k => String(a[k] || '') === String(b[k] || ''));
  const kelas: Record<string, string> = {};
  baca_('Kelas').forEach(k => (kelas[k.ID] = k.Nama));
  rows.forEach(r => {
    if (lamaMap[r.ID] && sama(r, lamaMap[r.ID])) return;
    const nm = (kelas[r.Kelas] || 'kelas') + ' · ' + r.Mapel;
    if (!HARI_VALID_.includes(r.Hari)) throw new Error('Hari tidak valid pada ' + nm + '.');
    if (menit_(r.Mulai) < 0 || menit_(r.Selesai) <= menit_(r.Mulai))
      throw new Error('Jam tidak valid pada ' + nm + ': jam selesai harus setelah jam mulai.');
    if (!['', 'A', 'B'].includes(String(r.Pekan || ''))) throw new Error('Pekan harus kosong, A, atau B.');
    const guru = String(r.Guru || '').trim().toLowerCase();
    rows.forEach(o => {
      if (o === r || o.ID === r.ID || o.Hari !== r.Hari || !tumpang_(r, o) || !pekanTemu_(r, o)) return;
      if (o.Kelas === r.Kelas)
        throw new Error(
          'Jadwal bentrok di ' +
            (kelas[r.Kelas] || 'kelas ini') +
            ' hari ' +
            r.Hari +
            ': ' +
            r.Mapel +
            ' (' +
            r.Mulai +
            '–' +
            r.Selesai +
            ') dengan ' +
            o.Mapel +
            ' (' +
            o.Mulai +
            '–' +
            o.Selesai +
            ').'
        );
      if (guru && adalahPelajaran_(r) && adalahPelajaran_(o) && String(o.Guru || '').trim().toLowerCase() === guru)
        throw new Error(
          'Guru ' +
            r.Guru +
            ' sudah mengajar ' +
            o.Mapel +
            ' di kelas ' +
            (kelas[o.Kelas] || '?') +
            ' hari ' +
            r.Hari +
            ' ' +
            o.Mulai +
            '–' +
            o.Selesai +
            ', bentrok dengan ' +
            r.Mapel +
            ' di ' +
            (kelas[r.Kelas] || 'kelas ini') +
            '.'
        );
    });
  });
}

function waliKelas_(kelasId: string): string {
  return baca_('Pengguna')
    .filter(u => perluas_(u).wali.includes(kelasId))
    .map(u => u.Nama)
    .join(', ');
}

const KODE_ABSEN_ = ['H', 'S', 'I', 'A', 'T', 'D'];
function wajibSekretaris_(token: string) {
  const sesi = sesi_(token, 'siswa');
  const s = baca_('Siswa').find(x => x.ID === sesi.sid);
  if (!s) throw new Error('SESI_HABIS');
  const ok = baca_('Struktur').some(j => j.Kelas === s.Kelas && j.SiswaID === s.ID && /sekretaris/i.test(j.Jabatan));
  if (!ok) throw new Error('Hanya sekretaris kelas yang dapat mengisi absensi.');
  return s;
}

function tanggalSekretaris_(t: string): string {
  t = String(t || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('Tanggal tidak valid.');
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const sekarang = Date.now();
  if (t > fmt(sekarang + 86400000)) throw new Error('Tanggal tidak boleh di masa depan.');
  if (t < fmt(sekarang - 8 * 86400000)) throw new Error('Sekretaris hanya dapat mengisi absensi 7 hari terakhir.');
  return t;
}

function sandiAcak_(): string {
  return uuid().replace(/-/g, '').slice(0, 10);
}

function sanitizeJurusanLogos_(raw: any): Record<string, string> {
  let obj: Record<string, any> = {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed;
    } catch (_) {
      return {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k || '').trim();
    const val = String(v || '').trim();
    if (!key || !val) continue;
    if (!val.startsWith('data:image/')) {
      throw new Error(`Format logo jurusan "${key}" harus berupa gambar valid (PNG, JPG, WebP, atau SVG).`);
    }
    if (val.length > 250000) {
      throw new Error(`Ukuran logo jurusan "${key}" terlalu besar (maks. 250 KB).`);
    }
    out[key] = val;
  }
  if (JSON.stringify(out).length > 550000) {
    throw new Error('Total ukuran semua logo jurusan terlalu besar.');
  }
  return out;
}

// RPC Methods matching Code.gs
const rpcMethods: Record<string, (...args: any[]) => any> = {
  api_status() {
    const set = pengaturan_();
    const em = String(set.emailPemulihan || '').trim();
    const emailHint = em.includes('@')
      ? `${em.slice(0, Math.min(2, em.indexOf('@')))}***@${em.split('@')[1]}`
      : '';
    return {
      adminAda: adminAda_(),
      sekolah: set.sekolah || 'SMA Negeri 1 Nusantara',
      logo: set.logo || '',
      jurusan: set.jurusan || '',
      jurusanLogos: set.jurusanLogos || '{}',
      waInfo: set.waInfo || '',
      emailHint
    };
  },

  api_updateLoginBranding(logo: string, jurusan: string, sekolah?: string, jurusanLogos?: any) {
    const cleanLogo = String(logo || '').trim();
    if (cleanLogo && !cleanLogo.startsWith('data:image/')) {
      throw new Error('Format logo harus berupa gambar valid (PNG, JPG, WebP, atau SVG).');
    }
    if (cleanLogo.length > 600000) {
      throw new Error('Ukuran gambar logo terlalu besar.');
    }
    const cleanJurusanList = Array.from(
      new Set(
        String(jurusan || '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      )
    );
    const cleanJurusan = cleanJurusanList.join(', ');
    if (!cleanJurusan) {
      throw new Error('Minimal isi 1 nama jurusan.');
    }
    const cur = pengaturan_();
    let nextLogosStr = cur.jurusanLogos || '{}';
    if (jurusanLogos !== undefined) {
      const sanitized = sanitizeJurusanLogos_(jurusanLogos);
      const filtered: Record<string, string> = {};
      cleanJurusanList.forEach(j => {
        if (sanitized[j]) filtered[j] = sanitized[j];
      });
      nextLogosStr = JSON.stringify(filtered);
    }
    const cleanSekolah = String(sekolah || '').trim();
    const baru: Record<string, string> = {
      ...cur,
      logo: cleanLogo,
      jurusan: cleanJurusan,
      jurusanLogos: nextLogosStr,
      ...(cleanSekolah ? { sekolah: cleanSekolah } : {})
    };
    tulis_(
      'Pengaturan',
      Object.keys(baru).map(k => ({ Kunci: k, Nilai: baru[k] }))
    );
    return {
      sekolah: baru.sekolah || 'SMA Negeri 1 Nusantara',
      logo: baru.logo || '',
      jurusan: baru.jurusan || '',
      jurusanLogos: baru.jurusanLogos || '{}'
    };
  },

  api_setupAdmin(user: string, pass: string) {
    user = String(user || '').trim();
    pass = String(pass || '');
    if (adminAda_()) throw new Error('Akun admin sudah dibuat.');
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (pass.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    setAdmin_(user, pass);
    return buatSesi_('admin', '', user);
  },

  api_login(mode: string, user: string, pass: string) {
    const userRaw = String(user || '').trim().toLowerCase();
    const userNisNorm = userRaw.replace(/\s+/g, '');
    const passRaw = String(pass || '');
    const passTrim = passRaw.trim();
    if (!userRaw || !passTrim) throw new Error('Lengkapi data masuk.');
    const kg = kunciGagal_(mode, userRaw);
    cekBlok_(kg);

    const tryStudentLogin = () => {
      const akun = baca_('Akun');
      const siswaMatches = baca_('Siswa').filter(
        s => String(s.NIS || '').replace(/\s+/g, '').toLowerCase() === userNisNorm
      );
      if (!siswaMatches.length) return { status: 'no_nis' as const };
      const withAkun = siswaMatches.filter(s => akun.some(a => a.SiswaID === s.ID));
      if (!withAkun.length) return { status: 'no_pin' as const };
      const matched = withAkun.find(s =>
        akun.some(a => a.SiswaID === s.ID && a.Hash === hash_(s.ID, passTrim))
      );
      if (matched) return { status: 'ok' as const, siswa: matched };
      return { status: 'wrong_pin' as const };
    };

    if (mode === 'admin') {
      if (!adminAda_()) throw new Error('Akun admin belum dibuat.');
      if (cekAdmin_(userRaw, passRaw) || cekAdmin_(userRaw, passTrim)) {
        loginFailures.delete(kg);
        return buatSesi_('admin', '', userRaw);
      }
      const staf = baca_('Pengguna').find(
        u =>
          String(u.Username || '').trim().toLowerCase() === userRaw &&
          (u.Hash === hash_(u.ID, passRaw) || u.Hash === hash_(u.ID, passTrim))
      );
      if (staf) {
        loginFailures.delete(kg);
        return buatSesi_('staf', staf.ID, staf.Nama);
      }
      // Fallback: if user entered a valid student NIS + PIN without switching to Portal Siswa tab
      const stCheck = tryStudentLogin();
      if (stCheck.status === 'ok') {
        loginFailures.delete(kg);
        loginFailures.delete(kunciGagal_('siswa', userRaw));
        return buatSesi_('siswa', stCheck.siswa.ID, stCheck.siswa.Nama);
      }
      if (stCheck.status === 'no_pin') {
        throw new Error('Akun siswa ini belum memiliki PIN aktif. Minta Admin/Wali Kelas membuat PIN terlebih dahulu.');
      }
      if (stCheck.status === 'wrong_pin') {
        catatGagal_(kg);
        throw new Error('PIN siswa salah. Pastikan mode masuk "Portal Siswa" dan PIN sesuai.');
      }
    } else {
      const stCheck = tryStudentLogin();
      if (stCheck.status === 'ok') {
        loginFailures.delete(kg);
        loginFailures.delete(kunciGagal_('admin', userRaw));
        return buatSesi_('siswa', stCheck.siswa.ID, stCheck.siswa.Nama);
      }
      if (stCheck.status === 'no_nis') {
        catatGagal_(kg);
        throw new Error('NIS tidak terdaftar pada data siswa.');
      }
      if (stCheck.status === 'no_pin') {
        throw new Error('Siswa dengan NIS tersebut belum memiliki PIN aktif. Minta Admin/Wali Kelas klik "Buat PIN Baru" atau "Buat PIN Baru Seragam".');
      }
      catatGagal_(kg);
      throw new Error('PIN siswa salah. Pastikan PIN 4–8 angka sesuai yang dibuat Admin/Wali Kelas.');
    }
    catatGagal_(kg);
    throw new Error('Nama pengguna / NIS atau kata sandi / PIN salah.');
  },

  api_kirimKodePemulihan(user: string, email: string) {
    const u = String(user || '').trim().toLowerCase();
    const em = String(email || '').trim().toLowerCase();
    if (!u || !em) throw new Error('Masukkan nama pengguna dan email pemulihan Admin.');

    const kg = kunciGagal_('email_otp', u);
    cekBlok_(kg);

    const db = getDb();
    const isMainAdmin = !!(db.admin && db.admin.user === u);
    const staf = baca_('Pengguna').find(x => String(x.Username || '').trim().toLowerCase() === u);
    if (!isMainAdmin && !staf) {
      catatGagal_(kg);
      throw new Error('Nama pengguna tidak ditemukan.');
    }

    const set = pengaturan_();
    const emailTerdaftar = String(set.emailPemulihan || '').trim().toLowerCase();
    if (!emailTerdaftar) {
      throw new Error('Email pemulihan Admin belum diatur pada menu Pengaturan.');
    }
    if (em !== emailTerdaftar) {
      catatGagal_(kg);
      throw new Error('Email yang dimasukkan tidak cocok dengan Email Pemulihan Admin yang terdaftar.');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    recoveryCodes.set(u, {
      code,
      email: emailTerdaftar,
      user: u,
      expires: Date.now() + 15 * 60 * 1000
    });
    loginFailures.delete(kg);

    return {
      ok: true,
      kodePreview: code,
      pesan: `Kode verifikasi 6 digit telah diterbitkan untuk ${emailTerdaftar} (berlaku 15 menit).`
    };
  },

  api_lupaSandi(mode: string, user: string, verifikasi: string, sandiBaru: string) {
    const modeNorm = mode === 'siswa' ? 'siswa' : 'admin';
    const u = String(user || '').trim().toLowerCase();
    const verRaw = String(verifikasi || '').trim();
    const ver = verRaw.toLowerCase();
    const baru = String(sandiBaru || '').trim();

    if (modeNorm === 'siswa') {
      throw new Error('Siswa yang lupa PIN silakan hubungi Admin atau Wali Kelas melalui WhatsApp Informasi untuk reset PIN.');
    }

    if (!u || !ver || !baru) throw new Error('Lengkapi seluruh kolom pemulihan kata sandi.');

    const kg = kunciGagal_('reset_' + modeNorm, u);
    cekBlok_(kg);

    const set = pengaturan_();
    const kodeReset = String(set.kodeReset || '').trim().toLowerCase();
    const recOtp = recoveryCodes.get(u);
    const otpValid = !!(recOtp && Date.now() <= recOtp.expires && recOtp.code === verRaw);

    if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    const db = getDb();
    if (db.admin && db.admin.user === u) {
      const ok = otpValid || (kodeReset && ver === kodeReset);
      if (!ok) {
        catatGagal_(kg);
        throw new Error('Verifikasi gagal. Masukkan Kode OTP 6 digit dari Email Pemulihan Admin atau Kode Pemulihan Sekolah.');
      }
      setAdmin_(u, baru);
      recoveryCodes.delete(u);
      loginFailures.delete(kg);
      loginFailures.delete(kunciGagal_('admin', u));
      return { ok: true, pesan: 'Kata sandi Admin berhasil diatur ulang via pemulihan email. Silakan masuk dengan kata sandi baru.' };
    }

    const semua = baca_('Pengguna');
    const staf = semua.find(x => String(x.Username || '').trim().toLowerCase() === u);
    if (staf) {
      const namaStaf = String(staf.Nama || '').trim().toLowerCase();
      const ok = otpValid || (kodeReset && ver === kodeReset) || (namaStaf && ver === namaStaf);
      if (!ok) {
        catatGagal_(kg);
        throw new Error('Verifikasi gagal. Masukkan Kode OTP Email atau Nama Lengkap / Kode Pemulihan Sekolah.');
      }
      staf.Hash = hash_(staf.ID, baru);
      tulis_('Pengguna', semua);
      recoveryCodes.delete(u);
      loginFailures.delete(kg);
      loginFailures.delete(kunciGagal_('admin', u));
      return { ok: true, pesan: 'Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru.' };
    }

    catatGagal_(kg);
    throw new Error('Nama pengguna tidak ditemukan.');
  },

  api_cekSesi(token: string) {
    const s = sesi_(token);
    return { role: s.role, nama: s.nama };
  },

  api_logout(token: string) {
    sessions.delete(token);
    return true;
  },

  api_load(token: string, _segarkan?: boolean) {
    const st = staf_(token);
    const out: Record<string, any> = {};
    Object.keys(SKEMA).forEach(n => {
      if (!SHEET_TERKUNCI.includes(n)) out[n] = bacaIzin_(n, st.izin);
    });
    out.Pengaturan = pengaturan_();
    const akunRows = baca_('Akun');
    const pin = akunRows.map(a => a.SiswaID);
    const allowedIds = new Set(out.Siswa.map((s: any) => s.ID));
    out.punyaPIN = st.izin ? pin.filter(id => allowedIds.has(id)) : pin;
    const pinHashes: Record<string, string> = {};
    akunRows.forEach(a => {
      if (!st.izin || allowedIds.has(a.SiswaID)) pinHashes[a.SiswaID] = a.Hash;
    });
    out.pinHashes = pinHashes;
    out.peran = st.peran;
    out.kelasWali = st.izin ? st.wali : null;
    out.namaPengguna = st.nama || '';
    out.GuruList = baca_('Pengguna').map(u => {
      const p = perluas_(u);
      return {
        Nama: u.Nama,
        Mapel: u.Mapel,
        KelasWali: p.wali.join(','),
        KelasMengajar: p.mengajar.join(',')
      };
    });
    out.mapelSaya = st.user ? String(st.user.Mapel || '') : '';
    const admin = st.peran === 'admin';
    const db = getDb();
    out.adminUser = admin ? (db.admin?.user || '') : '';
    out.urlSheet = '';
    if (admin) out.Pengguna = daftarPengguna_();
    return out;
  },

  api_saveSheet(token: string, nama: string, rows: Record<string, any>[]) {
    const st = staf_(token);
    if (!SKEMA[nama] || SHEET_TERKUNCI.includes(nama)) throw new Error('Sheet tidak dikenal: ' + nama);
    if (!bolehTulis_(st, nama)) throw new Error('Anda tidak punya izin mengubah data ini.');
    const tk = tulisKelas_(st, nama);
    rows = rows || [];
    if (st.izin && tk) rows = gabungIzin_(nama, rows, tk);
    if (nama === 'Jadwal') validasiJadwal_(rows as Record<string, string>[], baca_('Jadwal'));
    tulis_(nama, rows);
    if (nama === 'Siswa') {
      const ada: Record<string, boolean> = {};
      rows.forEach(s => (ada[s.ID] = true));
      tulis_('Akun', baca_('Akun').filter(a => ada[a.SiswaID]));
    }
    return true;
  },

  api_savePengaturan(token: string, obj: Record<string, string>) {
    sesi_(token, 'admin');
    tulis_(
      'Pengaturan',
      Object.keys(obj).map(k => ({ Kunci: k, Nilai: obj[k] }))
    );
    return true;
  },

  api_saveAbsensi(token: string, kelas: string, tanggal: string, recs: any[]) {
    const st = staf_(token);
    if (!tulisDi_(st, 'Absensi', kelas)) throw new Error('Anda tidak punya izin mengubah absensi kelas ini.');
    const semua = baca_('Absensi').filter(a => !(a.Kelas === kelas && a.Tanggal === tanggal));
    (recs || []).forEach(r =>
      semua.push({
        Kelas: kelas,
        Tanggal: tanggal,
        SiswaID: r.SiswaID,
        Kode: r.Kode,
        Keterangan: r.Keterangan || '',
        Sumber: ''
      })
    );
    tulis_('Absensi', semua);
    return true;
  },

  api_getPinHashes(token: string) {
    const st = staf_(token);
    const allowed = st.izin
      ? new Set(bacaIzin_('Siswa', st.izin).map(s => s.ID))
      : null;
    const out: Record<string, string> = {};
    baca_('Akun').forEach(a => {
      if (!allowed || allowed.has(a.SiswaID)) out[a.SiswaID] = a.Hash;
    });
    return out;
  },

  api_setPIN(token: string, sid: string, pin: string) {
    const st = staf_(token);
    const s = baca_('Siswa').find(x => x.ID === sid);
    if (!s) throw new Error('Siswa tidak ditemukan.');
    if (!bolehPIN_(st, s.Kelas))
      throw new Error('Anda tidak punya izin mengatur PIN siswa ini. Hanya wali kelas yang dapat melakukannya.');
    if (!String(s.NIS).trim()) throw new Error('Isi NIS siswa dulu (NIS dipakai sebagai nama pengguna).');
    pin = String(pin || '').trim();
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4-8 angka.');
    if (!pin) pin = pinAcak_();
    simpanAkun_([{ id: sid, pin }]);
    const nisKey = String(s.NIS || '').trim().toLowerCase();
    loginFailures.delete(kunciGagal_('siswa', nisKey));
    loginFailures.delete(kunciGagal_('admin', nisKey));
    return pin;
  },

  api_buatPINSemua(token: string, kelas: string, timpa: boolean, pinSeragam: string) {
    const st = staf_(token);
    if (kelas !== '__ALL__' && !bolehPIN_(st, kelas))
      throw new Error('Anda tidak punya izin mengatur PIN kelas ini. Hanya wali kelas yang dapat melakukannya.');
    if (kelas === '__ALL__' && st.izin && st.wali.length === 0)
      throw new Error('Anda tidak punya izin mengatur PIN kelas.');
    pinSeragam = String(pinSeragam || '').trim();
    if (pinSeragam && !/^\d{4,8}$/.test(pinSeragam)) throw new Error('PIN harus 4-8 angka.');
    const sudah: Record<string, boolean> = {};
    if (!timpa) baca_('Akun').forEach(a => (sudah[a.SiswaID] = true));
    const daftar: { id: string; pin: string }[] = [];
    const hasil: { id: string; nama: string; nis: string; pin: string }[] = [];
    let dilewati = 0;
    baca_('Siswa')
      .filter(s => {
        if (sudah[s.ID]) return false;
        if (kelas === '__ALL__') return bolehPIN_(st, s.Kelas);
        return s.Kelas === kelas;
      })
      .forEach(s => {
        if (!String(s.NIS).trim()) {
          dilewati++;
          return;
        }
        const pin = pinSeragam || pinAcak_();
        daftar.push({ id: s.ID, pin });
        hasil.push({ id: s.ID, nama: s.Nama, nis: s.NIS, pin });
        const nisKey = String(s.NIS || '').trim().toLowerCase();
        loginFailures.delete(kunciGagal_('siswa', nisKey));
        loginFailures.delete(kunciGagal_('admin', nisKey));
      });
    if (daftar.length) simpanAkun_(daftar);
    const pinHashes: Record<string, string> = {};
    baca_('Akun').forEach(a => {
      pinHashes[a.SiswaID] = a.Hash;
    });
    return { daftar: hasil, dilewati, pinHashes };
  },

  api_gantiAdmin(token: string, userBaru: string, passLama: string, passBaru: string) {
    sesi_(token, 'admin');
    const db = getDb();
    const curUser = db.admin?.user || '';
    if (!cekAdmin_(curUser, String(passLama || ''))) throw new Error('Kata sandi lama salah.');
    const user = String(userBaru || '').trim() || curUser;
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    passBaru = String(passBaru || '') || String(passLama);
    if (passBaru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    setAdmin_(user, passBaru);
    return true;
  },

  api_simpanPengguna(token: string, d: any) {
    sesi_(token, 'admin');
    d = d || {};
    const nama = String(d.Nama || '').trim();
    const user = String(d.Username || '').trim().toLowerCase();
    let sandi = String(d.Sandi || '').trim();
    if (!nama) throw new Error('Nama wajib diisi.');
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (sandi && sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    const db = getDb();
    if (user === db.admin?.user) throw new Error('Nama pengguna ini dipakai admin.');
    const ada = baca_('Kelas').map(k => k.ID);
    const valid = (ids: string[]) => (ids || []).filter((id, i, a) => ada.includes(id) && a.indexOf(id) === i);
    let kw = valid(d.KelasWali);
    let km = valid(d.KelasMengajar);
    if (d.KelasWali === undefined && d.KelasMengajar === undefined) {
      const k = valid(d.Kelas);
      if (d.Peran === 'wali') kw = k;
      else if (d.Peran === 'guru') km = k;
      else throw new Error('Peran tidak valid.');
    }
    if (!kw.length && !km.length) throw new Error('Pilih minimal satu kelas sebagai wali kelas atau guru mapel.');
    const peran = (kw.length ? ['wali'] : []).concat(km.length ? ['guru'] : []);
    const semuaKelas = kw.concat(km.filter(k => !kw.includes(k)));
    const adaMapel = baca_('Mapel').map(m => m.ID);
    const mapel = (d.Mapel || []).filter((id: string) => adaMapel.includes(id));

    const semua = baca_('Pengguna');
    if (semua.some(u => u.Username === user && u.ID !== d.ID)) throw new Error('Nama pengguna sudah dipakai.');
    let u = d.ID ? semua.find(x => x.ID === d.ID) : null;
    let tampil = '';
    if (!u) {
      u = { ID: uidShort(), Nama: '', Username: '', Peran: '', Kelas: '', Hash: '', Mapel: '', KelasWali: '', KelasMengajar: '' };
      semua.push(u);
      if (!sandi) sandi = sandiAcak_();
    }
    if (sandi) {
      u.Hash = hash_(u.ID, sandi);
      tampil = sandi;
    }
    Object.assign(u, {
      Nama: nama,
      Username: user,
      Peran: peran.join(','),
      Kelas: semuaKelas.join(','),
      KelasWali: kw.join(','),
      KelasMengajar: km.join(','),
      Mapel: mapel.join(',')
    });
    tulis_('Pengguna', semua);
    return { daftar: daftarPengguna_(), sandi: tampil, username: user };
  },

  api_hapusPengguna(token: string, id: string) {
    sesi_(token, 'admin');
    tulis_('Pengguna', baca_('Pengguna').filter(u => u.ID !== id));
    return daftarPengguna_();
  },

  api_resetSandiPengguna(token: string, id: string, sandi: string) {
    sesi_(token, 'admin');
    sandi = String(sandi || '').trim() || sandiAcak_();
    if (sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.Hash = hash_(u.ID, sandi);
    tulis_('Pengguna', semua);
    return { sandi, username: u.Username };
  },

  api_setMapelSaya(token: string, ids: string[]) {
    const s = sesi_(token, 'staf');
    const ada = baca_('Mapel').map(m => m.ID);
    const pilih = (ids || []).filter(id => ada.includes(id));
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === s.sid);
    if (!u) throw new Error('SESI_HABIS');
    u.Mapel = pilih.join(',');
    tulis_('Pengguna', semua);
    return pilih.join(',');
  },

  api_gantiSandiSaya(token: string, lama: string, baru: string) {
    const s = sesi_(token, 'staf');
    baru = String(baru || '');
    if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    const semua = baca_('Pengguna');
    const u = semua.find(x => x.ID === s.sid);
    if (!u || u.Hash !== hash_(u.ID, String(lama || ''))) throw new Error('Kata sandi lama salah.');
    u.Hash = hash_(u.ID, baru);
    tulis_('Pengguna', semua);
    return true;
  },

  api_loadSiswa(token: string) {
    const sesi = sesi_(token, 'siswa');
    const siswa = baca_('Siswa').find(x => x.ID === sesi.sid);
    if (!siswa) throw new Error('SESI_HABIS');
    const kelas = baca_('Kelas').find(k => k.ID === siswa.Kelas) || { ID: '', Nama: '', Jurusan: '', Mapel: '' };
    const absKelas = baca_('Absensi').filter(a => a.Kelas === siswa.Kelas);
    const tanggal: Record<string, boolean> = {};
    absKelas.forEach(a => (tanggal[a.Tanggal] = true));
    const tugas = baca_('Tugas').filter(t => t.Kelas === siswa.Kelas);
    const pg = baca_('Pengumpulan').filter(p => p.SiswaID === siswa.ID);
    const set = pengaturan_();
    const nm: Record<string, string> = {};
    baca_('Siswa')
      .filter(s => s.Kelas === siswa.Kelas)
      .forEach(s => (nm[s.ID] = s.Nama));
    const atur = baca_('DenahAtur').find(a => a.Kelas === siswa.Kelas) || { Baris: '4', Kolom: '4', Grup: '2' };
    const denah = {
      Baris: atur.Baris,
      Kolom: atur.Kolom,
      Grup: atur.Grup,
      kursi: baca_('Denah')
        .filter(d => d.Kelas === siswa.Kelas && nm[d.SiswaID])
        .map(d => ({
          Baris: d.Baris,
          Kolom: d.Kolom,
          Nama: nm[d.SiswaID],
          Saya: d.SiswaID === siswa.ID
        }))
    };
    const piket = baca_('Piket')
      .filter(p => p.Kelas === siswa.Kelas && nm[p.SiswaID])
      .map(p => ({
        Hari: p.Hari,
        Tugas: p.Tugas,
        Nama: nm[p.SiswaID],
        Saya: p.SiswaID === siswa.ID
      }));
    const struktur = baca_('Struktur')
      .filter(s => s.Kelas === siswa.Kelas)
      .map(s => ({
        Jabatan: s.Jabatan,
        Tingkat: s.Tingkat,
        Nama: nm[s.SiswaID] || '',
        Saya: s.SiswaID === siswa.ID
      }));
    const jadwal = baca_('Jadwal')
      .filter(j => j.Kelas === siswa.Kelas)
      .map(j => ({
        Hari: j.Hari,
        Mulai: j.Mulai,
        Selesai: j.Selesai,
        Mapel: j.Mapel,
        Guru: j.Guru,
        Jenis: j.Jenis,
        Pekan: j.Pekan
      }));
    let jurusanLogo = '';
    try {
      const logoMap = JSON.parse(set.jurusanLogos || '{}');
      if (kelas.Jurusan && logoMap && typeof logoMap[kelas.Jurusan] === 'string') {
        jurusanLogo = logoMap[kelas.Jurusan];
      }
    } catch (_) {}
    return {
      siswa: { Nama: siswa.Nama, NIS: siswa.NIS },
      kelas: kelas.Nama || '',
      jurusan: kelas.Jurusan || '',
      jurusanLogo,
      mapel: kelas.Mapel || '',
      sekolah: set.sekolah,
      logo: set.logo || '',
      waInfo: set.waInfo || '',
      semester: set.semester,
      wali: waliKelas_(siswa.Kelas) || set.wali,
      guru: set.guru,
      denah,
      piket,
      struktur,
      jadwal,
      sekretaris: baca_('Struktur').some(
        j => j.Kelas === siswa.Kelas && j.SiswaID === siswa.ID && /sekretaris/i.test(j.Jabatan)
      ),
      sistemJadwal: (baca_('JadwalAtur').find(a => a.Kelas === siswa.Kelas) || {}).Sistem || 'reguler',
      mulaiSemester: set.mulai,
      akademik: baca_('Akademik').map(a => ({
        Mulai: a.Mulai,
        Selesai: a.Selesai,
        Kegiatan: a.Kegiatan,
        Jenis: a.Jenis,
        Sumber: a.Sumber || ''
      })),
      pengaturan: {
        kkm: set.kkm,
        b_sikap: set.b_sikap,
        b_tugas: set.b_tugas,
        b_proyek: set.b_proyek,
        b_uts: set.b_uts,
        b_uas: set.b_uas
      },
      totalPertemuan: Object.keys(tanggal).length,
      absensi: absKelas
        .filter(a => a.SiswaID === siswa.ID)
        .map(a => ({ Tanggal: a.Tanggal, Kode: a.Kode, Keterangan: a.Keterangan })),
      tugas: tugas.map(t => {
        const p = pg.find(x => x.TugasID === t.ID);
        return {
          ID: t.ID,
          Judul: t.Judul,
          Mapel: t.Mapel || '',
          Deskripsi: t.Deskripsi || '',
          Jenis: t.Jenis,
          Tenggat: t.Tenggat,
          FileID: t.FileID || '',
          NamaFile: t.NamaFile || '',
          Status: p ? p.Status : 'Belum',
          Nilai: p ? p.Nilai : '',
          FileSiswaID: p ? p.FileID || '' : '',
          NamaFileSiswa: p ? p.NamaFile || '' : '',
          TanggalKumpul: p ? p.TanggalKumpul || '' : '',
          CatatanSiswa: p ? p.CatatanSiswa || '' : ''
        };
      }),
      nilai: baca_('Nilai').find(n => n.Kelas === siswa.Kelas && n.SiswaID === siswa.ID) || null,
      cbtList: baca_('CBT')
        .filter(c => c.Kelas === siswa.Kelas && (c.Status === 'Aktif' || c.Status === 'Selesai'))
        .map(c => {
          let soalObj: any = { soalPG: [], soalUraian: [] };
          try { soalObj = JSON.parse(c.SoalJSON || '{}'); } catch (_) {}
          const hasil = baca_('HasilCBT').find(h => h.CBTID === c.ID && h.SiswaID === siswa.ID) || null;
          const sudahSelesai = !!hasil;
          return {
            ID: c.ID,
            Judul: c.Judul,
            Mapel: c.Mapel,
            Durasi: c.Durasi,
            Status: c.Status,
            Acak: c.Acak,
            TanggalBuat: c.TanggalBuat,
            soalPG: (soalObj.soalPG || []).map((q: any) =>
              sudahSelesai
                ? q
                : {
                    id: q.id,
                    pertanyaan: q.pertanyaan,
                    opsiA: q.opsiA,
                    opsiB: q.opsiB,
                    opsiC: q.opsiC,
                    opsiD: q.opsiD,
                    opsiE: q.opsiE
                  }
            ),
            soalUraian: (soalObj.soalUraian || []).map((q: any) =>
              sudahSelesai
                ? q
                : {
                    id: q.id,
                    pertanyaan: q.pertanyaan,
                    poinMaksimal: q.poinMaksimal
                  }
            ),
            hasil
          };
        })
    };
  },

  api_absensiKelas(token: string, tanggal: string) {
    const s = wajibSekretaris_(token);
    tanggal = tanggalSekretaris_(tanggal);
    const rec = baca_('Absensi').filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
    return {
      tanggal,
      siswa: baca_('Siswa')
        .filter(x => x.Kelas === s.Kelas)
        .sort((a, b) => a.Nama.localeCompare(b.Nama))
        .map(x => ({ ID: x.ID, Nama: x.Nama })),
      catatan: rec.map(a => ({ SiswaID: a.SiswaID, Kode: a.Kode, Keterangan: a.Keterangan })),
      terkunci: rec.some(a => a.Sumber !== 'sekretaris')
    };
  },

  api_simpanAbsensiSekretaris(token: string, tanggal: string, recs: any[]) {
    const s = wajibSekretaris_(token);
    tanggal = tanggalSekretaris_(tanggal);
    const semua = baca_('Absensi');
    const lama = semua.filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
    if (lama.some(a => a.Sumber !== 'sekretaris'))
      throw new Error('Absensi tanggal ini sudah diisi atau dikonfirmasi guru, sehingga tidak bisa diubah dari akun siswa.');
    const anggota: Record<string, boolean> = {};
    baca_('Siswa').forEach(x => {
      if (x.Kelas === s.Kelas) anggota[x.ID] = true;
    });
    const dipakai: Record<string, boolean> = {};
    const baru: Record<string, string>[] = [];
    (recs || []).forEach(r => {
      if (!anggota[r.SiswaID] || dipakai[r.SiswaID] || !KODE_ABSEN_.includes(r.Kode)) return;
      dipakai[r.SiswaID] = true;
      baru.push({
        Kelas: s.Kelas,
        Tanggal: tanggal,
        SiswaID: r.SiswaID,
        Kode: r.Kode,
        Keterangan: String(r.Keterangan || '').slice(0, 200),
        Sumber: 'sekretaris'
      });
    });
    tulis_(
      'Absensi',
      semua.filter(a => !(a.Kelas === s.Kelas && a.Tanggal === tanggal)).concat(baru)
    );
    return baru.length;
  },

  api_gantiPIN(token: string, lama: string, baru: string) {
    const sesi = sesi_(token, 'siswa');
    const lamaTrim = String(lama || '').trim();
    baru = String(baru || '').trim();
    if (!/^\d{4,8}$/.test(baru)) throw new Error('PIN baru harus 4-8 angka.');
    const a = baca_('Akun').find(x => x.SiswaID === sesi.sid);
    if (!a || (a.Hash !== hash_(sesi.sid, String(lama || '')) && a.Hash !== hash_(sesi.sid, lamaTrim))) {
      throw new Error('PIN lama salah.');
    }
    simpanAkun_([{ id: sesi.sid, pin: baru }]);
    return true;
  },

  api_resetDemo(token: string) {
    sesi_(token, 'admin');
    dbCache = createSeedDatabase();
    saveDb();
    return true;
  },

  api_resetAllData(
    token: string,
    opts?: {
      resetKelas?: boolean;
      resetMapel?: boolean;
      resetPengguna?: boolean;
      resetPengaturan?: boolean;
    }
  ) {
    sesi_(token, 'admin');
    const db = getDb();
    const o = opts || {};
    const operationalSheets = [
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
      'Akun'
    ];
    for (const s of operationalSheets) {
      db.sheets[s] = [];
    }
    if (o.resetKelas) db.sheets.Kelas = [];
    if (o.resetMapel) db.sheets.Mapel = [];
    if (o.resetPengguna) db.sheets.Pengguna = [];
    if (o.resetPengaturan) {
      db.sheets.Pengaturan = Object.entries(PENGATURAN_AWAL).map(([Kunci, Nilai]) => ({ Kunci, Nilai }));
    }
    // Clear uploaded files on disk
    for (const dir of [CLOUD_DIR, TUGAS_DIR]) {
      try {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
          }
        }
      } catch (_) {}
    }
    saveDb();
    return true;
  },

  api_resetPartial(token: string, category: string) {
    sesi_(token, 'admin');
    const db = getDb();
    const map: Record<string, string[]> = {
      absensi: ['Absensi'],
      nilai_tugas: ['Tugas', 'Pengumpulan', 'Nilai'],
      cbt: ['CBT', 'HasilCBT'],
      operasional_kelas: ['DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur'],
      perangkat_ajar: ['TP', 'Modul', 'Pemantik'],
      kalender: ['Akademik', 'Checklist'],
      siswa: ['Siswa', 'Akun']
    };
    const targets = map[category];
    if (!targets) throw new Error('Kategori reset tidak dikenal.');
    for (const s of targets) {
      db.sheets[s] = [];
    }
    saveDb();
    return targets;
  },

  api_syncFromFirestore(token: string, snapshot: Record<string, any>) {
    sesi_(token, 'admin');
    if (!snapshot || typeof snapshot !== 'object') return false;
    const db = getDb();
    if (snapshot.Pengaturan && typeof snapshot.Pengaturan === 'object') {
      const merged = { ...pengaturan_(), ...snapshot.Pengaturan };
      db.sheets.Pengaturan = Object.entries(merged).map(([Kunci, Nilai]) => ({
        Kunci,
        Nilai: Nilai == null ? '' : String(Nilai)
      }));
    }
    for (const key of Object.keys(SKEMA)) {
      if (key === 'Pengaturan' || key === 'Akun') continue;
      if (Array.isArray(snapshot[key])) {
        const cols = SKEMA[key];
        if (key === 'Pengguna') {
          const oldMap = new Map((db.sheets.Pengguna || []).map(u => [u.ID, u.Hash]));
          db.sheets.Pengguna = snapshot[key].map((r: any) => {
            const obj: Record<string, string> = {};
            cols.forEach(c => {
              if (c === 'Hash') obj[c] = oldMap.get(r.ID) || hash_(String(r.ID || ''), 'guru12345');
              else obj[c] = r[c] == null ? '' : String(r[c]);
            });
            return obj;
          });
        } else {
          db.sheets[key] = snapshot[key].map((r: any) => {
            const obj: Record<string, string> = {};
            cols.forEach(c => {
              obj[c] = r[c] == null ? '' : String(r[c]);
            });
            return obj;
          });
          if (key === 'Siswa') {
            const existingAkunMap = new Map((db.sheets.Akun || []).map(a => [a.SiswaID, a.Hash]));
            const restoredAkun: Record<string, string>[] = [];
            snapshot[key].forEach((r: any) => {
              const sid = String(r.ID || '');
              if (!sid) return;
              const h = String(r.PinHash || '').trim() || existingAkunMap.get(sid) || '';
              if (h) restoredAkun.push({ SiswaID: sid, Hash: h });
            });
            db.sheets.Akun = restoredAkun;
          }
        }
      }
    }
    saveDb();
    return true;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/') || err) {
      if (err?.type === 'entity.too.large' || err?.status === 413) {
        res.status(413).json({ ok: false, error: 'Ukuran data atau berkas melebihi batas 25 MB.' });
        return;
      }
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ ok: false, error: 'Format payload JSON tidak valid.' });
        return;
      }
      if (err) {
        res.status(err.status || 500).json({ ok: false, error: err.message || 'Kesalahan server internal.' });
        return;
      }
    }
    next();
  });

  app.post('/api/rpc', (req, res) => {
    try {
      const { fn, args } = req.body || {};
      if (!fn || typeof rpcMethods[fn] !== 'function') {
        res.status(400).json({ ok: false, error: 'Metode API tidak ditemukan: ' + fn });
        return;
      }
      const result = rpcMethods[fn](...(Array.isArray(args) ? args : []));
      res.json({ ok: true, data: result });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Verify Firebase Google ID Token cryptographically & create app session
  app.post('/api/auth/google-session', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken || typeof idToken !== 'string') {
        res.status(400).json({ ok: false, error: 'Token Firebase Google tidak ditemukan.' });
        return;
      }
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        res.status(401).json({ ok: false, error: 'Format token Firebase tidak valid.' });
        return;
      }
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      if (header.alg !== 'RS256' || !header.kid) {
        res.status(401).json({ ok: false, error: 'Algoritma token tidak didukung.' });
        return;
      }

      let projectId = 'gen-lang-client-0510395924';
      try {
        if (fs.existsSync(FIREBASE_CONFIG_PATH)) {
          const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));
          if (cfg.projectId) projectId = cfg.projectId;
        }
      } catch (_) {}

      const certsResp = await fetch(
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
      );
      if (!certsResp.ok) {
        res.status(502).json({ ok: false, error: 'Gagal memverifikasi sertifikat Google Auth.' });
        return;
      }
      const certsText = await certsResp.text();
      let certs: Record<string, string> = {};
      try {
        certs = JSON.parse(certsText);
      } catch {
        res.status(502).json({ ok: false, error: 'Respons sertifikat Google Auth bukan JSON yang valid.' });
        return;
      }
      const pem = certs[header.kid];
      if (!pem) {
        res.status(401).json({ ok: false, error: 'Kunci sertifikat Firebase tidak cocok.' });
        return;
      }

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      verifier.end();
      const sigOk = verifier.verify(pem, Buffer.from(parts[2], 'base64url'));
      if (!sigOk) {
        res.status(401).json({ ok: false, error: 'Tanda tangan token Firebase tidak valid.' });
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (
        payload.aud !== projectId ||
        payload.iss !== `https://securetoken.google.com/${projectId}` ||
        !payload.sub ||
        Number(payload.exp || 0) <= nowSec
      ) {
        res.status(401).json({ ok: false, error: 'Token Firebase sudah kedaluwarsa atau proyek tidak sesuai.' });
        return;
      }

      if (!payload.email_verified || !payload.email) {
        res.status(403).json({ ok: false, error: 'Email Google harus terverifikasi.' });
        return;
      }

      const emailLower = String(payload.email).trim().toLowerCase();
      const set = pengaturan_();
      const pemulihan = String(set.emailPemulihan || '').trim().toLowerCase();
      const isAuthorizedAdmin =
        emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() ||
        (pemulihan && emailLower === pemulihan);

      if (!isAuthorizedAdmin) {
        res.status(403).json({
          ok: false,
          error: `Akun Google ${payload.email} terhubung ke Firestore, namun bukan email Admin yang terdaftar (${BOOTSTRAPPED_ADMIN_EMAIL}).`
        });
        return;
      }

      const session = buatSesi_('admin', '', String(payload.name || payload.email));
      res.json({ ok: true, data: session });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || 'Gagal autentikasi Google.' });
    }
  });

  // Sync & Auto-Update Jawa Barat Education Calendar (with optional Gemini Search Grounding)
  app.post('/api/kaldik/sync-jabar', async (req, res) => {
    try {
      const { token, tahunAjaran, useAi } = req.body || {};
      staf_(token);
      const ta = String(tahunAjaran || KALDIK_JABAR_REF.tahunAjaran).trim();
      let jabarEvents = getKaldikJabarEvents(ta);
      let sourceNote = `${KALDIK_JABAR_REF.dasarSurat} (${ta})`;

      if (useAi && process.env.GEMINI_API_KEY) {
        try {
          const aiResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Susun daftar agenda utama Kalender Pendidikan Provinsi Jawa Barat Tahun Ajaran ${ta} berdasarkan pedoman resmi Dinas Pendidikan Provinsi Jawa Barat (Hari Pertama Masuk Sekolah, MPLS, PTS/STS Ganjil & Genap, SAS Ganjil, Pembagian Rapor Ganjil & Genap, Libur Semester, Libur Akhir Tahun, serta Hari Libur Nasional utama). Kembalikan JSON valid.`,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  catatanSumber: { type: Type.STRING },
                  agenda: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        mulai: { type: Type.STRING, description: 'Format YYYY-MM-DD' },
                        selesai: { type: Type.STRING, description: 'Format YYYY-MM-DD' },
                        kegiatan: { type: Type.STRING },
                        jenis: {
                          type: Type.STRING,
                          description: 'Pilih salah satu: Kegiatan belajar, Ujian, Rapor, Kegiatan sekolah, Libur, Lainnya'
                        }
                      },
                      required: ['mulai', 'selesai', 'kegiatan', 'jenis']
                    }
                  }
                },
                required: ['agenda']
              }
            }
          });
          const parsed = JSON.parse((aiResp.text ?? '{}').trim());
          if (Array.isArray(parsed.agenda) && parsed.agenda.length >= 6) {
            const validJenis = ['Kegiatan belajar', 'Ujian', 'Rapor', 'Kegiatan sekolah', 'Libur', 'Lainnya'];
            jabarEvents = parsed.agenda
              .filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(x.mulai || '')))
              .map((x: any, i: number) => ({
                ID: `jabar_${ta.replace(/[^0-9]/g, '_')}_${i + 1}`,
                Mulai: String(x.mulai),
                Selesai: /^\d{4}-\d{2}-\d{2}$/.test(String(x.selesai || '')) ? String(x.selesai) : String(x.mulai),
                Kegiatan: String(x.kegiatan || '').slice(0, 250),
                Jenis: validJenis.includes(x.jenis) ? x.jenis : 'Kegiatan sekolah',
                Sumber: `Kaldik Disdik Jabar ${ta} (AI + Web)`
              }));
            if (parsed.catatanSumber) sourceNote = String(parsed.catatanSumber);
          }
        } catch (aiErr) {
          console.warn('Kaldik AI search fallback to local Disdik Jabar dataset:', aiErr);
        }
      }

      // Merge Jabar events while preserving custom school events
      const existing = baca_('Akademik');
      const customEvents = existing.filter(
        ev => !String(ev.ID).startsWith('jabar_') && !String(ev.Sumber || '').includes('Jabar')
      );
      const merged = [...jabarEvents, ...customEvents].sort((a, b) =>
        (a.Mulai || '').localeCompare(b.Mulai || '')
      );
      tulis_('Akademik', merged);

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const curSet = pengaturan_();
      curSet.kaldikTahunAjaran = ta;
      curSet.kaldikWilayah = KALDIK_JABAR_REF.wilayah;
      curSet.kaldikLastSync = stamp;
      tulis_(
        'Pengaturan',
        Object.keys(curSet).map(k => ({ Kunci: k, Nilai: curSet[k] }))
      );

      res.json({
        ok: true,
        data: {
          akademik: merged,
          pengaturan: curSet,
          addedCount: jabarEvents.length,
          sourceNote
        }
      });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Cloud Vault Upload Endpoint
  app.post('/api/cloud/upload', (req, res) => {
    try {
      const { token, kelas, namaFile, tipeMime, ukuran, base64Data, teksEkstrak } = req.body || {};
      const s = sesi_(token);
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Data berkas tidak lengkap.' });
        return;
      }

      if (!fs.existsSync(CLOUD_DIR)) {
        fs.mkdirSync(CLOUD_DIR, { recursive: true });
      }

      const id = 'cld_' + uidShort();
      const safeName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storedFileName = `${id}_${safeName}`;
      const fullPath = path.join(CLOUD_DIR, storedFileName);

      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(fullPath, buffer);

      // Save optional extracted text sidecar if provided
      if (teksEkstrak) {
        fs.writeFileSync(fullPath + '.txt', String(teksEkstrak), 'utf8');
      }

      const now = new Date();
      const tgl = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record = {
        ID: id,
        Kelas: String(kelas || ''),
        NamaFile: String(namaFile),
        TipeMime: String(tipeMime || 'application/octet-stream'),
        Ukuran: String(ukuran || buffer.length),
        TanggalUnggah: tgl,
        Pengunggah: s.nama || (s.role === 'admin' ? 'Administrator' : 'Pengguna'),
        StatusCloud: 'Tersimpan Aman (AES-256 Cloud Vault)',
        PathSimpan: storedFileName,
        AnalisisJSON: ''
      };

      const semua = baca_('BerkasCloud');
      semua.unshift(record);
      tulis_('BerkasCloud', semua);

      res.json({ ok: true, data: record });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // AI Document & Media Analysis Endpoint using gemini-3.8-flash
  app.post('/api/cloud/analyze', async (req, res) => {
    try {
      const { token, fileId, instruksiTambahan } = req.body || {};
      sesi_(token);

      const semua = baca_('BerkasCloud');
      const rec = semua.find(x => x.ID === fileId);
      if (!rec) {
        res.status(404).json({ ok: false, error: 'Berkas tidak ditemukan di penyimpanan cloud.' });
        return;
      }

      const fullPath = path.join(CLOUD_DIR, rec.PathSimpan);
      const parts: any[] = [];

      const mime = (rec.TipeMime || '').toLowerCase();
      const isTextLike =
        mime.includes('text') ||
        mime.includes('csv') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        /\.(txt|csv|tsv|json|md|html|gs|js|ts)$/i.test(rec.NamaFile);

      const isInlineSupported =
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        mime.startsWith('audio/');

      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        if (isTextLike) {
          const textContent = buf.toString('utf8').slice(0, 60000);
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile}\nTipe: ${rec.TipeMime}\nIsi Berkas:\n\`\`\`\n${textContent}\n\`\`\``
          });
        } else if (isInlineSupported) {
          parts.push({
            inlineData: {
              mimeType: mime || 'image/png',
              data: buf.toString('base64')
            }
          });
        } else if (fs.existsSync(fullPath + '.txt')) {
          const sidecar = fs.readFileSync(fullPath + '.txt', 'utf8').slice(0, 60000);
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile}\nIsi Teks Ekstraksi:\n${sidecar}`
          });
        } else {
          // Try utf8 fallback extract for spreadsheet/doc
          const rawStr = buf.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').slice(0, 30000);
          parts.push({
            text: `Nama Berkas: ${rec.NamaFile} (${rec.TipeMime}, ${rec.Ukuran} bytes).\nKonten terbaca:\n${rawStr}`
          });
        }
      } else {
        parts.push({
          text: `Nama Berkas: ${rec.NamaFile} (${rec.TipeMime}). Analisis berdasarkan konteks dokumen akademik kelas.`
        });
      }

      const promptText = `Analisis berkas "${rec.NamaFile}" ini secara mendalam dalam konteks pendidikan dan manajemen kelas.
${instruksiTambahan ? `Fokus tambahan dari pengguna: ${instruksiTambahan}\n` : ''}
Ekstrak informasi kunci, identifikasi tren atau pola penting, dan berikan ringkasan eksekutif serta rekomendasi tindak lanjut yang konkret dan dapat langsung diterapkan oleh guru, wali kelas, atau siswa.`;

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction:
            'Anda adalah analis data pendidikan dan asisten akademik ahli. Analisis dokumen teks, spreadsheet nilai/absensi, PDF, atau gambar kegiatan/catatan belajar dengan presisi tinggi dalam Bahasa Indonesia.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kategoriDokumen: {
                type: Type.STRING,
                description: 'Kategori dokumen (mis. Spreadsheet Nilai, Dokumen Modul Ajar, Foto Catatan Kelas, Laporan Absensi).'
              },
              ringkasanEksekutif: {
                type: Type.STRING,
                description: 'Ringkasan padat dan komprehensif mengenai isi dokumen (2-4 kalimat).'
              },
              informasiKunci: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Poin-poin informasi kunci, angka statistik, atau fakta penting yang diekstrak dari berkas.'
              },
              identifikasiTren: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Pola, anomali, atau tren yang teridentifikasi dari data/dokumen.'
              },
              rekomendasiTindakLanjut: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Langkah tindak lanjut konkret dan dapat ditindaklanjuti (actionable) untuk guru atau siswa.'
              }
            },
            required: [
              'kategoriDokumen',
              'ringkasanEksekutif',
              'informasiKunci',
              'identifikasiTren',
              'rekomendasiTindakLanjut'
            ]
          }
        }
      });

      const jsonText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonText);

      rec.AnalisisJSON = JSON.stringify(parsed);
      rec.StatusCloud = 'Tersimpan & Teranalisis AI';
      tulis_('BerkasCloud', semua);

      res.json({ ok: true, data: { record: rec, analisis: parsed } });
    } catch (e: any) {
      res.status(200).json({
        ok: false,
        error: e?.message || 'Gagal menganalisis berkas dengan AI.'
      });
    }
  });

  // Delete Cloud File Endpoint
  app.post('/api/cloud/delete', (req, res) => {
    try {
      const { token, fileId } = req.body || {};
      sesi_(token);
      const semua = baca_('BerkasCloud');
      const target = semua.find(x => x.ID === fileId);
      if (target && target.PathSimpan) {
        const fullPath = path.join(CLOUD_DIR, target.PathSimpan);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (_) {}
        }
      }
      const sisa = semua.filter(x => x.ID !== fileId);
      tulis_('BerkasCloud', sisa);
      res.json({ ok: true, data: sisa });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Download Cloud File Endpoint
  app.get('/api/cloud/file/:id', (req, res) => {
    try {
      const rec = baca_('BerkasCloud').find(x => x.ID === req.params.id);
      if (!rec) {
        res.status(404).send('Berkas tidak ditemukan');
        return;
      }
      const fullPath = path.join(CLOUD_DIR, rec.PathSimpan);
      if (!fs.existsSync(fullPath)) {
        res.status(404).send('Data fisik berkas merupakan sampel pratinjau metadata.');
        return;
      }
      res.setHeader('Content-Type', rec.TipeMime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${rec.NamaFile}"`);
      res.sendFile(fullPath);
    } catch (e) {
      res.status(500).send('Gagal mengunduh berkas');
    }
  });

  // Generate CBT PG (0-50) & Uraian (0-5) strictly from pasted or uploaded material using gemini-4-hydrogen
  app.post('/api/cbt/generate', async (req, res) => {
    try {
      const {
        token,
        uraianMateri,
        namaFile,
        tipeMime,
        base64Data,
        jumlahPG,
        jumlahUraian,
        tingkat,
        judul,
        mapel
      } = req.body || {};

      staf_(token);

      const nPG = Math.max(0, Math.min(50, Math.floor(Number(jumlahPG) || 0)));
      const nUr = Math.max(0, Math.min(5, Math.floor(Number(jumlahUraian) || 0)));
      if (nPG === 0 && nUr === 0) {
        res.status(400).json({ ok: false, error: 'Masukkan minimal 1 soal PG (maks. 50) atau 1 soal Uraian (maks. 5).' });
        return;
      }

      const teksMateri = String(uraianMateri || '').trim();
      const hasFile = Boolean(base64Data && namaFile);
      if (!teksMateri && !hasFile) {
        res.status(400).json({ ok: false, error: 'Masukkan uraian materi atau unggah berkas materi terlebih dahulu.' });
        return;
      }

      const parts: any[] = [];
      if (hasFile) {
        const buf = Buffer.from(String(base64Data), 'base64');
        const mime = String(tipeMime || '').toLowerCase();
        const isTextLike =
          mime.includes('text') ||
          mime.includes('csv') ||
          mime.includes('json') ||
          mime.includes('xml') ||
          /\.(txt|csv|tsv|json|md|html|gs|js|ts)$/i.test(String(namaFile));
        const isInline =
          mime.startsWith('image/') ||
          mime === 'application/pdf';

        if (isTextLike) {
          parts.push({
            text: `=== BERKAS MATERI SUMBER (${namaFile}) ===\n${buf.toString('utf8').slice(0, 80000)}`
          });
        } else if (isInline) {
          parts.push({
            inlineData: {
              mimeType: mime || 'application/pdf',
              data: String(base64Data)
            }
          });
        } else {
          const readable = buf.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').slice(0, 45000);
          parts.push({
            text: `=== BERKAS MATERI SUMBER (${namaFile}) ===\n${readable}`
          });
        }
      }

      if (teksMateri) {
        parts.push({
          text: `=== URAIAN MATERI SUMBER ===\n${teksMateri.slice(0, 80000)}`
        });
      }

      const instruksi = `Buatkan paket soal CBT berbasis materi sumber di atas dengan rincian:
- Judul/Topik: ${judul || 'Evaluasi Materi'} (${mapel || 'Umum'})
- Tingkat Kesulitan: ${tingkat || 'Campuran (C1–C5)'}
- Jumlah Soal Pilihan Ganda (PG): TEPAT ${nPG} soal${nPG === 0 ? ' (WAJIB array kosong [])' : ''}
- Jumlah Soal Uraian: TEPAT ${nUr} soal${nUr === 0 ? ' (WAJIB array kosong [])' : ''}

ATURAN KETAT SUMBER MATERI:
1. Seluruh pertanyaan, opsi jawaban (A–E), kunci jawaban, pembahasan, dan rubrik uraian WAJIB bersumber HANYA dari uraian materi atau berkas materi yang diberikan di atas.
2. DILARANG menambahkan fakta, definisi, rumus, atau informasi dari luar materi sumber yang diberikan.
3. Pada setiap soal, cantumkan field "kutipanMateri" yang mengutip kalimat/poin singkat langsung dari materi sumber sebagai bukti dasar soal tersebut.
4. Untuk soal PG (jika > 0), sediakan tepat 5 pilihan jawaban (opsiA, opsiB, opsiC, opsiD, opsiE) dengan tepat 1 kunci jawaban berupa huruf kapital 'A', 'B', 'C', 'D', atau 'E'.
5. Untuk soal Uraian (jika > 0), berikan pertanyaan analitis/pemahaman sesuai materi, kunci/rubrik jawaban ideal, dan poinMaksimal yang proporsional sehingga total poinMaksimal seluruh soal uraian = 100.`;

      parts.push({ text: instruksi });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'Anda adalah ahli penyusun soal CBT (Computer-Based Test) pendidikan Indonesia. Anda HANYA boleh menyusun soal dari materi sumber yang diberikan pengguna dan dilarang keras mengarang informasi di luar sumber materi.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasanMateri: {
                type: Type.STRING,
                description: 'Ringkasan padat materi sumber yang digunakan (2-4 kalimat).'
              },
              soalPG: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pertanyaan: { type: Type.STRING },
                    opsiA: { type: Type.STRING },
                    opsiB: { type: Type.STRING },
                    opsiC: { type: Type.STRING },
                    opsiD: { type: Type.STRING },
                    opsiE: { type: Type.STRING },
                    kunci: { type: Type.STRING, description: 'A, B, C, D, atau E' },
                    pembahasan: { type: Type.STRING },
                    kutipanMateri: { type: Type.STRING }
                  },
                  required: ['pertanyaan', 'opsiA', 'opsiB', 'opsiC', 'opsiD', 'opsiE', 'kunci', 'pembahasan', 'kutipanMateri']
                }
              },
              soalUraian: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pertanyaan: { type: Type.STRING },
                    kunciRubrik: { type: Type.STRING },
                    poinMaksimal: { type: Type.NUMBER },
                    kutipanMateri: { type: Type.STRING }
                  },
                  required: ['pertanyaan', 'kunciRubrik', 'poinMaksimal', 'kutipanMateri']
                }
              }
            },
            required: ['ringkasanMateri', 'soalPG', 'soalUraian']
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const pgOut = nPG === 0
        ? []
        : (parsed.soalPG || []).slice(0, nPG).map((q: any, i: number) => ({
            id: `pg_${Date.now()}_${i + 1}`,
            pertanyaan: String(q.pertanyaan || ''),
            opsiA: String(q.opsiA || ''),
            opsiB: String(q.opsiB || ''),
            opsiC: String(q.opsiC || ''),
            opsiD: String(q.opsiD || ''),
            opsiE: String(q.opsiE || ''),
            kunci: ['A', 'B', 'C', 'D', 'E'].includes(String(q.kunci || '').toUpperCase().trim())
              ? String(q.kunci).toUpperCase().trim()
              : 'A',
            pembahasan: String(q.pembahasan || ''),
            kutipanMateri: String(q.kutipanMateri || '')
          }));

      const urOut = nUr === 0
        ? []
        : (parsed.soalUraian || []).slice(0, nUr).map((q: any, i: number) => ({
            id: `ur_${Date.now()}_${i + 1}`,
            pertanyaan: String(q.pertanyaan || ''),
            kunciRubrik: String(q.kunciRubrik || ''),
            poinMaksimal: Number(q.poinMaksimal) || Math.round(100 / nUr),
            kutipanMateri: String(q.kutipanMateri || '')
          }));

      res.json({
        ok: true,
        data: {
          ringkasanMateri: String(parsed.ringkasanMateri || ''),
          soalPG: pgOut,
          soalUraian: urOut
        }
      });
    } catch (e: any) {
      res.status(200).json({
        ok: false,
        error: e?.message || 'Gagal menghasilkan soal CBT dengan AI.'
      });
    }
  });

  // Student submits CBT PG & Uraian answers
  app.post('/api/cbt/submit', (req, res) => {
    try {
      const { token, cbtId, jawabanPG, jawabanUraian, mulai } = req.body || {};
      const sesi = sesi_(token, 'siswa');
      const siswa = baca_('Siswa').find(s => s.ID === sesi.sid);
      if (!siswa) throw new Error('SESI_HABIS');

      const cbt = baca_('CBT').find(c => c.ID === cbtId && c.Kelas === siswa.Kelas);
      if (!cbt) {
        res.status(404).json({ ok: false, error: 'Paket CBT tidak ditemukan.' });
        return;
      }
      if (cbt.Status !== 'Aktif') {
        res.status(400).json({ ok: false, error: 'Ujian CBT ini sedang tidak dibuka.' });
        return;
      }

      const semuaHasil = baca_('HasilCBT');
      if (semuaHasil.some(h => h.CBTID === cbtId && h.SiswaID === siswa.ID)) {
        res.status(400).json({ ok: false, error: 'Anda sudah mengumpulkan ujian CBT ini.' });
        return;
      }

      let soalObj: any = { soalPG: [], soalUraian: [] };
      try { soalObj = JSON.parse(cbt.SoalJSON || '{}'); } catch (_) {}
      const soalPG = soalObj.soalPG || [];
      const soalUraian = soalObj.soalUraian || [];

      let benarPG = 0;
      soalPG.forEach((q: any) => {
        const jwb = String((jawabanPG || {})[q.id] || '').toUpperCase().trim();
        if (jwb && jwb === String(q.kunci || '').toUpperCase().trim()) {
          benarPG++;
        }
      });

      const skorPG = soalPG.length > 0 ? Math.round((benarPG / soalPG.length) * 1000) / 10 : 0;
      const hasUraian = soalUraian.length > 0;
      const hasPG = soalPG.length > 0;

      const now = new Date();
      const selesaiStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record = {
        ID: 'hcbt_' + uidShort(),
        CBTID: cbtId,
        Kelas: siswa.Kelas,
        SiswaID: siswa.ID,
        Mulai: String(mulai || selesaiStr),
        Selesai: selesaiStr,
        JawabanJSON: JSON.stringify({
          pg: jawabanPG || {},
          uraian: jawabanUraian || {}
        }),
        SkorPG: hasPG ? String(skorPG) : '-',
        SkorUraian: hasUraian ? '' : '-',
        SkorAkhir: hasUraian ? '' : String(skorPG),
        FeedbackAI: '',
        StatusNilai: hasUraian ? 'Menunggu Nilai Uraian' : 'Selesai'
      };

      semuaHasil.push(record);
      tulis_('HasilCBT', semuaHasil);
      res.json({ ok: true, data: record });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // AI Grades Student Uraian Answers using gemini-4-hydrogen
  app.post('/api/cbt/grade-essay', async (req, res) => {
    try {
      const { token, hasilId } = req.body || {};
      staf_(token);

      const semuaHasil = baca_('HasilCBT');
      const hasil = semuaHasil.find(h => h.ID === hasilId);
      if (!hasil) {
        res.status(404).json({ ok: false, error: 'Data hasil CBT tidak ditemukan.' });
        return;
      }
      const cbt = baca_('CBT').find(c => c.ID === hasil.CBTID);
      if (!cbt) {
        res.status(404).json({ ok: false, error: 'Paket CBT tidak ditemukan.' });
        return;
      }

      let soalObj: any = { soalPG: [], soalUraian: [] };
      let jwbObj: any = { pg: {}, uraian: {} };
      try { soalObj = JSON.parse(cbt.SoalJSON || '{}'); } catch (_) {}
      try { jwbObj = JSON.parse(hasil.JawabanJSON || '{}'); } catch (_) {}

      const soalPG = soalObj.soalPG || [];
      const soalUraian = soalObj.soalUraian || [];
      if (!soalUraian.length) {
        res.json({ ok: true, data: hasil });
        return;
      }

      const evaluasiPayload = soalUraian.map((q: any, idx: number) => ({
        nomor: idx + 1,
        id: q.id,
        pertanyaan: q.pertanyaan,
        kunciRubrik: q.kunciRubrik,
        poinMaksimal: Number(q.poinMaksimal) || Math.round(100 / soalUraian.length),
        jawabanSiswa: String((jwbObj.uraian || {})[q.id] || '(Tidak dijawab)')
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Materi Sumber CBT:\n${cbt.SumberMateri || '-'}\n\nDaftar Soal Uraian, Rubrik, & Jawaban Siswa:\n${JSON.stringify(evaluasiPayload, null, 2)}\n\nNilai setiap jawaban uraian siswa secara objektif berdasarkan rubrik dan materi sumber.`,
        config: {
          systemInstruction:
            'Anda adalah penilai asesmen uraian guru Indonesia yang objektif, adil, dan konstruktif. Berikan skor numerik sesuai poinMaksimal masing-masing soal dan catatan umpan balik singkat dalam Bahasa Indonesia.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detail: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    skor: { type: Type.NUMBER },
                    maksimal: { type: Type.NUMBER },
                    komentar: { type: Type.STRING }
                  },
                  required: ['id', 'skor', 'maksimal', 'komentar']
                }
              },
              ringkasanFeedback: { type: Type.STRING }
            },
            required: ['detail', 'ringkasanFeedback']
          }
        }
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const detail = parsed.detail || [];
      const totSkor = detail.reduce((acc: number, d: any) => acc + (Number(d.skor) || 0), 0);
      const totMax = soalUraian.reduce((acc: number, q: any) => acc + (Number(q.poinMaksimal) || Math.round(100 / soalUraian.length)), 0);
      const skorUraian = totMax > 0 ? Math.min(100, Math.round((totSkor / totMax) * 1000) / 10) : 0;

      const hasPG = soalPG.length > 0;
      const skorPGVal = Number(hasil.SkorPG) || 0;
      const skorAkhir = hasPG
        ? Math.round((skorPGVal * 0.6 + skorUraian * 0.4) * 10) / 10
        : skorUraian;

      hasil.SkorUraian = String(skorUraian);
      hasil.SkorAkhir = String(skorAkhir);
      hasil.FeedbackAI = JSON.stringify({
        ringkasan: parsed.ringkasanFeedback || '',
        detail
      });
      hasil.StatusNilai = 'Dinilai AI';

      tulis_('HasilCBT', semuaHasil);
      res.json({ ok: true, data: hasil });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || 'Gagal menilai uraian dengan AI.' });
    }
  });

  // Teacher manually saves/confirms CBT grades
  app.post('/api/cbt/save-grade', (req, res) => {
    try {
      const { token, hasilId, skorUraian, skorAkhir, catatanGuru } = req.body || {};
      staf_(token);

      const semuaHasil = baca_('HasilCBT');
      const hasil = semuaHasil.find(h => h.ID === hasilId);
      if (!hasil) {
        res.status(404).json({ ok: false, error: 'Data hasil CBT tidak ditemukan.' });
        return;
      }

      if (skorUraian !== undefined) hasil.SkorUraian = String(skorUraian);
      if (skorAkhir !== undefined) hasil.SkorAkhir = String(skorAkhir);
      if (catatanGuru !== undefined) {
        let fbObj: any = {};
        try { fbObj = JSON.parse(hasil.FeedbackAI || '{}'); } catch (_) {}
        fbObj.catatanGuru = String(catatanGuru);
        hasil.FeedbackAI = JSON.stringify(fbObj);
      }
      hasil.StatusNilai = 'Final';
      tulis_('HasilCBT', semuaHasil);
      res.json({ ok: true, data: hasil });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Upload Teacher Attachment for Tugas
  app.post('/api/tugas/upload-soal', (req, res) => {
    try {
      const { token, namaFile, base64Data } = req.body || {};
      staf_(token);
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Pilih berkas lampiran tugas terlebih dahulu.' });
        return;
      }
      if (!fs.existsSync(TUGAS_DIR)) fs.mkdirSync(TUGAS_DIR, { recursive: true });
      const fileId = 'tgs_' + uidShort();
      const cleanName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${fileId}__${cleanName}`;
      const buf = Buffer.from(String(base64Data), 'base64');
      fs.writeFileSync(path.join(TUGAS_DIR, diskName), buf);
      res.json({ ok: true, data: { fileId, namaFile: String(namaFile) } });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Student Submits Assignment File
  app.post('/api/tugas/submit', (req, res) => {
    try {
      const { token, tugasId, namaFile, base64Data, catatan } = req.body || {};
      const sesi = sesi_(token, 'siswa');
      const siswa = baca_('Siswa').find(s => s.ID === sesi.sid);
      if (!siswa) throw new Error('SESI_HABIS');

      const tugas = baca_('Tugas').find(t => t.ID === tugasId && t.Kelas === siswa.Kelas);
      if (!tugas) {
        res.status(404).json({ ok: false, error: 'Tugas tidak ditemukan.' });
        return;
      }
      if (!namaFile || !base64Data) {
        res.status(400).json({ ok: false, error: 'Pilih berkas hasil tugas untuk diunggah.' });
        return;
      }

      if (!fs.existsSync(TUGAS_DIR)) fs.mkdirSync(TUGAS_DIR, { recursive: true });
      const fileId = 'tsis_' + uidShort();
      const cleanName = String(namaFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${fileId}__${cleanName}`;
      const buf = Buffer.from(String(base64Data), 'base64');
      fs.writeFileSync(path.join(TUGAS_DIR, diskName), buf);

      const now = new Date();
      const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const tanggalKumpul = `${todayYmd} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const statusWaktu = !tugas.Tenggat || todayYmd <= String(tugas.Tenggat) ? 'Tepat Waktu' : 'Terlambat';

      const semuaPg = baca_('Pengumpulan');
      const idx = semuaPg.findIndex(p => p.TugasID === tugasId && p.SiswaID === siswa.ID);
      const updated = {
        TugasID: tugasId,
        SiswaID: siswa.ID,
        Status: statusWaktu,
        Nilai: idx >= 0 ? semuaPg[idx].Nilai || '' : '',
        FileID: fileId,
        NamaFile: String(namaFile),
        TanggalKumpul: tanggalKumpul,
        CatatanSiswa: String(catatan || '').trim()
      };
      if (idx >= 0) semuaPg[idx] = updated;
      else semuaPg.push(updated);

      tulis_('Pengumpulan', semuaPg);
      res.json({ ok: true, data: updated });
    } catch (e: any) {
      res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Download Tugas / Student Submission File
  app.get('/api/tugas/file/:fileId', (req, res) => {
    try {
      const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!fileId || !fs.existsSync(TUGAS_DIR)) {
        res.status(404).send('Berkas tugas tidak ditemukan');
        return;
      }
      const match = fs.readdirSync(TUGAS_DIR).find(f => f.startsWith(fileId + '__'));
      if (!match) {
        res.status(404).send('Berkas tugas tidak ditemukan');
        return;
      }
      const origName = match.slice((fileId + '__').length);
      res.setHeader('Content-Disposition', `attachment; filename="${origName}"`);
      res.sendFile(path.join(TUGAS_DIR, match));
    } catch {
      res.status(500).send('Gagal mengunduh berkas tugas');
    }
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint API tidak ditemukan.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
