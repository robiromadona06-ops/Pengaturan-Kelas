import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Users,
  User,
  Copy,
  CheckCircle2,
  Search,
  ExternalLink
} from 'lucide-react';
import { waLink } from '../api';

interface SiswaWA {
  ID: string;
  Nama: string;
  NIS: string;
  NoSiswa?: string;
  NoOrtu?: string;
  KontakOrtu?: string;
}

interface WaBlastModalProps {
  open: boolean;
  onClose: () => void;
  kelasNama: string;
  sekolahNama: string;
  siswaList: SiswaWA[];
  initialStudentId?: string;
  initialTargetType?: 'siswa' | 'ortu';
  showToast: (msg: string, ms?: number) => void;
}

const TEMPLATES_SISWA = [
  {
    label: 'Pengumuman Umum',
    text: 'Halo {nama} (Kelas {kelas}), berikut informasi penting dari {sekolah}: Mohon memeriksa Portal Siswa secara berkala untuk pembaruan jadwal dan materi terbaru. Terima kasih.'
  },
  {
    label: 'Pengingat Tugas',
    text: 'Halo {nama} (NIS {nis}, Kelas {kelas}), mengingatkan agar segera mengerjakan dan mengunggah berkas tugas di Portal Siswa {sekolah} sebelum batas waktu pengumpulan.'
  },
  {
    label: 'Info Ujian CBT',
    text: 'Halo {nama} (Kelas {kelas}), ujian CBT Online sudah dibuka di Portal Siswa {sekolah}. Silakan login menggunakan NIS {nis} dan kerjakan sebelum batas waktu berakhir.'
  },
  {
    label: 'Konfirmasi Kehadiran',
    text: 'Halo {nama} (Kelas {kelas}), kami dari {sekolah} menginformasikan catatan kehadiranmu. Mohon segera menghubungi wali kelas / guru mapel untuk konfirmasi.'
  }
];

const TEMPLATES_ORTU = [
  {
    label: 'Info Sekolah (Ortu)',
    text: 'Assalamu\'alaikum Bapak/Ibu Wali Murid dari {nama} (Kelas {kelas}, NIS {nis}). Kami dari {sekolah} menyampaikan informasi akademik terbaru siswa. Terima kasih atas perhatiannya.'
  },
  {
    label: 'Pengingat Tugas (Ortu)',
    text: 'Assalamu\'alaikum Bapak/Ibu Wali Murid dari {nama} (Kelas {kelas}). Kami mohon dukungan untuk mengingatkan ananda agar segera mengumpulkan tugas di Portal Siswa {sekolah}.'
  },
  {
    label: 'Konfirmasi Absensi (Ortu)',
    text: 'Assalamu\'alaikum Bapak/Ibu Wali Murid dari {nama} (Kelas {kelas}). Kami menginformasikan catatan ketidakhadiran ananda. Mohon konfirmasi kepada Wali Kelas {sekolah}.'
  }
];

