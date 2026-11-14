import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Save,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  Play,
  Pause,
  Archive,
  X,
  Bot,
  Award,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { uid, ymd, fmt, fetchJson } from '../api';

export interface SoalPG {
  id: string;
  pertanyaan: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string;
  kunci: 'A' | 'B' | 'C' | 'D' | 'E' | string;
  pembahasan: string;
  kutipanMateri?: string;
}

export interface SoalUraian {
  id: string;
  pertanyaan: string;
  kunciRubrik: string;
  poinMaksimal: number;
  kutipanMateri?: string;
}

interface CbtManagerProps {
  token: string;
  kelasId: string;
  kelasNama: string;
  mapelList: { ID: string; Nama: string }[];
  siswaList: { ID: string; Nama: string; NIS: string; Kelas: string }[];
  cbtList: any[];
  hasilList: any[];
  onSaveCBT: (nextCbtList: any[]) => Promise<boolean>;
  onSaveHasil: (nextHasilList: any[]) => Promise<boolean>;
  showToast: (msg: string, ms?: number) => void;
  askConfirm: (msg: string) => Promise<boolean>;
}

function parseSoalJSON(raw: string): { soalPG: SoalPG[]; soalUraian: SoalUraian[] } {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      soalPG: Array.isArray(parsed.soalPG) ? parsed.soalPG : [],
      soalUraian: Array.isArray(parsed.soalUraian) ? parsed.soalUraian : []
    };
  } catch {
    return { soalPG: [], soalUraian: [] };
  }
}

