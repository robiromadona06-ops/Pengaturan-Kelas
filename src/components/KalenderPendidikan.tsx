import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  Save,
  X
} from 'lucide-react';
import { CHECKLIST, JENIS_AK, KALENDER, KOMUNIKASI } from '../constants';
import { pad, tglIndo, uid, ymd } from '../api';
import { KALDIK_JABAR_REF, KaldikEvent } from '../data/kaldikJabar';

interface KalenderPendidikanProps {
  kelasId: string;
  peran: string;
  pengaturan: Record<string, string>;
  akademik: KaldikEvent[];
  checklist: any[];
  mingguKe: number | null;
  akBulan: string;
  onChangeAkBulan: (ym: string) => void;
  onSaveAkademik: (nextAkademik: KaldikEvent[]) => Promise<boolean>;
  onToggleChecklist: (idx: number) => Promise<void>;
  onSyncJabar: (opts: { tahunAjaran: string; autoSync: boolean; useAi?: boolean }) => Promise<void>;
  onToggleAutoSync: (enabled: boolean, tahunAjaran: string) => Promise<void>;
  askConfirm: (msg: string) => Promise<boolean>;
  showToast: (msg: string, ms?: number) => void;
}

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

export default function KalenderPendidikan({
  kelasId,
  peran,
  pengaturan,
  akademik,
  checklist,
  mingguKe,
  akBulan,
  onChangeAkBulan,
  onSaveAkademik,
  onToggleChecklist,
  onSyncJabar,
  onToggleAutoSync,
  askConfirm,
  showToast
}: KalenderPendidikanProps) {
  const [filterJenis, setFilterJenis] = useState<string>('Semua');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncingAi, setSyncingAi] = useState(false);
  const [tahunAjaran, setTahunAjaran] = useState<string>(
    pengaturan.kaldikTahunAjaran || KALDIK_JABAR_REF.tahunAjaran
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [draftMulai, setDraftMulai] = useState(ymd(new Date()));
  const [draftSelesai, setDraftSelesai] = useState(ymd(new Date()));
  const [draftKegiatan, setDraftKegiatan] = useState('');
  const [draftJenis, setDraftJenis] = useState('Kegiatan sekolah');

  const isAdmin = peran === 'admin';
  const canEdit = isAdmin || String(peran).includes('wali');
  const autoSyncOn = pengaturan.kaldikAutoSync !== '0';

  const isChecked = (i: number) =>
    (checklist || []).find((c: any) => c.Kelas === kelasId && c.Item === String(i))?.Selesai === '1';
  const selesaiCount = CHECKLIST.filter((_, i) => isChecked(i)).length;

  const sortedEvents = useMemo(() => {
    return [...(akademik || [])].sort((a, b) => (a.Mulai || '').localeCompare(b.Mulai || ''));
  }, [akademik]);

  const filteredEvents = useMemo(() => {
    return sortedEvents.filter(ev => {
      if (filterJenis !== 'Semua' && ev.Jenis !== filterJenis) return false;
      if (selectedDay) {
        const end = ev.Selesai || ev.Mulai;
        return selectedDay >= ev.Mulai && selectedDay <= end;
      }
      return true;
    });
  }, [sortedEvents, filterJenis, selectedDay]);

  // Month grid calculation
  const [curYear, curMonth] = useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(akBulan || '');
    if (m) return [Number(m[1]), Number(m[2])];
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1];
  }, [akBulan]);

  const monthGrid = useMemo(() => {
    const first = new Date(curYear, curMonth - 1, 1);
    const daysInMonth = new Date(curYear, curMonth, 0).getDate();
    // Monday = 0 ... Sunday = 6
    const startOffset = (first.getDay() + 6) % 7;
    const cells: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${curYear}-${pad(curMonth)}-${pad(d)}`,
        dayNum: d
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [curYear, curMonth]);

  function shiftMonth(delta: number) {
    const d = new Date(curYear, curMonth - 1 + delta, 1);
    onChangeAkBulan(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    setSelectedDay('');
  }

  function eventsOnDate(dateStr: string): KaldikEvent[] {
    return sortedEvents.filter(ev => {
      const end = ev.Selesai || ev.Mulai;
      return dateStr >= ev.Mulai && dateStr <= end;
    });
  }

  function openNewEventForm(datePrefill?: string) {
    const d = datePrefill || `${curYear}-${pad(curMonth)}-01`;
    setEditId('');
    setDraftMulai(d);
    setDraftSelesai(d);
    setDraftKegiatan('');
    setDraftJenis('Kegiatan sekolah');
    setFormOpen(true);
  }

  function openEditEventForm(ev: KaldikEvent) {
    setEditId(ev.ID);
    setDraftMulai(ev.Mulai);
    setDraftSelesai(ev.Selesai || ev.Mulai);
    setDraftKegiatan(ev.Kegiatan);
    setDraftJenis(ev.Jenis || 'Kegiatan sekolah');
    setFormOpen(true);
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!draftMulai || !draftKegiatan.trim()) {
      showToast('Tanggal mulai dan nama kegiatan wajib diisi.');
      return;
    }
    const endDate = draftSelesai && draftSelesai >= draftMulai ? draftSelesai : draftMulai;
    const next = [...sortedEvents];
    if (editId) {
      const idx = next.findIndex(x => x.ID === editId);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          Mulai: draftMulai,
          Selesai: endDate,
          Kegiatan: draftKegiatan.trim(),
          Jenis: draftJenis
        };
      }
    } else {
      next.push({
        ID: 'ak_' + uid(),
        Mulai: draftMulai,
        Selesai: endDate,
        Kegiatan: draftKegiatan.trim(),
        Jenis: draftJenis,
        Sumber: 'Sekolah (Kustom)'
      });
    }
    const ok = await onSaveAkademik(next);
    if (ok) {
      setFormOpen(false);
    }
  }

  async function handleDeleteEvent(ev: KaldikEvent) {
    if (!(await askConfirm(`Hapus agenda "${ev.Kegiatan}"?`))) return;
    await onSaveAkademik(sortedEvents.filter(x => x.ID !== ev.ID));
  }

  async function triggerSyncJabar(useAi = false) {
    if (useAi) setSyncingAi(true);
    else setSyncing(true);
    try {
      await onSyncJabar({ tahunAjaran, autoSync: autoSyncOn, useAi });
    } finally {
      setSyncing(false);
      setSyncingAi(false);
    }
  }

  const todayStr = ymd(new Date());
  const jabarCount = sortedEvents.filter(e => String(e.ID).startsWith('jabar_') || String(e.Sumber || '').includes('Jabar')).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold text-amber-200 mb-2">
            <Globe className="w-3.5 h-3.5" /> {KALDIK_JABAR_REF.instansi} · {KALDIK_JABAR_REF.dasarSurat}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Kalender Pendidikan Provinsi Jawa Barat & Sekolah
          </h1>
          <p className="text-xs text-indigo-100 mt-1">
            Terintegrasi Kalender Pendidikan Jawa Barat (update otomatis), kalender bulanan interaktif, rencana 20 minggu efektif, dan daftar periksa kelas.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => openNewEventForm(selectedDay || undefined)}
            className="px-4 py-2 text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah Agenda Sekolah
          </button>
        )}
      </div>

      {/* Auto-Update Jawa Barat Control Panel */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Sinkronisasi & Update Otomatis Kaldik Provinsi Jawa Barat
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {jabarCount} Agenda Jabar Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {pengaturan.kaldikLastSync
                  ? `Terakhir diperbarui: ${pengaturan.kaldikLastSync}`
                  : 'Siap disinkronkan dengan kalender resmi Dinas Pendidikan Jawa Barat.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={tahunAjaran}
              onChange={e => setTahunAjaran(e.target.value)}
              disabled={!canEdit}
              className="px-3 py-2 text-xs font-semibold border border-indigo-200 rounded-xl bg-indigo-50/50 text-indigo-950"
            >
              <option value="2026/2027">TA 2026/2027 (Resmi Jabar)</option>
              <option value="2027/2028">TA 2027/2028 (Proyeksi)</option>
            </select>

            {isAdmin && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncOn}
                  onChange={e => onToggleAutoSync(e.target.checked, tahunAjaran)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                Update Otomatis
              </label>
            )}

            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => triggerSyncJabar(false)}
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Memperbarui…' : 'Update Kaldik Jabar'}
                </button>
                <button
                  type="button"
                  disabled={syncingAi}
                  onClick={() => triggerSyncJabar(true)}
                  className="px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:brightness-110 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${syncingAi ? 'animate-pulse' : ''}`} />
                  {syncingAi ? 'Mencari Pembaruan…' : 'Cek Pembaruan AI + Web'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Event Inline Form */}
      {formOpen && canEdit && (
        <form
          onSubmit={handleSaveEvent}
          className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {editId ? 'Edit Agenda Kalender Pendidikan' : 'Tambah Agenda Sekolah Baru'}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Tanggal Mulai
              <input
                type="date"
                required
                value={draftMulai}
                onChange={e => setDraftMulai(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Tanggal Selesai
              <input
                type="date"
                value={draftSelesai}
                onChange={e => setDraftSelesai(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Kategori Agenda
              <select
                value={draftJenis}
                onChange={e => setDraftJenis(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              >
                {Object.keys(JENIS_AK).map(j => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700 md:col-span-1">
              Nama Kegiatan
              <input
                type="text"
                required
                value={draftKegiatan}
                onChange={e => setDraftKegiatan(e.target.value)}
                placeholder="Misal: Rapat Orang Tua / PTS"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Agenda
            </button>
          </div>
        </form>
      )}

      {/* Monthly Interactive Calendar + Agenda List */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Monthly Grid */}
        <div className="xl:col-span-7 bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {BULAN_INDO[curMonth - 1]} {curYear}
              </h2>
              <p className="text-[11px] text-slate-500">
                Klik tanggal untuk memfilter atau menambahkan agenda.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                title="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeAkBulan(todayStr.slice(0, 7));
                  setSelectedDay(todayStr);
                }}
                className="px-3 py-1.5 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                title="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 pb-1 border-b border-slate-100">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d, i) => (
              <div key={d} className={i === 6 ? 'text-rose-500' : ''}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty_${idx}`} className="min-h-[68px] rounded-xl bg-slate-50/50" />;
              }
              const dayEvents = eventsOnDate(cell.dateStr);
              const isToday = cell.dateStr === todayStr;
              const isSel = cell.dateStr === selectedDay;
              const isSunday = idx % 7 === 6;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDay(prev => (prev === cell.dateStr ? '' : cell.dateStr))}
                  className={`min-h-[68px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSel
                      ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200'
                      : isToday
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isToday
                          ? 'text-emerald-700'
                          : isSunday
                          ? 'text-rose-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] font-bold px-1 rounded bg-indigo-100 text-indigo-700 tabular-nums">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 w-full mt-1">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div
                        key={ev.ID + cell.dateStr}
                        style={{
                          backgroundColor: `${JENIS_AK[ev.Jenis] || '#6366f1'}1a`,
                          color: JENIS_AK[ev.Jenis] || '#4338ca'
                        }}
                        className="text-[9px] font-semibold px-1 py-0.5 rounded truncate"
                        title={ev.Kegiatan}
                      >
                        {ev.Kegiatan}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-slate-400 font-medium px-1">
                        +{dayEvents.length - 2} lainnya
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
            {Object.entries(JENIS_AK).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Agenda Table & Filter */}
        <div className="xl:col-span-5 bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Agenda ({filteredEvents.length})
              </h2>
              {selectedDay && (
                <div className="text-[11px] text-indigo-600 font-semibold flex items-center gap-2 mt-0.5">
                  Filter tanggal: {tglIndo(selectedDay)}
                  <button
                    type="button"
                    onClick={() => setSelectedDay('')}
                    className="underline text-rose-600 cursor-pointer"
                  >
                    Tampilkan semua
                  </button>
                </div>
              )}
            </div>
            <select
              value={filterJenis}
              onChange={e => setFilterJenis(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50"
            >
              <option value="Semua">Semua Kategori</option>
              {Object.keys(JENIS_AK).map(j => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[440px] divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Tidak ada agenda pada filter ini.
              </div>
            ) : (
              filteredEvents.map(ev => {
                const color = JENIS_AK[ev.Jenis] || '#64748b';
                const isJabar = String(ev.ID).startsWith('jabar_') || String(ev.Sumber || '').includes('Jabar');
                return (
                  <div
                    key={ev.ID}
                    className="p-3 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          {ev.Jenis}
                        </span>
                        {isJabar && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold">
                            Disdik Jabar
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900">{ev.Kegiatan}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {tglIndo(ev.Mulai)}
                        {ev.Selesai && ev.Selesai !== ev.Mulai ? ` – ${tglIndo(ev.Selesai)}` : ''}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEventForm(ev)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                          title="Edit agenda"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus agenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 20-Week Learning Roadmap */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Rencana Induk 20 Minggu Pembelajaran Efektif</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {KALENDER.map((f, idx) => {
            const aktif = mingguKe !== null && mingguKe >= f[0] && mingguKe <= f[1];
            return (
              <div
                key={idx}
                style={{
                  borderColor: aktif ? f[4] : `${f[4]}40`,
                  backgroundColor: aktif ? `${f[4]}16` : `${f[4]}08`
                }}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  aktif ? 'shadow-md' : 'shadow-2xs'
                }`}
              >
                <div style={{ color: f[4] }} className="text-[11px] font-mono font-bold uppercase">
                  Minggu {f[0] === f[1] ? f[0] : `${f[0]}–${f[1]}`} {aktif ? '· SEKARANG' : ''}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{f[2]}</div>
                <div className="text-xs text-slate-600 mt-1">{f[3]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checklist & Parent Communication */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Daftar Periksa Administrasi ({selesaiCount}/{CHECKLIST.length})
          </h2>
          <div className="space-y-2">
            {CHECKLIST.map((item, i) => (
              <label
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={isChecked(i)}
                  onChange={() => onToggleChecklist(i)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className={isChecked(i) ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Alur Komunikasi Orang Tua</h2>
          <div className="space-y-2.5">
            {KOMUNIKASI.map((k, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="font-bold text-slate-900">{k[0]}</div>
                <div className="text-slate-600 mt-0.5">{k[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
