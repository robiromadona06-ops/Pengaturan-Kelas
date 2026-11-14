import React, { useState } from 'react';
import { KODE, HARI, LVL_STR, JENIS_AK } from '../constants';
import { num, fmt, ymd, tglIndo, pad, waLink, fetchJson } from '../api';
import {
  LogOut,
  RefreshCw,
  CheckCircle2,
  Calendar,
  BookOpen,
  UserCheck,
  Award,
  KeyRound,
  Lock,
  MessageCircle,
  FileCheck2,
  Clock,
  Play,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  EyeOff,
  X,
  Upload,
  Download,
  Paperclip
} from 'lucide-react';

interface StudentPortalProps {
  token: string;
  portal: any;
  apiCall: (fn: string, ...args: any[]) => Promise<any>;
  onRefresh: () => void;
  onLogout: () => void;
  showToast: (msg: string, ms?: number) => void;
}

export default function StudentPortal({
  token,
  portal: p,
  apiCall,
  onRefresh,
  onLogout,
  showToast
}: StudentPortalProps) {
  const [pinLama, setPinLama] = useState('');
  const [pinBaru, setPinBaru] = useState('');
  const [showPinLama, setShowPinLama] = useState(false);
  const [showPinBaru, setShowPinBaru] = useState(false);

  // CBT Exam Runner & Result State
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [examItems, setExamItems] = useState<{ kind: 'pg' | 'uraian'; idxLabel: string; q: any }[]>([]);
  const [examIdx, setExamIdx] = useState(0);
  const [jawabanPG, setJawabanPG] = useState<Record<string, string>>({});
  const [jawabanUraian, setJawabanUraian] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [examMulai, setExamMulai] = useState('');
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [resultModal, setResultModal] = useState<any | null>(null);

  // Task File Upload State
  const [uploadTugasModal, setUploadTugasModal] = useState<any | null>(null);
  const [tugasFile, setTugasFile] = useState<{ namaFile: string; base64Data: string; size: number } | null>(null);
  const [tugasCatatan, setTugasCatatan] = useState('');
  const [uploadingTugas, setUploadingTugas] = useState(false);

  // Secretary Attendance State
  const [sekTanggal, setSekTanggal] = useState(ymd(new Date()));
  const [sekData, setSekData] = useState<{
    tanggal: string;
    siswa: { ID: string; Nama: string }[];
    terkunci: boolean;
    draft: Record<string, string>;
    note: Record<string, string>;
  } | null>(null);
  const [sekErr, setSekErr] = useState('');
  const [sekLoading, setSekLoading] = useState(false);

  React.useEffect(() => {
    if (p?.sekretaris) {
      loadSekretaris(sekTanggal);
    }
  }, [p?.sekretaris]);

  React.useEffect(() => {
    if (!activeExam || timeLeftSec <= 0) return;
    const timer = setInterval(() => {
      setTimeLeftSec(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeExam, timeLeftSec > 0]);

  React.useEffect(() => {
    if (activeExam && timeLeftSec === 0 && !submittingExam) {
      submitExamNow(true);
    }
  }, [timeLeftSec, activeExam]);

  function startExam(cbt: any) {
    const pgList = (cbt.soalPG || []).map((q: any, i: number) => ({
      kind: 'pg' as const,
      idxLabel: String(i + 1),
      q
    }));
    const urList = (cbt.soalUraian || []).map((q: any, i: number) => ({
      kind: 'uraian' as const,
      idxLabel: `U${i + 1}`,
      q
    }));
    const combined = [...pgList, ...urList];
    if (!combined.length) {
      showToast('Paket CBT belum memiliki soal');
      return;
    }
    const now = new Date();
    const mulaiStr = `${ymd(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setActiveExam(cbt);
    setExamItems(combined);
    setExamIdx(0);
    setJawabanPG({});
    setJawabanUraian({});
    setFlaggedIds({});
    setExamMulai(mulaiStr);
    setConfirmSubmit(false);
    setTimeLeftSec((Number(cbt.Durasi) || 30) * 60);
  }

  async function submitExamNow(autoTimeout = false) {
    if (!activeExam || submittingExam) return;
    setSubmittingExam(true);
    try {
      const json = await fetchJson('/api/cbt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cbtId: activeExam.ID,
          jawabanPG,
          jawabanUraian,
          mulai: examMulai
        })
      });
      if (!json.ok) {
        showToast('Gagal mengumpulkan CBT: ' + (json.error || 'Error'), 4000);
        setSubmittingExam(false);
        return;
      }
      setActiveExam(null);
      setConfirmSubmit(false);
      showToast(
        autoTimeout
          ? 'Waktu habis! Jawaban CBT otomatis dikumpulkan.'
          : 'Jawaban CBT berhasil dikumpulkan!',
        4000
      );
      onRefresh();
    } catch (err: any) {
      showToast('Gagal mengirim jawaban: ' + (err?.message || err), 4000);
    } finally {
      setSubmittingExam(false);
    }
  }

  function openUploadTugas(t: any) {
    setUploadTugasModal(t);
    setTugasFile(null);
    setTugasCatatan(t.CatatanSiswa || '');
  }

  function handleSelectTugasFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas tugas maksimal 15 MB', 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const base64Data = res.includes(',') ? res.split(',')[1] : res;
      setTugasFile({ namaFile: f.name, base64Data, size: f.size });
    };
    reader.readAsDataURL(f);
  }

  async function handleSubmitTugasFile() {
    if (!uploadTugasModal) return;
    if (!tugasFile) {
      showToast('Pilih berkas tugas yang akan diunggah terlebih dahulu');
      return;
    }
    setUploadingTugas(true);
    try {
      const json = await fetchJson('/api/tugas/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tugasId: uploadTugasModal.ID,
          namaFile: tugasFile.namaFile,
          base64Data: tugasFile.base64Data,
          catatan: tugasCatatan
        })
      });
      if (!json.ok) {
        showToast('Gagal mengunggah tugas: ' + (json.error || 'Error'), 4000);
        return;
      }
      showToast('Berkas tugas berhasil dikumpulkan!');
      setUploadTugasModal(null);
      onRefresh();
    } catch (err: any) {
      showToast('Gagal mengunggah: ' + (err?.message || err), 4000);
    } finally {
      setUploadingTugas(false);
    }
  }

  async function loadSekretaris(tgl: string) {
    setSekLoading(true);
    setSekErr('');
    try {
      const r = await apiCall('api_absensiKelas', tgl);
      const draft: Record<string, string> = {};
      const note: Record<string, string> = {};
      (r.catatan || []).forEach((c: any) => {
        draft[c.SiswaID] = c.Kode;
        note[c.SiswaID] = c.Keterangan || '';
      });
      setSekTanggal(r.tanggal);
      setSekData({
        tanggal: r.tanggal,
        siswa: r.siswa || [],
        terkunci: !!r.terkunci,
        draft,
        note
      });
    } catch (e: any) {
      setSekErr(e.message || String(e));
    } finally {
      setSekLoading(false);
    }
  }

  async function simpanSekretaris() {
    if (!sekData) return;
    const recs = sekData.siswa
      .filter(s => sekData.draft[s.ID])
      .map(s => ({
        SiswaID: s.ID,
        Kode: sekData.draft[s.ID],
        Keterangan: sekData.note[s.ID] || ''
      }));
    if (!recs.length) return showToast('Isi status minimal satu siswa');
    try {
      showToast('Menyimpan absensi kelas…', 5000);
      await apiCall('api_simpanAbsensiSekretaris', sekData.tanggal, recs);
      showToast('Absensi kelas berhasil disimpan');
      await loadSekretaris(sekData.tanggal);
      onRefresh();
    } catch (e: any) {
      showToast('Gagal: ' + (e.message || e), 4500);
    }
  }

  async function handleGantiPin() {
    if (!/^\d{4,8}$/.test(pinBaru.trim())) {
      return showToast('PIN baru harus 4–8 angka');
    }
    try {
      await apiCall('api_gantiPIN', pinLama, pinBaru.trim());
      setPinLama('');
      setPinBaru('');
      showToast('PIN berhasil diganti');
    } catch (e: any) {
      showToast('Gagal: ' + (e.message || e), 4000);
    }
  }

  const c: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, T: 0, D: 0 };
  (p.absensi || []).forEach((a: any) => {
    if (c[a.Kode] != null) c[a.Kode]++;
  });
  const hadir = c.H + c.T + c.D;
  const pct = p.totalPertemuan ? (hadir / p.totalPertemuan) * 100 : null;
  const tepat = (p.tugas || []).filter((t: any) => t.Status === 'Tepat Waktu').length;

  const w = ['b_sikap', 'b_tugas', 'b_proyek', 'b_uts', 'b_uas'].map(
    k => num(p.pengaturan?.[k]) || 0
  );
  const kkmVal = num(p.pengaturan?.kkm) || 70;

  const hitungAkhir = (r: any) => {
    if (!r) return null;
    let tot = 0;
    let ada = false;
    ['Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'].forEach((k, i) => {
      const v = num(r[k]);
      if (v != null) {
        ada = true;
        tot += (v * w[i]) / 100;
      }
    });
    return ada ? tot : null;
  };

  const predikat = (n: number | null): [string, string] => {
    if (n == null) return ['-', 'Belum ada predikat'];
    if (n >= 90) return ['A', 'Sangat Baik'];
    if (n >= 80) return ['B', 'Baik'];
    if (n >= kkmVal) return ['C', 'Cukup'];
    return ['D', 'Perlu Bimbingan'];
  };

  const tindakLanjut = (n: number | null) => {
    if (n == null) return '-';
    if (n < kkmVal) return 'Remedial';
    if (n >= 90) return 'Pengayaan';
    return 'Penguatan';
  };

  const nilaiAkhir = hitungAkhir(p.nilai);
  const pr = predikat(nilaiAkhir);
  const komp: [string, string][] = [
    ['Kehadiran & Sikap', 'Sikap'],
    ['Tugas & Harian', 'Tugas'],
    ['Proyek / Praktik', 'Proyek'],
    ['UTS', 'UTS'],
    ['UAS', 'UAS']
  ];

  // Seating chart helper
  const barisDenah = num(p.denah?.Baris) || 4;
  const kolomDenah = num(p.denah?.Kolom) || 4;
  const grupDenah = num(p.denah?.Grup) || 2;
  const kursiMap: Record<string, { Nama: string; Saya: boolean }> = {};
  (p.denah?.kursi || []).forEach((k: any) => {
    kursiMap[`${k.Baris}-${k.Kolom}`] = { Nama: k.Nama, Saya: k.Saya };
  });

  const todayName = HARI[(new Date().getDay() + 6) % 7] || '';
  const hariPiketSaya = (p.piket || []).filter((x: any) => x.Saya).map((x: any) => x.Hari);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="h-1 rainbow-strip sticky top-0 z-40" />
      {/* Top Bar Contract: Brand — Context — Actions */}
      <header className="sticky top-1 z-30 bg-gradient-to-r from-indigo-900 via-violet-900 to-fuchsia-900 text-white border-b border-white/10 px-6 py-3.5 flex items-center justify-between gap-8 shadow-md">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          {p.logo ? (
            <img
              src={p.logo}
              alt={p.sekolah || 'Logo Sekolah'}
              className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold tracking-tight text-base">Portal Siswa · {p.sekolah}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-indigo-100 truncate">
          <span>{p.kelas}</span>
          {p.jurusan && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                {p.jurusanLogo && (
                  <img
                    src={p.jurusanLogo}
                    alt={`Logo ${p.jurusan}`}
                    className="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0"
                  />
                )}
                <span>Jurusan {p.jurusan}</span>
              </span>
            </>
          )}
          <span>·</span>
          <span>Semester {p.semester}</span>
          <span>·</span>
          <span>Wali Kelas: {p.wali || '-'}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {p.waInfo && (
            <a
              href={waLink(
                p.waInfo,
                `Halo Admin/Informasi ${p.sekolah || 'Sekolah'}, saya ${p.siswa?.Nama || ''} (NIS ${p.siswa?.NIS || ''}, Kelas ${p.kelas || ''}) ingin menanyakan informasi.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WA Informasi
            </a>
          )}
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat Ulang
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 text-white rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Colorful Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {p.jurusanLogo && (
                <img
                  src={p.jurusanLogo}
                  alt={`Logo ${p.jurusan}`}
                  className="w-12 h-12 rounded-2xl object-contain bg-white/95 p-1 shadow-sm shrink-0"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">Halo, {p.siswa?.Nama}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-sky-100 mt-1">
                  <span>Kelas {p.kelas}</span>
                  {(p.jurusan || p.mapel) && (
                    <>
                      <span>·</span>
                      <span>{p.jurusan ? `Jurusan ${p.jurusan}` : p.mapel}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="font-mono tabular-nums">NIS {p.siswa?.NIS}</span>
                  {p.sekretaris && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-amber-300">Sekretaris Kelas</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="px-4 py-3.5 bg-white text-slate-900 rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-emerald-700">Kehadiran</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                {pct == null ? '-' : fmt(pct) + '%'}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                {hadir}/{p.totalPertemuan} pertemuan
              </div>
            </div>
            <div className="px-4 py-3.5 bg-white text-slate-900 rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-sky-700">Tugas Tepat Waktu</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                {tepat}/{(p.tugas || []).length}
              </div>
              <div className="text-[11px] text-slate-500">Terverifikasi</div>
            </div>
            <div className="px-4 py-3.5 bg-white text-slate-900 rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-amber-700">Nilai Akhir</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                {fmt(nilaiAkhir)}
              </div>
              <div className="text-[11px] text-slate-500">KKM {kkmVal}</div>
            </div>
            <div className="px-4 py-3.5 bg-white text-slate-900 rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-fuchsia-700">Predikat</div>
              <div className="text-2xl font-bold text-fuchsia-600 tabular-nums mt-0.5">{pr[0]}</div>
              <div className="text-[11px] text-slate-500">{pr[1]}</div>
            </div>
          </div>
        </div>

        {/* CBT Online Section */}
        <section className="bg-white border border-cyan-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-cyan-600" /> Ujian CBT Online (PG & Uraian)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kerjakan ujian berbasis komputer sesuai waktu yang tersedia. Skor Pilihan Ganda langsung muncul setelah selesai.
              </p>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-lg tabular-nums">
              {(p.cbtList || []).length} Paket Ujian
            </span>
          </div>

          {(p.cbtList || []).length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
              Belum ada ujian CBT yang dibuka untuk kelas ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(p.cbtList || []).map((c: any) => {
                const jmlPG = (c.soalPG || []).length;
                const jmlUr = (c.soalUraian || []).length;
                const h = c.hasil;
                return (
                  <div
                    key={c.ID}
                    className="p-4 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/40 via-white to-indigo-50/30 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold text-sky-700 uppercase">{c.Mapel || 'Umum'}</div>
                          <h3 className="text-sm font-bold text-slate-900">{c.Judul}</h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border shrink-0 ${
                            h
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.Status === 'Aktif'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {h ? h.StatusNilai : c.Status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-sky-600" /> {c.Durasi} menit
                        </span>
                        <span>{jmlPG} Soal PG</span>
                        <span>·</span>
                        <span>{jmlUr} Soal Uraian</span>
                      </div>

                      {h && (
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className="p-2 rounded-lg bg-white border border-sky-100 text-center">
                            <div className="text-[10px] text-slate-500">Skor PG</div>
                            <div className="text-sm font-bold text-sky-700 tabular-nums">{h.SkorPG || '-'}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-violet-100 text-center">
                            <div className="text-[10px] text-slate-500">Skor Uraian</div>
                            <div className="text-sm font-bold text-violet-700 tabular-nums">{h.SkorUraian || '-'}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-emerald-100 text-center">
                            <div className="text-[10px] text-slate-500">Skor Akhir</div>
                            <div className="text-sm font-bold text-emerald-700 tabular-nums">{h.SkorAkhir || 'Menunggu'}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {h ? (
                        <button
                          onClick={() => setResultModal(c)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Lihat Hasil & Pembahasan
                        </button>
                      ) : c.Status === 'Aktif' ? (
                        <button
                          onClick={() => startExam(c)}
                          className="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" /> Mulai Ujian CBT
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Ujian telah ditutup</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Secretary Attendance Input (If student is Secretary) */}
        {p.sekretaris && (
          <section className="bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  Input Absensi Kelas (Akses Sekretaris)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Isi kehadiran teman sekelas maksimal 7 hari ke belakang. Data dapat diubah sampai guru mengonfirmasi.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={sekTanggal}
                  max={ymd(new Date())}
                  min={ymd(new Date(Date.now() - 7 * 86400000))}
                  onChange={e => loadSekretaris(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-indigo-200 bg-white rounded-xl tabular-nums"
                />
                {sekData && !sekData.terkunci && (
                  <>
                    <button
                      onClick={() => {
                        const next = { ...sekData.draft };
                        sekData.siswa.forEach(s => (next[s.ID] = 'H'));
                        setSekData({ ...sekData, draft: next });
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl"
                    >
                      Semua Hadir
                    </button>
                    <button
                      onClick={simpanSekretaris}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white rounded-xl shadow-sm"
                    >
                      Simpan Absensi
                    </button>
                  </>
                )}
              </div>
            </div>

            {sekErr && <div className="text-xs text-rose-600">{sekErr}</div>}

            {sekData?.terkunci && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                Absensi tanggal ini sudah diisi atau dikonfirmasi oleh guru sehingga tidak dapat diubah dari akun siswa.
              </div>
            )}

            {sekData && !sekLoading && (
              <div className="overflow-x-auto border border-indigo-100 bg-white rounded-xl max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-900">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Status Kehadiran</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sekData.siswa.map((s, idx) => (
                      <tr key={s.ID} className="hover:bg-indigo-50/30">
                        <td className="py-2 px-3 tabular-nums text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{s.Nama}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            {Object.keys(KODE).map(k => {
                              const active = sekData.draft[s.ID] === k;
                              return (
                                <button
                                  key={k}
                                  disabled={sekData.terkunci}
                                  onClick={() => {
                                    const next = { ...sekData.draft };
                                    next[s.ID] = next[s.ID] === k ? '' : k;
                                    setSekData({ ...sekData, draft: next });
                                  }}
                                  title={KODE[k][0]}
                                  style={active ? { backgroundColor: KODE[k][1], borderColor: KODE[k][1], color: '#fff' } : {}}
                                  className={`w-7 h-7 rounded-lg font-bold text-xs border transition-all ${
                                    active
                                      ? 'shadow-sm'
                                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  {k}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={sekData.terkunci}
                            value={sekData.note[s.ID] || ''}
                            onChange={e => {
                              setSekData({
                                ...sekData,
                                note: { ...sekData.note, [s.ID]: e.target.value }
                              });
                            }}
                            placeholder="Alasan / jam datang..."
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Grades & Attendance Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-600" /> Rincian Nilai Akademik
            </h2>
            {p.nilai ? (
              <>
                <div className="overflow-x-auto border border-sky-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-sky-50/70 border-b border-sky-100 text-sky-900">
                      <tr>
                        <th className="py-2.5 px-3">Komponen</th>
                        <th className="py-2.5 px-3 text-right">Bobot</th>
                        <th className="py-2.5 px-3 text-right">Nilai</th>
                        <th className="py-2.5 px-3 text-right">Kontribusi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {komp.map((k, i) => {
                        const v = num(p.nilai[k[1]]);
                        return (
                          <tr key={k[1]}>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{k[0]}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{w[i]}%</td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                              {v == null ? '-' : fmt(v)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-sky-700 font-semibold">
                              {v == null ? '-' : fmt((v * w[i]) / 100)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gradient-to-r from-indigo-50 to-sky-50 font-bold text-slate-900">
                        <td className="py-2.5 px-3">Nilai Akhir</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">100%</td>
                        <td className="py-2.5 px-3 text-right text-violet-700">Predikat {pr[0]}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-indigo-700">
                          {fmt(nilaiAkhir)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600">
                  Rekomendasi tindak lanjut: <strong className="text-indigo-700">{tindakLanjut(nilaiAkhir)}</strong> (KKM {kkmVal}).
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Nilai belum diinput oleh guru.</p>
            )}
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Rekap Kehadiran
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              {Object.keys(KODE).map(k => (
                <span key={k} className="tabular-nums flex items-center gap-1">
                  <span style={{ backgroundColor: KODE[k][1] }} className="w-4 h-4 rounded text-[10px] font-bold text-white inline-flex items-center justify-center">{k}</span>
                  <span>{KODE[k][0]}:</span> <strong className="text-slate-900">{c[k]}</strong>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto max-h-60 border border-emerald-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-emerald-50/70 border-b border-emerald-100 text-emerald-900 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(p.absensi || [])
                    .slice()
                    .sort((x: any, y: any) => y.Tanggal.localeCompare(x.Tanggal))
                    .map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 tabular-nums text-slate-700">{r.Tanggal}</td>
                        <td className="py-2 px-3 font-semibold" style={{ color: KODE[r.Kode]?.[1] || '#0f172a' }}>
                          {r.Kode} · {(KODE[r.Kode] || [''])[0]}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{r.Keterangan || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Assignments */}
        <div className="bg-white border border-amber-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daftar Tugas & Asesmen</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unduh berkas soal dari guru (jika tersedia) dan unggah hasil pekerjaanmu sebelum tenggat.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto border border-amber-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-amber-50/70 border-b border-amber-100 text-amber-900">
                <tr>
                  <th className="py-2.5 px-3">Judul Tugas & Mapel</th>
                  <th className="py-2.5 px-3">Lampiran Guru</th>
                  <th className="py-2.5 px-3">Tenggat</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Upload Jawaban</th>
                  <th className="py-2.5 px-3 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(p.tugas || []).map((t: any, i: number) => (
                  <tr key={t.ID || i} className="hover:bg-amber-50/30">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900">{t.Judul}</span>
                        {t.Mapel && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                            {t.Mapel}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">({t.Jenis})</span>
                      </div>
                      {t.Deskripsi && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.Deskripsi}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {t.FileID ? (
                        <a
                          href={`/api/tugas/file/${t.FileID}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg whitespace-nowrap"
                        >
                          <Download className="w-3 h-3" /> {t.NamaFile || 'Unduh Soal'}
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-slate-600 whitespace-nowrap">{t.Tenggat || '-'}</td>
                    <td className={`py-2.5 px-3 font-semibold whitespace-nowrap ${t.Status === 'Tepat Waktu' ? 'text-emerald-700' : t.Status === 'Terlambat' ? 'text-amber-700' : 'text-rose-600'}`}>
                      <div>{t.Status}</div>
                      {t.TanggalKumpul && (
                        <div className="text-[10px] font-normal text-slate-400 tabular-nums">{t.TanggalKumpul}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.FileSiswaID && (
                          <a
                            href={`/api/tugas/file/${t.FileSiswaID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg max-w-[150px] truncate"
                            title={t.NamaFileSiswa}
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate">{t.NamaFileSiswa}</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openUploadTugas(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg whitespace-nowrap cursor-pointer shadow-2xs"
                        >
                          <Upload className="w-3 h-3" /> {t.FileSiswaID ? 'Ganti File' : 'Upload Tugas'}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-indigo-700">
                      {t.Nilai || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule & Duty Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-violet-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-600" /> Jadwal Pelajaran
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HARI.filter(h => h !== 'Sabtu' || (p.jadwal || []).some((x: any) => x.Hari === h)).map(h => {
                const ls = (p.jadwal || [])
                  .filter((x: any) => x.Hari === h)
                  .sort((a: any, b: any) => (a.Mulai || '').localeCompare(b.Mulai || ''));
                return (
                  <div
                    key={h}
                    className={`p-3.5 rounded-xl border ${
                      h === todayName ? 'border-violet-500 bg-gradient-to-b from-violet-50 to-white ring-1 ring-violet-300' : 'border-slate-200 bg-slate-50/40'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 mb-2">
                      {h} {h === todayName && <span className="text-violet-600">· Hari ini</span>}
                    </div>
                    <div className="space-y-1.5">
                      {ls.length ? (
                        ls.map((x: any, idx: number) => (
                          <div key={idx} className="text-xs flex items-start gap-2">
                            <span className="font-mono tabular-nums text-[11px] text-indigo-600 font-semibold shrink-0">
                              {x.Mulai}–{x.Selesai}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-800">{x.Mapel}</div>
                              {x.Guru && <div className="text-[11px] text-slate-500">{x.Guru}</div>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400">Belum ada jadwal</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Jadwal Piket Kelas</h2>
            {hariPiketSaya.length > 0 && (
              <p className="text-xs text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl font-medium">
                Hari piket kamu: <strong>{hariPiketSaya.join(', ')}</strong>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HARI.slice(0, 5).map(h => {
                const ls = (p.piket || []).filter((x: any) => x.Hari === h);
                return (
                  <div key={h} className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/30">
                    <div className="font-bold text-xs text-teal-950 mb-2">{h}</div>
                    <div className="space-y-1">
                      {ls.map((pk: any, i: number) => (
                        <div
                          key={i}
                          className={`text-xs ${
                            pk.Saya ? 'font-bold text-rose-600' : 'text-slate-700'
                          }`}
                        >
                          {pk.Nama} {pk.Saya ? '(Kamu)' : ''} ·{' '}
                          <span className="text-slate-500 font-normal">{pk.Tugas || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Seating Map & Class Org Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-cyan-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Denah Tempat Duduk</h2>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white text-center text-xs font-bold tracking-wider py-2.5 rounded-xl mb-4 shadow-sm">
                  PAPAN TULIS · MEJA GURU
                </div>
                <div className="space-y-2">
                  {Array.from({ length: barisDenah }, (_, rIdx) => {
                    const r = rIdx + 1;
                    return (
                      <div key={r} className="flex items-center justify-center gap-2">
                        {Array.from({ length: kolomDenah }, (_, cIdx) => {
                          const col = cIdx + 1;
                          const o = kursiMap[`${r}-${col}`];
                          return (
                            <React.Fragment key={col}>
                              {grupDenah > 0 && col > 1 && (col - 1) % grupDenah === 0 && (
                                <div className="w-4 shrink-0" />
                              )}
                              <div
                                className={`w-28 h-14 p-2 rounded-xl border-2 text-xs flex items-center justify-center text-center leading-tight ${
                                  o?.Saya
                                    ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-400 font-bold text-amber-950 shadow-sm'
                                    : o
                                    ? 'bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200 text-slate-800 font-semibold'
                                    : 'border-dashed border-slate-200 text-slate-300'
                                }`}
                              >
                                {o ? `${o.Nama}${o.Saya ? ' (Kamu)' : ''}` : '-'}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-purple-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Struktur Organisasi Kelas</h2>
            <div className="space-y-4 text-center">
              <div className="inline-block px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                <div className="text-[10px] uppercase tracking-wider text-indigo-200">Wali Kelas</div>
                <div className="text-xs font-bold">{p.wali || '-'}</div>
              </div>
              {[1, 2, 3].map(lvl => {
                const items = (p.struktur || []).filter((s: any) => String(s.Tingkat) === String(lvl));
                if (!items.length) return null;
                return (
                  <div key={lvl} className="flex flex-wrap justify-center gap-2.5">
                    {items.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        style={{ borderColor: LVL_STR[lvl]?.[1] || '#cbd5e1' }}
                        className={`px-4 py-2.5 rounded-xl border-2 text-left min-w-[130px] shadow-xs ${
                          s.Saya ? 'bg-gradient-to-br from-amber-50 to-orange-50' : 'bg-white'
                        }`}
                      >
                        <div className="text-[10px] font-semibold text-slate-500">{s.Jabatan}</div>
                        <div className="text-xs font-bold text-slate-900">
                          {s.Nama || '—'} {s.Saya ? '(Kamu)' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Academic Calendar & Change PIN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-rose-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Kalender Pendidikan Jawa Barat & Sekolah</h2>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold">
                Sinkronisasi Disdik Jabar
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-rose-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-rose-50/70 border-b border-rose-100 text-rose-900 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Kegiatan</th>
                    <th className="py-2 px-3">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(p.akademik || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-3 text-center text-slate-400">
                        Belum ada agenda kalender akademik.
                      </td>
                    </tr>
                  ) : (
                    (p.akademik || []).map((a: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 px-3 whitespace-nowrap tabular-nums text-slate-600">
                          {tglIndo(a.Mulai)}
                          {a.Selesai && a.Selesai !== a.Mulai ? ` – ${tglIndo(a.Selesai)}` : ''}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {a.Kegiatan}
                          {String(a.Sumber || '').includes('Jabar') && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-bold">
                              Jabar
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium" style={{ color: JENIS_AK[a.Jenis] || '#475569' }}>
                          {a.Jenis}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" /> Ganti PIN Akun Siswa
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">
                PIN Lama
                <div className="relative mt-1">
                  <input
                    type={showPinLama ? 'text' : 'password'}
                    inputMode="numeric"
                    value={pinLama}
                    onChange={e => setPinLama(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-indigo-200 rounded-xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPinLama(v => !v);
                    }}
                    title={showPinLama ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    aria-label={showPinLama ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                  >
                    {showPinLama ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                PIN Baru (4–8 angka)
                <div className="relative mt-1">
                  <input
                    type={showPinBaru ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    value={pinBaru}
                    onChange={e => setPinBaru(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-indigo-200 rounded-xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPinBaru(v => !v);
                    }}
                    title={showPinBaru ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    aria-label={showPinBaru ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                  >
                    {showPinBaru ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
            </div>
            <button
              onClick={handleGantiPin}
              className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white rounded-xl shadow-sm"
            >
              Simpan PIN Baru
            </button>
          </div>
        </div>
      </main>

      {/* CBT EXAM RUNNER MODAL */}
      {activeExam && examItems[examIdx] && (() => {
        const cur = examItems[examIdx];
        const q = cur.q;
        const mins = Math.floor(timeLeftSec / 60);
        const secs = timeLeftSec % 60;
        const answeredCount = examItems.filter(it =>
          it.kind === 'pg'
            ? Boolean(jawabanPG[it.q.id])
            : Boolean((jawabanUraian[it.q.id] || '').trim())
        ).length;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-indigo-200">
              {/* Runner Header */}
              <div className="bg-gradient-to-r from-indigo-900 via-sky-900 to-cyan-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-cyan-200 font-semibold">{activeExam.Mapel}</div>
                  <div className="text-sm sm:text-base font-bold">{activeExam.Judul}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-cyan-100 tabular-nums">
                    Terjawab: <strong className="text-white">{answeredCount}/{examItems.length}</strong>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold tabular-nums flex items-center gap-1.5 ${
                      timeLeftSec < 60
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-white/15 text-amber-300'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {pad(mins)}:{pad(secs)}
                  </div>
                </div>
              </div>

              {/* Runner Body */}
              <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Question Content */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        cur.kind === 'pg'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {cur.kind === 'pg'
                        ? `Pilihan Ganda No. ${cur.idxLabel}`
                        : `Soal Uraian ${cur.idxLabel} (Maks. ${q.poinMaksimal || 20} poin)`}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setFlaggedIds(prev => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                        flaggedIds[q.id]
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {flaggedIds[q.id] ? 'Ditandai Ragu-ragu' : 'Tandai Ragu-ragu'}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 leading-relaxed whitespace-pre-wrap font-medium">
                    {q.pertanyaan}
                  </div>

                  {cur.kind === 'pg' ? (
                    <div className="space-y-2.5">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map(opt => {
                        const textOpt = q[`opsi${opt}`];
                        if (!textOpt) return null;
                        const selected = jawabanPG[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setJawabanPG(prev => ({ ...prev, [q.id]: opt }))
                            }
                            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 cursor-pointer ${
                              selected
                                ? 'border-sky-600 bg-sky-50 text-sky-950 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-sky-300 text-slate-800'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                                selected
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {opt}
                            </span>
                            <span className="text-xs sm:text-sm leading-relaxed pt-0.5">{textOpt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Jawaban Uraian Anda:
                      </label>
                      <textarea
                        rows={7}
                        value={jawabanUraian[q.id] || ''}
                        onChange={e =>
                          setJawabanUraian(prev => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Tuliskan penjelasan atau langkah penyelesaian Anda secara lengkap sesuai materi..."
                        className="w-full p-3.5 border-2 border-violet-200 focus:border-violet-500 rounded-xl text-sm leading-relaxed"
                      />
                    </div>
                  )}
                </div>

                {/* Question Navigator Grid */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 h-fit">
                  <div className="text-xs font-bold text-slate-800">Navigasi Nomor Soal</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {examItems.map((it, idx) => {
                      const isCur = idx === examIdx;
                      const isAns =
                        it.kind === 'pg'
                          ? Boolean(jawabanPG[it.q.id])
                          : Boolean((jawabanUraian[it.q.id] || '').trim());
                      const isFlag = Boolean(flaggedIds[it.q.id]);
                      return (
                        <button
                          key={it.q.id}
                          type="button"
                          onClick={() => setExamIdx(idx)}
                          className={`h-9 rounded-lg text-xs font-bold tabular-nums border cursor-pointer transition-all ${
                            isCur
                              ? 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-600 text-white'
                              : isFlag
                              ? 'bg-amber-400 border-amber-500 text-slate-950'
                              : isAns
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {it.idxLabel}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Sudah dijawab
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Ragu-ragu
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block" /> Belum dijawab
                    </div>
                  </div>
                </div>
              </div>

              {/* Runner Footer */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={examIdx === 0}
                    onClick={() => setExamIdx(i => Math.max(0, i - 1))}
                    className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-xl flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={examIdx >= examItems.length - 1}
                    onClick={() => setExamIdx(i => Math.min(examItems.length - 1, i + 1))}
                    className="px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-xl flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {!confirmSubmit ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Kumpulkan Ujian
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl">
                    <span className="text-xs font-semibold text-amber-900">
                      Yakin kumpulkan sekarang ({answeredCount}/{examItems.length} terjawab)?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmSubmit(false)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={submittingExam}
                      onClick={() => submitExamNow(false)}
                      className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg cursor-pointer disabled:opacity-60"
                    >
                      {submittingExam ? 'Mengirim…' : 'Ya, Kumpulkan!'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* HASIL & PEMBAHASAN CBT MODAL */}
      {resultModal && (() => {
        const h = resultModal.hasil || {};
        let jwb: any = { pg: {}, uraian: {} };
        let fb: any = {};
        try { jwb = JSON.parse(h.JawabanJSON || '{}'); } catch {}
        try { fb = JSON.parse(h.FeedbackAI || '{}'); } catch {}
        const detailMap: Record<string, any> = {};
        (fb.detail || []).forEach((d: any) => {
          detailMap[d.id] = d;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Hasil & Pembahasan: {resultModal.Judul}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {resultModal.Mapel} · Dikumpulkan {h.Selesai} · Status: {h.StatusNilai}
                  </p>
                </div>
                <button
                  onClick={() => setResultModal(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-[11px] font-semibold text-sky-700">Skor Pilihan Ganda</div>
                  <div className="text-2xl font-bold text-sky-950 tabular-nums">{h.SkorPG || '-'}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-200 text-center">
                  <div className="text-[11px] font-semibold text-violet-700">Skor Uraian</div>
                  <div className="text-2xl font-bold text-violet-950 tabular-nums">{h.SkorUraian || 'Proses'}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[11px] font-semibold text-emerald-700">Skor Akhir</div>
                  <div className="text-2xl font-bold text-emerald-950 tabular-nums">{h.SkorAkhir || 'Menunggu'}</div>
                </div>
              </div>

              {(fb.catatanGuru || fb.ringkasan) && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                  <div className="font-bold">Catatan & Umpan Balik:</div>
                  <div>{fb.catatanGuru || fb.ringkasan}</div>
                </div>
              )}

              {(resultModal.soalPG || []).length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    Pembahasan Pilihan Ganda
                  </h4>
                  {(resultModal.soalPG || []).map((q: any, idx: number) => {
                    const ans = String((jwb.pg || {})[q.id] || '-').toUpperCase();
                    const benar = ans === String(q.kunci || '').toUpperCase();
                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          benar ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold">
                          <span>PG #{idx + 1}: {q.pertanyaan}</span>
                          <span className={benar ? 'text-emerald-700 shrink-0' : 'text-rose-700 shrink-0'}>
                            Jawab: {ans} · Kunci: {q.kunci}
                          </span>
                        </div>
                        {q.pembahasan && (
                          <div className="text-slate-700">
                            <strong>Pembahasan:</strong> {q.pembahasan}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(resultModal.soalUraian || []).length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-violet-800">
                    Review Jawaban Uraian
                  </h4>
                  {(resultModal.soalUraian || []).map((q: any, idx: number) => {
                    const ans = (jwb.uraian || {})[q.id] || '';
                    const dAI = detailMap[q.id];
                    return (
                      <div key={q.id} className="p-3.5 rounded-xl border border-violet-200 bg-violet-50/20 text-xs space-y-1.5">
                        <div className="font-bold text-slate-900">
                          Uraian #{idx + 1}: {q.pertanyaan}
                        </div>
                        <div className="p-2 bg-white border border-slate-200 rounded-lg">
                          <span className="font-semibold text-slate-500">Jawaban Kamu:</span>{' '}
                          <span className="text-slate-800 whitespace-pre-wrap">{ans || '(Kosong)'}</span>
                        </div>
                        <div className="text-emerald-800">
                          <strong>Rubrik / Kunci:</strong> {q.kunciRubrik}
                        </div>
                        {dAI && (
                          <div className="text-indigo-800">
                            <strong>Skor AI ({dAI.skor}/{dAI.maksimal}):</strong> {dAI.komentar}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setResultModal(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* UPLOAD TUGAS SISWA MODAL */}
      {uploadTugasModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-amber-200 p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Hasil Tugas</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {uploadTugasModal.Judul} {uploadTugasModal.Mapel ? `· ${uploadTugasModal.Mapel}` : ''}
                </p>
              </div>
              <button
                onClick={() => setUploadTugasModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 rounded-xl cursor-pointer text-center">
              <Upload className="w-6 h-6 text-amber-600 mb-1.5" />
              <span className="text-xs font-bold text-amber-950">
                {tugasFile ? tugasFile.namaFile : 'Pilih Berkas Tugas (PDF, DOCX, Gambar, ZIP)'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                {tugasFile ? `${(tugasFile.size / 1024).toFixed(1)} KB siap diunggah` : 'Maksimal ukuran file 15 MB'}
              </span>
              <input
                type="file"
                onChange={handleSelectTugasFile}
                className="hidden"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Catatan untuk Guru (Opsional)
              <textarea
                rows={3}
                value={tugasCatatan}
                onChange={e => setTugasCatatan(e.target.value)}
                placeholder="Mis. Tugas sudah selesai nomor 1-10, mohon koreksinya."
                className="mt-1 w-full p-2.5 border border-slate-300 rounded-xl text-xs font-normal"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUploadTugasModal(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={uploadingTugas || !tugasFile}
                onClick={handleSubmitTugasFile}
                className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {uploadingTugas ? 'Mengunggah…' : 'Kumpulkan Tugas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