export default function CbtManager({
  token,
  kelasId,
  kelasNama,
  mapelList,
  siswaList,
  cbtList,
  hasilList,
  onSaveCBT,
  onSaveHasil,
  showToast,
  askConfirm
}: CbtManagerProps) {
  const [subTab, setSubTab] = useState<'daftar' | 'editor' | 'hasil'>('daftar');

  // Editor state
  const [editId, setEditId] = useState('');
  const [judul, setJudul] = useState('');
  const [mapel, setMapel] = useState(mapelList[0]?.Nama || 'Matematika');
  const [durasi, setDurasi] = useState(45);
  const [status, setStatus] = useState<'Draft' | 'Aktif' | 'Selesai'>('Aktif');
  const [acak, setAcak] = useState('0');

  // AI Generator state
  const [jumlahPG, setJumlahPG] = useState<number>(10);
  const [jumlahUraian, setJumlahUraian] = useState<number>(2);
  const [tingkat, setTingkat] = useState('Campuran (C1–C5)');
  const [uraianMateri, setUraianMateri] = useState('');
  const [materialFile, setMaterialFile] = useState<{
    namaFile: string;
    tipeMime: string;
    base64Data: string;
    ukuran: number;
  } | null>(null);
  const [ringkasanAI, setRingkasanAI] = useState('');
  const [generating, setGenerating] = useState(false);

  // Questions state
  const [soalPG, setSoalPG] = useState<SoalPG[]>([]);
  const [soalUraian, setSoalUraian] = useState<SoalUraian[]>([]);
  const [savingCBT, setSavingCBT] = useState(false);

  // Results & grading state
  const [filterCbtId, setFilterCbtId] = useState('');
  const [inspectHasil, setInspectHasil] = useState<any | null>(null);
  const [gradingAiId, setGradingAiId] = useState('');
  const [manualSkorUraian, setManualSkorUraian] = useState('');
  const [manualSkorAkhir, setManualSkorAkhir] = useState('');
  const [manualCatatan, setManualCatatan] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  const cbtKelas = useMemo(
    () => (cbtList || []).filter(c => c.Kelas === kelasId),
    [cbtList, kelasId]
  );

  const hasilKelas = useMemo(() => {
    const base = (hasilList || []).filter(h => h.Kelas === kelasId);
    return filterCbtId ? base.filter(h => h.CBTID === filterCbtId) : base;
  }, [hasilList, kelasId, filterCbtId]);

  const siswaMap = useMemo(() => {
    const m: Record<string, { Nama: string; NIS: string }> = {};
    (siswaList || []).forEach(s => {
      m[s.ID] = { Nama: s.Nama, NIS: s.NIS };
    });
    return m;
  }, [siswaList]);

  function mulaiBaru() {
    setEditId('');
    setJudul('');
    setMapel(mapelList[0]?.Nama || 'Matematika');
    setDurasi(45);
    setStatus('Aktif');
    setAcak('0');
    setJumlahPG(10);
    setJumlahUraian(2);
    setUraianMateri('');
    setMaterialFile(null);
    setRingkasanAI('');
    setSoalPG([]);
    setSoalUraian([]);
    setSubTab('editor');
  }

  function editPaket(c: any) {
    const parsed = parseSoalJSON(c.SoalJSON);
    setEditId(c.ID);
    setJudul(c.Judul || '');
    setMapel(c.Mapel || mapelList[0]?.Nama || 'Umum');
    setDurasi(Number(c.Durasi) || 30);
    setStatus((c.Status as any) || 'Draft');
    setAcak(c.Acak || '0');
    setUraianMateri(c.SumberMateri || '');
    setMaterialFile(null);
    setRingkasanAI('');
    setSoalPG(parsed.soalPG);
    setSoalUraian(parsed.soalUraian);
    setJumlahPG(Math.min(50, Math.max(0, parsed.soalPG.length)));
    setJumlahUraian(Math.min(5, Math.max(0, parsed.soalUraian.length)));
    setSubTab('editor');
  }

  async function toggleStatusPaket(c: any, nextStatus: 'Draft' | 'Aktif' | 'Selesai') {
    const nextList = (cbtList || []).map(x =>
      x.ID === c.ID ? { ...x, Status: nextStatus } : x
    );
    await onSaveCBT(nextList);
  }

  async function hapusPaket(c: any) {
    const ok = await askConfirm(`Hapus paket CBT "${c.Judul}" beserta seluruh soalnya?`);
    if (!ok) return;
    const nextList = (cbtList || []).filter(x => x.ID !== c.ID);
    await onSaveCBT(nextList);
  }

  function handleUploadMaterial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas materi maksimal 15 MB', 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const base64Data = res.includes(',') ? res.split(',')[1] : res;
      setMaterialFile({
        namaFile: file.name,
        tipeMime: file.type || 'application/octet-stream',
        base64Data,
        ukuran: file.size
      });
      showToast(`Materi "${file.name}" siap diproses AI`);
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerateAI() {
    const nPG = Math.max(0, Math.min(50, Math.floor(Number(jumlahPG) || 0)));
    const nUr = Math.max(0, Math.min(5, Math.floor(Number(jumlahUraian) || 0)));
    setJumlahPG(nPG);
    setJumlahUraian(nUr);

    if (nPG === 0 && nUr === 0) {
      showToast('Isi minimal 1 soal PG (0–50) atau 1 soal Uraian (0–5)', 3500);
      return;
    }
    if (!uraianMateri.trim() && !materialFile) {
      showToast('Masukkan uraian materi atau unggah file materi sumber terlebih dahulu', 3500);
      return;
    }

    setGenerating(true);
    try {
      const json = await fetchJson('/api/cbt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          uraianMateri: uraianMateri.trim(),
          namaFile: materialFile?.namaFile || '',
          tipeMime: materialFile?.tipeMime || '',
          base64Data: materialFile?.base64Data || '',
          jumlahPG: nPG,
          jumlahUraian: nUr,
          tingkat,
          judul: judul.trim() || 'Evaluasi CBT',
          mapel: mapel.trim() || 'Umum'
        })
      });
      if (!json.ok) {
        showToast('Gagal generate AI: ' + (json.error || 'Terjadi kesalahan'), 4500);
        return;
      }
      const data = json.data || {};
      setRingkasanAI(data.ringkasanMateri || '');
      setSoalPG(data.soalPG || []);
      setSoalUraian(data.soalUraian || []);
      if (!judul.trim()) {
        setJudul(`CBT ${mapel || 'Materi'} (${ymd(new Date())})`);
      }
      showToast(
        `Berhasil membuat ${(data.soalPG || []).length} PG & ${(data.soalUraian || []).length} Uraian dari materi!`
      );
    } catch (err: any) {
      showToast('Gagal menghubungi AI: ' + (err?.message || err), 4500);
    } finally {
      setGenerating(false);
    }
  }

  function tambahPGManual() {
    if (soalPG.length >= 50) {
      showToast('Maksimal 50 soal Pilihan Ganda per paket CBT', 3000);
      return;
    }
    setSoalPG(prev => [
      ...prev,
      {
        id: 'pg_' + uid(),
        pertanyaan: '',
        opsiA: '',
        opsiB: '',
        opsiC: '',
        opsiD: '',
        opsiE: '',
        kunci: 'A',
        pembahasan: '',
        kutipanMateri: ''
      }
    ]);
  }

  function tambahUraianManual() {
    if (soalUraian.length >= 5) {
      showToast('Maksimal 5 soal Uraian per paket CBT', 3000);
      return;
    }
    const countNext = soalUraian.length + 1;
    setSoalUraian(prev => [
      ...prev,
      {
        id: 'ur_' + uid(),
        pertanyaan: '',
        kunciRubrik: '',
        poinMaksimal: Math.round(100 / countNext),
        kutipanMateri: ''
      }
    ]);
  }

  async function handleSimpanPaketCBT() {
    if (!judul.trim()) {
      showToast('Judul paket CBT wajib diisi');
      return;
    }
    if (soalPG.length === 0 && soalUraian.length === 0) {
      showToast('Tambahkan atau generate minimal 1 soal PG atau 1 soal Uraian');
      return;
    }
    if (soalPG.length > 50) {
      showToast('Jumlah soal PG maksimal 50 soal');
      return;
    }
    if (soalUraian.length > 5) {
      showToast('Jumlah soal Uraian maksimal 5 soal');
      return;
    }
    if (soalPG.some(q => !q.pertanyaan.trim())) {
      showToast('Ada soal Pilihan Ganda yang pertanyaannya masih kosong');
      return;
    }
    if (soalUraian.some(q => !q.pertanyaan.trim())) {
      showToast('Ada soal Uraian yang pertanyaannya masih kosong');
      return;
    }

    setSavingCBT(true);
    try {
      const rec = {
        ID: editId || 'cbt_' + uid(),
        Kelas: kelasId,
        Judul: judul.trim(),
        Mapel: mapel.trim() || 'Umum',
        Durasi: String(Math.max(5, Math.min(240, Number(durasi) || 30))),
        Status: status,
        Acak: acak,
        SumberMateri: uraianMateri.trim() || ringkasanAI || '',
        NamaFileMateri: materialFile?.namaFile || '',
        TanggalBuat: ymd(new Date()),
        SoalJSON: JSON.stringify({ soalPG, soalUraian })
      };

      const exists = (cbtList || []).some(c => c.ID === rec.ID);
      const nextList = exists
        ? (cbtList || []).map(c => (c.ID === rec.ID ? rec : c))
        : [...(cbtList || []), rec];

      const ok = await onSaveCBT(nextList);
      if (ok) {
        setEditId(rec.ID);
        setSubTab('daftar');
      }
    } finally {
      setSavingCBT(false);
    }
  }

  function openInspectHasil(h: any) {
    let fb: any = {};
    try { fb = JSON.parse(h.FeedbackAI || '{}'); } catch {}
    setInspectHasil(h);
    setManualSkorUraian(h.SkorUraian === '-' ? '' : h.SkorUraian || '');
    setManualSkorAkhir(h.SkorAkhir || '');
    setManualCatatan(fb.catatanGuru || fb.ringkasan || '');
  }

  async function handleAutoGradeUraian(h: any) {
    setGradingAiId(h.ID);
    try {
      const json = await fetchJson('/api/cbt/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, hasilId: h.ID })
      });
      if (!json.ok) {
        showToast('Gagal menilai dengan AI: ' + (json.error || 'Error'), 4500);
        return;
      }
      const updated = json.data;
      const nextHasilList = (hasilList || []).map(x => (x.ID === updated.ID ? updated : x));
      await onSaveHasil(nextHasilList);
      if (inspectHasil?.ID === updated.ID) {
        openInspectHasil(updated);
      }
      showToast('Penilaian uraian otomatis oleh AI selesai!');
    } catch (err: any) {
      showToast('Gagal menghubungi AI: ' + (err?.message || err), 4500);
    } finally {
      setGradingAiId('');
    }
  }

  async function handleSaveManualGrade() {
    if (!inspectHasil) return;
    setSavingGrade(true);
    try {
      const json = await fetchJson('/api/cbt/save-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          hasilId: inspectHasil.ID,
          skorUraian: manualSkorUraian,
          skorAkhir: manualSkorAkhir,
          catatanGuru: manualCatatan
        })
      });
      if (!json.ok) {
        showToast('Gagal menyimpan nilai: ' + (json.error || 'Error'), 4000);
        return;
      }
      const updated = json.data;
      const nextHasilList = (hasilList || []).map(x => (x.ID === updated.ID ? updated : x));
      await onSaveHasil(nextHasilList);
      setInspectHasil(updated);
      showToast('Nilai CBT berhasil difinalisasi');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || err), 4000);
    } finally {
      setSavingGrade(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 p-6 text-white shadow-lg shadow-sky-500/20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-100 text-xs font-semibold uppercase tracking-wider">
            <FileCheck2 className="w-4 h-4" /> Computer-Based Test & Generator AI · Kelas {kelasNama}
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            CBT Pilihan Ganda & Uraian Berbasis Materi
          </h1>
          <p className="text-xs text-sky-100 mt-1 max-w-2xl">
            Susun ujian CBT secara otomatis dari uraian atau unggahan berkas materi saja (maksimal 50 soal PG dan 5 soal Uraian; isi 0 bila jenis soal tidak digunakan).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('daftar')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              subTab === 'daftar'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            Daftar Paket CBT ({cbtKelas.length})
          </button>
          <button
            onClick={mulaiBaru}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'editor'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Buat Soal AI & Paket Baru
          </button>
          <button
            onClick={() => setSubTab('hasil')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              subTab === 'hasil'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            Hasil & Koreksi ({hasilKelas.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: DAFTAR PAKET CBT */}
      {subTab === 'daftar' && (
        <div className="space-y-4">
          {cbtKelas.length === 0 ? (
            <div className="bg-white border border-sky-100 rounded-2xl p-10 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Belum ada paket CBT untuk kelas ini</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Klik tombol di bawah untuk membuat ujian CBT PG (0–50 soal) dan Uraian (0–5 soal) otomatis menggunakan AI hanya dari materi yang Anda berikan.
              </p>
              <button
                onClick={mulaiBaru}
                className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Buat Paket CBT Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cbtKelas.map(c => {
                const { soalPG: pgList, soalUraian: urList } = parseSoalJSON(c.SoalJSON);
                const jmlPeserta = (hasilList || []).filter(h => h.CBTID === c.ID).length;
                const statusColor =
                  c.Status === 'Aktif'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : c.Status === 'Selesai'
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';
                return (
                  <div
                    key={c.ID}
                    className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">
                            {c.Mapel || 'Umum'}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 leading-snug mt-0.5">
                            {c.Judul}
                          </h3>
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border shrink-0 ${statusColor}`}>
                          {c.Status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
                          <div className="text-[10px] font-semibold text-sky-700">Soal PG</div>
                          <div className="text-base font-bold text-slate-900 tabular-nums">
                            {pgList.length} <span className="text-[11px] font-normal text-slate-500">soal</span>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-violet-50/70 border border-violet-100">
                          <div className="text-[10px] font-semibold text-violet-700">Soal Uraian</div>
                          <div className="text-base font-bold text-slate-900 tabular-nums">
                            {urList.length} <span className="text-[11px] font-normal text-slate-500">soal</span>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                          <div className="text-[10px] font-semibold text-emerald-700">Durasi & Peserta</div>
                          <div className="text-xs font-bold text-slate-900 tabular-nums mt-0.5">
                            {c.Durasi} mnt · {jmlPeserta} siswa
                          </div>
                        </div>
                      </div>

                      {c.NamaFileMateri && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          Sumber file: <span className="font-medium text-slate-700 truncate">{c.NamaFileMateri}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {c.Status !== 'Aktif' ? (
                          <button
                            onClick={() => toggleStatusPaket(c, 'Aktif')}
                            className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Aktifkan Ujian
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleStatusPaket(c, 'Draft')}
                            className="px-2.5 py-1.5 text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Pause className="w-3 h-3" /> Tarik ke Draft
                          </button>
                        )}
                        {c.Status === 'Aktif' && (
                          <button
                            onClick={() => toggleStatusPaket(c, 'Selesai')}
                            className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Archive className="w-3 h-3" /> Tutup
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setFilterCbtId(c.ID);
                            setSubTab('hasil');
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Hasil ({jmlPeserta})
                        </button>
                        <button
                          onClick={() => editPaket(c)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Soal
                        </button>
                        <button
                          onClick={() => hapusPaket(c)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Paket CBT"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: EDITOR & GENERATOR SOAL AI */}
      {subTab === 'editor' && (
        <div className="space-y-6">
          {/* Metadata & Config Paket */}
          <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                1. Identitas Paket & Pengaturan Jumlah Soal
              </h2>
              <button
                onClick={handleSimpanPaketCBT}
                disabled={savingCBT}
                className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {savingCBT ? 'Menyimpan…' : 'Simpan Paket CBT'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="md:col-span-2 block text-xs font-semibold text-slate-700">
                Judul Ujian CBT
                <input
                  type="text"
                  value={judul}
                  onChange={e => setJudul(e.target.value)}
                  placeholder="Contoh: UH 1 Eksponen & Logaritma"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-normal"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Mata Pelajaran
                <input
                  type="text"
                  list="cbt-mapel-list"
                  value={mapel}
                  onChange={e => setMapel(e.target.value)}
                  placeholder="Pilih / ketik mapel"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-normal"
                />
                <datalist id="cbt-mapel-list">
                  {mapelList.map(m => (
                    <option key={m.ID} value={m.Nama} />
                  ))}
                </datalist>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Durasi (menit)
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={durasi}
                    onChange={e => setDurasi(Number(e.target.value) || 30)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-normal tabular-nums"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Status
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-normal bg-white"
                  >
                    <option value="Aktif">Aktif (Dibuka)</option>
                    <option value="Draft">Draft (Tersembunyi)</option>
                    <option value="Selesai">Selesai (Ditutup)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Generator AI Strictly From Material */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-cyan-50/70 border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  2. Generator Soal AI (Hanya Bersumber dari Materi Anda)
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  AI hanya menyusun soal berdasarkan <strong>uraian materi</strong> yang Anda tempelkan atau <strong>berkas materi</strong> yang Anda unggah — tanpa menambah materi dari luar.
                </p>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-bold bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200">
                Ketat 100% Sesuai Materi
              </span>
            </div>

            {/* Jumlah PG (0-50) & Uraian (0-5) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white border border-sky-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Jumlah Soal PG (0–50)
                  </label>
                  <span className="text-[11px] font-bold text-sky-700 tabular-nums">
                    {jumlahPG === 0 ? 'Tidak ada PG' : `${jumlahPG} soal`}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={jumlahPG}
                  onChange={e => setJumlahPG(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                  className="w-full px-3 py-2 border border-sky-300 rounded-xl text-sm font-bold tabular-nums text-sky-900"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[0, 5, 10, 20, 30, 50].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setJumlahPG(n)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border cursor-pointer tabular-nums ${
                        jumlahPG === n
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-sky-50'
                      }`}
                    >
                      {n === 0 ? '0 (Kosong)' : n}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  Isi <strong>0</strong> jika ujian ini tanpa soal Pilihan Ganda. Maksimal <strong>50</strong> soal.
                </p>
              </div>

              <div className="p-4 bg-white border border-violet-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Jumlah Soal Uraian (0–5)
                  </label>
                  <span className="text-[11px] font-bold text-violet-700 tabular-nums">
                    {jumlahUraian === 0 ? 'Tidak ada Uraian' : `${jumlahUraian} soal`}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={jumlahUraian}
                  onChange={e => setJumlahUraian(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
                  className="w-full px-3 py-2 border border-violet-300 rounded-xl text-sm font-bold tabular-nums text-violet-900"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setJumlahUraian(n)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border cursor-pointer tabular-nums ${
                        jumlahUraian === n
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-violet-50'
                      }`}
                    >
                      {n === 0 ? '0 (Kosong)' : n}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  Isi <strong>0</strong> jika ujian ini tanpa soal Uraian. Maksimal <strong>5</strong> soal.
                </p>
              </div>

              <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Level Kognitif / Kesulitan
                </label>
                <select
                  value={tingkat}
                  onChange={e => setTingkat(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-xl text-xs bg-white"
                >
                  <option value="Campuran (C1–C5)">Campuran (C1–C5)</option>
                  <option value="Dasar / Pemahaman (C1–C2)">Dasar / Pemahaman (C1–C2)</option>
                  <option value="Aplikasi (C3)">Aplikasi (C3)</option>
                  <option value="HOTS Analisis (C4–C6)">HOTS Analisis (C4–C6)</option>
                </select>
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Catatan:</strong> Setiap soal yang dibuat akan menyertakan kutipan langsung dari materi Anda sebagai bukti sumber.
                </div>
              </div>
            </div>

            {/* Dual Input: Textarea & File Upload */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Masukkan / Tempel Uraian Materi Sumber
                </label>
                <textarea
                  rows={6}
                  value={uraianMateri}
                  onChange={e => setUraianMateri(e.target.value)}
                  placeholder="Tempelkan ringkasan materi, teks bacaan, poin rumus, atau catatan pelajaran di sini. AI hanya akan membuat soal dari teks ini (dan/atau file yang diunggah)."
                  className="w-full p-3.5 border border-indigo-200 bg-white rounded-xl text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Atau Upload Berkas Materi
                </label>
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-indigo-300 bg-white hover:bg-indigo-50/40 rounded-xl cursor-pointer transition-colors text-center">
                  <Upload className="w-6 h-6 text-indigo-600 mb-2" />
                  <span className="text-xs font-semibold text-indigo-900">
                    Pilih File Materi
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    PDF, TXT, MD, CSV, HTML, JSON, atau Gambar Catatan (Maks. 15 MB)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.csv,.html,.json,image/*"
                    onChange={handleUploadMaterial}
                    className="hidden"
                  />
                </label>

                {materialFile && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-900 truncate">{materialFile.namaFile}</div>
                      <div className="text-[11px] text-emerald-700 tabular-nums">
                        {(materialFile.ukuran / 1024).toFixed(1)} KB siap dianalisis
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMaterialFile(null)}
                      className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                      title="Hapus file materi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-600">
                Target generate: <strong className="text-sky-700 tabular-nums">{jumlahPG} PG</strong> +{' '}
                <strong className="text-violet-700 tabular-nums">{jumlahUraian} Uraian</strong>
              </div>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={generating || (jumlahPG === 0 && jumlahUraian === 0)}
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 text-white rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {generating ? 'AI Sedang Menyusun Soal dari Materi…' : 'Buat Soal PG & Uraian dengan AI'}
              </button>
            </div>

            {ringkasanAI && (
              <div className="p-3.5 bg-white border border-indigo-200 rounded-xl text-xs text-slate-700">
                <strong className="text-indigo-800">Ringkasan Materi Terdeteksi AI:</strong> {ringkasanAI}
              </div>
            )}
          </div>

          {/* 3. Editor Daftar Soal PG */}
          <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  3A. Daftar Soal Pilihan Ganda ({soalPG.length} / maks. 50)
                </h2>
                <p className="text-xs text-slate-500">
                  Biarkan kosong (0 soal) jika paket CBT ini hanya berupa soal Uraian.
                </p>
              </div>
              <button
                type="button"
                onClick={tambahPGManual}
                disabled={soalPG.length >= 50}
                className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah PG Manual
              </button>
            </div>

            {soalPG.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                Belum ada soal Pilihan Ganda (0 soal PG).
              </div>
            ) : (
              <div className="space-y-4">
                {soalPG.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-sky-800 tabular-nums">
                        Soal PG #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          Kunci:
                          <select
                            value={q.kunci}
                            onChange={e =>
                              setSoalPG(prev =>
                                prev.map((item, i) => (i === idx ? { ...item, kunci: e.target.value } : item))
                              )
                            }
                            className="px-2 py-1 border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold rounded-lg text-xs"
                          >
                            {['A', 'B', 'C', 'D', 'E'].map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => setSoalPG(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus soal ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={q.pertanyaan}
                      onChange={e =>
                        setSoalPG(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, pertanyaan: e.target.value } : item))
                        )
                      }
                      placeholder="Tulis pertanyaan pilihan ganda..."
                      className="w-full p-2.5 border border-slate-300 bg-white rounded-xl text-xs"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map(opt => {
                        const field = `opsi${opt}` as keyof SoalPG;
                        const isKey = q.kunci === opt;
                        return (
                          <div
                            key={opt}
                            className={`p-2 rounded-xl border text-xs ${
                              isKey ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="font-bold text-[11px] text-slate-500 mb-1">
                              Opsi {opt} {isKey && <span className="text-emerald-700">(Kunci)</span>}
                            </div>
                            <input
                              type="text"
                              value={String(q[field] || '')}
                              onChange={e =>
                                setSoalPG(prev =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, [field]: e.target.value } : item
                                  )
                                )
                              }
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={q.pembahasan}
                        onChange={e =>
                          setSoalPG(prev =>
                            prev.map((item, i) => (i === idx ? { ...item, pembahasan: e.target.value } : item))
                          )
                        }
                        placeholder="Pembahasan singkat jawaban benar..."
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={q.kutipanMateri || ''}
                        onChange={e =>
                          setSoalPG(prev =>
                            prev.map((item, i) => (i === idx ? { ...item, kutipanMateri: e.target.value } : item))
                          )
                        }
                        placeholder="Kutipan bukti dari materi sumber..."
                        className="w-full px-3 py-1.5 border border-indigo-100 bg-indigo-50/40 rounded-lg text-xs text-indigo-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3B. Editor Daftar Soal Uraian */}
          <div className="bg-white border border-violet-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  3B. Daftar Soal Uraian ({soalUraian.length} / maks. 5)
                </h2>
                <p className="text-xs text-slate-500">
                  Biarkan kosong (0 soal) jika paket CBT ini hanya berupa soal Pilihan Ganda.
                </p>
              </div>
              <button
                type="button"
                onClick={tambahUraianManual}
                disabled={soalUraian.length >= 5}
                className="px-3 py-1.5 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Uraian Manual
              </button>
            </div>

            {soalUraian.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                Belum ada soal Uraian (0 soal Uraian).
              </div>
            ) : (
              <div className="space-y-4">
                {soalUraian.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-violet-200 bg-violet-50/30 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-violet-900 tabular-nums">
                        Soal Uraian #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          Poin Maksimal:
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={q.poinMaksimal}
                            onChange={e =>
                              setSoalUraian(prev =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, poinMaksimal: Number(e.target.value) || 20 } : item
                                )
                              )
                            }
                            className="w-16 px-2 py-1 border border-violet-300 bg-white rounded-lg text-xs font-bold tabular-nums"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setSoalUraian(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus soal uraian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={q.pertanyaan}
                      onChange={e =>
                        setSoalUraian(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, pertanyaan: e.target.value } : item))
                        )
                      }
                      placeholder="Tulis pertanyaan uraian..."
                      className="w-full p-2.5 border border-slate-300 bg-white rounded-xl text-xs"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <textarea
                        rows={2}
                        value={q.kunciRubrik}
                        onChange={e =>
                          setSoalUraian(prev =>
                            prev.map((item, i) => (i === idx ? { ...item, kunciRubrik: e.target.value } : item))
                          )
                        }
                        placeholder="Kunci jawaban ideal / rubrik penilaian uraian..."
                        className="w-full p-2.5 border border-emerald-200 bg-white rounded-xl text-xs"
                      />
                      <textarea
                        rows={2}
                        value={q.kutipanMateri || ''}
                        onChange={e =>
                          setSoalUraian(prev =>
                            prev.map((item, i) => (i === idx ? { ...item, kutipanMateri: e.target.value } : item))
                          )
                        }
                        placeholder="Kutipan bukti langsung dari materi sumber..."
                        className="w-full p-2.5 border border-indigo-100 bg-indigo-50/40 rounded-xl text-xs text-indigo-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSubTab('daftar')}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
            >
              Kembali ke Daftar
            </button>
            <button
              type="button"
              onClick={handleSimpanPaketCBT}
              disabled={savingCBT}
              className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {savingCBT ? 'Menyimpan…' : 'Simpan Paket CBT'}
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 3: HASIL & KOREKSI UJIAN */}
      {subTab === 'hasil' && (
        <div className="space-y-4">
          <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Rekap Jawaban & Penilaian CBT</h2>
              <p className="text-xs text-slate-500">
                Skor PG dihitung otomatis saat siswa mengumpulkan ujian. Gunakan asisten AI untuk membantu mengoreksi jawaban Uraian.
              </p>
            </div>
            <select
              value={filterCbtId}
              onChange={e => setFilterCbtId(e.target.value)}
              className="px-3 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl text-xs font-semibold text-indigo-950"
            >
              <option value="">Semua Paket CBT ({cbtKelas.length})</option>
              {cbtKelas.map(c => (
                <option key={c.ID} value={c.ID}>
                  {c.Judul}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {hasilKelas.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Belum ada siswa yang mengumpulkan ujian CBT pada filter yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-950">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">Paket CBT</th>
                      <th className="py-3 px-4">Waktu Selesai</th>
                      <th className="py-3 px-4 text-right">Skor PG</th>
                      <th className="py-3 px-4 text-right">Skor Uraian</th>
                      <th className="py-3 px-4 text-right">Skor Akhir</th>
                      <th className="py-3 px-4">Status Nilai</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hasilKelas.map((h, i) => {
                      const sw = siswaMap[h.SiswaID];
                      const cbtObj = (cbtList || []).find(c => c.ID === h.CBTID);
                      const parsedSoal = parseSoalJSON(cbtObj?.SoalJSON || '{}');
                      const hasUraian = parsedSoal.soalUraian.length > 0;
                      return (
                        <tr key={h.ID} className="hover:bg-sky-50/30">
                          <td className="py-2.5 px-4 tabular-nums text-slate-400">{i + 1}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{sw?.Nama || '(Siswa)'}</div>
                            <div className="text-[11px] font-mono text-slate-500">{sw?.NIS || '-'}</div>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{cbtObj?.Judul || '-'}</td>
                          <td className="py-2.5 px-4 tabular-nums text-slate-600">{h.Selesai}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-sky-700">
                            {h.SkorPG || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-violet-700">
                            {h.SkorUraian || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-emerald-700">
                            {h.SkorAkhir || '-'}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                h.StatusNilai === 'Final' || h.StatusNilai === 'Selesai'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : h.StatusNilai === 'Dinilai AI'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {h.StatusNilai}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasUraian && (
                                <button
                                  onClick={() => handleAutoGradeUraian(h)}
                                  disabled={gradingAiId === h.ID}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg inline-flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                                >
                                  <Bot className="w-3 h-3" />
                                  {gradingAiId === h.ID ? 'Menilai…' : 'Nilai AI'}
                                </button>
                              )}
                              <button
                                onClick={() => openInspectHasil(h)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> Koreksi & Detail
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL KOREKSI & DETAIL HASIL CBT */}
      {inspectHasil && (() => {
        const cbtObj = (cbtList || []).find(c => c.ID === inspectHasil.CBTID);
        const { soalPG: pgArr, soalUraian: urArr } = parseSoalJSON(cbtObj?.SoalJSON || '{}');
        let jwb: any = { pg: {}, uraian: {} };
        let fb: any = {};
        try { jwb = JSON.parse(inspectHasil.JawabanJSON || '{}'); } catch {}
        try { fb = JSON.parse(inspectHasil.FeedbackAI || '{}'); } catch {}
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
                    Koreksi Jawaban: {siswaMap[inspectHasil.SiswaID]?.Nama || 'Siswa'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {cbtObj?.Judul} · Dikumpulkan {inspectHasil.Selesai}
                  </p>
                </div>
                <button
                  onClick={() => setInspectHasil(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Score Summary & AI Button */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="text-[11px] font-semibold text-sky-700">Skor PG (Otomatis)</div>
                  <div className="text-xl font-bold text-sky-950 tabular-nums">{inspectHasil.SkorPG || '-'}</div>
                </div>
                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
                  <div className="text-[11px] font-semibold text-violet-700">Skor Uraian</div>
                  <div className="text-xl font-bold text-violet-950 tabular-nums">{inspectHasil.SkorUraian || '-'}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-700">Skor Akhir</div>
                  <div className="text-xl font-bold text-emerald-950 tabular-nums">{inspectHasil.SkorAkhir || '-'}</div>
                </div>
                <div className="flex items-center">
                  {urArr.length > 0 && (
                    <button
                      onClick={() => handleAutoGradeUraian(inspectHasil)}
                      disabled={gradingAiId === inspectHasil.ID}
                      className="w-full py-2.5 px-3 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                    >
                      <Bot className="w-4 h-4" />
                      {gradingAiId === inspectHasil.ID ? 'Menilai AI…' : 'Nilai Uraian via AI'}
                    </button>
                  )}
                </div>
              </div>

              {/* Jawaban Uraian */}
              {urArr.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-violet-800">
                    Jawaban Soal Uraian ({urArr.length} soal)
                  </h4>
                  {urArr.map((q, idx) => {
                    const ans = (jwb.uraian || {})[q.id] || '';
                    const dAI = detailMap[q.id];
                    return (
                      <div key={q.id} className="p-4 rounded-xl border border-violet-200 bg-violet-50/25 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">Uraian #{idx + 1}: {q.pertanyaan}</span>
                          <span className="text-[11px] font-semibold text-violet-700 tabular-nums shrink-0">
                            Bobot maks: {q.poinMaksimal}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">Jawaban Siswa:</div>
                          <div className="text-slate-800 whitespace-pre-wrap mt-0.5">{ans || '(Tidak dijawab)'}</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">Rubrik / Kunci Ideal:</div>
                          <div className="mt-0.5">{q.kunciRubrik}</div>
                        </div>
                        {dAI && (
                          <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950">
                            <div className="font-bold">
                              Evaluasi AI: {dAI.skor} / {dAI.maksimal} poin
                            </div>
                            <div className="text-indigo-800 mt-0.5">{dAI.komentar}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Jawaban PG */}
              {pgArr.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    Ringkasan Pilihan Ganda ({pgArr.length} soal)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {pgArr.map((q, idx) => {
                      const ans = String((jwb.pg || {})[q.id] || '-').toUpperCase();
                      const benar = ans === String(q.kunci).toUpperCase();
                      return (
                        <div
                          key={q.id}
                          className={`p-2.5 rounded-xl border text-xs ${
                            benar ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="tabular-nums">PG #{idx + 1}</span>
                            <span className={benar ? 'text-emerald-700' : 'text-rose-700'}>
                              Jawab: {ans} · Kunci: {q.kunci} {benar ? '✓' : '✗'}
                            </span>
                          </div>
                          <div className="text-slate-700 line-clamp-2 mt-1">{q.pertanyaan}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Finalize Grade Form */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-900">Finalisasi & Catatan Guru</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {urArr.length > 0 && (
                    <label className="block text-xs font-semibold text-slate-700">
                      Skor Uraian (0–100)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={manualSkorUraian}
                        onChange={e => {
                          const v = e.target.value;
                          setManualSkorUraian(v);
                          if (pgArr.length > 0) {
                            const pgNum = Number(inspectHasil.SkorPG) || 0;
                            const urNum = Number(v) || 0;
                            setManualSkorAkhir(String(Math.round((pgNum * 0.6 + urNum * 0.4) * 10) / 10));
                          } else {
                            setManualSkorAkhir(v);
                          }
                        }}
                        className="mt-1 w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs tabular-nums"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-slate-700">
                    Skor Akhir (0–100)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={manualSkorAkhir}
                      onChange={e => setManualSkorAkhir(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-bold tabular-nums"
                    />
                  </label>
                  <label className="sm:col-span-2 block text-xs font-semibold text-slate-700">
                    Catatan / Umpan Balik Guru untuk Siswa
                    <input
                      type="text"
                      value={manualCatatan}
                      onChange={e => setManualCatatan(e.target.value)}
                      placeholder="Berikan apresiasi atau saran perbaikan..."
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-normal"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setInspectHasil(null)}
                    className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-xl cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handleSaveManualGrade}
                    disabled={savingGrade}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {savingGrade ? 'Menyimpan…' : 'Simpan Nilai Final'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