export default function WaBlastModal({
  open,
  onClose,
  kelasNama,
  sekolahNama,
  siswaList,
  initialStudentId,
  initialTargetType,
  showToast
}: WaBlastModalProps) {
  const [mode, setMode] = useState<'massal' | 'individu'>('massal');
  const [targetRole, setTargetRole] = useState<'siswa' | 'ortu'>('siswa');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [singleId, setSingleId] = useState('');
  const [pesan, setPesan] = useState(TEMPLATES_SISWA[0].text);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});

  const siswaDenganNo = useMemo(
    () =>
      (siswaList || []).map(s => {
        const noSiswa = String(s.NoSiswa || s.KontakOrtu || '').trim();
        const noOrtu = String(s.NoOrtu || '').trim();
        const nomor = targetRole === 'ortu' ? noOrtu : noSiswa;
        return {
          ...s,
          noSiswa,
          noOrtu,
          nomor
        };
      }),
    [siswaList, targetRole]
  );

  useEffect(() => {
    if (!open) return;
    setSentIds({});
    const tRole = initialTargetType || 'siswa';
    setTargetRole(tRole);
    setPesan(tRole === 'ortu' ? TEMPLATES_ORTU[0].text : TEMPLATES_SISWA[0].text);
    const allValid = (siswaList || [])
      .filter(s => {
        const num = tRole === 'ortu' ? s.NoOrtu : (s.NoSiswa || s.KontakOrtu);
        return Boolean(String(num || '').trim());
      })
      .map(s => s.ID);

    if (initialStudentId) {
      setMode('individu');
      setSingleId(initialStudentId);
      setSelectedIds([initialStudentId]);
    } else {
      setMode('massal');
      setSelectedIds(allValid);
      setSingleId(allValid[0] || siswaList?.[0]?.ID || '');
    }
  }, [open, initialStudentId, initialTargetType]);

  const handleSwitchTarget = (nextRole: 'siswa' | 'ortu') => {
    setTargetRole(nextRole);
    setSentIds({});
    setPesan(nextRole === 'ortu' ? TEMPLATES_ORTU[0].text : TEMPLATES_SISWA[0].text);
    const valid = (siswaList || [])
      .filter(s => Boolean(String(nextRole === 'ortu' ? s.NoOrtu : (s.NoSiswa || s.KontakOrtu) || '').trim()))
      .map(s => s.ID);
    setSelectedIds(valid);
  };

  if (!open) return null;

  const formatPesan = (s: SiswaWA) =>
    pesan
      .replace(/\{nama\}/gi, s.Nama || '')
      .replace(/\{nis\}/gi, s.NIS || '-')
      .replace(/\{kelas\}/gi, kelasNama || '-')
      .replace(/\{sekolah\}/gi, sekolahNama || 'Sekolah');

  const filtered = siswaDenganNo.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.Nama.toLowerCase().includes(q) ||
      String(s.NIS || '').toLowerCase().includes(q) ||
      s.nomor.toLowerCase().includes(q)
    );
  });

  const selectedStudents = siswaDenganNo.filter(s => selectedIds.includes(s.ID) && s.nomor);
  const activeSingle = siswaDenganNo.find(s => s.ID === singleId) || siswaDenganNo[0];
  const templates = targetRole === 'ortu' ? TEMPLATES_ORTU : TEMPLATES_SISWA;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllValid = () => {
    setSelectedIds(filtered.filter(s => s.nomor).map(s => s.ID));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const copyAllNumbers = () => {
    if (!selectedStudents.length) return showToast('Pilih minimal 1 penerima yang memiliki nomor WA');
    const nums = selectedStudents.map(s => `${s.Nama} (${s.nomor})`).join('\n');
    navigator.clipboard?.writeText(nums);
    showToast(`${selectedStudents.length} nomor WA disalin ke papan klip`);
  };

  const copyAllLinks = () => {
    if (!selectedStudents.length) return showToast('Pilih minimal 1 penerima yang memiliki nomor WA');
    const txt = selectedStudents
      .map(s => `${s.Nama} (${s.nomor}):\n${waLink(s.nomor, formatPesan(s))}`)
      .join('\n\n');
    navigator.clipboard?.writeText(txt);
    showToast(`Daftar tautan WA (${selectedStudents.length} penerima) disalin`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-emerald-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-4 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Kirim WhatsApp Massal & Per Individu</h2>
              <p className="text-xs text-emerald-50">
                Kelas {kelasNama} · Kirim pesan ke No. WA Siswa atau No. WA Orang Tua secara massal maupun per individu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode & Recipient Role Switcher */}
        <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 bg-emerald-50 border border-emerald-200 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode('massal')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer ${
                  mode === 'massal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Massal ({selectedStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setMode('individu')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer ${
                  mode === 'individu'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-teal-800 hover:bg-teal-100'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Per Individu
              </button>
            </div>

            <div className="inline-flex p-1 bg-sky-50 border border-sky-200 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => handleSwitchTarget('siswa')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                  targetRole === 'siswa'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-sky-800 hover:bg-sky-100'
                }`}
              >
                Ke No. WA Siswa
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTarget('ortu')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                  targetRole === 'ortu'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                Ke No. WA Orang Tua
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {templates.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => setPesan(t.text)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg cursor-pointer"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Composer */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Isi Pesan WhatsApp ({targetRole === 'ortu' ? 'Untuk Orang Tua / Wali' : 'Untuk Siswa'})
                </label>
                <span className="text-[11px] text-slate-500">Klik variabel:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['{nama}', '{nis}', '{kelas}', '{sekolah}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setPesan(prev => `${prev} ${tag}`.trim())}
                    className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                rows={5}
                value={pesan}
                onChange={e => setPesan(e.target.value)}
                placeholder="Tulis pesan WhatsApp di sini..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {mode === 'individu' ? (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <label className="block text-xs font-bold text-emerald-950">
                  Pilih {targetRole === 'ortu' ? 'Orang Tua dari Siswa' : 'Siswa Penerima'}
                  <select
                    value={activeSingle?.ID || ''}
                    onChange={e => setSingleId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-emerald-300 bg-white rounded-xl text-xs font-semibold"
                  >
                    {siswaDenganNo.map(s => (
                      <option key={s.ID} value={s.ID}>
                        {s.Nama} ({s.NIS}) — {s.nomor || `Belum ada No. ${targetRole === 'ortu' ? 'Ortu' : 'Siswa'}`}
                      </option>
                    ))}
                  </select>
                </label>

                {activeSingle && (
                  <>
                    <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap">
                      <div className="text-[10px] font-bold uppercase text-emerald-700 mb-1">
                        Pratinjau Pesan ({targetRole === 'ortu' ? 'WA Ortu' : 'WA Siswa'} - {activeSingle.Nama}):
                      </div>
                      {formatPesan(activeSingle)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeSingle.nomor ? (
                        <a
                          href={waLink(activeSingle.nomor, formatPesan(activeSingle))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" /> Kirim WA ({activeSingle.nomor})
                        </a>
                      ) : (
                        <div className="flex-1 py-2 px-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
                          Nomor WA {targetRole === 'ortu' ? 'Orang Tua' : 'Siswa'} belum diisi di Data Siswa.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(formatPesan(activeSingle));
                          showToast('Teks pesan disalin');
                        }}
                        className="py-2.5 px-3 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Salin
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-900">
                  Pratinjau Pesan Massal ({selectedStudents.length} tujuan {targetRole === 'ortu' ? 'WA Ortu' : 'WA Siswa'})
                </div>
                {selectedStudents[0] ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">
                      Contoh untuk {selectedStudents[0].Nama} ({selectedStudents[0].nomor}):
                    </div>
                    {formatPesan(selectedStudents[0])}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Centang penerima di daftar sebelah kanan untuk mengirim pesan massal.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={copyAllNumbers}
                    className="px-3 py-1.5 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin Semua Nomor
                  </button>
                  <button
                    type="button"
                    onClick={copyAllLinks}
                    className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin Semua Tautan WA
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Student Queue / Recipient Picker */}
          <div className="space-y-3 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama / NIS / nomor WA..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              {mode === 'massal' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllValid}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg cursor-pointer"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-y-auto max-h-[380px] bg-white">
              {filtered.map(s => {
                const checked = selectedIds.includes(s.ID);
                const sent = !!sentIds[s.ID];
                return (
                  <div
                    key={s.ID}
                    className={`p-2.5 flex items-center justify-between gap-2 text-xs ${
                      mode === 'individu' && singleId === s.ID
                        ? 'bg-emerald-50'
                        : checked && mode === 'massal'
                        ? 'bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                      {mode === 'massal' ? (
                        <input
                          type="checkbox"
                          disabled={!s.nomor}
                          checked={checked && !!s.nomor}
                          onChange={() => toggleSelect(s.ID)}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                      ) : (
                        <input
                          type="radio"
                          name="single-wa-student"
                          checked={singleId === s.ID}
                          onChange={() => setSingleId(s.ID)}
                          className="text-emerald-600"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{s.Nama}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {s.NIS || '-'} · {s.nomor || `No. ${targetRole === 'ortu' ? 'Ortu' : 'Siswa'} kosong`}
                        </div>
                      </div>
                    </label>

                    {s.nomor ? (
                      <a
                        href={waLink(s.nomor, formatPesan(s))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSentIds(prev => ({ ...prev, [s.ID]: true }))}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 shrink-0 transition-colors ${
                          sent
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {sent ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Terbuka ✓
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3" /> Kirim WA
                          </>
                        )}
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400 shrink-0">No. Kosong</span>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  Tidak ada penerima yang cocok dengan pencarian.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Pilih penerima ke <strong>No. WA Siswa</strong> atau <strong>No. WA Orang Tua</strong>, lalu kirim satu-per-satu dalam antrean atau salin tautan massal.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
