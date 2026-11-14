/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  KODE,
  KODE_DESKRIPSI,
  TABS,
  TANGGA,
  KALENDER,
  CHECKLIST,
  KOMUNIKASI,
  ATURAN,
  LEVEL,
  TAHAP,
  HARI,
  TUGAS_PIKET,
  STRUKTUR_STD,
  LVL_STR,
  JENIS_AK,
  STATUS_TP,
  MAPEL_UMUM,
  PERAN_NAMA,
  TAB_PERAN,
  TAB_WALI,
  KOLOM_NILAI,
  ATUR_STD,
  MODUL_AWAL,
  TAB_THEME,
  DAY_THEME,
  avatarColorFor
} from './constants';
import {
  callRaw,
  fetchJson,
  num,
  fmt,
  pad,
  ymd,
  uid,
  pesanErr,
  acak,
  urlAman,
  tglTambah,
  tglIndo,
  menit,
  jamStr,
  tumpang,
  pekanTemu,
  adaPelajaran,
  slotJadwal,
  uraiCSV,
  petaKolom,
  waLink
} from './api';
import StudentPortal from './components/StudentPortal';
import CloudAiHub from './components/CloudAiHub';
import CbtManager from './components/CbtManager';
import WaBlastModal from './components/WaBlastModal';
import KalenderPendidikan from './components/KalenderPendidikan';
import ResetDatabasePanel from './components/ResetDatabasePanel';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ensureUserProfileInFirestore,
  loadWorkspaceFromFirestore,
  syncPengaturanToFirestore,
  syncSheetToFirestore,
  syncAllToFirestore
} from './db/firestoreSync';
import {
  BookOpen,
  LayoutDashboard,
  CloudUpload,
  CheckSquare,
  Users,
  Grid,
  Sparkles,
  Network,
  CalendarClock,
  ClipboardList,
  BarChart3,
  Award,
  CalendarDays,
  Compass,
  UserCheck,
  Settings,
  RotateCcw,
  Database,
  LogOut,
  RefreshCw,
  Printer,
  Plus,
  Trash2,
  Edit3,
  Save,
  Download,
  Upload,
  Copy,
  KeyRound,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Image as ImageIcon,
  GraduationCap,
  ArrowLeft,
  FileCheck2,
  Mail,
  Paperclip,
  Eye,
  EyeOff
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  CloudUpload,
  CheckSquare,
  Users,
  Grid,
  Sparkles,
  Network,
  CalendarClock,
  BookOpen,
  FileCheck2,
  ClipboardList,
  BarChart3,
  Award,
  CalendarDays,
  Compass,
  UserCheck,
  Settings,
  RotateCcw
};

function parseJurusanLogos(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k && typeof v === 'string' && v.startsWith('data:image/')) out[k] = v;
    }
    return out;
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k && typeof v === 'string' && v.startsWith('data:image/')) out[k] = v;
      }
      return out;
    }
  } catch (_) {}
  return {};
}

interface PasswordFieldProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}

