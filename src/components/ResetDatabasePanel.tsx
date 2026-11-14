import React, { useEffect, useState } from 'react';
import {
  Database,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  LogIn,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { User } from 'firebase/auth';
import { FIREBASE_META, testConnection } from '../firebase';
import { getFirestoreCollectionCounts } from '../db/firestoreSync';

interface ResetDatabasePanelProps {
  db: Record<string, any>;
  firebaseUser: User | null;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onPushFirestore: () => Promise<void>;
  onPullFirestore: () => Promise<void>;
  onResetAll: (opts: {
    resetKelas: boolean;
    resetMapel: boolean;
    resetPengguna: boolean;
    resetPengaturan: boolean;
  }) => Promise<void>;
  onResetPartial: (category: string, label: string) => Promise<void>;
  onResetDemo: () => Promise<void>;
  askConfirm: (msg: string) => Promise<boolean>;
  showToast: (msg: string, ms?: number) => void;
}

const PARTIAL_CATEGORIES = [
  {
    id: 'absensi',
    title: 'Absensi & Kehadiran',
    desc: 'Hapus seluruh riwayat absensi harian dan keterlambatan semua kelas.'
  },
  {
    id: 'nilai_tugas',
    title: 'Tugas, Pengumpulan & Nilai',
    desc: 'Hapus seluruh daftar tugas, pengumpulan siswa, dan rekap nilai.'
  },
  {
    id: 'cbt',
    title: 'Ujian CBT & Hasil AI',
    desc: 'Hapus seluruh paket soal CBT beserta riwayat nilai ujian siswa.'
  },
  {
    id: 'operasional_kelas',
    title: 'Denah, Piket, Struktur & Jadwal',
    desc: 'Kosongkan denah duduk, piket, pengurus kelas, dan jadwal pelajaran.'
  },
  {
    id: 'perangkat_ajar',
    title: 'Perangkat Ajar (TP, Modul, Pemantik)',
    desc: 'Hapus seluruh Tujuan Pembelajaran, Modul Ajar, dan Slide Pemantik.'
  },
  {
    id: 'kalender',
    title: 'Kalender Akademik',
    desc: 'Kosongkan agenda kalender pendidikan (dapat disinkron ulang dengan Jabar).'
  },
  {
    id: 'siswa',
    title: 'Data Siswa & PIN Portal',
    desc: 'Hapus seluruh daftar siswa beserta akun PIN masuk Portal Siswa.'
  }
];

export default function ResetDatabasePanel({
  db,
  firebaseUser,
  onConnectGoogle,
  onDisconnectGoogle,
  onPushFirestore,
  onPullFirestore,
  onResetAll,
  onResetPartial,
  onResetDemo,
  askConfirm,
  showToast
}: ResetDatabasePanelProps) {
  const [connOk, setConnOk] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  // Full wipe safeguards
  const [confirmText, setConfirmText] = useState('');
  const [resetKelas, setResetKelas] = useState(false);
  const [resetMapel, setResetMapel] = useState(false);
  const [resetPengguna, setResetPengguna] = useState(false);
  const [resetPengaturan, setResetPengaturan] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await testConnection();
      setConnOk(res.ok);
    })();
  }, []);

  useEffect(() => {
    if (!firebaseUser?.emailVerified) {
      setCounts({});
      return;
    }
    getFirestoreCollectionCounts(firebaseUser.uid)
      .then(setCounts)
      .catch(() => setCounts({}));
  }, [firebaseUser, db]);

  const localStats = [
    ['Kelas', (db.Kelas || []).length],
    ['Siswa', (db.Siswa || []).length],
    ['Absensi', (db.Absensi || []).length],
    ['Tugas', (db.Tugas || []).length],
    ['Nilai', (db.Nilai || []).length],
    ['Jadwal', (db.Jadwal || []).length],
    ['Kalender', (db.Akademik || []).length],
    ['CBT', (db.CBT || []).length]
  ];

  async function runFullReset() {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Ketik kata RESET terlebih dahulu untuk mengaktifkan tombol reset total.');
      return;
    }
    const ok = await askConfirm(
      'PERINGATAN: Semua data yang dipilih akan dihapus permanen (termasuk di database Firestore jika terhubung). Lanjutkan?'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await onResetAll({
        resetKelas,
        resetMapel,
        resetPengguna,
        resetPengaturan
      });
      setConfirmText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reset Data & Database Cloud</h1>
          <p className="text-xs text-rose-100 mt-1">
            Kelola koneksi database Firebase Firestore, bersihkan seluruh data aplikasi untuk tahun ajaran baru, atau reset per kategori.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (
              await askConfirm(
                'Kembalikan seluruh data ke paket pratinjau awal (SMA Negeri 1 Nusantara)?'
              )
            ) {
              setBusy(true);
              try {
                await onResetDemo();
              } finally {
                setBusy(false);
              }
            }
          }}
          className="px-4 py-2 text-xs font-bold bg-white text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Kembalikan Data Demo Awal
        </button>
      </div>

      {/* Firebase Firestore Status & Sync */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Database Cloud Firebase Firestore
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                    connOk
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {connOk === null ? 'Memeriksa koneksi…' : connOk ? 'Server Firestore Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Project: {FIREBASE_META.projectId} · DB: {FIREBASE_META.databaseId}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {firebaseUser ? (
              <>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {firebaseUser.email}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onPushFirestore();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Simpan ke Firestore
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onPullFirestore();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5" /> Muat dari Firestore
                </button>
                <button
                  type="button"
                  onClick={onDisconnectGoogle}
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Putuskan
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogle}
                className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <LogIn className="w-4 h-4" /> Hubungkan Akun Google ke Firestore
              </button>
            )}
          </div>
        </div>

        {/* Record Counts Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {localStats.map(([label, val]) => (
            <div
              key={String(label)}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center"
            >
              <div className="text-[11px] font-semibold text-slate-500">{label}</div>
              <div className="text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">{val}</div>
            </div>
          ))}
        </div>

        {firebaseUser && Object.keys(counts).length > 0 && (
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex flex-wrap items-center gap-3">
            <span className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dokumen Tersimpan di Firestore:
            </span>
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 rounded bg-white border border-indigo-100 font-mono text-[11px]">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Full Reset Card */}
      <div className="bg-white border-2 border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-950">
              Reset Semua Data ke Kosong (Bersih / Siap Pakai)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Menghapus seluruh data siswa, absensi, tugas, pengumpulan, nilai, jurnal perilaku, denah duduk, jadwal piket, struktur kelas, jadwal pelajaran, perangkat ajar, berkas cloud, soal CBT, hasil CBT, dan kalender akademik. Akun login Admin tetap dipertahankan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetKelas}
              onChange={e => setResetKelas(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Daftar Kelas
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetMapel}
              onChange={e => setResetMapel(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Mata Pelajaran
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetPengguna}
              onChange={e => setResetPengguna(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Hapus juga Akun Guru/Wali
          </label>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetPengaturan}
              onChange={e => setResetPengaturan(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600"
            />
            Reset Pengaturan Sekolah
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder='Ketik "RESET" untuk konfirmasi'
            className="px-3.5 py-2 border border-rose-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 w-64"
          />
          <button
            type="button"
            disabled={busy || confirmText.trim().toUpperCase() !== 'RESET'}
            onClick={runFullReset}
            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            {busy ? 'Mereset Data…' : 'Reset Semua Data Sekarang'}
          </button>
        </div>
      </div>

      {/* Partial Reset Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reset Parsial per Kategori Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hapus hanya modul tertentu tanpa memengaruhi data lainnya.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PARTIAL_CATEGORIES.map(cat => (
            <div
              key={cat.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">{cat.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{cat.desc}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await askConfirm(`Kosongkan seluruh data "${cat.title}"?`)) {
                    setBusy(true);
                    try {
                      await onResetPartial(cat.id, cat.title);
                    } finally {
                      setBusy(false);
                    }
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Kosongkan Kategori
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
