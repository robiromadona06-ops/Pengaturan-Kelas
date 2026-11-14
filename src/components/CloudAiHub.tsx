import React, { useState, useRef } from 'react';
import {
  CloudUpload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileCheck,
  Sparkles,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  TrendingUp,
  ListChecks,
  Key
} from 'lucide-react';
import { fetchJson } from '../api';

export interface CloudFileRecord {
  ID: string;
  Kelas: string;
  NamaFile: string;
  TipeMime: string;
  Ukuran: string;
  TanggalUnggah: string;
  Pengunggah: string;
  StatusCloud: string;
  PathSimpan: string;
  AnalisisJSON: string;
}

export interface AnalisisResult {
  kategoriDokumen: string;
  ringkasanEksekutif: string;
  informasiKunci: string[];
  identifikasiTren: string[];
  rekomendasiTindakLanjut: string[];
}

interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  progress: number;
  stage: 'reading' | 'uploading' | 'analyzing' | 'completed' | 'error';
  message: string;
}

interface CloudAiHubProps {
  token: string;
  kelasId: string;
  kelasNama: string;
  files: CloudFileRecord[];
  onFilesUpdated: (nextFiles: CloudFileRecord[]) => void;
  showToast: (msg: string, ms?: number) => void;
}

function formatBytes(bytes: number | string): string {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CloudAiHub({
  token,
  kelasId,
  kelasNama,
  files,
  onFilesUpdated,
  showToast
}: CloudAiHubProps) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.ID || '');
  const [customPrompt, setCustomPrompt] = useState('');
  const [analyzingId, setAnalyzingId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const classFiles = files.filter(f => !f.Kelas || f.Kelas === kelasId);
  const activeFile =
    classFiles.find(f => f.ID === selectedFileId) || classFiles[0] || null;

  let activeAnalysis: AnalisisResult | null = null;
  if (activeFile?.AnalisisJSON) {
    try {
      activeAnalysis = JSON.parse(activeFile.AnalisisJSON);
    } catch (_) {
      activeAnalysis = null;
    }
  }

  const updateQueueItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  async function processSingleFile(file: File) {
    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newItem: UploadQueueItem = {
      id: qId,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      progress: 12,
      stage: 'reading',
      message: 'Membaca & mengenkripsi berkas lokal…'
    };
    setQueue(prev => [newItem, ...prev]);

    try {
      // Read file as base64 + optional text extraction for spreadsheets/docs
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = ev => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 35);
            updateQueueItem(qId, { progress: Math.max(15, pct) });
          }
        };
        reader.onload = () => {
          const res = String(reader.result || '');
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas'));
        reader.readAsDataURL(file);
      });

      let teksEkstrak = '';
      if (
        file.type.includes('text') ||
        file.type.includes('csv') ||
        file.type.includes('json') ||
        /\.(csv|tsv|txt|md|json|html|xml|gs)$/i.test(file.name)
      ) {
        try {
          teksEkstrak = await file.text();
        } catch (_) {}
      }

      updateQueueItem(qId, {
        progress: 55,
        stage: 'uploading',
        message: 'Mengunggah otomatis ke Cloud Vault Aman…'
      });

      const upJson = await fetchJson('/api/cloud/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          kelas: kelasId,
          namaFile: file.name,
          tipeMime: file.type || 'application/octet-stream',
          ukuran: file.size,
          base64Data,
          teksEkstrak
        })
      });
      if (!upJson.ok) {
        throw new Error(upJson.error || 'Gagal mengunggah ke penyimpanan cloud.');
      }

      const uploadedRecord: CloudFileRecord = upJson.data;
      onFilesUpdated([uploadedRecord, ...files]);
      setSelectedFileId(uploadedRecord.ID);

      // Automatically trigger AI analysis
      updateQueueItem(qId, {
        progress: 80,
        stage: 'analyzing',
        message: 'Menjalankan model AI untuk ekstraksi & analisis tren…'
      });
      setAnalyzingId(uploadedRecord.ID);

      const anJson = await fetchJson('/api/cloud/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fileId: uploadedRecord.ID,
          instruksiTambahan: customPrompt.trim()
        })
      });

      if (anJson.ok && anJson.data?.record) {
        const updatedRec: CloudFileRecord = anJson.data.record;
        onFilesUpdated([
          updatedRec,
          ...files.filter(f => f.ID !== updatedRec.ID)
        ]);
        updateQueueItem(qId, {
          progress: 100,
          stage: 'completed',
          message: 'Tersimpan di Cloud & selesai dianalisis AI'
        });
        showToast(`Berkas "${file.name}" berhasil diunggah dan dianalisis AI`);
      } else {
        updateQueueItem(qId, {
          progress: 100,
          stage: 'completed',
          message: 'Tersimpan di Cloud (Analisis dapat dijalankan ulang)'
        });
        if (anJson.error) {
          showToast('Unggah berhasil, namun analisis AI tertunda: ' + anJson.error, 4500);
        }
      }
    } catch (e: any) {
      updateQueueItem(qId, {
        progress: 100,
        stage: 'error',
        message: e?.message || 'Gagal memproses berkas'
      });
      showToast('Gagal: ' + (e?.message || String(e)), 4500);
    } finally {
      setAnalyzingId('');
    }
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const arr = Array.from(fileList);
    for (const f of arr) {
      await processSingleFile(f);
    }
  }

  async function reAnalyzeFile(fileRec: CloudFileRecord) {
    setAnalyzingId(fileRec.ID);
    try {
      showToast(`Menganalisis "${fileRec.NamaFile}" dengan AI…`, 8000);
      const json = await fetchJson('/api/cloud/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fileId: fileRec.ID,
          instruksiTambahan: customPrompt.trim()
        })
      });
      if (!json.ok) throw new Error(json.error || 'Gagal menganalisis berkas');
      const updatedRec: CloudFileRecord = json.data.record;
      onFilesUpdated(
        files.map(f => (f.ID === updatedRec.ID ? updatedRec : f))
      );
      setSelectedFileId(updatedRec.ID);
      showToast('Analisis AI berhasil diperbarui');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message || String(e)), 4500);
    } finally {
      setAnalyzingId('');
    }
  }

  async function handleDeleteFile(fileId: string) {
    try {
      const json = await fetchJson('/api/cloud/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fileId })
      });
      if (!json.ok) throw new Error(json.error || 'Gagal menghapus berkas');
      onFilesUpdated(json.data);
      showToast('Berkas dihapus dari penyimpanan cloud');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message || String(e)), 4000);
    }
  }

  const getFileBadgeClass = (mime: string, name: string) => {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-sm';
    if (m.includes('csv') || m.includes('sheet') || m.includes('excel') || /\.(csv|xlsx|xls|tsv)$/i.test(name)) {
      return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm';
    }
    return 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm';
  };

  const getFileIconWhite = (mime: string, name: string) => {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-white shrink-0" />;
    if (m.includes('csv') || m.includes('sheet') || m.includes('excel') || /\.(csv|xlsx|xls|tsv)$/i.test(name)) {
      return <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-white shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Colorful Hero Header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-500/15 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Penyimpanan Cloud Aman & Analisis Dokumen AI
          </h1>
          <p className="text-xs text-indigo-100 mt-1 max-w-2xl leading-relaxed">
            Unggah otomatis dokumen teks, spreadsheet (CSV/TSV), PDF, atau gambar kelas {kelasNama} ke Cloud Vault dan ekstrak informasi kunci, tren, serta rekomendasi tindak lanjut secara instan.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white bg-white/15 backdrop-blur-sm border border-white/25 px-3.5 py-2 rounded-xl font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>Cloud Vault Aktif · Analisis Otomatis</span>
        </div>
      </div>

      {/* Automatic Drag & Drop Upload Zone */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-fuchsia-500 bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 scale-[1.01]'
                : 'border-indigo-300 hover:border-violet-500 bg-gradient-to-br from-sky-50/70 via-indigo-50/50 to-violet-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.tsv,.txt,.pdf,.png,.jpg,.jpeg,.webp,.json,.md,.html,.doc,.docx,.xls,.xlsx"
              onChange={e => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-600 to-fuchsia-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-500/25">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-900">
              Seret & Lepas Berkas di Sini, atau Klik untuk Memilih
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Begitu dipilih, berkas langsung diunggah otomatis ke penyimpanan cloud aman dan dianalisis oleh AI. Mendukung Spreadsheet (CSV/TSV), Dokumen Teks/PDF, dan Gambar/Foto Catatan.
            </p>
          </div>

          <div className="space-y-3 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-rose-50/60 border border-amber-200/80 rounded-2xl p-4">
            <label className="block text-xs font-bold text-amber-900">
              Fokus Analisis AI Opsional
              <textarea
                rows={3}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Contoh: Fokuskan pada siswa yang membutuhkan remedial atau tren ketidakhadiran..."
                className="mt-1.5 w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
            <div className="text-[11px] text-amber-800 leading-relaxed">
              Model AI mengekstrak fakta numerik, mendeteksi pola anomali/tren nilai, dan menyusun langkah rekomendasi yang dapat ditindaklanjuti.
            </div>
          </div>
        </div>

        {/* Visual Upload & AI Status Feedback Queue */}
        {queue.length > 0 && (
          <div className="space-y-2.5 pt-3 border-t border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950">
                Status Unggahan & Pemrosesan Otomatis
              </span>
              <button
                onClick={() => setQueue([])}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Bersihkan Riwayat Status
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {queue.map(q => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-sky-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="font-bold text-slate-900 truncate">{q.name}</div>
                    <span className="font-mono tabular-nums text-[11px] font-bold text-indigo-700 shrink-0">
                      {q.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${q.progress}%` }}
                      className={`h-full transition-all duration-300 rounded-full ${
                        q.stage === 'error'
                          ? 'bg-gradient-to-r from-rose-500 to-red-600'
                          : q.stage === 'completed'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {q.stage === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : q.stage === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                    )}
                    <span
                      className={
                        q.stage === 'error'
                          ? 'text-rose-700 font-semibold'
                          : q.stage === 'completed'
                          ? 'text-emerald-700 font-semibold'
                          : 'text-indigo-700 font-medium'
                      }
                    >
                      {q.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Split View: Cloud Files Table (Left) + Actionable AI Insights (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cloud Repository List */}
        <div className="lg:col-span-5 bg-white border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-indigo-100 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Repositori Cloud Kelas</h2>
              <p className="text-[11px] text-indigo-700 font-medium tabular-nums">
                {classFiles.length} berkas tersimpan aman
              </p>
            </div>
          </div>

          {classFiles.length ? (
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {classFiles.map(f => {
                const isSelected = activeFile?.ID === f.ID;
                const hasAnalysis = !!f.AnalisisJSON;
                const isAnalyzing = analyzingId === f.ID;
                return (
                  <div
                    key={f.ID}
                    onClick={() => setSelectedFileId(f.ID)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-50 to-fuchsia-50/70'
                        : 'hover:bg-slate-50/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getFileBadgeClass(f.TipeMime, f.NamaFile)}`}>
                          {getFileIconWhite(f.TipeMime, f.NamaFile)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {f.NamaFile}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {formatBytes(f.Ukuran)} · {f.TanggalUnggah}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Oleh: {f.Pengunggah} ·{' '}
                            <span
                              className={
                                hasAnalysis
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-amber-700 font-medium'
                              }
                            >
                              {isAnalyzing
                                ? 'Sedang dianalisis AI…'
                                : hasAnalysis
                                ? 'Teranalisis AI'
                                : 'Tersimpan di Cloud'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => reAnalyzeFile(f)}
                          disabled={isAnalyzing}
                          title="Analisis ulang dengan AI"
                          className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`/api/cloud/file/${f.ID}`}
                          download={f.NamaFile}
                          title="Unduh berkas asli"
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(f.ID)}
                          title="Hapus dari Cloud"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              Belum ada berkas diunggah untuk kelas ini. Seret berkas ke kotak di atas untuk mengunggah dan menganalisis secara otomatis.
            </div>
          )}
        </div>

        {/* AI Analysis & Actionable Summary Panel */}
        <div className="lg:col-span-7 bg-white border border-indigo-100 rounded-2xl p-6 space-y-5 shadow-sm">
          {activeFile ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-indigo-100 pb-4">
                <div>
                  <div className="text-xs font-bold text-fuchsia-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {activeAnalysis?.kategoriDokumen || 'Laporan Analisis Dokumen AI'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeFile.NamaFile}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    Status: {activeFile.StatusCloud} · Ukuran {formatBytes(activeFile.Ukuran)}
                  </div>
                </div>

                <button
                  onClick={() => reAnalyzeFile(activeFile)}
                  disabled={analyzingId === activeFile.ID}
                  className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 disabled:opacity-50 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {analyzingId === activeFile.ID ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menganalisis…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Analisis Ulang AI
                    </>
                  )}
                </button>
              </div>

              {analyzingId === activeFile.ID ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
                  <div className="text-sm font-bold text-slate-900">
                    Model AI Sedang Mengekstrak Informasi & Mengidentifikasi Tren…
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Memeriksa struktur dokumen, menghitung metrik kunci, dan menyusun rekomendasi tindak lanjut untuk kelas {kelasNama}.
                  </p>
                </div>
              ) : activeAnalysis ? (
                <div className="space-y-5">
                  {/* Executive Summary */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 via-violet-50/70 to-fuchsia-50/50 border border-indigo-200 space-y-1.5">
                    <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-violet-600" />
                      Ringkasan Eksekutif
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {activeAnalysis.ringkasanEksekutif}
                    </p>
                  </div>

                  {/* Extracted Key Information */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-sky-600" />
                      Ekstraksi Informasi Kunci
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {(activeAnalysis.informasiKunci || []).map((info, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 text-xs text-slate-800 flex items-start gap-2.5"
                        >
                          <span className="font-mono font-bold text-sky-700 tabular-nums">
                            0{idx + 1}.
                          </span>
                          <span>{info}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trend Identification */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Identifikasi Tren & Pola Data
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {(activeAnalysis.identifikasiTren || []).map((tren, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/70 border border-emerald-200 text-xs text-slate-800 flex items-start gap-2.5"
                        >
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span>{tren}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actionable Recommendations */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-amber-600" />
                      Rekomendasi Tindak Lanjut (Actionable Summary)
                    </h3>
                    <div className="space-y-2">
                      {(activeAnalysis.rekomendasiTindakLanjut || []).map((rek, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200 text-xs text-slate-900 flex items-start gap-2.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                          <span className="font-medium">{rek}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-3">
                  <p className="text-xs text-slate-500">
                    Berkas ini telah tersimpan aman di Cloud Vault namun belum memiliki hasil analisis AI.
                  </p>
                  <button
                    onClick={() => reAnalyzeFile(activeFile)}
                    className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl"
                  >
                    Jalankan Analisis AI Sekarang
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Pilih berkas di sebelah kiri atau unggah berkas baru untuk melihat hasil ekstraksi informasi kunci, tren, dan rekomendasi AI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