function PasswordField({
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  className = '',
  inputMode,
  maxLength
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setVisible(v => !v);
        }}
        title={visible ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        aria-label={visible ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function App() {
  // Session & Auth State
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [peran, setPeran] = useState('admin');
  const [adminAda, setAdminAda] = useState(true);
  const [loginMode, setLoginMode] = useState<'admin' | 'siswa'>('admin');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginPass2, setLoginPass2] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [publicInfo, setPublicInfo] = useState<{
    sekolah: string;
    logo: string;
    jurusan: string;
    jurusanLogos?: string;
    waInfo: string;
    emailHint?: string;
  }>({
    sekolah: 'SMA Negeri 1 Nusantara',
    logo: '',
    jurusan: 'MIPA, IPS, Bahasa',
    jurusanLogos: '{}',
    waInfo: '6281234567890',
    emailHint: ''
  });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotUser, setForgotUser] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtpPreview, setForgotOtpPreview] = useState('');
  const [forgotVerif, setForgotVerif] = useState('');
  const [forgotPass, setForgotPass] = useState('');
  const [forgotPass2, setForgotPass2] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotOk, setForgotOk] = useState(false);
  const [forgotSiswaNis, setForgotSiswaNis] = useState('');
  const [forgotSiswaNama, setForgotSiswaNama] = useState('');
  const [waBlastState, setWaBlastState] = useState<{
    open: boolean;
    studentId?: string;
    targetType?: 'siswa' | 'ortu';
  }>({ open: false });
  const [loginBrandEdit, setLoginBrandEdit] = useState(false);
  const [brandLogoDraft, setBrandLogoDraft] = useState('');
  const [brandSekolahDraft, setBrandSekolahDraft] = useState('');
  const [brandJurusanItems, setBrandJurusanItems] = useState<Array<{ name: string; logo: string }>>([]);
  const [brandNewJurusan, setBrandNewJurusan] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState('');

  // Main Database & Portal State
  const [db, setDb] = useState<Record<string, any>>({
    Pengaturan: {},
    Kelas: [],
    Siswa: [],
    Absensi: [],
    Tugas: [],
    Pengumpulan: [],
    Nilai: [],
    Perilaku: [],
    Checklist: [],
    DenahAtur: [],
    Denah: [],
    Piket: [],
    Struktur: [],
    Jadwal: [],
    JadwalAtur: [],
    Akademik: [],
    TP: [],
    Modul: [],
    Pemantik: [],
    Mapel: [],
    CBT: [],
    HasilCBT: [],
    Pengguna: [],
    GuruList: [],
    punyaPIN: []
  });
  const [portal, setPortal] = useState<any>(null);

  // Active Navigation & Class State
  const [K, setK] = useState('');
  const [tab, setTab] = useState('dash');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toast & Modal
  const [toastMsg, setToastMsg] = useState('');
  const [modalContent, setModalContent] = useState<{
    title: string;
    wide?: boolean;
    render: () => React.ReactNode;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    msg: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  // Sub-views & Feature States
  const [absDate, setAbsDate] = useState(ymd(new Date()));
  const [absMode, setAbsMode] = useState<'input' | 'rekap'>('input');
  const [rekapBulan, setRekapBulan] = useState(ymd(new Date()).slice(0, 7));
  const [absDraft, setAbsDraft] = useState<Record<string, string>>({});
  const [absNote, setAbsNote] = useState<Record<string, string>>({});

  const [tugSel, setTugSel] = useState('');
  const [denSel, setDenSel] = useState('');
  const [denPick, setDenPick] = useState('');
  const [denDirty, setDenDirty] = useState(false);
  const [akBulan, setAkBulan] = useState(ymd(new Date()).slice(0, 7));
  const [ajarSub, setAjarSub] = useState<'tp' | 'mod' | 'pem'>('tp');
  const [modView, setModView] = useState('');
  const [presState, setPresState] = useState<{ slides: string[]; i: number } | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [googleAuthBusy, setGoogleAuthBusy] = useState(false);
  const kaldikAutoCheckedRef = React.useRef(false);

  // Toast helper
  const showToast = useCallback((msg: string, ms = 2500) => {
    setToastMsg(msg);
    const timer = setTimeout(() => {
      setToastMsg(prev => (prev === msg ? '' : prev));
    }, ms);
    return () => clearTimeout(timer);
  }, []);

  const askConfirm = (msg: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ msg, resolve });
    });
  };

  const simpanTokenStorage = (t: string, r: string) => {
    try {
      if (t) {
        sessionStorage.setItem('mk_token', t);
        sessionStorage.setItem('mk_role', r || '');
      } else {
        sessionStorage.removeItem('mk_token');
        sessionStorage.removeItem('mk_role');
      }
    } catch (_) {}
  };

  const sesiHabis = useCallback((pesan?: string) => {
    setToken('');
    setRole('');
    setPeran('admin');
    setPortal(null);
    simpanTokenStorage('', '');
    setLoginErr(pesan || 'Sesi berakhir, silakan masuk kembali.');
  }, []);

  const apiCall = useCallback(
    async (fn: string, ...args: any[]) => {
      try {
        return await callRaw(fn, token, ...args);
      } catch (e: any) {
        if (pesanErr(e).includes('SESI_HABIS')) {
          sesiHabis();
        }
        throw e;
      }
    },
    [token, sesiHabis]
  );

  const masukSesi = useCallback(async (t: string, r: string) => {
    setToken(t);
    setRole(r);
    simpanTokenStorage(t, r);
    setLoading(true);
    try {
      if (r !== 'siswa') {
        const data = await callRaw('api_load', t);
        setDb(data);
        setPeran(data.peran || 'admin');
        const firstKelas = data.Kelas?.[0]?.ID || '';
        setK(firstKelas);
        setTab('dash');
      } else {
        const pData = await callRaw('api_loadSiswa', t);
        setPortal(pData);
      }
      setLoginErr('');
    } catch (e: any) {
      sesiHabis(pesanErr(e));
    } finally {
      setLoading(false);
    }
  }, [sesiHabis]);

  // Initial session check
  useEffect(() => {
    (async () => {
      try {
        let savedTok = '';
        let savedRole = '';
        try {
          savedTok = sessionStorage.getItem('mk_token') || '';
          savedRole = sessionStorage.getItem('mk_role') || '';
        } catch (_) {}
        if (savedTok && savedRole) {
          await masukSesi(savedTok, savedRole);
          return;
        }
        const st = await callRaw('api_status');
        setAdminAda(!!st.adminAda);
        setPublicInfo({
          sekolah: st.sekolah || 'SMA Negeri 1 Nusantara',
          logo: st.logo || '',
          jurusan: st.jurusan || '',
          jurusanLogos: st.jurusanLogos || '{}',
          waInfo: st.waInfo || '',
          emailHint: st.emailHint || ''
        });
      } catch (e: any) {
        setLoginErr(pesanErr(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [masukSesi]);

  // Track Firebase Google Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setFirebaseUser(user);
      if (user && user.emailVerified) {
        try {
          await ensureUserProfileInFirestore(user);
        } catch (err) {
          console.warn('Gagal memastikan profil Firestore:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Load attendance draft whenever class K or absDate changes
  useEffect(() => {
    if (!K || !db.Absensi) return;
    const draft: Record<string, string> = {};
    const note: Record<string, string> = {};
    db.Absensi.filter((a: any) => a.Kelas === K && a.Tanggal === absDate).forEach((a: any) => {
      draft[a.SiswaID] = a.Kode;
      note[a.SiswaID] = a.Keterangan || '';
    });
    setAbsDraft(draft);
    setAbsNote(note);
  }, [K, absDate, db.Absensi]);

  // Keyboard navigation for slide presentation
  useEffect(() => {
    if (!presState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setPresState(p => (p ? { ...p, i: Math.min(p.slides.length - 1, p.i + 1) } : null));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPresState(p => (p ? { ...p, i: Math.max(0, p.i - 1) } : null));
      } else if (e.key === 'Escape') {
        setPresState(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presState]);

  async function handleLoginSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass;
    if (!u || !p) {
      setLoginErr('Lengkapi nama pengguna dan kata sandi / PIN.');
      return;
    }
    setLoginErr('Memeriksa kredensial…');
    try {
      let r;
      if (!adminAda) {
        if (p !== loginPass2) {
          setLoginErr('Kata sandi konfirmasi tidak sama.');
          return;
        }
        r = await callRaw('api_setupAdmin', u, p);
        setAdminAda(true);
      } else {
        r = await callRaw('api_login', loginMode, u, p);
      }
      await masukSesi(r.token, r.role);
    } catch (err: any) {
      setLoginErr(pesanErr(err));
    }
  }

  async function quickDemoLogin(mode: 'admin' | 'siswa', user: string, pass: string) {
    setLoginMode(mode);
    setLoginUser(user);
    setLoginPass(pass);
    setLoginErr('Masuk otomatis…');
    try {
      const r = await callRaw('api_login', mode, user, pass);
      await masukSesi(r.token, r.role);
    } catch (err: any) {
      setLoginErr(pesanErr(err));
    }
  }

  async function loginWithGoogleAdmin() {
    setGoogleAuthBusy(true);
    setLoginErr('Menghubungkan akun Google & Firestore…');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!cred.user.emailVerified) {
        throw new Error('Akun Google harus memiliki email yang terverifikasi.');
      }
      await ensureUserProfileInFirestore(cred.user);
      const idToken = await cred.user.getIdToken();
      const json = await fetchJson('/api/auth/google-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      if (!json.ok || !json.data?.token) {
        throw new Error(json.error || 'Gagal memverifikasi akun Google Admin.');
      }
      await masukSesi(json.data.token, json.data.role);
      try {
        const cloudData = await loadWorkspaceFromFirestore(cred.user.uid);
        if (cloudData) {
          await callRaw('api_syncFromFirestore', json.data.token, cloudData);
          const refreshed = await callRaw('api_load', json.data.token, true);
          setDb(refreshed);
          setK(refreshed.Kelas?.[0]?.ID || '');
          showToast('Data workspace dimuat dari Firebase Firestore');
        } else {
          const initial = await callRaw('api_load', json.data.token);
          await syncAllToFirestore(initial, cred.user.uid);
          showToast('Database Firestore disiapkan & disinkronkan');
        }
      } catch (syncErr: any) {
        console.warn('Firestore initial sync warning:', syncErr);
      }
    } catch (err: any) {
      setLoginErr(pesanErr(err));
    } finally {
      setGoogleAuthBusy(false);
    }
  }

  async function handleSendEmailOtp() {
    setForgotOk(false);
    const u = forgotUser.trim();
    const em = forgotEmail.trim();
    if (!u || !em) {
      setForgotMsg('Masukkan Nama Pengguna dan Email Pemulihan Admin terlebih dahulu.');
      return;
    }
    setForgotMsg('Memverifikasi email & mengirim kode pemulihan…');
    try {
      const r = await callRaw('api_kirimKodePemulihan', u, em);
      setForgotOtpSent(true);
      setForgotOtpPreview(r.kodePreview || '');
      setForgotOk(true);
      setForgotMsg(r.pesan || 'Kode pemulihan berhasil diterbitkan.');
    } catch (err: any) {
      setForgotOtpSent(false);
      setForgotOtpPreview('');
      setForgotOk(false);
      setForgotMsg(pesanErr(err));
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotOk(false);
    const u = forgotUser.trim();
    const v = forgotVerif.trim();
    const p1 = forgotPass;
    const p2 = forgotPass2;
    if (!u || !v || !p1) {
      setForgotMsg('Lengkapi nama pengguna, kode OTP / pemulihan, dan kata sandi baru.');
      return;
    }
    if (p1 !== p2) {
      setForgotMsg('Konfirmasi kata sandi baru tidak sama.');
      return;
    }
    setForgotMsg('Memproses pengaturan ulang…');
    try {
      const r = await callRaw('api_lupaSandi', loginMode, u, v, p1);
      setForgotOk(true);
      setForgotMsg(r.pesan || 'Kata sandi berhasil diatur ulang.');
      setLoginUser(u);
      setLoginPass('');
      setForgotPass('');
      setForgotPass2('');
      setForgotVerif('');
      setForgotOtpSent(false);
      setForgotOtpPreview('');
    } catch (err: any) {
      setForgotOk(false);
      setForgotMsg(pesanErr(err));
    }
  }

  async function handleLogout() {
    try {
      if (token) await callRaw('api_logout', token);
    } catch (_) {}
    setToken('');
    setRole('');
    setPortal(null);
    simpanTokenStorage('', '');
    setLoginPass('');
    try {
      const st = await callRaw('api_status');
      setPublicInfo({
        sekolah: st.sekolah || 'SMA Negeri 1 Nusantara',
        logo: st.logo || '',
        jurusan: st.jurusan || '',
        jurusanLogos: st.jurusanLogos || '{}',
        waInfo: st.waInfo || '',
        emailHint: st.emailHint || ''
      });
    } catch (_) {}
  }

  async function prosesLogoGambar(file: File, maxDim = 240): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Pilih berkas gambar (PNG, JPG, WebP, atau SVG)');
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
      reader.onload = () => {
        const raw = String(reader.result || '');
        if (file.type === 'image/svg+xml' || raw.length < 60000) {
          resolve(raw);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(raw);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(raw);
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }

  function bukaEditorBrandingLogin() {
    setBrandLogoDraft(publicInfo.logo || '');
    setBrandSekolahDraft(publicInfo.sekolah || 'SMA Negeri 1 Nusantara');
    const list = String(publicInfo.jurusan || 'MIPA, IPS, Bahasa')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
    const logos = parseJurusanLogos(publicInfo.jurusanLogos);
    const items = (list.length ? list : ['MIPA', 'IPS', 'Bahasa']).map(name => ({
      name,
      logo: logos[name] || ''
    }));
    setBrandJurusanItems(items);
    setBrandNewJurusan('');
    setBrandMsg('');
    setLoginBrandEdit(true);
  }

  async function simpanBrandingLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const pending = brandNewJurusan.trim();
    const combined = pending
      ? [...brandJurusanItems, { name: pending, logo: '' }]
      : [...brandJurusanItems];
    const seen = new Set<string>();
    const cleanedNames: string[] = [];
    const logoMap: Record<string, string> = {};
    combined.forEach(item => {
      const nm = item.name.trim();
      if (!nm) return;
      if (!seen.has(nm)) {
        seen.add(nm);
        cleanedNames.push(nm);
      }
      if (item.logo && !logoMap[nm]) {
        logoMap[nm] = item.logo;
      }
    });
    if (!cleanedNames.length) {
      setBrandMsg('Minimal masukkan 1 nama jurusan.');
      return;
    }
    setBrandSaving(true);
    setBrandMsg('');
    try {
      const res = await callRaw(
        'api_updateLoginBranding',
        brandLogoDraft,
        cleanedNames.join(', '),
        brandSekolahDraft.trim(),
        JSON.stringify(logoMap)
      );
      setPublicInfo(p => ({
        ...p,
        sekolah: res.sekolah || p.sekolah,
        logo: res.logo || '',
        jurusan: res.jurusan || '',
        jurusanLogos: res.jurusanLogos || '{}'
      }));
      setLoginBrandEdit(false);
      setBrandNewJurusan('');
      showToast('Logo sekolah, logo jurusan & daftar jurusan berhasil diperbarui');
    } catch (err: any) {
      setBrandMsg(pesanErr(err));
    } finally {
      setBrandSaving(false);
    }
  }

  async function muatUlang() {
    if (role === 'siswa') {
      try {
        const pData = await apiCall('api_loadSiswa');
        setPortal(pData);
        showToast('Data berhasil dimuat ulang');
      } catch (e: any) {
        showToast(pesanErr(e), 4000);
      }
      return;
    }
    try {
      showToast('Memuat ulang data…', 8000);
      const baru = await apiCall('api_load', true);
      setDb(baru);
      setPeran(baru.peran || 'admin');
      if (!baru.Kelas.some((x: any) => x.ID === K)) {
        setK(baru.Kelas[0]?.ID || '');
      }
      showToast('Data berhasil dimuat ulang');
    } catch (e: any) {
      showToast('Gagal: ' + pesanErr(e), 4000);
    }
  }

  async function persistSheets(
    nextDb: Record<string, any>,
    ...sheetNames: string[]
  ): Promise<boolean> {
    try {
      setDb(nextDb);
      showToast('Menyimpan perubahan…', 6000);
      for (const n of sheetNames) {
        await apiCall('api_saveSheet', n, nextDb[n]);
      }
      if (firebaseUser?.emailVerified && peran === 'admin') {
        for (const n of sheetNames) {
          const payload =
            n === 'Siswa' && nextDb.pinHashes && typeof nextDb.pinHashes === 'object'
              ? (nextDb[n] || []).map((s: any) => ({
                  ...s,
                  PinHash: s.PinHash || nextDb.pinHashes[s.ID] || ''
                }))
              : nextDb[n];
          await syncSheetToFirestore(n, payload, firebaseUser.uid);
        }
      }
      showToast('Perubahan tersimpan');
      return true;
    } catch (e: any) {
      showToast('Gagal menyimpan: ' + pesanErr(e), 5000);
      return false;
    }
  }

  const syncKaldikJabar = useCallback(
    async (opts: { tahunAjaran: string; autoSync: boolean; useAi?: boolean; silent?: boolean }) => {
      if (!token || role === 'siswa') return;
      try {
        const json = await fetchJson('/api/kaldik/sync-jabar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            tahunAjaran: opts.tahunAjaran,
            useAi: !!opts.useAi
          })
        });
        if (!json.ok) throw new Error(json.error || 'Gagal menyinkronkan Kaldik Jawa Barat.');
        const { akademik, pengaturan, addedCount, sourceNote } = json.data;
        setDb(prev => ({
          ...prev,
          Akademik: akademik,
          Pengaturan: pengaturan
        }));
        if (firebaseUser?.emailVerified && peran === 'admin') {
          await syncSheetToFirestore('Akademik', akademik, firebaseUser.uid);
          await syncPengaturanToFirestore(pengaturan, firebaseUser.uid);
        }
        if (!opts.silent) {
          showToast(
            `Kalender Pendidikan Jabar diperbarui (${addedCount} agenda · ${sourceNote})`,
            4500
          );
        }
      } catch (err: any) {
        if (!opts.silent) {
          showToast('Gagal update Kaldik Jabar: ' + pesanErr(err), 4500);
        }
      }
    },
    [token, role, firebaseUser, peran, showToast]
  );

  // Auto-update Kalender Pendidikan Jawa Barat saat sesi dimulai jika aktif & perlu pembaruan
  useEffect(() => {
    if (!token || role === 'siswa' || !db.Pengaturan) return;
    if (kaldikAutoCheckedRef.current) return;
    kaldikAutoCheckedRef.current = true;

    const autoOn = db.Pengaturan.kaldikAutoSync !== '0';
    if (!autoOn) return;
    const ta = db.Pengaturan.kaldikTahunAjaran || '2026/2027';
    const hasJabar = (db.Akademik || []).some(
      (a: any) => String(a.ID).startsWith('jabar_') || String(a.Sumber || '').includes('Jabar')
    );
    const lastSyncStr = String(db.Pengaturan.kaldikLastSync || '');
    const lastMs = lastSyncStr ? new Date(lastSyncStr.replace(' ', 'T')).getTime() : 0;
    const stale = !lastMs || Number.isNaN(lastMs) || Date.now() - lastMs > 7 * 86400000;
    if (!hasJabar || stale) {
      syncKaldikJabar({ tahunAjaran: ta, autoSync: true, silent: true });
    }
  }, [token, role, db.Pengaturan, db.Akademik, syncKaldikJabar]);

  async function toggleKaldikAutoSync(enabled: boolean, tahunAjaran: string) {
    const baru = {
      ...S,
      kaldikAutoSync: enabled ? '1' : '0',
      kaldikTahunAjaran: tahunAjaran,
      kaldikWilayah: 'Provinsi Jawa Barat'
    };
    await apiCall('api_savePengaturan', baru);
    setDb(prev => ({ ...prev, Pengaturan: baru }));
    if (firebaseUser?.emailVerified && peran === 'admin') {
      await syncPengaturanToFirestore(baru, firebaseUser.uid);
    }
    showToast(
      enabled
        ? 'Update otomatis Kalender Pendidikan Jabar diaktifkan'
        : 'Update otomatis Kalender Pendidikan Jabar dinonaktifkan'
    );
  }

  async function connectGoogleFirestore() {
    setGoogleAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!cred.user.emailVerified) {
        throw new Error('Akun Google harus memiliki email yang terverifikasi.');
      }
      await ensureUserProfileInFirestore(cred.user);
      const existing = await loadWorkspaceFromFirestore(cred.user.uid);
      if (!existing) {
        await syncAllToFirestore(db, cred.user.uid);
        showToast('Akun Google terhubung & database Firestore disiapkan!');
      } else {
        showToast('Akun Google terhubung ke Firestore! Klik Muat/Simpan untuk sinkronisasi.');
      }
    } catch (err: any) {
      showToast('Gagal menghubungkan Google: ' + pesanErr(err), 4500);
    } finally {
      setGoogleAuthBusy(false);
    }
  }

  async function disconnectGoogleFirestore() {
    await signOut(auth);
    showToast('Koneksi akun Google Firestore diputuskan');
  }

  async function pushToFirestore() {
    if (!firebaseUser?.emailVerified) {
      showToast('Hubungkan akun Google terverifikasi terlebih dahulu.');
      return;
    }
    showToast('Menyimpan seluruh data ke Firebase Firestore…', 8000);
    try {
      await syncAllToFirestore(db, firebaseUser.uid);
      showToast('Seluruh data berhasil disinkronkan ke Firestore');
    } catch (err: any) {
      showToast('Gagal menyimpan ke Firestore: ' + pesanErr(err), 4500);
    }
  }

  async function pullFromFirestore() {
    if (!firebaseUser?.emailVerified) {
      showToast('Hubungkan akun Google terverifikasi terlebih dahulu.');
      return;
    }
    showToast('Memuat data dari Firebase Firestore…', 8000);
    try {
      const cloudData = await loadWorkspaceFromFirestore(firebaseUser.uid);
      if (!cloudData) {
        showToast('Database Firestore masih kosong. Simpan data lokal ke Firestore terlebih dahulu.');
        return;
      }
      await apiCall('api_syncFromFirestore', cloudData);
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      setK(fresh.Kelas?.[0]?.ID || '');
      const st = await callRaw('api_status');
      setPublicInfo({
        sekolah: st.sekolah || 'SMA Negeri 1 Nusantara',
        logo: st.logo || '',
        jurusan: st.jurusan || '',
        jurusanLogos: st.jurusanLogos || '{}',
        waInfo: st.waInfo || '',
        emailHint: st.emailHint || ''
      });
      showToast('Data berhasil dimuat dari Firebase Firestore');
    } catch (err: any) {
      showToast('Gagal memuat dari Firestore: ' + pesanErr(err), 4500);
    }
  }

  async function handleResetAllData(opts: {
    resetKelas: boolean;
    resetMapel: boolean;
    resetPengguna: boolean;
    resetPengaturan: boolean;
  }) {
    showToast('Mereset seluruh data aplikasi…', 8000);
    try {
      await apiCall('api_resetAllData', opts);
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      setK(fresh.Kelas?.[0]?.ID || '');
      if (opts.resetPengaturan) {
        const st = await callRaw('api_status');
        setPublicInfo({
          sekolah: st.sekolah || 'SMA Negeri 1 Nusantara',
          logo: st.logo || '',
          jurusan: st.jurusan || '',
          jurusanLogos: st.jurusanLogos || '{}',
          waInfo: st.waInfo || '',
          emailHint: st.emailHint || ''
        });
      }
      if (firebaseUser?.emailVerified && peran === 'admin') {
        await syncAllToFirestore(fresh, firebaseUser.uid);
      }
      showToast('Seluruh data berhasil direset ke kondisi kosong');
    } catch (err: any) {
      showToast('Gagal mereset data: ' + pesanErr(err), 4500);
    }
  }

  async function handleResetPartial(category: string, label: string) {
    showToast(`Mengosongkan kategori ${label}…`, 6000);
    try {
      const targets: string[] = await apiCall('api_resetPartial', category);
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      if (firebaseUser?.emailVerified && peran === 'admin' && Array.isArray(targets)) {
        for (const sheetName of targets) {
          if (sheetName !== 'Akun') {
            await syncSheetToFirestore(sheetName, fresh[sheetName] || [], firebaseUser.uid);
          }
        }
      }
      showToast(`Kategori "${label}" berhasil dikosongkan`);
    } catch (err: any) {
      showToast('Gagal reset parsial: ' + pesanErr(err), 4500);
    }
  }

  async function handleResetDemoData() {
    showToast('Mengembalikan data pratinjau awal…', 8000);
    try {
      await apiCall('api_resetDemo');
      const fresh = await apiCall('api_load', true);
      setDb(fresh);
      setK(fresh.Kelas?.[0]?.ID || '');
      const st = await callRaw('api_status');
      setPublicInfo({
        sekolah: st.sekolah || 'SMA Negeri 1 Nusantara',
        logo: st.logo || '',
        jurusan: st.jurusan || '',
        jurusanLogos: st.jurusanLogos || '{}',
        waInfo: st.waInfo || '',
        emailHint: st.emailHint || ''
      });
      if (firebaseUser?.emailVerified && peran === 'admin') {
        await syncAllToFirestore(fresh, firebaseUser.uid);
      }
      showToast('Basis data berhasil dikembalikan ke kondisi awal');
    } catch (err: any) {
      showToast('Gagal mengembalikan data demo: ' + pesanErr(err), 4500);
    }
  }

  // Derived Helpers
  const S = db.Pengaturan || {};
  const kelasObj = (db.Kelas || []).find((k: any) => k.ID === K) || {};
  const activeJurusanLogos = parseJurusanLogos(S.jurusanLogos);
  const activeJurusanLogo = kelasObj.Jurusan ? activeJurusanLogos[kelasObj.Jurusan] || '' : '';
  const siswaK = (db.Siswa || [])
    .filter((s: any) => s.Kelas === K)
    .sort((a: any, b: any) => a.Nama.localeCompare(b.Nama));
  const namaSiswa = (id: string) =>
    (db.Siswa || []).find((s: any) => s.ID === id)?.Nama || '(dihapus)';
  const absK = (db.Absensi || []).filter((a: any) => a.Kelas === K);
  const tanggalK: string[] = Array.from(new Set<string>(absK.map((a: any) => String(a.Tanggal)))).sort();
  const tugasK = (db.Tugas || [])
    .filter((t: any) => t.Kelas === K)
    .sort((a: any, b: any) => (a.Tenggat || '').localeCompare(b.Tenggat || ''));
  const bobot = ['b_sikap', 'b_tugas', 'b_proyek', 'b_uts', 'b_uas'].map(
    k => num(S[k]) || 0
  );
  const kkmVal = num(S.kkm) || 70;

  function absStat(sid: string) {
    const c: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, T: 0, D: 0 };
    absK
      .filter((a: any) => a.SiswaID === sid)
      .forEach((r: any) => {
        if (c[r.Kode] != null) c[r.Kode]++;
      });
    const total = tanggalK.length;
    const hadir = c.H + c.T + c.D;
    return {
      H: c.H,
      S: c.S,
      I: c.I,
      A: c.A,
      T: c.T,
      D: c.D,
      total,
      hadir,
      pct: total ? (hadir / total) * 100 : null
    };
  }

  function getNilaiRow(sid: string) {
    return (db.Nilai || []).find((n: any) => n.Kelas === K && n.SiswaID === sid);
  }

  function hitungAkhir(r: any): number | null {
    if (!r) return null;
    let tot = 0;
    let ada = false;
    ['Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'].forEach((k, i) => {
      const v = num(r[k]);
      if (v != null) {
        ada = true;
        tot += (v * bobot[i]) / 100;
      }
    });
    return ada ? tot : null;
  }

  function getPredikat(n: number | null): [string, string, string] {
    if (n == null) return ['-', '', 'bg-slate-100 text-slate-600'];
    if (n >= 90) return ['A', 'Sangat Baik', 'bg-emerald-100 text-emerald-800'];
    if (n >= 80) return ['B', 'Baik', 'bg-blue-100 text-blue-800'];
    if (n >= kkmVal) return ['C', 'Cukup', 'bg-amber-100 text-amber-800'];
    return ['D', 'Perlu Bimbingan', 'bg-rose-100 text-rose-800'];
  }

  function getTindakLanjut(n: number | null): string {
    if (n == null) return '-';
    if (n < kkmVal) return 'Remedial';
    if (n >= 90) return 'Pengayaan';
    return 'Penguatan';
  }

  function tanggaLevel(a: number): number {
    return a >= 10 ? 4 : a >= 5 ? 3 : a >= 3 ? 2 : a >= 1 ? 1 : 0;
  }

  function mingguKe(): number | null {
    const m = S.mulai;
    if (!m) return null;
    const d = Math.floor((new Date(ymd(new Date())).getTime() - new Date(m).getTime()) / 86400000);
    return d < 0 ? 0 : Math.floor(d / 7) + 1;
  }

  function waliKelasNama(kelasId: string): string {
    const src = peran === 'admin' ? db.Pengguna || [] : db.GuruList || [];
    const n = src
      .filter((u: any) => String(u.KelasWali || '').split(',').includes(kelasId))
      .map((u: any) => u.Nama);
    return n.length ? n.join(', ') : S.wali || '';
  }

  const peranLabel = (p: string) =>
    String(p || '')
      .split(',')
      .filter(Boolean)
      .map(r => PERAN_NAMA[r] || r)
      .join(' + ');

  const tabOk = (id: string) =>
    peran === 'admin'
      ? id !== 'usr'
      : String(peran)
          .split(',')
          .some(r => (TAB_PERAN[r] || []).includes(id));

  const waliDi = (kId: string) => peran === 'admin' || (db.kelasWali || []).includes(kId);

  const hariIni = () => HARI[(new Date().getDay() + 6) % 7] || '';
  const pekanIni = () => {
    const m = mingguKe();
    return m ? (m % 2 ? 'A' : 'B') : '';
  };
  const tampilHariIni = (x: any) => !x.Pekan || !pekanIni() || x.Pekan === pekanIni();

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <div className="font-bold text-sm">Memuat Sistem Manajemen Kelas…</div>
        <div className="text-xs text-slate-500 mt-1">Menyiapkan basis data kelas otomatis</div>
      </div>
    );
  }

  // Login Screen
  if (!token) {
    const isAdm = loginMode === 'admin';
    const waInfoUrl = publicInfo.waInfo
      ? waLink(
          publicInfo.waInfo,
          `Halo Admin / Informasi ${publicInfo.sekolah}, saya memerlukan informasi terkait akses Sistem Manajemen Kelas.`
        )
      : '';

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-white/40 overflow-hidden shadow-2xl">
          <div className="h-2 rainbow-strip" />
          <div className="p-8 space-y-5">
            <div>
              <div className="flex items-start justify-between gap-2.5 text-indigo-700 font-bold text-sm mb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  {publicInfo.logo ? (
                    <img
                      src={publicInfo.logo}
                      alt={publicInfo.sekolah}
                      className="w-12 h-12 rounded-2xl object-contain bg-indigo-50 border border-indigo-100 p-1 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{publicInfo.sekolah}</div>
                    <div className="text-[11px] font-medium text-indigo-600 truncate">
                      {publicInfo.jurusan
                        ? `Jurusan: ${publicInfo.jurusan}`
                        : 'Sistem Manajemen Kelas Terpadu'}
                    </div>
                  </div>
                </div>
                {!loginBrandEdit && (
                  <button
                    type="button"
                    onClick={bukaEditorBrandingLogin}
                    title="Ganti Logo Sekolah & Jurusan"
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3" /> Logo & Jurusan
                  </button>
                )}
              </div>
              {publicInfo.jurusan && !loginBrandEdit && (() => {
                const jLogos = parseJurusanLogos(publicInfo.jurusanLogos);
                return (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {publicInfo.jurusan
                      .split(',')
                      .map(j => j.trim())
                      .filter(Boolean)
                      .map((j, idx) => (
                        <span
                          key={j + idx}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1.5"
                        >
                          {jLogos[j] && (
                            <img
                              src={jLogos[j]}
                              alt={`Logo ${j}`}
                              className="w-4 h-4 rounded object-contain bg-white border border-indigo-100 shrink-0"
                            />
                          )}
                          <span>{j}</span>
                        </span>
                      ))}
                  </div>
                );
              })()}
              <h1 className="text-2xl font-bold text-slate-900">
                {loginBrandEdit
                  ? 'Ganti Logo & Jurusan Sekolah'
                  : !adminAda
                  ? 'Buat Akun Admin Pertama'
                  : forgotMode
                  ? isAdm
                    ? 'Lupa Kata Sandi'
                    : 'Lupa PIN Siswa'
                  : 'Masuk ke Aplikasi'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {loginBrandEdit
                  ? 'Sesuaikan logo resmi sekolah, nama sekolah, dan daftar jurusan langsung dari halaman masuk.'
                  : forgotMode
                  ? isAdm
                    ? 'Verifikasi kepemilikan akun untuk mengatur ulang kata sandi Admin atau Guru/Wali Kelas.'
                    : 'Verifikasi NIS dan data siswa untuk mengatur ulang PIN Portal Siswa.'
                  : 'Kelola absensi, nilai, jadwal, denah duduk, perangkat ajar, dan portal siswa dalam satu ruang kerja.'}
              </p>
            </div>

            {loginBrandEdit ? (
              <form onSubmit={simpanBrandingLogin} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50/70 to-sky-50 border border-indigo-100 flex items-center gap-3.5">
                  {brandLogoDraft ? (
                    <img
                      src={brandLogoDraft}
                      alt="Pratinjau Logo"
                      className="w-16 h-16 rounded-2xl object-contain bg-white border border-indigo-200 p-1.5 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-sm shrink-0">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-xs font-bold text-slate-800">Logo Sekolah</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
                        <Upload className="w-3.5 h-3.5" /> Pilih / Ganti Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f) return;
                            try {
                              const dataUrl = await prosesLogoGambar(f);
                              setBrandLogoDraft(dataUrl);
                              setBrandMsg('');
                            } catch (err: any) {
                              setBrandMsg(pesanErr(err));
                            }
                          }}
                        />
                      </label>
                      {brandLogoDraft && (
                        <button
                          type="button"
                          onClick={() => setBrandLogoDraft('')}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl cursor-pointer"
                        >
                          Hapus Logo
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">Format PNG, JPG, WebP, atau SVG.</div>
                  </div>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Nama Sekolah
                  <input
                    type="text"
                    value={brandSekolahDraft}
                    onChange={e => setBrandSekolahDraft(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 Nusantara"
                    className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Daftar Jurusan & Logo Jurusan
                    </span>
                    <span className="text-[11px] font-medium text-indigo-600">
                      {brandJurusanItems.length} jurusan
                    </span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {brandJurusanItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded-xl border border-indigo-100 bg-indigo-50/30"
                      >
                        <label
                          title="Unggah / Ganti Logo Jurusan"
                          className="w-8 h-8 rounded-lg border border-indigo-200 bg-white flex items-center justify-center shrink-0 cursor-pointer hover:border-indigo-400 overflow-hidden"
                        >
                          {item.logo ? (
                            <img
                              src={item.logo}
                              alt={item.name || 'Logo Jurusan'}
                              className="w-full h-full object-contain p-0.5"
                            />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await prosesLogoGambar(f, 160);
                                setBrandJurusanItems(prev =>
                                  prev.map((x, i) => (i === idx ? { ...x, logo: dataUrl } : x))
                                );
                                setBrandMsg('');
                              } catch (err: any) {
                                setBrandMsg(pesanErr(err));
                              }
                            }}
                          />
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => {
                            const val = e.target.value;
                            setBrandJurusanItems(prev =>
                              prev.map((x, i) => (i === idx ? { ...x, name: val } : x))
                            );
                          }}
                          placeholder={`Nama Jurusan ${idx + 1}`}
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {item.logo && (
                          <button
                            type="button"
                            onClick={() =>
                              setBrandJurusanItems(prev =>
                                prev.map((x, i) => (i === idx ? { ...x, logo: '' } : x))
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Hapus logo jurusan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {brandJurusanItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBrandJurusanItems(prev => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Hapus jurusan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={brandNewJurusan}
                      onChange={e => setBrandNewJurusan(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = brandNewJurusan.trim();
                          if (val && !brandJurusanItems.some(x => x.name.trim() === val)) {
                            setBrandJurusanItems(prev => [...prev, { name: val, logo: '' }]);
                            setBrandNewJurusan('');
                          }
                        }
                      }}
                      placeholder="Tambah jurusan baru (mis. TKJ, RPL)…"
                      className="flex-1 px-3 py-1.5 border border-emerald-200 bg-emerald-50/30 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = brandNewJurusan.trim();
                        if (!val) return;
                        if (!brandJurusanItems.some(x => x.name.trim() === val)) {
                          setBrandJurusanItems(prev => [...prev, { name: val, logo: '' }]);
                        }
                        setBrandNewJurusan('');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                </div>

                {brandMsg && (
                  <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {brandMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={brandSaving}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/25"
                  >
                    <Save className="w-4 h-4" />
                    {brandSaving ? 'Menyimpan…' : 'Simpan Logo & Jurusan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginBrandEdit(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <>
            {adminAda && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-indigo-50 border border-indigo-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('admin');
                    setLoginErr('');
                    setForgotMsg('');
                    setForgotOk(false);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isAdm
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                      : 'text-indigo-700 hover:text-indigo-950'
                  }`}
                >
                  Guru / Wali / Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('siswa');
                    setLoginErr('');
                    setForgotMsg('');
                    setForgotOk(false);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    !isAdm
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-sm'
                      : 'text-indigo-700 hover:text-indigo-950'
                  }`}
                >
                  Portal Siswa
                </button>
              </div>
            )}

            {forgotMode && adminAda ? (
              isAdm ? (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Pemulihan Kata Sandi Admin via Email
                    </div>
                    <p className="text-[11px] text-indigo-700">
                      Masukkan username dan Email Pemulihan Admin{publicInfo.emailHint ? ` (${publicInfo.emailHint})` : ''} untuk mendapatkan kode verifikasi 6 digit, atau gunakan Kode Pemulihan Sekolah.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Pengguna (Username)
                      <input
                        type="text"
                        value={forgotUser}
                        onChange={e => setForgotUser(e.target.value)}
                        placeholder="contoh: admin atau ratna"
                        className="mt-1 w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="block text-xs font-semibold text-slate-700">
                      Email Pemulihan Admin
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="email-pemulihan@domain.com"
                        className="mt-1 w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    className="w-full py-2 px-3 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" /> Kirim Kode Verifikasi ke Email Pemulihan
                  </button>

                  {forgotOtpSent && forgotOtpPreview && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                      <div className="font-bold">Kode Verifikasi Email Diterbitkan:</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-extrabold tracking-widest text-emerald-700">
                          {forgotOtpPreview}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForgotVerif(forgotOtpPreview)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg cursor-pointer"
                        >
                          Isi Otomatis
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-slate-700">
                    Kode OTP Email (6 Digit) atau Kode Pemulihan Sekolah
                    <input
                      type="text"
                      value={forgotVerif}
                      onChange={e => setForgotVerif(e.target.value)}
                      placeholder="Masukkan 6 digit kode OTP email"
                      className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kata Sandi Baru (min. 8)
                      <PasswordField
                        value={forgotPass}
                        onChange={e => setForgotPass(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Ulangi Sandi Baru
                      <PasswordField
                        value={forgotPass2}
                        onChange={e => setForgotPass2(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1 w-full px-3.5 py-2 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  {forgotMsg && (
                    <div
                      className={`text-xs font-medium rounded-xl px-3 py-2 border ${
                        forgotOk
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          : 'text-rose-600 bg-rose-50 border-rose-200'
                      }`}
                    >
                      {forgotMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/25"
                  >
                    Simpan Kata Sandi Baru
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotMsg('');
                      setForgotOk(false);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Masuk
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-1.5">
                    <div className="font-bold text-sm text-sky-900">Lupa PIN Portal Siswa?</div>
                    <p className="text-sky-800 leading-relaxed">
                      Demi keamanan akun, reset PIN siswa dilakukan oleh <strong>Admin</strong> atau <strong>Wali Kelas</strong>. Isi NIS dan Nama Lengkap Anda di bawah, lalu hubungi Admin melalui WhatsApp untuk mendapatkan PIN baru.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      NIS / NISN Siswa
                      <input
                        type="text"
                        value={forgotSiswaNis}
                        onChange={e => setForgotSiswaNis(e.target.value)}
                        placeholder="Contoh: 102601"
                        className="mt-1 w-full px-3 py-2 border border-sky-200 rounded-xl text-xs font-mono"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Lengkap Siswa
                      <input
                        type="text"
                        value={forgotSiswaNama}
                        onChange={e => setForgotSiswaNama(e.target.value)}
                        placeholder="Contoh: Adinda Putri"
                        className="mt-1 w-full px-3 py-2 border border-sky-200 rounded-xl text-xs"
                      />
                    </label>
                  </div>

                  {publicInfo.waInfo ? (
                    <a
                      href={waLink(
                        publicInfo.waInfo,
                        `Halo Admin ${publicInfo.sekolah}, saya siswa atas nama ${forgotSiswaNama || '[Nama Siswa]'} (NIS: ${forgotSiswaNis || '[NIS]'}) lupa PIN login Portal Siswa. Mohon bantuan reset PIN akun saya. Terima kasih.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" /> Hubungi Admin via WhatsApp
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Silakan hubungi langsung Admin atau Wali Kelas di sekolah untuk mereset PIN Anda.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setForgotMsg('');
                      setForgotOk(false);
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Masuk
                  </button>
                </div>
              )
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <label className="block text-xs font-semibold text-slate-700">
                  {adminAda ? (isAdm ? 'Nama Pengguna' : 'NIS / NISN Siswa') : 'Nama Pengguna Admin'}
                  <input
                    type="text"
                    value={loginUser}
                    onChange={e => setLoginUser(e.target.value)}
                    placeholder={isAdm ? 'contoh: admin atau ratna' : 'contoh: 102601'}
                    className="mt-1.5 w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      {adminAda
                        ? isAdm
                          ? 'Kata Sandi'
                          : 'PIN Siswa (4–8 angka)'
                        : 'Kata Sandi (minimal 8 karakter)'}
                    </label>
                    {adminAda && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setForgotUser(loginUser);
                          setForgotMsg('');
                          setForgotOk(false);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-fuchsia-600 hover:underline cursor-pointer"
                      >
                        {isAdm ? 'Lupa Kata Sandi?' : 'Lupa PIN?'}
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <PasswordField
                      value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      placeholder={isAdm ? '••••••••' : '123456'}
                      className="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {!adminAda && (
                  <label className="block text-xs font-semibold text-slate-700">
                    Ulangi Kata Sandi
                    <div className="mt-1.5">
                      <PasswordField
                        value={loginPass2}
                        onChange={e => setLoginPass2(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </label>
                )}

                {loginErr && (
                  <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {loginErr}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/25"
                >
                  {adminAda ? 'Masuk Sekarang' : 'Buat Akun Admin'}
                </button>

                {adminAda && isAdm && (
                  <button
                    type="button"
                    disabled={googleAuthBusy}
                    onClick={loginWithGoogleAdmin}
                    className="w-full py-2.5 px-4 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                  >
                    <Database className="w-4 h-4 text-indigo-600" />
                    {googleAuthBusy
                      ? 'Menghubungkan Google Firestore…'
                      : 'Masuk dengan Google (Admin Firestore)'}
                  </button>
                )}
              </form>
            )}

            {waInfoUrl && (
              <a
                href={waInfoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-105 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi WhatsApp Informasi Sekolah
              </a>
            )}

            {adminAda && !forgotMode && (
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="text-[11px] font-semibold text-slate-500">
                  Akses Cepat Akun Pratinjau Otomatis (1-Klik):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => quickDemoLogin('admin', 'admin', 'admin12345')}
                    className="px-3 py-2 text-left rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50/60 hover:border-rose-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-rose-950">Admin Utama</div>
                    <div className="text-[11px] text-rose-700 font-mono">admin / admin12345</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickDemoLogin('admin', 'ratna', 'guru12345')}
                    className="px-3 py-2 text-left rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 hover:border-emerald-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-emerald-950">Wali & Guru Mapel</div>
                    <div className="text-[11px] text-emerald-700 font-mono">ratna / guru12345</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickDemoLogin('siswa', '102601', '123456')}
                    className="px-3 py-2 text-left rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50/60 hover:border-sky-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-sky-950">Siswa (Sekretaris)</div>
                    <div className="text-[11px] text-sky-700 font-mono">NIS 102601 / 123456</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickDemoLogin('siswa', '102602', '123456')}
                    className="px-3 py-2 text-left rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 hover:border-violet-300 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-violet-950">Siswa (Ketua Kelas)</div>
                    <div className="text-[11px] text-violet-700 font-mono">NIS 102602 / 123456</div>
                  </button>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>
    );
  }

  // Student Portal Mode
  if (role === 'siswa' && portal) {
    return (
      <>
        <StudentPortal
          token={token}
          portal={portal}
          apiCall={apiCall}
          onRefresh={muatUlang}
          onLogout={handleLogout}
          showToast={showToast}
        />
        {toastMsg && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg">
            {toastMsg}
          </div>
        )}
      </>
    );
  }

  // Print Header Component
  const PrintHeader = () => (
    <div className="hidden print:flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-300">
      <div className="flex items-center gap-4">
        {S.logo && (
          <img src={S.logo} alt={S.sekolah} className="w-12 h-12 object-contain shrink-0" />
        )}
        <div>
          <h2 className="text-xl font-bold">{S.sekolah}</h2>
          <div className="text-xs text-slate-600 mt-1">
            Kelas: {kelasObj.Nama} · Jurusan: {kelasObj.Jurusan || '-'} · Semester {S.semester}
          </div>
          <div className="text-xs text-slate-600">
            Guru: {S.guru} · Wali Kelas: {waliKelasNama(K)}
            {S.waInfo ? ` · WA Info: ${S.waInfo}` : ''}
          </div>
        </div>
      </div>
      {activeJurusanLogo && (
        <img
          src={activeJurusanLogo}
          alt={`Logo ${kelasObj.Jurusan}`}
          className="w-12 h-12 object-contain shrink-0"
        />
      )}
    </div>
  );

  // ================= VIEW SECTIONS =================

  // 1. DASBOR
  function renderDash() {
    const pcts = siswaK.map((s: any) => absStat(s.ID).pct).filter((x: any) => x != null) as number[];
    const rataAbs = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    const tIds = tugasK.map((t: any) => t.ID);
    const tepat = (db.Pengumpulan || []).filter(
      (p: any) => tIds.includes(p.TugasID) && p.Status === 'Tepat Waktu'
    ).length;
    const tepatPct =
      tIds.length && siswaK.length ? (tepat / (tIds.length * siswaK.length)) * 100 : null;
    const naList = siswaK
      .map((s: any) => hitungAkhir(getNilaiRow(s.ID)))
      .filter((x: any) => x != null) as number[];
    const naRata = naList.length ? naList.reduce((a, b) => a + b, 0) / naList.length : null;
    const mg = mingguKe();
    const fase = mg ? KALENDER.find(f => mg >= f[0] && mg <= f[1]) : null;
    const peringatan = siswaK
      .map((s: any) => ({ s, a: absStat(s.ID).A }))
      .filter((x: any) => x.a > 0)
      .sort((a: any, b: any) => b.a - a.a);
    const hr = hariIni();
    const jdHari = (db.Jadwal || [])
      .filter((x: any) => x.Kelas === K && x.Hari === hr && tampilHariIni(x))
      .sort((a: any, b: any) => (a.Mulai || '').localeCompare(b.Mulai || ''));
    const pkHari = (db.Piket || []).filter((x: any) => x.Kelas === K && x.Hari === hr);

    return (
      <div className="space-y-6">
        {/* Colorful Hero Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-indigo-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {activeJurusanLogo && (
              <img
                src={activeJurusanLogo}
                alt={`Logo ${kelasObj.Jurusan}`}
                className="w-14 h-14 rounded-2xl object-contain bg-white/95 p-1 shadow-sm shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">Dasbor Kelas {kelasObj.Nama}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-sky-100 mt-1">
                <span>
                  {kelasObj.Jurusan
                    ? `Jurusan ${kelasObj.Jurusan}`
                    : kelasObj.Mapel || 'Atur jurusan kelas di Pengaturan'}
                </span>
                {mg !== null && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-white">
                      {mg === 0 ? 'Semester belum dimulai' : `Minggu ke-${mg}`}
                    </span>
                  </>
                )}
                {fase && (
                  <>
                    <span>·</span>
                    <span className="text-amber-200 font-semibold">{fase[2]}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWaBlastState({ open: true })}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Kirim WA Massal / Siswa
            </button>
            <button
              onClick={() => setTab('cld')}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" /> Cloud & Analisis AI
            </button>
            <button
              onClick={() => setTab('abs')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Catat Absensi
            </button>
          </div>
        </div>

        {/* 4 Colorful Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-sky-800">Total Siswa Aktif</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {siswaK.length}
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Wali Kelas: <span className="text-sky-900 font-semibold">{waliKelasNama(K) || '-'}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-800">Rata-rata Kehadiran</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {rataAbs == null ? '-' : `${fmt(rataAbs)}%`}
            </div>
            <div className="text-xs mt-2">
              {rataAbs != null ? (
                <span className={rataAbs >= 90 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {rataAbs >= 90 ? 'Target ≥ 90% tercapai' : 'Di bawah target 90%'}
                </span>
              ) : (
                <span className="text-slate-400">Belum ada data pertemuan</span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-amber-800">Ketepatan Tugas</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {tepatPct == null ? '-' : `${fmt(tepatPct)}%`}
            </div>
            <div className="text-xs mt-2">
              {tepatPct != null ? (
                <span className={tepatPct >= 90 ? 'text-emerald-700 font-semibold' : 'text-orange-700 font-semibold'}>
                  {tepatPct >= 90 ? 'Target ≥ 90% tercapai' : 'Perlu tindak lanjut tugas'}
                </span>
              ) : (
                <span className="text-slate-400">Belum ada tugas</span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-violet-800">Rata-rata Nilai Akhir</div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-xs">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
              {fmt(naRata)}
            </div>
            <div className="text-xs text-violet-700 font-medium mt-2 tabular-nums">
              Batas Ketuntasan (KKM): {kkmVal}
            </div>
          </div>
        </div>

        {/* 8-Stage Cycle & Absence Warnings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Siklus Manajemen 8 Tahap</h2>
              <p className="text-xs text-slate-500">Klik tahap untuk langsung membuka modul terkait</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TAHAP.map(t => (
                <button
                  key={t.n}
                  onClick={() => setTab(t.tab)}
                  style={{ backgroundColor: `${t.c}10`, borderColor: `${t.c}40` }}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:brightness-95 text-left transition-all cursor-pointer"
                >
                  <span
                    style={{ backgroundColor: t.c }}
                    className="w-8 h-8 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0 tabular-nums shadow-xs"
                  >
                    0{t.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{t.t}</div>
                    <div className="text-[11px] text-slate-600 truncate">{t.w}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tindak Lanjut Ketidakhadiran (Alpa)
              </h2>
              <p className="text-xs text-slate-500">
                Deteksi dini siswa dengan akumulasi ketidakhadiran tanpa keterangan
              </p>
            </div>
            {peringatan.length ? (
              <div className="space-y-2.5">
                {peringatan.map((x: any) => {
                  const l = tanggaLevel(x.a);
                  return (
                    <div
                      key={x.s.ID}
                      className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50/70 border border-amber-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          style={{ backgroundColor: LEVEL[l][2] }}
                          className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-white shrink-0 shadow-xs"
                        >
                          Tahap {l}
                        </span>
                        <div className="text-xs">
                          <div className="font-bold text-slate-900">
                            {x.s.Nama} · <span className="tabular-nums text-rose-600">{x.a} hari alpa</span>
                          </div>
                          <div className="text-slate-600 mt-0.5">{TANGGA[l]}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {(x.s.NoSiswa || x.s.KontakOrtu) && (
                          <a
                            href={waLink(
                              x.s.NoSiswa || x.s.KontakOrtu,
                              `Halo ${x.s.Nama} (Kelas ${kelasObj.Nama}). Kami menginformasikan bahwa kamu tercatat ${x.a} hari tidak hadir tanpa keterangan (Alpa). Harap segera konfirmasi kepada Wali Kelas. Terima kasih.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <MessageCircle className="w-3 h-3" /> WA Siswa
                          </a>
                        )}
                        {x.s.NoOrtu && (
                          <a
                            href={waLink(
                              x.s.NoOrtu,
                              `Assalamu'alaikum Bapak/Ibu Wali Murid dari ${x.s.Nama} (Kelas ${kelasObj.Nama}). Kami menginformasikan bahwa ananda tercatat ${x.a} hari tidak hadir tanpa keterangan (Alpa). Mohon konfirmasi kepada Wali Kelas. Terima kasih.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <MessageCircle className="w-3 h-3" /> WA Ortu
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-xl border border-emerald-200 text-xs font-medium text-emerald-800">
                Seluruh siswa tertib hadir tanpa catatan alpa.
              </div>
            )}
          </div>
        </div>

        {/* Today's Schedule & Duty Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-orange-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Jadwal Pelajaran Hari Ini {hr ? `(${hr})` : ''}
              </h2>
              <button
                onClick={() => setTab('jad')}
                className="text-xs font-semibold text-orange-600 hover:text-orange-500"
              >
                Kelola Jadwal →
              </button>
            </div>
            {jdHari.length ? (
              <div className="space-y-2">
                {jdHari.map((x: any) => (
                  <div
                    key={x.ID}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                      x.Jenis === 'Istirahat'
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                        : 'bg-gradient-to-r from-sky-50/70 to-indigo-50/50 border-sky-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{x.Mapel}</div>
                      {x.Guru && <div className="text-[11px] text-slate-600">{x.Guru}</div>}
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-indigo-700">
                      {x.Mulai}–{x.Selesai}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {hr ? 'Belum ada jadwal tercatat untuk hari ini.' : 'Hari Minggu / libur.'}
              </p>
            )}
          </div>

          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Petugas Piket Hari Ini {hr ? `(${hr})` : ''}
              </h2>
              <button
                onClick={() => setTab('pik')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-500"
              >
                Atur Piket →
              </button>
            </div>
            {pkHari.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pkHari.map((p: any) => {
                  const nama = namaSiswa(p.SiswaID);
                  return (
                    <div
                      key={p.ID}
                      className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200 flex items-center gap-2.5"
                    >
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColorFor(nama)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                        {nama.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{nama}</div>
                        <div className="text-[11px] text-teal-700 truncate">{p.Tugas || '-'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {hr ? 'Belum ada petugas piket hari ini.' : 'Hari ini libur.'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. ABSENSI
  async function simpanAbsensiHarian() {
    const recs = siswaK
      .filter((s: any) => absDraft[s.ID])
      .map((s: any) => ({
        SiswaID: s.ID,
        Kode: absDraft[s.ID],
        Keterangan: absNote[s.ID] || ''
      }));
    try {
      showToast('Menyimpan absensi…', 6000);
      await apiCall('api_saveAbsensi', K, absDate, recs);
      const nextAbs = (db.Absensi || []).filter(
        (a: any) => !(a.Kelas === K && a.Tanggal === absDate)
      );
      recs.forEach((r: any) =>
        nextAbs.push({
          Kelas: K,
          Tanggal: absDate,
          SiswaID: r.SiswaID,
          Kode: r.Kode,
          Keterangan: r.Keterangan,
          Sumber: ''
        })
      );
      setDb({ ...db, Absensi: nextAbs });
      if (firebaseUser?.emailVerified && peran === 'admin') {
        await syncSheetToFirestore('Absensi', nextAbs, firebaseUser.uid);
      }
      showToast('Absensi harian tersimpan');
    } catch (e: any) {
      showToast('Gagal: ' + pesanErr(e), 4500);
    }
  }

  function renderAbs() {
    const adaSekretaris = absK.some(
      (a: any) => a.Tanggal === absDate && a.Sumber === 'sekretaris'
    );
    const terisiCount = siswaK.filter((s: any) => absDraft[s.ID]).length;

    if (absMode === 'rekap') {
      const [y, m] = rekapBulan.split('-').map(Number);
      const tglBulan = tanggalK.filter(t => t.slice(0, 7) === rekapBulan);
      const peta: Record<string, string> = {};
      absK.forEach((a: any) => {
        peta[`${a.SiswaID}|${a.Tanggal}`] = a.Kode;
      });
      const nmBulan = [
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
      ][m - 1];

      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Rekap Absensi Bulanan</h1>
              <p className="text-xs text-emerald-50 mt-1">
                Persentase kehadiran = jumlah hadir (H, T, D) dibagi total pertemuan ({tanggalK.length} pertemuan)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex p-1 bg-white/20 backdrop-blur-sm rounded-xl">
                <button
                  onClick={() => setAbsMode('input')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white/90 hover:text-white whitespace-nowrap cursor-pointer"
                >
                  Input Harian
                </button>
                <button
                  onClick={() => setAbsMode('rekap')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-teal-800 shadow-sm whitespace-nowrap cursor-pointer"
                >
                  Rekap Bulanan
                </button>
              </div>
              <input
                type="month"
                value={rekapBulan}
                onChange={e => setRekapBulan(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 border border-white/40 rounded-xl bg-white"
              />
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold bg-white text-teal-800 hover:bg-emerald-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak
              </button>
            </div>
          </div>

          <PrintHeader />

          <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Bulan {nmBulan} {y}
            </h2>
            {tglBulan.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <tr>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      {tglBulan.map(t => (
                        <th key={t} className="py-2.5 px-2 text-center tabular-nums">
                          {Number(t.slice(8))}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center">H</th>
                      <th className="py-2.5 px-2 text-center">S</th>
                      <th className="py-2.5 px-2 text-center">I</th>
                      <th className="py-2.5 px-2 text-center">A</th>
                      <th className="py-2.5 px-2 text-center">T</th>
                      <th className="py-2.5 px-2 text-center">D</th>
                      <th className="py-2.5 px-3 text-right">% Semester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {siswaK.map((s: any) => {
                      const st = absStat(s.ID);
                      return (
                        <tr key={s.ID} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {s.Nama}
                          </td>
                          {tglBulan.map(t => {
                            const kd = peta[`${s.ID}|${t}`] || '';
                            return (
                              <td key={t} className="py-2 px-1.5 text-center">
                                {kd ? (
                                  <span
                                    style={{ backgroundColor: KODE[kd]?.[1] || '#e2e8f0' }}
                                    className="inline-block w-6 py-0.5 rounded text-[11px] font-bold text-white"
                                  >
                                    {kd}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center tabular-nums">{st.H}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.S}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.I}</td>
                          <td className="py-2 px-2 text-center tabular-nums font-semibold text-rose-600">
                            {st.A}
                          </td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.T}</td>
                          <td className="py-2 px-2 text-center tabular-nums">{st.D}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                            {fmt(st.pct)}
                            {st.pct == null ? '' : '%'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada catatan absensi pada bulan ini.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Absensi Harian</h1>
            <p className="text-xs text-emerald-50 mt-1">
              Catat dalam 5 menit pertama. Terlambat (T) dan Dispensasi (D) dihitung hadir.
            </p>
          </div>
          <div className="flex p-1 bg-white/20 backdrop-blur-sm rounded-xl">
            <button
              onClick={() => setAbsMode('input')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-teal-800 shadow-sm whitespace-nowrap cursor-pointer"
            >
              Input Harian
            </button>
            <button
              onClick={() => setAbsMode('rekap')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white/90 hover:text-white whitespace-nowrap cursor-pointer"
            >
              Rekap Bulanan
            </button>
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
          {adaSekretaris && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <strong>Diisi Sekretaris Kelas:</strong> Absensi tanggal ini diinput oleh sekretaris dan belum dikonfirmasi. Periksa lalu klik <strong>Simpan Absensi</strong> untuk mengonfirmasi.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                Tanggal:
                <input
                  type="date"
                  value={absDate}
                  onChange={e => setAbsDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs tabular-nums"
                />
              </label>
              <button
                onClick={() => {
                  const next: Record<string, string> = {};
                  siswaK.forEach((s: any) => (next[s.ID] = 'H'));
                  setAbsDraft(next);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Semua Hadir (H)
              </button>
              <button
                onClick={() => setAbsDraft({})}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Kosongkan
              </button>
              <span className="text-xs text-slate-500 tabular-nums ml-2">
                {terisiCount} / {siswaK.length} siswa terisi
              </span>
            </div>

            <button
              onClick={simpanAbsensiHarian}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Absensi
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
            {Object.keys(KODE).map(k => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: KODE[k][1] }}
                  className="w-5 h-5 rounded text-white font-bold text-[11px] flex items-center justify-center"
                >
                  {k}
                </span>
                <span>{KODE[k][0]}</span>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3">Status Kehadiran</th>
                  <th className="py-2.5 px-3">Keterangan (Jam datang / Alasan / Bukti)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.map((s: any, i: number) => (
                  <tr key={s.ID} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 tabular-nums text-slate-400">{i + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{s.Nama}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {Object.keys(KODE).map(k => {
                          const on = absDraft[s.ID] === k;
                          return (
                            <button
                              key={k}
                              onClick={() =>
                                setAbsDraft(prev => ({
                                  ...prev,
                                  [s.ID]: prev[s.ID] === k ? '' : k
                                }))
                              }
                              title={KODE[k][0]}
                              style={
                                on
                                  ? {
                                      backgroundColor: KODE[k][1],
                                      borderColor: KODE[k][1],
                                      color: '#fff'
                                    }
                                  : {}
                              }
                              className={`w-8 h-8 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                                on
                                  ? ''
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {k}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={absNote[s.ID] || ''}
                        onChange={e =>
                          setAbsNote(prev => ({ ...prev, [s.ID]: e.target.value }))
                        }
                        placeholder="Catatan tambahan..."
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. SISWA
  function openModalSiswa(id?: string) {
    const s = (db.Siswa || []).find((x: any) => x.ID === id) || {};
    let nama = s.Nama || '';
    let nis = s.NIS || '';
    let noSiswa = s.NoSiswa || s.KontakOrtu || '';
    let noOrtu = s.NoOrtu || '';
    let alm = s.Alamat || '';
    let kes = s.Kesehatan || '';

    setModalContent({
      title: id ? 'Edit Data Siswa' : 'Tambah Siswa Baru',
      render: () => (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Nama Lengkap
            <input
              defaultValue={nama}
              onChange={e => (nama = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            NIS / NISN (Nama pengguna login siswa)
            <input
              defaultValue={nis}
              onChange={e => (nis = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              No. WA Siswa
              <input
                defaultValue={noSiswa}
                placeholder="0812..."
                onChange={e => (noSiswa = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              No. WA Orang Tua
              <input
                defaultValue={noOrtu}
                placeholder="0813..."
                onChange={e => (noOrtu = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Alamat Tempat Tinggal
            <input
              defaultValue={alm}
              onChange={e => (alm = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Catatan Kesehatan
            <input
              defaultValue={kes}
              onChange={e => (kes = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                if (!nama.trim()) return showToast('Nama siswa wajib diisi');
                const nisClean = nis.trim();
                if (
                  nisClean &&
                  (db.Siswa || []).some(
                    (x: any) =>
                      x.ID !== id && String(x.NIS).trim().toLowerCase() === nisClean.toLowerCase()
                  )
                ) {
                  return showToast('NIS sudah dipakai siswa lain');
                }
                const nextSiswa = [...(db.Siswa || [])];
                const idx = nextSiswa.findIndex(x => x.ID === id);
                if (idx >= 0) {
                  nextSiswa[idx] = {
                    ...nextSiswa[idx],
                    Nama: nama.trim(),
                    NIS: nisClean,
                    NoSiswa: noSiswa.trim(),
                    NoOrtu: noOrtu.trim(),
                    Alamat: alm.trim(),
                    Kesehatan: kes.trim()
                  };
                } else {
                  nextSiswa.push({
                    ID: uid(),
                    Kelas: K,
                    Nama: nama.trim(),
                    NIS: nisClean,
                    NoSiswa: noSiswa.trim(),
                    NoOrtu: noOrtu.trim(),
                    Alamat: alm.trim(),
                    Kesehatan: kes.trim()
                  });
                }
                setModalContent(null);
                await persistSheets({ ...db, Siswa: nextSiswa }, 'Siswa');
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Simpan
            </button>
          </div>
        </div>
      )
    });
  }

  function openModalImporSiswa() {
    let rawText = '';
    setModalContent({
      title: 'Impor Daftar Siswa',
      render: () => (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Satu siswa per baris. Format: <strong>Nama; NIS; No. WA Siswa; No. WA Orang Tua; Alamat</strong>. Bisa tempel langsung dari Excel/Sheets.
          </p>
          <textarea
            rows={6}
            placeholder="Andi Pratama; 102620; 08123456789; 08139876543; Jl. Melati No. 5"
            onChange={e => (rawText = e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                const lines = rawText
                  .split('\n')
                  .map(x => x.trim())
                  .filter(Boolean);
                if (!lines.length) return showToast('Isi data terlebih dahulu');
                const nextSiswa = [...(db.Siswa || [])];
                lines.forEach(line => {
                  const p = line.split(/;|\t/).map(x => x.trim());
                  if (p[0]) {
                    nextSiswa.push({
                      ID: uid(),
                      Kelas: K,
                      Nama: p[0],
                      NIS: p[1] || '',
                      NoSiswa: p[2] || '',
                      NoOrtu: p[3] || '',
                      Alamat: p[4] || '',
                      Kesehatan: 'Normal'
                    });
                  }
                });
                setModalContent(null);
                await persistSheets({ ...db, Siswa: nextSiswa }, 'Siswa');
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Impor Sekarang
            </button>
          </div>
        </div>
      )
    });
  }

  async function handleAturPin(sid: string, pinManual?: string) {
    try {
      const pin = await apiCall('api_setPIN', sid, pinManual || '');
      const punya = Array.from(new Set([...(db.punyaPIN || []), sid]));
      let nextHashes = db.pinHashes || {};
      try {
        nextHashes = await apiCall('api_getPinHashes');
      } catch (_) {}
      const nextDb: Record<string, any> = { ...db, punyaPIN: punya, pinHashes: nextHashes };
      setDb(nextDb);
      if (firebaseUser?.emailVerified && peran === 'admin') {
        const siswaPayload = (nextDb.Siswa || []).map((s: any) => ({
          ...s,
          PinHash: nextHashes[s.ID] || s.PinHash || ''
        }));
        syncSheetToFirestore('Siswa', siswaPayload, firebaseUser.uid).catch(err =>
          console.warn('Sync PIN hash ke Firestore gagal:', err)
        );
      }
      setModalContent({
        title: `PIN Login untuk ${namaSiswa(sid)}`,
        render: () => (
          <div className="space-y-4 text-center">
            <div className="py-4 bg-slate-100 rounded-xl font-mono text-3xl font-bold tracking-widest text-slate-900">
              {pin}
            </div>
            <p className="text-xs text-slate-500">
              Catat dan berikan PIN ini kepada siswa. Siswa masuk menggunakan NIS dan PIN ini.
            </p>
            <button
              onClick={() => setModalContent(null)}
              className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Selesai
            </button>
          </div>
        )
      });
    } catch (e: any) {
      showToast(pesanErr(e), 4000);
    }
  }

  async function handleBuatPinSemua(timpa: boolean, seragam = '', targetKelas = K) {
    try {
      const r = await apiCall('api_buatPINSemua', targetKelas, timpa, seragam);
      const punya = new Set(db.punyaPIN || []);
      (r.daftar || []).forEach((x: any) => punya.add(x.id));
      const nextHashes = r.pinHashes || db.pinHashes || {};
      const nextDb: Record<string, any> = { ...db, punyaPIN: Array.from(punya), pinHashes: nextHashes };
      setDb(nextDb);
      if (firebaseUser?.emailVerified && peran === 'admin') {
        const siswaPayload = (nextDb.Siswa || []).map((s: any) => ({
          ...s,
          PinHash: nextHashes[s.ID] || s.PinHash || ''
        }));
        syncSheetToFirestore('Siswa', siswaPayload, firebaseUser.uid).catch(err =>
          console.warn('Sync PIN massal ke Firestore gagal:', err)
        );
      }
      const teks = (r.daftar || [])
        .map((x: any) => `${x.nama}\t${x.nis}\t${x.pin}`)
        .join('\n');
      setModalContent({
        title: `PIN Siswa (${(r.daftar || []).length} siswa)`,
        render: () => (
          <div className="space-y-3">
            {seragam && r.daftar?.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between gap-2">
                <span>
                  PIN seragam diterapkan untuk <strong>{r.daftar.length}</strong> siswa:
                </span>
                <span className="font-mono font-bold text-sm tracking-widest">{seragam}</span>
              </div>
            )}
            {r.dilewati > 0 && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {r.dilewati} siswa dilewati karena belum memiliki NIS.
              </div>
            )}
            {r.daftar?.length ? (
              <>
                <p className="text-xs text-slate-500">
                  Salin daftar di bawah (Nama, NIS, PIN) untuk dibagikan kepada siswa:
                </p>
                <textarea
                  readOnly
                  rows={6}
                  value={teks}
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50"
                />
              </>
            ) : (
              <p className="text-xs text-slate-600">
                {timpa
                  ? 'Tidak ada siswa dengan NIS valid pada target yang dipilih.'
                  : 'Seluruh siswa pada target yang dipilih sudah memiliki PIN aktif.'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {r.daftar?.length > 0 && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(teks);
                    showToast('Tersalin ke papan klip');
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
                >
                  Salin Semua
                </button>
              )}
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        )
      });
    } catch (e: any) {
      showToast(pesanErr(e), 4000);
    }
  }

  function openModalPinSeragam() {
    const canAllClasses = peran === 'admin' || (db.kelasWali || []).length > 1;
    const PinSeragamForm = () => {
      const [pinVal, setPinVal] = useState('123456');
      const [timpaMode, setTimpaMode] = useState<'baru' | 'semua'>('semua');
      const [scopeKelas, setScopeKelas] = useState<'kelas' | 'semua_kelas'>('kelas');
      const [errPin, setErrPin] = useState('');
      const [busy, setBusy] = useState(false);

      const cleanPin = pinVal.trim();
      const targetList = (db.Siswa || []).filter((s: any) =>
        scopeKelas === 'semua_kelas'
          ? peran === 'admin' || (db.kelasWali || []).includes(s.Kelas)
          : s.Kelas === K
      );
      const affectedCount = targetList.filter((s: any) => {
        if (!String(s.NIS || '').trim()) return false;
        if (timpaMode === 'semua') return true;
        return !(db.punyaPIN || []).includes(s.ID);
      }).length;

      return (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!/^\d{4,8}$/.test(cleanPin)) {
              setErrPin('PIN seragam harus berupa 4–8 digit angka.');
              return;
            }
            setErrPin('');
            setBusy(true);
            try {
              await handleBuatPinSemua(
                timpaMode === 'semua',
                cleanPin,
                scopeKelas === 'semua_kelas' ? '__ALL__' : K
              );
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              PIN Seragam Baru (4–8 angka)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={pinVal}
                onChange={e => {
                  setPinVal(e.target.value.replace(/\D/g, '').slice(0, 8));
                  setErrPin('');
                }}
                placeholder="Contoh: 123456"
                className="flex-1 px-3 py-2 border border-indigo-200 rounded-xl font-mono text-base font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  setPinVal(String(100000 + Math.floor(Math.random() * 900000)));
                  setErrPin('');
                }}
                className="px-3 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl cursor-pointer whitespace-nowrap"
              >
                Acak 6 Digit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-500">Cepat:</span>
              {['123456', '202627', '000000'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setPinVal(preset);
                    setErrPin('');
                  }}
                  className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Target Siswa</div>
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="timpaMode"
                checked={timpaMode === 'semua'}
                onChange={() => setTimpaMode('semua')}
                className="mt-0.5"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  Semua siswa (timpa PIN lama jika sudah ada)
                </div>
                <div className="text-[11px] text-slate-500">
                  Seluruh siswa pada target kelas akan memakai PIN seragam yang sama ini.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="timpaMode"
                checked={timpaMode === 'baru'}
                onChange={() => setTimpaMode('baru')}
                className="mt-0.5"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  Hanya siswa yang belum punya PIN
                </div>
                <div className="text-[11px] text-slate-500">
                  Siswa yang sudah memiliki PIN aktif tidak diubah.
                </div>
              </div>
            </label>
          </div>

          {canAllClasses && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">Cakupan Kelas</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScopeKelas('kelas')}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    scopeKelas === 'kelas'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Kelas {kelasObj.Nama || 'Aktif'} Saja
                </button>
                <button
                  type="button"
                  onClick={() => setScopeKelas('semua_kelas')}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    scopeKelas === 'semua_kelas'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Semua Kelas Wali/Sekolah
                </button>
              </div>
            </div>
          )}

          <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Akan menerapkan PIN seragam <strong className="font-mono">{cleanPin || '…'}</strong> untuk{' '}
            <strong>{affectedCount}</strong> siswa ber-NIS. Siswa dapat mengganti PIN masing-masing setelah masuk Portal Siswa.
          </div>

          {errPin && (
            <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errPin}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {busy ? 'Menerapkan…' : 'Terapkan PIN Seragam'}
            </button>
          </div>
        </form>
      );
    };

    setModalContent({
      title: 'Buat PIN Baru Seragam',
      render: () => <PinSeragamForm />
    });
  }

  function renderSis() {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-md shadow-amber-500/15 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Siswa & Akses Portal</h1>
            <p className="text-xs text-amber-50 mt-1">
              Tahap 1: pastikan 100% data induk siswa, kontak orang tua, dan PIN portal siswa terverifikasi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWaBlastState({ open: true })}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Kirim WA Massal
            </button>
            <button
              onClick={() => openModalSiswa()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-orange-700 hover:bg-orange-50 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Siswa
            </button>
            <button
              onClick={openModalImporSiswa}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Impor Daftar
            </button>
            <button
              onClick={() => handleBuatPinSemua(false)}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Buat PIN Baru
            </button>
            <button
              onClick={openModalPinSeragam}
              className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Buat PIN Baru Seragam
            </button>
            <button
              onClick={async () => {
                if (await askConfirm('Reset PIN seluruh siswa di kelas ini menjadi PIN acak baru?')) {
                  handleBuatPinSemua(true);
                }
              }}
              className="px-3 py-2 text-xs font-semibold bg-rose-900/30 hover:bg-rose-900/50 text-white border border-white/20 rounded-xl cursor-pointer"
            >
              Reset Semua PIN
            </button>
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gradient-to-r from-amber-50 to-orange-50/70 border-b border-amber-100 text-amber-950">
                <tr>
                  <th className="py-3 px-4 w-10">#</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">No. WA Siswa</th>
                  <th className="py-3 px-4">No. WA Orang Tua</th>
                  <th className="py-3 px-4">Alamat</th>
                  <th className="py-3 px-4">Kesehatan</th>
                  <th className="py-3 px-4">Status PIN Portal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.map((s: any, i: number) => {
                  const hasPin = (db.punyaPIN || []).includes(s.ID);
                  const noSw = s.NoSiswa || s.KontakOrtu || '';
                  const noOrtu = s.NoOrtu || '';
                  return (
                    <tr key={s.ID} className="hover:bg-amber-50/30">
                      <td className="py-2.5 px-4 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarColorFor(s.Nama)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                            {s.Nama.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{s.Nama}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-indigo-700 font-medium">
                        {s.NIS || '-'}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums text-slate-600">
                        {noSw ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px]">{noSw}</span>
                            <button
                              type="button"
                              onClick={() => setWaBlastState({ open: true, studentId: s.ID, targetType: 'siswa' })}
                              title="Kirim WhatsApp ke Siswa"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-md whitespace-nowrap cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" /> WA
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums text-slate-600">
                        {noOrtu ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px]">{noOrtu}</span>
                            <button
                              type="button"
                              onClick={() => setWaBlastState({ open: true, studentId: s.ID, targetType: 'ortu' })}
                              title="Kirim WhatsApp ke Orang Tua"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md whitespace-nowrap cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" /> WA
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{s.Alamat || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-600">{s.Kesehatan || '-'}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            hasPin ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {hasPin ? 'PIN Aktif' : 'Belum ada PIN'}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <button
                          onClick={() => handleAturPin(s.ID)}
                          className="text-indigo-600 hover:underline font-semibold"
                        >
                          Reset PIN
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => openModalSiswa(s.ID)}
                          className="text-sky-600 hover:text-sky-800 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              await askConfirm(
                                `Hapus siswa "${s.Nama}" beserta seluruh absensi dan nilainya?`
                              )
                            ) {
                              const nextDb = {
                                ...db,
                                Siswa: db.Siswa.filter((x: any) => x.ID !== s.ID),
                                Absensi: db.Absensi.filter((x: any) => x.SiswaID !== s.ID),
                                Nilai: db.Nilai.filter((x: any) => x.SiswaID !== s.ID),
                                Pengumpulan: db.Pengumpulan.filter((x: any) => x.SiswaID !== s.ID),
                                Perilaku: db.Perilaku.filter((x: any) => x.SiswaID !== s.ID),
                                Denah: db.Denah.filter((x: any) => x.SiswaID !== s.ID),
                                Piket: db.Piket.filter((x: any) => x.SiswaID !== s.ID)
                              };
                              await persistSheets(
                                nextDb,
                                'Siswa',
                                'Absensi',
                                'Nilai',
                                'Pengumpulan',
                                'Perilaku',
                                'Denah',
                                'Piket'
                              );
                            }
                          }}
                          className="text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 4. DENAH TEMPAT DUDUK
  function renderDen() {
    const atur = (db.DenahAtur || []).find((x: any) => x.Kelas === K) || {
      Kelas: K,
      Baris: '4',
      Kolom: '4',
      Grup: '2'
    };
    const b = num(atur.Baris) || 4;
    const k = num(atur.Kolom) || 4;
    const g = num(atur.Grup) || 0;
    const denK = (db.Denah || []).filter((d: any) => d.Kelas === K);
    const kursiMap: Record<string, { Nama: string; SiswaID: string }> = {};
    denK.forEach((d: any) => {
      const s = (db.Siswa || []).find((x: any) => x.ID === d.SiswaID);
      if (s) kursiMap[`${d.Baris}-${d.Kolom}`] = { Nama: s.Nama, SiswaID: s.ID };
    });
    const dudukSet = new Set(denK.map((d: any) => d.SiswaID));
    const belumDuduk = siswaK.filter((s: any) => !dudukSet.has(s.ID));

    const handleKlikKursi = (r: number, col: number) => {
      const pos = `${r}-${col}`;
      const ada = denK.find(
        (d: any) => String(d.Baris) === String(r) && String(d.Kolom) === String(col)
      );
      let nextDenah = [...(db.Denah || [])];

      if (denPick) {
        nextDenah = nextDenah.filter(
          (d: any) =>
            !(
              d.Kelas === K &&
              (d.SiswaID === denPick ||
                (String(d.Baris) === String(r) && String(d.Kolom) === String(col)))
            )
        );
        nextDenah.push({ Kelas: K, Baris: String(r), Kolom: String(col), SiswaID: denPick });
        setDb({ ...db, Denah: nextDenah });
        setDenPick('');
        setDenDirty(true);
      } else if (denSel && denSel !== pos) {
        const [r0, c0] = denSel.split('-');
        const asal = nextDenah.find(
          (d: any) =>
            d.Kelas === K && String(d.Baris) === String(r0) && String(d.Kolom) === String(c0)
        );
        const tujuan = nextDenah.find(
          (d: any) =>
            d.Kelas === K && String(d.Baris) === String(r) && String(d.Kolom) === String(col)
        );
        if (asal && tujuan) {
          const tmp = asal.SiswaID;
          asal.SiswaID = tujuan.SiswaID;
          tujuan.SiswaID = tmp;
        } else if (asal) {
          asal.Baris = String(r);
          asal.Kolom = String(col);
        }
        setDb({ ...db, Denah: nextDenah });
        setDenSel('');
        setDenDirty(true);
      } else if (denSel === pos) {
        setDenSel('');
      } else if (ada) {
        setDenSel(pos);
      }
    };

    const susunOtomatis = (mode: 'abjad' | 'acak') => {
      if (siswaK.length > b * k) {
        return showToast(`Kursi kurang: ${siswaK.length} siswa untuk ${b * k} kursi`);
      }
      const list = mode === 'abjad' ? siswaK : acak(siswaK);
      const nextDenah = (db.Denah || []).filter((d: any) => d.Kelas !== K);
      list.forEach((s: any, idx: number) => {
        nextDenah.push({
          Kelas: K,
          Baris: String(Math.floor(idx / k) + 1),
          Kolom: String((idx % k) + 1),
          SiswaID: s.ID
        });
      });
      setDb({ ...db, Denah: nextDenah });
      setDenDirty(true);
      setDenSel('');
      setDenPick('');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Denah Tempat Duduk</h1>
            <p className="text-xs text-sky-50 mt-1">
              Klik siswa di daftar bawah lalu klik kursi, atau klik dua kursi untuk menukar posisi duduk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => susunOtomatis('abjad')}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Susun Abjad
            </button>
            <button
              onClick={() => susunOtomatis('acak')}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Susun Acak
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
            <button
              onClick={async () => {
                if (await persistSheets(db, 'Denah', 'DenahAtur')) {
                  setDenDirty(false);
                }
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-white text-sky-700 hover:bg-sky-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Denah {denDirty ? '*' : ''}
            </button>
          </div>
        </div>

        <PrintHeader />

        {/* Grid Size Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4 noprint">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Baris:
            <input
              type="number"
              min={1}
              max={10}
              value={b}
              onChange={e => {
                const val = String(Math.max(1, Math.min(10, Number(e.target.value) || 4)));
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Baris: val });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="w-16 px-2.5 py-1 border border-slate-300 rounded-lg text-xs tabular-nums"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Kolom:
            <input
              type="number"
              min={1}
              max={10}
              value={k}
              onChange={e => {
                const val = String(Math.max(1, Math.min(10, Number(e.target.value) || 4)));
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Kolom: val });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="w-16 px-2.5 py-1 border border-slate-300 rounded-lg text-xs tabular-nums"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
            Lorong:
            <select
              value={g}
              onChange={e => {
                const nextAtur = (db.DenahAtur || []).filter((x: any) => x.Kelas !== K);
                nextAtur.push({ ...atur, Kelas: K, Grup: e.target.value });
                setDb({ ...db, DenahAtur: nextAtur });
                setDenDirty(true);
              }}
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs"
            >
              <option value="0">Tanpa lorong</option>
              <option value="2">Tiap 2 kolom</option>
              <option value="3">Tiap 3 kolom</option>
              <option value="4">Tiap 4 kolom</option>
            </select>
          </label>
          {denSel && (
            <button
              onClick={() => {
                const [r0, c0] = denSel.split('-');
                const nextDenah = (db.Denah || []).filter(
                  (d: any) =>
                    !(
                      d.Kelas === K &&
                      String(d.Baris) === String(r0) &&
                      String(d.Kolom) === String(c0)
                    )
                );
                setDb({ ...db, Denah: nextDenah });
                setDenSel('');
                setDenDirty(true);
              }}
              className="px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg"
            >
              Kosongkan Kursi Terpilih
            </button>
          )}
        </div>

        {/* Seating Map */}
        <div className="bg-white border border-cyan-100 rounded-2xl p-6 overflow-x-auto shadow-sm">
          <div className="inline-block min-w-full">
            <div className="max-w-xl mx-auto bg-gradient-to-r from-emerald-800 to-teal-800 text-white text-center text-xs font-bold tracking-widest py-3 rounded-xl mb-6 shadow-md">
              PAPAN TULIS · MEJA GURU
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: b }, (_, rIdx) => {
                const r = rIdx + 1;
                return (
                  <div key={r} className="flex items-center justify-center gap-2.5">
                    {Array.from({ length: k }, (_, cIdx) => {
                      const col = cIdx + 1;
                      const pos = `${r}-${col}`;
                      const o = kursiMap[pos];
                      const selected = denSel === pos;
                      return (
                        <React.Fragment key={col}>
                          {g > 0 && col > 1 && (col - 1) % g === 0 && (
                            <div className="w-6 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleKlikKursi(r, col)}
                            className={`w-28 h-16 p-2 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center text-center leading-tight cursor-pointer ${
                              selected
                                ? 'border-fuchsia-600 ring-2 ring-fuchsia-500/30 bg-gradient-to-br from-fuchsia-50 to-indigo-50 text-fuchsia-950 shadow-sm'
                                : o
                                ? 'border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50/70 text-slate-900 hover:border-indigo-500 shadow-xs'
                                : 'border-dashed border-slate-200 bg-slate-50/50 text-slate-400 hover:border-cyan-400'
                            }`}
                          >
                            {o ? o.Nama : '+'}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unseated Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 noprint">
          <h3 className="text-xs font-bold text-slate-700 mb-3">
            Siswa Belum Mendapat Kursi ({belumDuduk.length})
          </h3>
          {belumDuduk.length ? (
            <div className="flex flex-wrap gap-2">
              {belumDuduk.map((s: any) => (
                <button
                  key={s.ID}
                  onClick={() => setDenPick(denPick === s.ID ? '' : s.ID)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    denPick === s.ID
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.Nama}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Seluruh siswa di kelas ini sudah mendapat kursi.</p>
          )}
        </div>
      </div>
    );
  }

  // 5. JADWAL PIKET
  function renderPik() {
    const piketK = (db.Piket || []).filter((p: any) => p.Kelas === K);
    const today = hariIni();

    const bagiPiketOtomatis = async () => {
      if (!siswaK.length) return showToast('Belum ada siswa di kelas ini');
      const nextPiket = (db.Piket || []).filter((p: any) => p.Kelas !== K);
      const hari5 = HARI.slice(0, 5);
      const cnt: Record<string, number> = {};
      acak(siswaK).forEach((s: any, i: number) => {
        const h = hari5[i % 5];
        cnt[h] = cnt[h] || 0;
        nextPiket.push({
          ID: uid(),
          Kelas: K,
          Hari: h,
          SiswaID: s.ID,
          Tugas: TUGAS_PIKET[cnt[h]++ % TUGAS_PIKET.length]
        });
      });
      await persistSheets({ ...db, Piket: nextPiket }, 'Piket');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-lime-500 via-emerald-500 to-teal-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Piket Kebersihan</h1>
            <p className="text-xs text-emerald-50 mt-1">
              Pembagian tanggung jawab harian kelas Senin sampai Jumat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={bagiPiketOtomatis}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              Bagi Otomatis (Senin–Jumat)
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
          </div>
        </div>

        <PrintHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HARI.slice(0, 5).map(h => {
            const ls = piketK.filter((p: any) => p.Hari === h);
            const dt = DAY_THEME[h] || DAY_THEME.Senin;
            return (
              <div
                key={h}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                  h === today ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                <div className={`px-5 py-3.5 bg-gradient-to-r ${dt.header} text-white flex items-center justify-between`}>
                  <h3 className="text-sm font-bold">
                    {h} {h === today && <span className="text-xs text-white/90 font-normal">· Hari ini</span>}
                  </h3>
                  <span className="text-xs text-white/90 tabular-nums">{ls.length} petugas</span>
                </div>
                <div className="p-4 space-y-2">
                  {ls.map((p: any) => (
                    <div
                      key={p.ID}
                      className={`p-2.5 rounded-xl border space-y-1.5 ${dt.card}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {namaSiswa(p.SiswaID)}
                        </span>
                        <button
                          onClick={async () => {
                            const next = db.Piket.filter((x: any) => x.ID !== p.ID);
                            await persistSheets({ ...db, Piket: next }, 'Piket');
                          }}
                          className="text-slate-400 hover:text-rose-600 text-xs noprint cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        defaultValue={p.Tugas}
                        placeholder="Tugas piket..."
                        onBlur={async e => {
                          if (e.target.value.trim() === p.Tugas) return;
                          const next = db.Piket.map((x: any) =>
                            x.ID === p.ID ? { ...x, Tugas: e.target.value.trim() } : x
                          );
                          await persistSheets({ ...db, Piket: next }, 'Piket');
                        }}
                        className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. STRUKTUR ORGANISASI
  function openModalStruktur(id?: string) {
    const x = (db.Struktur || []).find((s: any) => s.ID === id) || {};
    let jab = x.Jabatan || '';
    let sid = x.SiswaID || '';
    let lvl = x.Tingkat || '3';

    setModalContent({
      title: id ? 'Edit Jabatan Kelas' : 'Tambah Jabatan Kelas',
      render: () => (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Nama Jabatan
            <input
              defaultValue={jab}
              onChange={e => (jab = e.target.value)}
              placeholder="mis. Ketua Kelas / Sekretaris"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Siswa Terpilih
            <select
              defaultValue={sid}
              onChange={e => (sid = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">(Belum diisi)</option>
              {siswaK.map((s: any) => (
                <option key={s.ID} value={s.ID}>
                  {s.Nama}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Tingkat pada Bagan
            <select
              defaultValue={lvl}
              onChange={e => (lvl = e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {[1, 2, 3].map(t => (
                <option key={t} value={String(t)}>
                  {LVL_STR[t][0]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-between pt-3">
            {id ? (
              <button
                onClick={async () => {
                  setModalContent(null);
                  const next = db.Struktur.filter((s: any) => s.ID !== id);
                  await persistSheets({ ...db, Struktur: next }, 'Struktur');
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg"
              >
                Hapus Jabatan
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!jab.trim()) return showToast('Nama jabatan wajib diisi');
                  const next = [...(db.Struktur || [])];
                  const idx = next.findIndex(s => s.ID === id);
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], Jabatan: jab.trim(), SiswaID: sid, Tingkat: lvl };
                  } else {
                    next.push({
                      ID: uid(),
                      Kelas: K,
                      Jabatan: jab.trim(),
                      SiswaID: sid,
                      Tingkat: lvl
                    });
                  }
                  setModalContent(null);
                  await persistSheets({ ...db, Struktur: next }, 'Struktur');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )
    });
  }

  function renderStr() {
    const list = (db.Struktur || []).filter((s: any) => s.Kelas === K);
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Struktur Organisasi Kelas</h1>
            <p className="text-xs text-purple-100 mt-1">
              Klik kotak jabatan untuk menetapkan pengurus. Siswa yang menjabat <strong>Sekretaris</strong> otomatis mendapat akses input absensi kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModalStruktur()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-purple-700 hover:bg-purple-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Jabatan
            </button>
            <button
              onClick={async () => {
                const ada = new Set(list.map((s: any) => s.Jabatan.toLowerCase()));
                const baru = STRUKTUR_STD.filter(j => !ada.has(j[0].toLowerCase()));
                if (!baru.length) return showToast('Jabatan standar sudah lengkap');
                const next = [...(db.Struktur || [])];
                baru.forEach(j =>
                  next.push({
                    ID: uid(),
                    Kelas: K,
                    Jabatan: j[0],
                    SiswaID: '',
                    Tingkat: String(j[1])
                  })
                );
                await persistSheets({ ...db, Struktur: next }, 'Struktur');
              }}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Jabatan Standar
            </button>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div>
            <div className="inline-block px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-md shadow-indigo-500/20">
              <div className="text-[10px] uppercase tracking-wider text-indigo-100">Wali Kelas</div>
              <div className="text-sm font-bold mt-0.5">{waliKelasNama(K) || '—'}</div>
            </div>
          </div>

          {[1, 2, 3].map(lvl => {
            const items = list.filter((x: any) => String(x.Tingkat) === String(lvl));
            if (!items.length) return null;
            return (
              <div key={lvl} className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500">{LVL_STR[lvl][0]}</div>
                <div className="flex flex-wrap justify-center gap-3">
                  {items.map((x: any) => (
                    <button
                      key={x.ID}
                      onClick={() => openModalStruktur(x.ID)}
                      style={{ borderColor: LVL_STR[lvl][1], backgroundColor: `${LVL_STR[lvl][1]}0D` }}
                      className="px-5 py-3 rounded-xl border-2 hover:brightness-95 text-center min-w-[165px] transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="text-[11px] font-semibold" style={{ color: LVL_STR[lvl][1] }}>{x.Jabatan}</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {x.SiswaID ? namaSiswa(x.SiswaID) : '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 7. JADWAL PELAJARAN
  function openModalJadwal(id?: string, defaultHari = 'Senin') {
    const x = (db.Jadwal || []).find((j: any) => j.ID === id) || {};
    let hari = x.Hari || defaultHari;
    let mulai = x.Mulai || '07:00';
    let selesai = x.Selesai || '08:30';
    let mapel = x.Mapel || '';
    let guru = x.Guru || '';
    let jenis = x.Jenis || 'Pelajaran';
    let pekan = x.Pekan || '';

    setModalContent({
      title: id ? 'Edit Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran',
      render: () => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Hari
              <select
                defaultValue={hari}
                onChange={e => (hari = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {HARI.map(h => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Jenis Kegiatan
              <select
                defaultValue={jenis}
                onChange={e => (jenis = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option>Pelajaran</option>
                <option>Istirahat</option>
                <option>Kegiatan lain</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Jam Mulai
              <input
                type="time"
                defaultValue={mulai}
                onChange={e => (mulai = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Jam Selesai
              <input
                type="time"
                defaultValue={selesai}
                onChange={e => (selesai = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Mata Pelajaran / Kegiatan
            <input
              defaultValue={mapel}
              onChange={e => (mapel = e.target.value)}
              list="dl_mapel_modal"
              placeholder="Pilih atau ketik mata pelajaran"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <datalist id="dl_mapel_modal">
              {(db.Mapel || []).map((m: any) => (
                <option key={m.ID} value={m.Nama} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Nama Guru Pengampu
            <input
              defaultValue={guru}
              onChange={e => (guru = e.target.value)}
              placeholder="Nama guru..."
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <div className="flex justify-between pt-3">
            {id ? (
              <button
                onClick={async () => {
                  setModalContent(null);
                  const next = db.Jadwal.filter((j: any) => j.ID !== id);
                  await persistSheets({ ...db, Jadwal: next }, 'Jadwal');
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg"
              >
                Hapus
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!mapel.trim()) return showToast('Mata pelajaran wajib diisi');
                  const next = [...(db.Jadwal || [])];
                  const row = {
                    ID: id || uid(),
                    Kelas: K,
                    Hari: hari,
                    Mulai: mulai,
                    Selesai: selesai,
                    Mapel: mapel.trim(),
                    Guru: guru.trim(),
                    Jenis: jenis,
                    Pekan: pekan
                  };
                  const idx = next.findIndex(j => j.ID === id);
                  if (idx >= 0) next[idx] = row;
                  else next.push(row);
                  const prevJadwal = db.Jadwal;
                  setModalContent(null);
                  const ok = await persistSheets({ ...db, Jadwal: next }, 'Jadwal');
                  if (!ok) setDb(d => ({ ...d, Jadwal: prevJadwal }));
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )
    });
  }

  function renderJad() {
    const klsJadwal = (db.Jadwal || []).filter((x: any) => x.Kelas === K);
    const today = hariIni();

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jadwal Pelajaran</h1>
            <p className="text-xs text-orange-50 mt-1">
              Validasi anti-bentrok otomatis: mencegah tumpang tindih jam di kelas yang sama maupun guru yang sama lintas kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModalJadwal()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-orange-700 hover:bg-orange-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Jadwal
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
          </div>
        </div>

        <PrintHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HARI.slice(0, 5).map(h => {
            const ls = klsJadwal
              .filter((x: any) => x.Hari === h)
              .sort((a: any, b: any) => (a.Mulai || '').localeCompare(b.Mulai || ''));
            const dt = DAY_THEME[h] || DAY_THEME.Senin;
            return (
              <div
                key={h}
                className={`rounded-2xl border overflow-hidden shadow-xs ${dt.card} ${
                  h === today ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                <div className={`px-5 py-3 bg-gradient-to-r ${dt.header} text-white flex items-center justify-between`}>
                  <h3 className="text-sm font-bold">
                    {h} {h === today && <span className="text-xs text-amber-200">· Hari ini</span>}
                  </h3>
                  <button
                    onClick={() => openModalJadwal('', h)}
                    className="text-xs font-semibold text-white hover:underline noprint"
                  >
                    + Tambah
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {ls.length ? (
                    ls.map((x: any) => (
                      <div
                        key={x.ID}
                        onClick={() => openModalJadwal(x.ID)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          x.Jenis === 'Istirahat'
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                            : 'bg-white border-slate-200/80 hover:border-indigo-400 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{x.Mapel}</span>
                          <span className={`font-mono tabular-nums text-[11px] font-bold ${dt.accent}`}>
                            {x.Mulai}–{x.Selesai}
                          </span>
                        </div>
                        {x.Guru && <div className="text-[11px] text-slate-500 mt-0.5">{x.Guru}</div>}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Belum ada jadwal</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 8. PERANGKAT AJAR (TP, Modul Ajar, Slide Pemantik)
  function renderAjar() {
    const tpList = (db.TP || [])
      .filter((t: any) => t.Kelas === K)
      .sort((a: any, b: any) => a.Kode.localeCompare(b.Kode, undefined, { numeric: true }));
    const modList = (db.Modul || []).filter((m: any) => m.Kelas === K);
    const pemList = (db.Pemantik || []).filter((p: any) => p.Kelas === K);

    if (modView) {
      const m = modList.find((x: any) => x.ID === modView);
      if (m) {
        const tps = String(m.TPIDs || '')
          .split(',')
          .map(id => tpList.find((t: any) => t.ID === id))
          .filter(Boolean);
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 noprint">
              <button
                onClick={() => setModView('')}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
              >
                ← Kembali
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Modul Ajar
              </button>
            </div>
            <PrintHeader />
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Modul Ajar: {m.Judul}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  {m.Mapel} · Alokasi Waktu: {m.Alokasi || '-'} · Kelas {kelasObj.Nama}
                </p>
              </div>
              {tps.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Tujuan Pembelajaran
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-800">
                    {tps.map((t: any) => (
                      <li key={t.ID}>
                        <strong>{t.Kode}:</strong> {t.Tujuan}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {[
                ['Kegiatan Pembuka', m.Pembuka],
                ['Kegiatan Inti', m.Inti],
                ['Kegiatan Penutup', m.Penutup],
                ['Asesmen', m.Asesmen],
                ['Media & Sumber Belajar', m.Media],
                ['Catatan & Refleksi Guru', m.Catatan]
              ].map(([label, val]) =>
                val ? (
                  <div key={label}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {label}
                    </h3>
                    <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      {val}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        );
      }
    }

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Perangkat Ajar</h1>
            <p className="text-xs text-pink-50 mt-1">
              Tahap 3: kelola Tujuan Pembelajaran (TP), Modul Ajar / RPP, serta Slide Pemantik Interaktif.
            </p>
          </div>
          <div className="flex p-1 bg-white/20 backdrop-blur-sm rounded-xl">
            {[
              ['tp', 'Tujuan Pembelajaran'],
              ['mod', 'Modul Ajar / RPP'],
              ['pem', 'Slide Pemantik']
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAjarSub(id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  ajarSub === id
                    ? 'bg-white text-fuchsia-700 shadow-sm'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {ajarSub === 'tp' && (
          <div className="bg-white border border-pink-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 tabular-nums">
                {tpList.filter((t: any) => t.Status === 'Tercapai').length} dari {tpList.length} TP Tercapai
              </span>
              <button
                onClick={() => {
                  let kode = `TP ${tpList.length + 1}`;
                  let tujuan = '';
                  let materi = '';
                  setModalContent({
                    title: 'Tambah Tujuan Pembelajaran',
                    render: () => (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-700">
                          Kode TP
                          <input
                            defaultValue={kode}
                            onChange={e => (kode = e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Rumusan Tujuan Pembelajaran
                          <textarea
                            rows={3}
                            onChange={e => (tujuan = e.target.value)}
                            placeholder="Peserta didik mampu..."
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Materi Pokok
                          <input
                            onChange={e => (materi = e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setModalContent(null)}
                            className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg"
                          >
                            Batal
                          </button>
                          <button
                            onClick={async () => {
                              if (!tujuan.trim()) return showToast('Tujuan wajib diisi');
                              const next = [
                                ...(db.TP || []),
                                {
                                  ID: uid(),
                                  Kelas: K,
                                  Kode: kode.trim(),
                                  Tujuan: tujuan.trim(),
                                  Materi: materi.trim(),
                                  Status: 'Belum'
                                }
                              ];
                              setModalContent(null);
                              await persistSheets({ ...db, TP: next }, 'TP');
                            }}
                            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )
                  });
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                + Tambah Tujuan Pembelajaran
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3 w-24">Kode</th>
                    <th className="py-2.5 px-3">Tujuan Pembelajaran</th>
                    <th className="py-2.5 px-3">Materi Pokok</th>
                    <th className="py-2.5 px-3 w-36">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tpList.map((t: any) => (
                    <tr key={t.ID}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{t.Kode}</td>
                      <td className="py-2.5 px-3 text-slate-800">{t.Tujuan}</td>
                      <td className="py-2.5 px-3 text-slate-600">{t.Materi}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={t.Status}
                          onChange={async e => {
                            const next = db.TP.map((x: any) =>
                              x.ID === t.ID ? { ...x, Status: e.target.value } : x
                            );
                            await persistSheets({ ...db, TP: next }, 'TP');
                          }}
                          className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50"
                        >
                          {Object.keys(STATUS_TP).map(s => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={async () => {
                            const next = db.TP.filter((x: any) => x.ID !== t.ID);
                            await persistSheets({ ...db, TP: next }, 'TP');
                          }}
                          className="text-rose-600 hover:underline font-medium"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ajarSub === 'mod' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modList.map((m: any) => (
              <div
                key={m.ID}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900">{m.Judul}</h3>
                  <div className="text-xs text-slate-500 mt-1">
                    {m.Mapel} · {m.Alokasi || '-'}
                  </div>
                  <p className="text-xs text-slate-600 mt-3 line-clamp-3">{m.Inti}</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setModView(m.ID)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg"
                  >
                    Lihat & Cetak
                  </button>
                  <button
                    onClick={async () => {
                      const next = db.Modul.filter((x: any) => x.ID !== m.ID);
                      await persistSheets({ ...db, Modul: next }, 'Modul');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg ml-auto"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {ajarSub === 'pem' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pemList.map((p: any) => {
              const slides = String(p.Slide || '')
                .split(/\n\s*-{3,}\s*\n?/)
                .map(x => x.trim())
                .filter(Boolean);
              return (
                <div
                  key={p.ID}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{p.Judul}</h3>
                    {p.Pertanyaan && (
                      <p className="text-xs text-slate-600 mt-1.5">
                        <strong>Pertanyaan Pemantik:</strong> {p.Pertanyaan}
                      </p>
                    )}
                    <div className="text-xs text-slate-400 mt-2">{slides.length} slide materi</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        const allSlides = [`# ${p.Judul}`];
                        if (p.Pertanyaan) allSlides.push(`Pertanyaan Pemantik\n${p.Pertanyaan}`);
                        slides.forEach(s => allSlides.push(s));
                        setPresState({ slides: allSlides, i: 0 });
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Tampilkan Layar Penuh
                    </button>
                    {urlAman(p.Tautan) && (
                      <a
                        href={p.Tautan}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
                      >
                        Buka Tautan ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 9. TUGAS & PENGUMPULAN
  function renderTug() {
    const activeId =
      tugSel && tugasK.some((t: any) => t.ID === tugSel) ? tugSel : tugasK[0]?.ID || '';
    const curTug = tugasK.find((t: any) => t.ID === activeId);

    const openTambahTugas = (editRow?: any) => {
      let judul = editRow?.Judul || '';
      let mapel = editRow?.Mapel || (db.Mapel?.[0]?.Nama || 'Umum');
      let deskripsi = editRow?.Deskripsi || '';
      let jenis = editRow?.Jenis || 'Tugas';
      let tenggat = editRow?.Tenggat || ymd(new Date());
      let fileId = editRow?.FileID || '';
      let namaFile = editRow?.NamaFile || '';
      let pendingFile: { namaFile: string; base64Data: string } | null = null;

      setModalContent({
        title: editRow ? 'Edit Tugas & Lampiran' : 'Tambah Tugas / Asesmen Formatif',
        render: () => (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Judul Tugas
              <input
                defaultValue={judul}
                onChange={e => (judul = e.target.value)}
                placeholder="Contoh: Latihan Soal Vektor"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Mata Pelajaran
                <input
                  list="tugas-mapel-list"
                  defaultValue={mapel}
                  onChange={e => (mapel = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <datalist id="tugas-mapel-list">
                  {(db.Mapel || []).map((m: any) => (
                    <option key={m.ID} value={m.Nama} />
                  ))}
                </datalist>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Jenis Asesmen
                <select
                  defaultValue={jenis}
                  onChange={e => (jenis = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option>Tugas</option>
                  <option>Kuis harian</option>
                  <option>Exit ticket</option>
                  <option>Proyek</option>
                  <option>Praktik</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Deskripsi / Instruksi Tugas
              <textarea
                rows={3}
                defaultValue={deskripsi}
                onChange={e => (deskripsi = e.target.value)}
                placeholder="Petunjuk pengerjaan untuk siswa..."
                className="mt-1 w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Tenggat Pengumpulan
              <input
                type="date"
                defaultValue={tenggat}
                onChange={e => (tenggat = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Upload Berkas Soal / Lampiran Tugas (Opsional)
              <input
                type="file"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 15 * 1024 * 1024) {
                    showToast('Ukuran lampiran maksimal 15 MB');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const res = String(reader.result || '');
                    const base64Data = res.includes(',') ? res.split(',')[1] : res;
                    pendingFile = { namaFile: f.name, base64Data };
                    showToast(`Lampiran "${f.name}" siap diunggah`);
                  };
                  reader.readAsDataURL(f);
                }}
                className="mt-1 w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:font-semibold hover:file:bg-teal-100"
              />
              {namaFile && (
                <div className="text-[11px] text-emerald-700 mt-1">
                  Lampiran saat ini: <strong>{namaFile}</strong>
                </div>
              )}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!judul.trim()) return showToast('Judul tugas wajib diisi');
                  if (pendingFile) {
                    showToast('Mengunggah berkas tugas…', 5000);
                    const upRes = await fetchJson('/api/tugas/upload-soal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        token,
                        namaFile: pendingFile.namaFile,
                        base64Data: pendingFile.base64Data
                      })
                    });
                    if (!upRes.ok) {
                      return showToast('Gagal unggah lampiran: ' + (upRes.error || 'Error'), 4000);
                    }
                    fileId = upRes.data.fileId;
                    namaFile = upRes.data.namaFile;
                  }
                  const idBaru = editRow?.ID || uid();
                  const record = {
                    ID: idBaru,
                    Kelas: K,
                    Judul: judul.trim(),
                    Mapel: mapel.trim(),
                    Deskripsi: deskripsi.trim(),
                    Jenis: jenis,
                    Tenggat: tenggat,
                    FileID: fileId,
                    NamaFile: namaFile
                  };
                  const next = editRow
                    ? (db.Tugas || []).map((t: any) => (t.ID === editRow.ID ? record : t))
                    : [...(db.Tugas || []), record];
                  setTugSel(idBaru);
                  setModalContent(null);
                  await persistSheets({ ...db, Tugas: next }, 'Tugas');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        )
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-500 via-cyan-600 to-sky-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tugas & Pengumpulan</h1>
            <p className="text-xs text-cyan-50 mt-1">
              Unggah berkas tugas per mata pelajaran, pantau pengumpulan siswa, dan nilai hasil unggahan siswa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeId}
              onChange={e => setTugSel(e.target.value)}
              className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-white/40 rounded-xl"
            >
              {tugasK.map((t: any) => (
                <option key={t.ID} value={t.ID}>
                  {t.Judul}{t.Mapel ? ` · ${t.Mapel}` : ''} ({t.Jenis})
                </option>
              ))}
            </select>
            <button
              onClick={() => openTambahTugas()}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-teal-700 hover:bg-teal-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              + Tambah Tugas
            </button>
          </div>
        </div>

        {curTug ? (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{curTug.Judul}</h2>
                  {curTug.Mapel && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                      {curTug.Mapel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Jenis: {curTug.Jenis} · Tenggat: {curTug.Tenggat || '-'}
                </div>
                {curTug.Deskripsi && (
                  <p className="text-xs text-slate-600 max-w-2xl">{curTug.Deskripsi}</p>
                )}
                {curTug.FileID && (
                  <div className="pt-1">
                    <a
                      href={`/api/tugas/file/${curTug.FileID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" /> Lampiran Guru: {curTug.NamaFile}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openTambahTugas(curTug)}
                  className="px-3 py-2 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Tugas
                </button>
                <button
                  onClick={() => setWaBlastState({ open: true })}
                  className="px-3 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Ingatkan WA
                </button>
                <button
                  onClick={() => persistSheets(db, 'Pengumpulan')}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Pengumpulan
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-teal-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-teal-50/70 border-b border-teal-100 text-teal-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Berkas Unggahan Siswa</th>
                    <th className="py-2.5 px-3">Status Pengumpulan</th>
                    <th className="py-2.5 px-3 text-right">Nilai (0–100)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {siswaK.map((s: any, i: number) => {
                    const r = (db.Pengumpulan || []).find(
                      (q: any) => q.TugasID === curTug.ID && q.SiswaID === s.ID
                    ) || { Status: 'Belum', Nilai: '', FileID: '', NamaFile: '', TanggalKumpul: '', CatatanSiswa: '' };
                    return (
                      <tr key={s.ID} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          <div>{s.Nama}</div>
                          {r.CatatanSiswa && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">"{r.CatatanSiswa}"</div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.FileID ? (
                            <div className="space-y-0.5">
                              <a
                                href={`/api/tugas/file/${r.FileID}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg max-w-[200px] truncate"
                                title={r.NamaFile}
                              >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span className="truncate">{r.NamaFile || 'Unduh Berkas'}</span>
                              </a>
                              {r.TanggalKumpul && (
                                <div className="text-[10px] text-slate-400 tabular-nums">{r.TanggalKumpul}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Belum upload</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={r.Status}
                            onChange={e => {
                              const next = [...(db.Pengumpulan || [])];
                              const idx = next.findIndex(
                                q => q.TugasID === curTug.ID && q.SiswaID === s.ID
                              );
                              if (idx >= 0) next[idx] = { ...next[idx], Status: e.target.value };
                              else
                                next.push({
                                  TugasID: curTug.ID,
                                  SiswaID: s.ID,
                                  Status: e.target.value,
                                  Nilai: '',
                                  FileID: '',
                                  NamaFile: '',
                                  TanggalKumpul: '',
                                  CatatanSiswa: ''
                                });
                              setDb({ ...db, Pengumpulan: next });
                            }}
                            className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
                          >
                            <option>Belum</option>
                            <option>Tepat Waktu</option>
                            <option>Terlambat</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="text"
                            value={r.Nilai}
                            onChange={e => {
                              const next = [...(db.Pengumpulan || [])];
                              const idx = next.findIndex(
                                q => q.TugasID === curTug.ID && q.SiswaID === s.ID
                              );
                              if (idx >= 0) next[idx] = { ...next[idx], Nilai: e.target.value };
                              else
                                next.push({
                                  TugasID: curTug.ID,
                                  SiswaID: s.ID,
                                  Status: 'Tepat Waktu',
                                  Nilai: e.target.value,
                                  FileID: '',
                                  NamaFile: '',
                                  TanggalKumpul: '',
                                  CatatanSiswa: ''
                                });
                              setDb({ ...db, Pengumpulan: next });
                            }}
                            className="w-20 px-2.5 py-1 text-right border border-slate-200 rounded-lg text-xs font-mono tabular-nums"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
            Belum ada tugas di kelas ini. Klik "+ Tambah Tugas" untuk memulai.
          </div>
        )}
      </div>
    );
  }

  // 10. PENGOLAHAN NILAI
  function renderNil() {
    const totBobot = bobot.reduce((a, b) => a + b, 0);

    const updateNilaiField = (sid: string, field: string, val: string) => {
      const next = [...(db.Nilai || [])];
      const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === sid);
      if (idx >= 0) {
        next[idx] = { ...next[idx], [field]: val };
      } else {
        next.push({
          Kelas: K,
          SiswaID: sid,
          Sikap: '',
          Tugas: '',
          Proyek: '',
          UTS: '',
          UAS: '',
          [field]: val
        });
      }
      setDb({ ...db, Nilai: next });
    };

    const isiSikapOtomatis = () => {
      const next = [...(db.Nilai || [])];
      siswaK.forEach((s: any) => {
        const st = absStat(s.ID);
        if (st.pct != null) {
          const v = String(Math.round(st.pct * 10) / 10);
          const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === s.ID);
          if (idx >= 0) next[idx] = { ...next[idx], Sikap: v };
          else
            next.push({
              Kelas: K,
              SiswaID: s.ID,
              Sikap: v,
              Tugas: '',
              Proyek: '',
              UTS: '',
              UAS: ''
            });
        }
      });
      setDb({ ...db, Nilai: next });
      showToast('Nilai Kehadiran & Sikap diisi otomatis dari persentase absensi');
    };

    const isiTugasOtomatis = () => {
      const ids = tugasK.map((t: any) => t.ID);
      const next = [...(db.Nilai || [])];
      siswaK.forEach((s: any) => {
        const vals = (db.Pengumpulan || [])
          .filter((p: any) => p.SiswaID === s.ID && ids.includes(p.TugasID) && num(p.Nilai) != null)
          .map((p: any) => num(p.Nilai) as number);
        if (vals.length) {
          const avg = String(
            Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
          );
          const idx = next.findIndex(n => n.Kelas === K && n.SiswaID === s.ID);
          if (idx >= 0) next[idx] = { ...next[idx], Tugas: avg };
          else
            next.push({
              Kelas: K,
              SiswaID: s.ID,
              Sikap: '',
              Tugas: avg,
              Proyek: '',
              UTS: '',
              UAS: ''
            });
        }
      });
      setDb({ ...db, Nilai: next });
      showToast('Nilai Tugas diisi otomatis dari rata-rata tugas terkumpul');
    };

    const eksporCSV = () => {
      const kepala = [
        'No',
        'NIS',
        'Nama',
        ...KOLOM_NILAI.map(k => k[1]),
        'Nilai Akhir',
        'Predikat',
        'Tindak Lanjut'
      ];
      const rows = siswaK.map((s: any, i: number) => {
        const r = getNilaiRow(s.ID) || {};
        const a = hitungAkhir(r);
        return [
          i + 1,
          s.NIS,
          s.Nama,
          ...KOLOM_NILAI.map(k => String(r[k[0]] || '').replace('.', ',')),
          a == null ? '' : fmt(a),
          a == null ? '' : getPredikat(a)[0],
          a == null ? '' : getTindakLanjut(a)
        ];
      });
      const csv = '\uFEFF' + [kepala, ...rows].map(r => r.join(';')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Nilai_${kelasObj.Nama || 'Kelas'}.csv`;
      a.click();
      showToast('Berkas CSV berhasil diunduh');
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md noprint">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengolahan Nilai Induk</h1>
            <p className="text-xs text-blue-100 mt-1">
              Tahap 7 & 8: kalkulasi otomatis nilai akhir berbobot, predikat, dan rekomendasi tindak lanjut.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={isiSikapOtomatis}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Kehadiran dari Absensi
            </button>
            <button
              onClick={isiTugasOtomatis}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Isi Tugas dari Rata-rata
            </button>
            <button
              onClick={eksporCSV}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
            <button
              onClick={() => persistSheets(db, 'Nilai')}
              className="px-4 py-1.5 text-xs font-semibold bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Nilai
            </button>
          </div>
        </div>

        {totBobot !== 100 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            Total bobot komponen saat ini <strong>{totBobot}%</strong> (seharusnya 100%). Sesuaikan di menu Pengaturan.
          </div>
        )}

        <PrintHeader />

        <div className="bg-white border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-indigo-50/80 border-b border-indigo-100 text-indigo-900">
                <tr>
                  <th className="py-3 px-3 w-10">#</th>
                  <th className="py-3 px-3">Nama Siswa</th>
                  <th className="py-3 px-2 text-center">Sikap ({bobot[0]}%)</th>
                  <th className="py-3 px-2 text-center">Tugas ({bobot[1]}%)</th>
                  <th className="py-3 px-2 text-center">Proyek ({bobot[2]}%)</th>
                  <th className="py-3 px-2 text-center">UTS ({bobot[3]}%)</th>
                  <th className="py-3 px-2 text-center">UAS ({bobot[4]}%)</th>
                  <th className="py-3 px-3 text-right">Nilai Akhir</th>
                  <th className="py-3 px-3 text-center">Predikat</th>
                  <th className="py-3 px-3">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaK.map((s: any, i: number) => {
                  const r = getNilaiRow(s.ID) || {};
                  const a = hitungAkhir(r);
                  const pr = getPredikat(a);
                  return (
                    <tr key={s.ID} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{s.Nama}</td>
                      {['Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'].map(f => (
                        <td key={f} className="py-2 px-2 text-center">
                          <input
                            type="text"
                            value={r[f] || ''}
                            onChange={e => updateNilaiField(s.ID, f, e.target.value)}
                            className="w-16 px-2 py-1 text-center border border-slate-200 rounded-md font-mono tabular-nums text-xs"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {fmt(a)}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-indigo-600">{pr[0]}</td>
                      <td className="py-2 px-3 text-slate-600">{getTindakLanjut(a)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 11. JURNAL PERILAKU
  function renderPer() {
    const list = (db.Perilaku || [])
      .filter((p: any) => p.Kelas === K)
      .sort((a: any, b: any) => b.Tanggal.localeCompare(a.Tanggal));
    const pos = list.filter((p: any) => p.Jenis !== 'Pelanggaran').length;
    const neg = list.length - pos;

    const openCatatPerilaku = () => {
      let tgl = ymd(new Date());
      let sid = siswaK[0]?.ID || '';
      let jenis = 'Penguatan positif';
      let lvl = '1';
      let cat = '';
      let tl = '';

      setModalContent({
        title: 'Catat Jurnal Perilaku Siswa',
        render: () => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Tanggal
                <input
                  type="date"
                  defaultValue={tgl}
                  onChange={e => (tgl = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Siswa
                <select
                  defaultValue={sid}
                  onChange={e => (sid = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {siswaK.map((s: any) => (
                    <option key={s.ID} value={s.ID}>
                      {s.Nama}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">
                Kategori
                <select
                  defaultValue={jenis}
                  onChange={e => (jenis = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option>Penguatan positif</option>
                  <option>Pelanggaran</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Level (Jika pelanggaran)
                <select
                  defaultValue={lvl}
                  onChange={e => (lvl = e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4].map(l => (
                    <option key={l} value={String(l)}>
                      Level {l} · {LEVEL[l][0]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Catatan Perilaku & Dampaknya
              <input
                onChange={e => (cat = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Tindak Lanjut
              <input
                onChange={e => (tl = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!sid) return showToast('Pilih siswa terlebih dahulu');
                  const isPos = jenis !== 'Pelanggaran';
                  const next = [
                    ...(db.Perilaku || []),
                    {
                      ID: uid(),
                      Kelas: K,
                      Tanggal: tgl,
                      SiswaID: sid,
                      Jenis: jenis,
                      Level: isPos ? '' : lvl,
                      Catatan: cat.trim(),
                      TindakLanjut: tl.trim()
                    }
                  ];
                  setModalContent(null);
                  await persistSheets({ ...db, Perilaku: next }, 'Perilaku');
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
              >
                Simpan
              </button>
            </div>
          </div>
        )
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jurnal Perilaku & Kesepakatan Kelas</h1>
            <p className="text-xs text-rose-50 mt-1">
              Rasio ideal penguatan positif berbanding koreksi adalah 4 : 1 (Tercatat saat ini: <strong>{pos} positif : {neg} koreksi</strong>).
            </p>
          </div>
          <button
            onClick={openCatatPerilaku}
            className="px-4 py-2 text-xs font-semibold bg-white text-rose-700 hover:bg-rose-50 rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
          >
            + Catat Jurnal Perilaku
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ATURAN.map((a, i) => {
            const ruleColors = [
              'from-sky-50 to-blue-50 border-sky-200 text-sky-700',
              'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700',
              'from-amber-50 to-orange-50 border-amber-200 text-amber-700',
              'from-violet-50 to-purple-50 border-violet-200 text-violet-700',
              'from-rose-50 to-pink-50 border-rose-200 text-rose-700'
            ][i % 5];
            return (
              <div key={i} className={`bg-gradient-to-br ${ruleColors} border rounded-2xl p-4 shadow-2xs`}>
                <div className="text-xs font-mono font-bold">0{i + 1}</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{a[0]}</div>
                <div className="text-xs text-slate-600 mt-0.5">{a[1]}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-rose-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-rose-50/70 border-b border-rose-100 text-rose-900">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Catatan Perilaku</th>
                  <th className="py-3 px-4">Tindak Lanjut</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p: any) => (
                  <tr key={p.ID}>
                    <td className="py-2.5 px-4 tabular-nums text-slate-600">{p.Tanggal}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {namaSiswa(p.SiswaID)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          p.Jenis === 'Pelanggaran' ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {p.Jenis === 'Pelanggaran' ? `Pelanggaran Level ${p.Level}` : 'Penguatan Positif'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{p.Catatan}</td>
                    <td className="py-2.5 px-4 text-slate-600">{p.TindakLanjut}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={async () => {
                          const next = db.Perilaku.filter((x: any) => x.ID !== p.ID);
                          await persistSheets({ ...db, Perilaku: next }, 'Perilaku');
                        }}
                        className="text-rose-600 hover:underline font-medium"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 12. KALENDER PENDIDIKAN JAWA BARAT & CHECKLIST
  function renderKal() {
    const mg = mingguKe();
    const toggleChecklist = async (i: number) => {
      const next = [...(db.Checklist || [])];
      const idx = next.findIndex(c => c.Kelas === K && c.Item === String(i));
      if (idx >= 0) {
        next[idx] = { ...next[idx], Selesai: next[idx].Selesai === '1' ? '0' : '1' };
      } else {
        next.push({ Kelas: K, Item: String(i), Selesai: '1' });
      }
      await persistSheets({ ...db, Checklist: next }, 'Checklist');
    };

    return (
      <KalenderPendidikan
        kelasId={K}
        peran={peran}
        pengaturan={S}
        akademik={db.Akademik || []}
        checklist={db.Checklist || []}
        mingguKe={mg}
        akBulan={akBulan}
        onChangeAkBulan={setAkBulan}
        onSaveAkademik={nextAkademik => persistSheets({ ...db, Akademik: nextAkademik }, 'Akademik')}
        onToggleChecklist={toggleChecklist}
        onSyncJabar={syncKaldikJabar}
        onToggleAutoSync={toggleKaldikAutoSync}
        askConfirm={askConfirm}
        showToast={showToast}
      />
    );
  }

  // 13. PANDUAN 8 TAHAP
  function renderPan() {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white rounded-2xl p-6 shadow-md">
          <h1 className="text-2xl font-bold tracking-tight">Panduan Operasional 8 Tahap</h1>
          <p className="text-xs text-amber-50 mt-1">
            Standar prosedur operasional manajemen kelas dari persiapan awal semester hingga pelaporan rapor.
          </p>
        </div>

        <div className="space-y-3">
          {TAHAP.map(t => (
            <div
              key={t.n}
              style={{ borderColor: `${t.c}35` }}
              className="bg-white border-2 rounded-2xl p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: t.c }}
                    className="w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center tabular-nums shadow-sm"
                  >
                    0{t.n}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t.t}</h3>
                    <div className="text-xs text-slate-500">{t.w}</div>
                  </div>
                </div>
                <button
                  onClick={() => setTab(t.tab)}
                  style={{ backgroundColor: `${t.c}15`, color: t.c }}
                  className="px-3.5 py-1.5 text-xs font-bold hover:brightness-95 rounded-xl whitespace-nowrap cursor-pointer"
                >
                  Buka Fitur →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Kegiatan Utama
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {t.k.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Dokumen & Instrumen
                  </div>
                  <div className="text-slate-700">{t.d.join(' · ')}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">
                    Indikator Keberhasilan
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {t.i.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 14. AKUN SAYA (GURU / WALI)
  function renderUsr() {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow-md">
          <h1 className="text-2xl font-bold tracking-tight">Akun Saya</h1>
          <p className="text-xs text-sky-100 mt-1">
            Masuk sebagai {db.namaPengguna} ({peranLabel(peran)}).
          </p>
        </div>
        <div className="bg-white border border-sky-100 rounded-2xl p-6 max-w-lg space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Ganti Kata Sandi</h2>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const l = String(fd.get('lama') || '');
              const b = String(fd.get('baru') || '');
              if (b.length < 8) return showToast('Kata sandi baru minimal 8 karakter');
              try {
                await apiCall('api_gantiSandiSaya', l, b);
                e.currentTarget.reset();
                showToast('Kata sandi berhasil diperbarui');
              } catch (err: any) {
                showToast(pesanErr(err), 4000);
              }
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-slate-700">
              Kata Sandi Lama
              <div className="mt-1">
                <PasswordField
                  name="lama"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Kata Sandi Baru (minimal 8 karakter)
              <div className="mt-1">
                <PasswordField
                  name="baru"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </label>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Simpan Kata Sandi Baru
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 15. PENGATURAN (ADMIN)
  function openModalPengguna(id?: string) {
    const u = (db.Pengguna || []).find((x: any) => x.ID === id) || {};
    let nama = u.Nama || '';
    let username = u.Username || '';
    let sandi = '';
    const waliSet = new Set<string>(String(u.KelasWali || '').split(',').filter(Boolean));
    const mengSet = new Set<string>(String(u.KelasMengajar || '').split(',').filter(Boolean));
    const mapelSet = new Set<string>(String(u.Mapel || '').split(',').filter(Boolean));

    setModalContent({
      title: id ? 'Edit Akun Guru / Wali Kelas' : 'Tambah Akun Guru / Wali Kelas',
      wide: true,
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Nama Lengkap Guru
              <input
                defaultValue={nama}
                onChange={e => (nama = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Nama Pengguna Login (minimal 3 karakter)
              <input
                defaultValue={username}
                onChange={e => (username = e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">
              Penugasan Per Kelas (Wali Kelas vs Guru Mapel)
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Kelas</th>
                    <th className="py-2 px-3 text-center">Sebagai Wali Kelas</th>
                    <th className="py-2 px-3 text-center">Sebagai Guru Mengajar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(db.Kelas || []).map((kls: any) => (
                    <tr key={kls.ID}>
                      <td className="py-2 px-3 font-medium text-slate-900">{kls.Nama}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={waliSet.has(kls.ID)}
                          onChange={e => {
                            if (e.target.checked) waliSet.add(kls.ID);
                            else waliSet.delete(kls.ID);
                          }}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={mengSet.has(kls.ID)}
                          onChange={e => {
                            if (e.target.checked) mengSet.add(kls.ID);
                            else mengSet.delete(kls.ID);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              Mata Pelajaran yang Diampu
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(db.Mapel || []).map((m: any) => (
                <label key={m.ID} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    defaultChecked={mapelSet.has(m.ID)}
                    onChange={e => {
                      if (e.target.checked) mapelSet.add(m.ID);
                      else mapelSet.delete(m.ID);
                    }}
                  />
                  <span>{m.Nama}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            {id
              ? 'Kata Sandi Baru (Kosongkan jika tidak diganti)'
              : 'Kata Sandi (Kosongkan untuk dibuatkan acak otomatis)'}
            <div className="mt-1">
              <PasswordField
                placeholder="Minimal 8 karakter"
                onChange={e => (sandi = e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalContent(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await apiCall('api_simpanPengguna', {
                    ID: id || '',
                    Nama: nama,
                    Username: username,
                    Sandi: sandi,
                    KelasWali: Array.from(waliSet),
                    KelasMengajar: Array.from(mengSet),
                    Mapel: Array.from(mapelSet)
                  });
                  setDb({ ...db, Pengguna: r.daftar });
                  if (firebaseUser?.emailVerified && peran === 'admin') {
                    await syncSheetToFirestore('Pengguna', r.daftar, firebaseUser.uid);
                  }
                  setModalContent(null);
                  if (r.sandi) {
                    setModalContent({
                      title: 'Akun Pengguna Siap Dipakai',
                      render: () => (
                        <div className="space-y-3 text-center">
                          <div className="text-xs text-slate-600">
                            Nama Pengguna: <strong>{r.username}</strong>
                          </div>
                          <div className="py-3 bg-slate-100 rounded-xl font-mono text-2xl font-bold text-slate-900">
                            {r.sandi}
                          </div>
                          <p className="text-xs text-slate-500">
                            Catat kata sandi ini dan berikan kepada guru terkait.
                          </p>
                          <button
                            onClick={() => setModalContent(null)}
                            className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
                          >
                            Selesai
                          </button>
                        </div>
                      )
                    });
                  } else {
                    showToast('Data pengguna tersimpan');
                  }
                } catch (e: any) {
                  showToast(pesanErr(e), 4500);
                }
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
            >
              Simpan Pengguna
            </button>
          </div>
        </div>
      )
    });
  }

  function renderSet() {
    const namaMapelIds = (ids: string) =>
      String(ids || '')
        .split(',')
        .map(id => (db.Mapel || []).find((m: any) => m.ID === id)?.Nama)
        .filter(Boolean)
        .join(', ');

    const kelasPeran = (u: any) =>
      String(u.Kelas || '')
        .split(',')
        .filter(Boolean)
        .map(id => {
          const w = String(u.KelasWali || '').split(',').includes(id);
          const m = String(u.KelasMengajar || '').split(',').includes(id);
          const n = (db.Kelas || []).find((k: any) => k.ID === id)?.Nama;
          return n ? `${n} (${w && m ? 'wali+guru' : w ? 'wali' : 'guru'})` : '';
        })
        .filter(Boolean)
        .join(', ');

    const jurusanList = Array.from(
      new Set(
        String(S.jurusan || 'MIPA, IPS, Bahasa')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      )
    );

    const handleLogoUpload = async (file: File) => {
      if (!file.type.startsWith('image/')) {
        return showToast('Pilih berkas gambar (PNG, JPG, WebP, atau SVG)');
      }
      try {
        showToast('Memproses logo sekolah…', 4000);
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Gagal membaca berkas gambar'));
          reader.onload = () => {
            const raw = String(reader.result || '');
            if (file.type === 'image/svg+xml' || raw.length < 60000) {
              resolve(raw);
              return;
            }
            const img = new Image();
            img.onload = () => {
              const maxDim = 240;
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              const w = Math.max(1, Math.round(img.width * scale));
              const h = Math.max(1, Math.round(img.height * scale));
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(raw);
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(raw);
            img.src = raw;
          };
          reader.readAsDataURL(file);
        });
        const baru = { ...S, logo: dataUrl };
        await apiCall('api_savePengaturan', baru);
        setDb({ ...db, Pengaturan: baru });
        if (firebaseUser?.emailVerified && peran === 'admin') {
          await syncPengaturanToFirestore(baru, firebaseUser.uid);
        }
        setPublicInfo(p => ({ ...p, logo: dataUrl }));
        showToast('Logo sekolah berhasil diperbarui');
      } catch (err: any) {
        showToast(pesanErr(err), 4000);
      }
    };

    const jurusanLogosMap = parseJurusanLogos(S.jurusanLogos);

    const simpanDaftarJurusan = async (nextList: string[], nextLogos?: Record<string, string>) => {
      const cleaned = Array.from(new Set(nextList.map(j => j.trim()).filter(Boolean)));
      const srcLogos = nextLogos || jurusanLogosMap;
      const filteredLogos: Record<string, string> = {};
      cleaned.forEach(name => {
        if (srcLogos[name]) filteredLogos[name] = srcLogos[name];
      });
      const logosJson = JSON.stringify(filteredLogos);
      const baru = { ...S, jurusan: cleaned.join(', '), jurusanLogos: logosJson };
      await apiCall('api_savePengaturan', baru);
      setDb({ ...db, Pengaturan: baru });
      if (firebaseUser?.emailVerified && peran === 'admin') {
        await syncPengaturanToFirestore(baru, firebaseUser.uid);
      }
      setPublicInfo(p => ({ ...p, jurusan: baru.jurusan, jurusanLogos: logosJson }));
      showToast('Daftar & logo jurusan diperbarui');
    };

    const handleJurusanLogoUpload = async (jurusanName: string, file: File) => {
      try {
        showToast(`Memproses logo ${jurusanName}…`, 4000);
        const dataUrl = await prosesLogoGambar(file, 160);
        const nextLogos = { ...jurusanLogosMap, [jurusanName]: dataUrl };
        await simpanDaftarJurusan(jurusanList, nextLogos);
      } catch (err: any) {
        showToast(pesanErr(err), 4000);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-violet-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pengaturan Sekolah & Sistem</h1>
            <p className="text-xs text-indigo-100 mt-1">
              Konfigurasi logo sekolah, jurusan, WhatsApp informasi, bobot penilaian, daftar kelas, dan akun pengguna.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('rst')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl shadow-sm whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Menu Reset & Database
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  await askConfirm(
                    'Reset seluruh data aplikasi kembali ke data pratinjau awal (SMA Negeri 1 Nusantara)?'
                  )
                ) {
                  await handleResetDemoData();
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
            >
              Reset Data Pratinjau Awal
            </button>
          </div>
        </div>

        {/* Logo Sekolah Card */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            {S.logo ? (
              <img
                src={S.logo}
                alt={S.sekolah || 'Logo Sekolah'}
                className="w-16 h-16 rounded-2xl object-contain bg-indigo-50 border border-indigo-200 p-1.5 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900">Logo Resmi Sekolah</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ditampilkan di halaman masuk, sidebar, header portal siswa, serta laporan cetak (PNG, JPG, WebP, atau SVG).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Ganti Logo Sekolah
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
            {S.logo && (
              <button
                type="button"
                onClick={async () => {
                  const baru = { ...S, logo: '' };
                  await apiCall('api_savePengaturan', baru);
                  setDb({ ...db, Pengaturan: baru });
                  if (firebaseUser?.emailVerified && peran === 'admin') {
                    await syncPengaturanToFirestore(baru, firebaseUser.uid);
                  }
                  setPublicInfo(p => ({ ...p, logo: '' }));
                  showToast('Logo dikembalikan ke ikon bawaan');
                }}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Reset Logo Bawaan
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={async e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const keys = [
              'sekolah',
              'jurusan',
              'waInfo',
              'emailPemulihan',
              'kodeReset',
              'guru',
              'wali',
              'semester',
              'mulai',
              'kkm',
              'b_sikap',
              'b_tugas',
              'b_proyek',
              'b_uts',
              'b_uas'
            ];
            const baru: Record<string, string> = { ...S };
            keys.forEach(k => (baru[k] = String(fd.get(k) || '').trim()));
            const tot = ['b_sikap', 'b_tugas', 'b_proyek', 'b_uts', 'b_uas'].reduce(
              (a, k) => a + (num(baru[k]) || 0),
              0
            );
            if (tot !== 100) {
              return showToast(`Total bobot harus 100% (saat ini ${tot}%)`, 4000);
            }
            try {
              showToast('Menyimpan pengaturan…', 6000);
              await apiCall('api_savePengaturan', baru);
              setDb({ ...db, Pengaturan: baru });
              if (firebaseUser?.emailVerified && peran === 'admin') {
                await syncPengaturanToFirestore(baru, firebaseUser.uid);
              }
              const em = baru.emailPemulihan || '';
              const emailHint = em.includes('@')
                ? `${em.slice(0, Math.min(2, em.indexOf('@')))}***@${em.split('@')[1]}`
                : '';
              setPublicInfo(p => ({
                ...p,
                sekolah: baru.sekolah || p.sekolah,
                jurusan: baru.jurusan || '',
                waInfo: baru.waInfo || '',
                emailHint
              }));
              showToast('Pengaturan berhasil disimpan');
            } catch (err: any) {
              showToast(pesanErr(err), 4000);
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Identitas Sekolah, Jurusan & WA Informasi</h2>
            {[
              ['sekolah', 'Nama Sekolah / Lembaga', 'text'],
              ['jurusan', 'Daftar Jurusan / Program Keahlian (pisahkan dengan koma)', 'text'],
              ['waInfo', 'Nomor WhatsApp Informasi Sekolah (mis. 6281234567890)', 'text'],
              ['emailPemulihan', 'Email Pemulihan Lupa Kata Sandi Admin', 'email'],
              ['kodeReset', 'Kode Pemulihan Lupa Kata Sandi Sekolah', 'text'],
              ['guru', 'Nama Guru Pengampu', 'text'],
              ['wali', 'Nama Wali Kelas Default', 'text'],
              ['semester', 'Semester Berjalan', 'text'],
              ['mulai', 'Tanggal Mulai Semester (Senin Minggu ke-1)', 'date']
            ].map(([k, label, type]) => (
              <label key={k} className="block text-xs font-semibold text-slate-700">
                {label}
                <input
                  name={k}
                  type={type}
                  defaultValue={S[k] || ''}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </label>
            ))}
          </div>

          <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Batas Ketuntasan (KKM) & Bobot Nilai</h2>
              <label className="block text-xs font-semibold text-slate-700">
                Batas Ketuntasan Minimal (KKM)
                <input
                  name="kkm"
                  type="number"
                  defaultValue={S.kkm || '75'}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['b_sikap', 'Kehadiran & Sikap (%)'],
                  ['b_tugas', 'Tugas & Harian (%)'],
                  ['b_proyek', 'Proyek / Praktik (%)'],
                  ['b_uts', 'UTS (%)'],
                  ['b_uas', 'UAS (%)']
                ].map(([k, label]) => (
                  <label key={k} className="block text-xs font-semibold text-slate-700">
                    {label}
                    <input
                      name={k}
                      type="number"
                      defaultValue={S[k] || '20'}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-4">
              <button
                type="submit"
                className="w-full justify-center px-4 py-2.5 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Pengaturan Identitas, WA & Nilai
              </button>
            </div>
          </div>
        </form>

        {/* Manajemen Pengguna (Guru & Wali Kelas) */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pengguna: Guru & Wali Kelas</h2>
              <p className="text-xs text-slate-500">
                Setiap akun hanya melihat dan mengelola kelas yang ditugaskan kepadanya.
              </p>
            </div>
            <button
              onClick={() => openModalPengguna()}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
            >
              + Tambah Pengguna
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-indigo-50/70 border-b border-indigo-100 text-indigo-950">
                <tr>
                  <th className="py-2.5 px-3">Nama Guru</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Peran</th>
                  <th className="py-2.5 px-3">Penugasan Kelas</th>
                  <th className="py-2.5 px-3">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(db.Pengguna || []).map((u: any) => (
                  <tr key={u.ID}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{u.Nama}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{u.Username}</td>
                    <td className="py-2.5 px-3 text-slate-700">{peranLabel(u.Peran)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{kelasPeran(u) || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{namaMapelIds(u.Mapel) || '-'}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => openModalPengguna(u.ID)}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Reset kata sandi acak baru untuk "${u.Nama}"?`)) {
                            const r = await apiCall('api_resetSandiPengguna', u.ID, '');
                            setModalContent({
                              title: 'Kata Sandi Baru Pengguna',
                              render: () => (
                                <div className="space-y-3 text-center">
                                  <div className="text-xs text-slate-600">
                                    Username: <strong>{r.username}</strong>
                                  </div>
                                  <div className="py-3 bg-indigo-50 border border-indigo-200 rounded-xl font-mono text-2xl font-bold text-indigo-900">
                                    {r.sandi}
                                  </div>
                                  <button
                                    onClick={() => setModalContent(null)}
                                    className="w-full py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
                                  >
                                    Selesai
                                  </button>
                                </div>
                              )
                            });
                          }
                        }}
                        className="text-amber-600 hover:underline font-medium"
                      >
                        Reset Sandi
                      </button>
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Hapus akun pengguna "${u.Nama}"?`)) {
                            const listBaru = await apiCall('api_hapusPengguna', u.ID);
                            setDb({ ...db, Pengguna: listBaru });
                            if (firebaseUser?.emailVerified && peran === 'admin') {
                              await syncSheetToFirestore('Pengguna', listBaru, firebaseUser.uid);
                            }
                            showToast('Akun pengguna dihapus');
                          }
                        }}
                        className="text-rose-600 hover:underline font-medium"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manajemen Kelas & Jurusan (Tanpa Tambah Mata Pelajaran di Daftar Kelas) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-sky-600" /> Daftar Kelas & Jurusan
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atur nama kelas dan jurusan masing-masing kelas.
                </p>
              </div>
              <button
                onClick={async () => {
                  const defaultJur = jurusanList[0] || 'Umum';
                  const next = [
                    ...(db.Kelas || []),
                    { ID: uid(), Nama: `Kelas ${(db.Kelas || []).length + 1}`, Jurusan: defaultJur, Mapel: '' }
                  ];
                  await persistSheets({ ...db, Kelas: next }, 'Kelas');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl whitespace-nowrap cursor-pointer"
              >
                + Tambah Kelas
              </button>
            </div>
            <div className="space-y-2.5">
              {(db.Kelas || []).map((kls: any) => {
                const pilihanJur = Array.from(
                  new Set([...jurusanList, ...(kls.Jurusan ? [kls.Jurusan] : [])])
                );
                return (
                  <div
                    key={kls.ID}
                    className="p-3 rounded-xl border border-sky-100 bg-sky-50/30 flex items-center gap-2"
                  >
                    <input
                      defaultValue={kls.Nama}
                      placeholder="Nama kelas (mis. X MIPA 1)"
                      onBlur={async e => {
                        const next = db.Kelas.map((x: any) =>
                          x.ID === kls.ID ? { ...x, Nama: e.target.value.trim() || 'Kelas' } : x
                        );
                        await persistSheets({ ...db, Kelas: next }, 'Kelas');
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                    />
                    <select
                      value={kls.Jurusan || ''}
                      onChange={async e => {
                        const next = db.Kelas.map((x: any) =>
                          x.ID === kls.ID ? { ...x, Jurusan: e.target.value } : x
                        );
                        await persistSheets({ ...db, Kelas: next }, 'Kelas');
                      }}
                      className="w-36 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="">Pilih Jurusan…</option>
                      {pilihanJur.map(j => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                    {(db.Kelas || []).length > 1 && (
                      <button
                        onClick={async () => {
                          if (await askConfirm(`Hapus kelas "${kls.Nama}"?`)) {
                            const next = db.Kelas.filter((x: any) => x.ID !== kls.ID);
                            await persistSheets({ ...db, Kelas: next }, 'Kelas');
                            if (K === kls.ID) setK(next[0]?.ID || '');
                          }
                        }}
                        title="Hapus Kelas"
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-violet-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Daftar Jurusan & Logo Jurusan</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tambahkan jurusan dan unggah logo masing-masing program keahlian.
                </p>
              </div>
              <button
                type="button"
                onClick={() => simpanDaftarJurusan([...jurusanList, `Jurusan ${jurusanList.length + 1}`])}
                className="px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl whitespace-nowrap cursor-pointer"
              >
                + Tambah Jurusan
              </button>
            </div>
            <div className="space-y-2">
              {jurusanList.map((j, idx) => {
                const jLogo = jurusanLogosMap[j] || '';
                return (
                  <div
                    key={`${j}-${idx}`}
                    className="p-2 rounded-xl bg-violet-50/40 border border-violet-200 flex items-center gap-2"
                  >
                    <label
                      title={`Unggah logo jurusan ${j}`}
                      className="w-10 h-10 rounded-lg border border-violet-200 bg-white flex items-center justify-center shrink-0 cursor-pointer hover:border-violet-400 overflow-hidden"
                    >
                      {jLogo ? (
                        <img
                          src={jLogo}
                          alt={`Logo ${j}`}
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-violet-400" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleJurusanLogoUpload(j, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      defaultValue={j}
                      onBlur={e => {
                        const val = e.target.value.trim();
                        if (!val || val === j) return;
                        const next = jurusanList.map((x, i) => (i === idx ? val : x));
                        const nextLogos = { ...jurusanLogosMap };
                        if (nextLogos[j]) {
                          nextLogos[val] = nextLogos[j];
                          delete nextLogos[j];
                        }
                        simpanDaftarJurusan(next, nextLogos);
                      }}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold bg-white border border-violet-200 rounded-lg"
                    />
                    <label
                      title="Unggah / Ganti Logo Jurusan"
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <Upload className="w-3 h-3" /> Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleJurusanLogoUpload(j, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {jLogo && (
                      <button
                        type="button"
                        title="Hapus logo jurusan"
                        onClick={() => {
                          const nextLogos = { ...jurusanLogosMap };
                          delete nextLogos[j];
                          simpanDaftarJurusan(jurusanList, nextLogos);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {jurusanList.length > 1 && (
                      <button
                        type="button"
                        title="Hapus jurusan"
                        onClick={() => {
                          const nextLogos = { ...jurusanLogosMap };
                          delete nextLogos[j];
                          simpanDaftarJurusan(jurusanList.filter((_, i) => i !== idx), nextLogos);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daftar Mata Pelajaran Sekolah */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" /> Daftar Mata Pelajaran Sekolah
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan atau ubah mata pelajaran yang dipakai di jadwal, tugas, CBT, dan penugasan guru.
              </p>
            </div>
            <button
              onClick={async () => {
                const namaBaru = `Mata Pelajaran ${(db.Mapel || []).length + 1}`;
                const next = [...(db.Mapel || []), { ID: uid(), Nama: namaBaru }];
                await persistSheets({ ...db, Mapel: next }, 'Mapel');
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl whitespace-nowrap cursor-pointer shadow-xs"
            >
              + Tambah Mata Pelajaran
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(db.Mapel || []).map((m: any) => (
              <div key={m.ID} className="flex items-center gap-1.5">
                <input
                  defaultValue={m.Nama}
                  onBlur={async e => {
                    const val = e.target.value.trim();
                    if (!val || val === m.Nama) return;
                    const next = (db.Mapel || []).map((x: any) =>
                      x.ID === m.ID ? { ...x, Nama: val } : x
                    );
                    await persistSheets({ ...db, Mapel: next }, 'Mapel');
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-emerald-50/40 border border-emerald-200 rounded-lg"
                />
                {(db.Mapel || []).length > 1 && (
                  <button
                    onClick={async () => {
                      if (await askConfirm(`Hapus mata pelajaran "${m.Nama}"?`)) {
                        const next = (db.Mapel || []).filter((x: any) => x.ID !== m.ID);
                        await persistSheets({ ...db, Mapel: next }, 'Mapel');
                      }
                    }}
                    title="Hapus Mata Pelajaran"
                    className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeView = () => {
    if (TAB_WALI.includes(tab) && !waliDi(K)) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl">
          <h2 className="text-lg font-bold text-slate-900">Akses Khusus Wali Kelas</h2>
          <p className="text-xs text-slate-600 mt-1">
            Menu ini hanya dapat dikelola oleh <strong>Wali Kelas</strong>. Di kelas{' '}
            <strong>{kelasObj.Nama}</strong> Anda bertugas sebagai guru mata pelajaran.
          </p>
        </div>
      );
    }
    switch (tab) {
      case 'dash':
        return renderDash();
      case 'cld':
        return (
          <CloudAiHub
            token={token}
            kelasId={K}
            kelasNama={kelasObj.Nama || ''}
            files={db.BerkasCloud || []}
            onFilesUpdated={nextFiles => {
              setDb(prev => ({ ...prev, BerkasCloud: nextFiles }));
              if (firebaseUser?.emailVerified && peran === 'admin') {
                syncSheetToFirestore('BerkasCloud', nextFiles, firebaseUser.uid).catch(err =>
                  console.warn('Firestore cloud file sync warning:', err)
                );
              }
            }}
            showToast={showToast}
          />
        );
      case 'abs':
        return renderAbs();
      case 'sis':
        return renderSis();
      case 'den':
        return renderDen();
      case 'pik':
        return renderPik();
      case 'str':
        return renderStr();
      case 'jad':
        return renderJad();
      case 'ajar':
        return renderAjar();
      case 'cbt':
        return (
          <CbtManager
            token={token}
            kelasId={K}
            kelasNama={kelasObj.Nama || ''}
            mapelList={db.Mapel || []}
            siswaList={db.Siswa || []}
            cbtList={db.CBT || []}
            hasilList={db.HasilCBT || []}
            onSaveCBT={nextCbt => persistSheets({ ...db, CBT: nextCbt }, 'CBT')}
            onSaveHasil={nextHasil => persistSheets({ ...db, HasilCBT: nextHasil }, 'HasilCBT')}
            showToast={showToast}
            askConfirm={askConfirm}
          />
        );
      case 'tug':
        return renderTug();
      case 'nil':
        return renderNil();
      case 'per':
        return renderPer();
      case 'kal':
        return renderKal();
      case 'pan':
        return renderPan();
      case 'usr':
        return renderUsr();
      case 'set':
        return renderSet();
      case 'rst':
        return (
          <ResetDatabasePanel
            db={db}
            firebaseUser={firebaseUser}
            onConnectGoogle={connectGoogleFirestore}
            onDisconnectGoogle={disconnectGoogleFirestore}
            onPushFirestore={pushToFirestore}
            onPullFirestore={pullFromFirestore}
            onResetAll={handleResetAllData}
            onResetPartial={handleResetPartial}
            onResetDemo={handleResetDemoData}
            askConfirm={askConfirm}
            showToast={showToast}
          />
        );
      default:
        return renderDash();
    }
  };

  return (
    <div className="min-h-screen text-slate-900 flex">
      {/* Colorful Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-indigo-950 via-violet-950 to-slate-950 text-slate-200 flex flex-col border-r border-indigo-900/60 transition-transform lg:translate-x-0 lg:static noprint shadow-xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-1 rainbow-strip shrink-0" />
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm tracking-tight min-w-0">
            {S.logo ? (
              <img
                src={S.logo}
                alt={S.sekolah || 'Logo Sekolah'}
                className="w-8 h-8 rounded-xl object-contain bg-white p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-sm shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="truncate">Manajemen Kelas</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {TABS.filter(t => tabOk(t[0])).map(([id, label, iconName]) => {
            const Icon = ICON_MAP[iconName] || LayoutDashboard;
            const on = tab === id;
            const theme = TAB_THEME[id] || TAB_THEME.dash;
            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  on
                    ? `${theme.active} font-semibold`
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-white/20 text-white' : theme.badge}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20 text-[11px] text-indigo-200 space-y-2">
          <div>
            <div className="font-bold text-white truncate">
              {peran === 'admin' ? 'Administrator' : db.namaPengguna}
            </div>
            <div className="truncate text-indigo-300">{peranLabel(peran)}</div>
          </div>
          {S.waInfo && (
            <a
              href={waLink(
                S.waInfo,
                `Halo Admin/Informasi ${S.sekolah || 'Sekolah'}, saya ${peran === 'admin' ? 'Admin' : db.namaPengguna} ingin berkoordinasi.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WA Informasi Sekolah
            </a>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden noprint"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-1 rainbow-strip sticky top-0 z-30 noprint" />
        {/* Top Bar Contract */}
        <header className="sticky top-1 z-20 bg-white/90 backdrop-blur-md border-b border-indigo-100 px-6 py-3 flex items-center justify-between gap-8 noprint shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-indigo-200 text-indigo-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            {S.logo && (
              <img
                src={S.logo}
                alt={S.sekolah}
                className="w-7 h-7 rounded-lg object-contain border border-indigo-100 bg-white p-0.5 shrink-0 hidden sm:block"
              />
            )}
            <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
              <span className="truncate">
                {S.sekolah} · <span className="text-indigo-600 font-semibold">Semester {S.semester}</span>
              </span>
              {activeJurusanLogo && (
                <img
                  src={activeJurusanLogo}
                  alt={`Logo ${kelasObj.Jurusan}`}
                  title={`Logo Jurusan ${kelasObj.Jurusan}`}
                  className="w-6 h-6 rounded-md object-contain border border-violet-200 bg-white p-0.5 shrink-0 hidden md:block"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {S.waInfo && (
              <a
                href={waLink(
                  S.waInfo,
                  `Halo Informasi ${S.sekolah || 'Sekolah'}, saya memerlukan informasi.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp Informasi Sekolah"
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WA Info</span>
              </a>
            )}
            <select
              value={K}
              onChange={e => {
                setK(e.target.value);
                setDenSel('');
                setDenPick('');
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl text-indigo-950"
            >
              {(db.Kelas || []).length === 0 ? (
                <option value="">Belum ada kelas</option>
              ) : (
                (db.Kelas || []).map((k: any) => (
                  <option key={k.ID} value={k.ID}>
                    Kelas {k.Nama}{k.Jurusan ? ` · ${k.Jurusan}` : ''}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={muatUlang}
              title="Muat ulang data"
              className="p-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 text-white rounded-xl flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-6">{activeView()}</main>
      </div>

      {/* Modal Dialog */}
      {modalContent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl border border-slate-200 p-6 w-full ${
              modalContent.wide ? 'max-w-2xl' : 'max-w-md'
            } max-h-[90vh] overflow-y-auto space-y-4 shadow-xl`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{modalContent.title}</h3>
              <button
                onClick={() => setModalContent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {modalContent.render()}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4 shadow-xl">
            <p className="text-sm font-medium text-slate-800">{confirmState.msg}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Slide Presentation */}
      {presState && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 text-white flex flex-col justify-between p-8">
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
            {(() => {
              const s = presState.slides[presState.i].replace(/^# /, '');
              const lines = s.split('\n');
              return (
                <>
                  <h1 className="text-3xl md:text-5xl font-bold mb-6 text-amber-300">{lines[0]}</h1>
                  <div className="text-lg md:text-2xl text-indigo-100 whitespace-pre-line leading-relaxed">
                    {lines.slice(1).join('\n')}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={() => setPresState(p => (p ? { ...p, i: Math.max(0, p.i - 1) } : null))}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold"
            >
              ◀ Sebelumnya
            </button>
            <span className="text-xs font-mono tabular-nums text-amber-300">
              {presState.i + 1} / {presState.slides.length}
            </span>
            <button
              onClick={() =>
                setPresState(p =>
                  p ? { ...p, i: Math.min(p.slides.length - 1, p.i + 1) } : null
                )
              }
              className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold"
            >
              Berikutnya ▶
            </button>
            <button
              onClick={() => setPresState(null)}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 rounded-xl text-xs font-semibold"
            >
              Tutup (Esc)
            </button>
          </div>
        </div>
      )}

      <WaBlastModal
        open={waBlastState.open}
        onClose={() => setWaBlastState({ open: false })}
        kelasNama={kelasObj.Nama || ''}
        sekolahNama={S.sekolah || 'Sekolah'}
        siswaList={siswaK}
        initialStudentId={waBlastState.studentId}
        initialTargetType={waBlastState.targetType}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-indigo-700 to-violet-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-lg border border-white/20">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
