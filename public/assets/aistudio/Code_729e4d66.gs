/**
 * MANAJEMEN KELAS - Backend Google Apps Script (dengan login Admin & Siswa)
 * Data disimpan di Google Sheets (dibuat otomatis).
 *
 * Keamanan:
 * - Kata sandi admin & PIN siswa disimpan sebagai hash SHA-256 + salt (bukan teks asli).
 * - Setiap panggilan API wajib membawa token sesi (berlaku 6 jam) dan dicek di server.
 * - Login dibatasi 5 kali gagal per akun, lalu dikunci 10 menit.
 * Deploy: "Jalankan sebagai: Saya"; akses boleh "Siapa saja" karena login ditangani aplikasi.
 */

const SKEMA = {
  Pengaturan: ['Kunci', 'Nilai'],
  Kelas: ['ID', 'Nama', 'Mapel'],
  Siswa: ['ID', 'Kelas', 'Nama', 'NIS', 'KontakOrtu', 'Alamat', 'Kesehatan'],
  Absensi: ['Kelas', 'Tanggal', 'SiswaID', 'Kode', 'Keterangan', 'Sumber'], // Sumber: '' = guru/admin, 'sekretaris' = diisi sekretaris kelas (belum dikonfirmasi)
  Tugas: ['ID', 'Kelas', 'Judul', 'Tenggat', 'Jenis'],
  Pengumpulan: ['TugasID', 'SiswaID', 'Status', 'Nilai'],
  Nilai: ['Kelas', 'SiswaID', 'Sikap', 'Tugas', 'Proyek', 'UTS', 'UAS'],
  Perilaku: ['ID', 'Kelas', 'Tanggal', 'SiswaID', 'Jenis', 'Level', 'Catatan', 'TindakLanjut'],
  Checklist: ['Kelas', 'Item', 'Selesai'],
  DenahAtur: ['Kelas', 'Baris', 'Kolom', 'Grup'],           // ukuran denah per kelas (Grup = lorong tiap N kolom, 0 = tanpa lorong)
  Denah: ['Kelas', 'Baris', 'Kolom', 'SiswaID'],            // siswa duduk di baris/kolom tertentu
  Piket: ['ID', 'Kelas', 'Hari', 'SiswaID', 'Tugas'],
  Struktur: ['ID', 'Kelas', 'Jabatan', 'SiswaID', 'Tingkat'], // Tingkat: 1 pimpinan, 2 pengurus inti, 3 seksi
  Jadwal: ['ID', 'Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'], // Pekan: '' = setiap pekan, 'A' / 'B' = pekan bergantian (sistem blok)
  JadwalAtur: ['Kelas', 'Sistem', 'Mulai', 'Durasi', 'Jumlah', 'Istirahat'], // Sistem: 'reguler' | 'blok'; Istirahat mis. '3:15,6:30' (setelah jam ke-n, menit)
  Akademik: ['ID', 'Mulai', 'Selesai', 'Kegiatan', 'Jenis'],  // kalender akademik (berlaku untuk semua kelas)
  TP: ['ID', 'Kelas', 'Kode', 'Tujuan', 'Materi', 'Status'],   // tujuan pembelajaran
  Modul: ['ID', 'Kelas', 'Judul', 'Mapel', 'Alokasi', 'TPIDs', 'Pembuka', 'Inti', 'Penutup', 'Asesmen', 'Media', 'Catatan'],
  Pemantik: ['ID', 'Kelas', 'Judul', 'Tautan', 'Pertanyaan', 'Slide'], // slide dipisah baris '---'
  Mapel: ['ID', 'Nama'],                                        // daftar mata pelajaran sekolah (diatur admin)
  Pengguna: ['ID', 'Nama', 'Username', 'Peran', 'Kelas', 'Hash', 'Mapel', 'KelasWali', 'KelasMengajar'], // Peran: 'wali', 'guru', atau 'wali,guru'; Kelas = gabungan; Mapel = ID mapel yang diajar; // akun guru/wali kelas; Hash tidak pernah dikirim ke client
  Akun: ['SiswaID', 'Hash']            // hash PIN siswa; tidak pernah dikirim ke client
};
const SHEET_TERKUNCI = ['Pengaturan', 'Akun', 'Pengguna']; // tidak boleh ditimpa lewat api_saveSheet
// Sheet yang boleh ditulis per peran (admin: semua). Data dibatasi ke kelas yang ditugaskan.
const IZIN_TULIS = {
  wali: ['Siswa', 'Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik'],
  guru: ['Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Perilaku', 'Checklist', 'Jadwal', 'JadwalAtur', 'TP', 'Modul', 'Pemantik']
};
const TTL_SESI = 21600; // 6 jam (maksimum CacheService)

const PENGATURAN_AWAL = {
  sekolah: '[Nama Sekolah]', guru: '', wali: '', semester: 'Ganjil 2026/2027', mulai: '',
  kkm: '70', b_sikap: '10', b_tugas: '20', b_proyek: '20', b_uts: '20', b_uas: '30'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Manajemen Kelas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- Spreadsheet helper ---------- */

// Cache per eksekusi (variabel global di Apps Script hidup selama satu panggilan API).
// Tanpa ini, membuka spreadsheet dan membaca sheet diulang puluhan kali per panggilan sehingga lambat.
let SS_ = null;
const SH_ = {};   // handle sheet
const RAW_ = {};  // isi sheet (nilai mentah); dihapus saat sheet ditulis

let PROPS_ = null;
function props_() { return PROPS_ || (PROPS_ = PropertiesService.getScriptProperties().getProperties()); }

function ss_() {
  if (SS_) return SS_;
  const props = PropertiesService.getScriptProperties();
  const id = props_().SS_ID;
  if (id) { SS_ = SpreadsheetApp.openById(id); return SS_; }
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create('Database Manajemen Kelas');
  props.setProperty('SS_ID', ss.getId());
  SS_ = ss;
  return SS_;
}

// Samakan semua sheet dan judul kolom dengan SKEMA. Hanya berjalan saat skema berubah (setelah pembaruan aplikasi),
// bukan di setiap pemuatan, agar masuk ke aplikasi tetap cepat.
function pastikanSkema_() {
  const sig = hash_('skema', JSON.stringify(SKEMA));
  if (props_().SKEMA_SIG === sig) return;
  Object.keys(SKEMA).forEach(n => {
    const sh = sheet_(n), h = SKEMA[n], cur = sh.getRange(1, 1, 1, h.length).getDisplayValues()[0];
    if (cur.join('|') !== h.join('|')) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#a78bfa').setFontColor('#ffffff');
    }
  });
  PropertiesService.getScriptProperties().setProperty('SKEMA_SIG', sig);
}

function sheet_(nama) {
  if (SH_[nama]) return SH_[nama];
  const ss = ss_();
  let sh = ss.getSheetByName(nama);
  if (!sh) {
    sh = ss.insertSheet(nama);
    const h = SKEMA[nama];
    sh.getRange(1, 1, 1, h.length).setValues([h])
      .setFontWeight('bold').setBackground('#a78bfa').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@');
  }
  SH_[nama] = sh;
  return sh;
}

/* ---------- Cache data sheet (CacheService) ----------
 * Membaca 20+ sheet satu per satu lambat. Isi sheet disimpan di cache (dipotong 80 KB per entri),
 * dimuat sekaligus dengan satu panggilan getAll, dan dihapus otomatis tiap sheet ditulis lewat aplikasi.
 * Jika sheet diubah manual di Google Sheets: onEdit membersihkan cache (skrip terikat spreadsheet),
 * dan tombol "Muat ulang" di aplikasi memaksa baca ulang. Kedaluwarsa otomatis 30 menit. */
const CACHE_CHUNK_ = 80000, CACHE_TTL_ = 1800;
const kunciDb_ = (n, i) => 'db_' + n + (i ? '_' + i : '');

function hapusCacheDb_(namaList) {
  const keys = [];
  (namaList || Object.keys(SKEMA)).forEach(n => { keys.push(kunciDb_(n)); for (let i = 1; i < 20; i++) keys.push(kunciDb_(n, i)); });
  try { CacheService.getScriptCache().removeAll(keys); } catch (e) {}
  (namaList || Object.keys(SKEMA)).forEach(n => delete RAW_[n]);
}
function onEdit() { hapusCacheDb_(); } // pemicu sederhana: perubahan manual di Sheets membersihkan cache

// Muat banyak sheet sekaligus ke RAW_: dari cache bila ada, selebihnya dari sheet lalu disimpan ke cache.
function muatSemua_(names) {
  const cache = CacheService.getScriptCache();
  const hit = cache.getAll(names.map(n => kunciDb_(n))), baru = {};
  names.forEach(n => {
    if (RAW_[n]) return;
    const v = hit[kunciDb_(n)];
    if (v != null) {
      try {
        const m = v.indexOf('|'), jml = parseInt(v.slice(0, m), 10);
        let s = v.slice(m + 1);
        if (jml > 1) {
          const ks = []; for (let i = 1; i < jml; i++) ks.push(kunciDb_(n, i));
          const sisa = cache.getAll(ks);
          for (let i = 1; i < jml; i++) { if (sisa[kunciDb_(n, i)] == null) throw new Error('chunk hilang'); s += sisa[kunciDb_(n, i)]; }
        }
        RAW_[n] = JSON.parse(s); return;
      } catch (e) { /* cache rusak: baca ulang dari sheet */ }
    }
    baca_(n); // baca dari sheet, mengisi RAW_
    const s = JSON.stringify(RAW_[n]), jml = Math.ceil(s.length / CACHE_CHUNK_) || 1;
    if (jml <= 20) {
      baru[kunciDb_(n)] = jml + '|' + s.slice(0, CACHE_CHUNK_);
      for (let i = 1; i < jml; i++) baru[kunciDb_(n, i)] = s.slice(i * CACHE_CHUNK_, (i + 1) * CACHE_CHUNK_);
    }
  });
  if (Object.keys(baru).length) { try { cache.putAll(baru, CACHE_TTL_); } catch (e) {} }
}

function baca_(nama) {
  const h = SKEMA[nama];
  if (!RAW_[nama]) {
    const sh = sheet_(nama), n = sh.getLastRow();
    RAW_[nama] = n < 2 ? [] : sh.getRange(2, 1, n - 1, h.length).getDisplayValues();
  }
  return RAW_[nama]
    .filter(r => r.some(c => c !== ''))
    .map(r => { const o = {}; h.forEach((k, i) => (o[k] = r[i])); return o; });
}

function tulis_(nama, rows) {
  const sh = sheet_(nama), h = SKEMA[nama];
  hapusCacheDb_([nama]);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, h.length).clearContent();
  if (rows.length) {
    const v = rows.map(o => h.map(k => (o[k] == null ? '' : String(o[k]))));
    sh.getRange(2, 1, v.length, h.length).setNumberFormat('@').setValues(v);
  }
}

function kunci_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function pengaturan_() {
  const set = Object.assign({}, PENGATURAN_AWAL);
  baca_('Pengaturan').forEach(r => (set[r.Kunci] = r.Nilai));
  return set;
}

/* ---------- Keamanan: hash, sesi, anti brute-force ---------- */

function hash_(salt, teks) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + teks, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}

function adminAda_() {
  return !!PropertiesService.getScriptProperties().getProperty('ADM_HASH');
}

function setAdmin_(user, pass) {
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({
    ADM_USER: String(user).trim().toLowerCase(), ADM_SALT: salt, ADM_HASH: hash_(salt, pass)
  });
}

function cekAdmin_(user, pass) {
  const p = PropertiesService.getScriptProperties().getProperties();
  return !!p.ADM_HASH && user === p.ADM_USER && hash_(p.ADM_SALT, pass) === p.ADM_HASH;
}

function buatSesi_(role, sid, nama) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + token, JSON.stringify({ role: role, sid: sid || '', nama: nama || '' }), TTL_SESI);
  return { token: token, role: role, nama: nama || '' };
}

function sesi_(token, role) {
  if (!token) throw new Error('SESI_HABIS');
  const raw = CacheService.getScriptCache().get('tok_' + token);
  if (!raw) throw new Error('SESI_HABIS');
  const s = JSON.parse(raw);
  if (role && s.role !== role) throw new Error('Akses ditolak.');
  return s;
}

function kunciGagal_(mode, user) {
  return 'gagal_' + Utilities.base64EncodeWebSafe(mode + '|' + user).slice(0, 100);
}
function cekBlok_(k) {
  if (Number(CacheService.getScriptCache().get(k) || 0) >= 5)
    throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
}
function catatGagal_(k) {
  const c = CacheService.getScriptCache();
  c.put(k, String(Number(c.get(k) || 0) + 1), 600);
}

function pinAcak_() {
  return String(100000 + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000));
}

function simpanAkun_(daftar) { // daftar: [{id, pin}]
  kunci_(() => {
    const akun = baca_('Akun').filter(a => !daftar.some(d => d.id === a.SiswaID));
    daftar.forEach(d => akun.push({ SiswaID: d.id, Hash: hash_(d.id, d.pin) }));
    tulis_('Akun', akun);
  });
}

/* ---------- API publik (tanpa token) ---------- */

function api_status() {
  return { adminAda: adminAda_() };
}

function api_setupAdmin(user, pass) {
  user = String(user || '').trim(); pass = String(pass || '');
  return kunci_(() => {
    if (adminAda_()) throw new Error('Akun admin sudah dibuat.');
    if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
    if (pass.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    setAdmin_(user, pass);
    return buatSesi_('admin', '', user);
  });
}

function api_login(mode, user, pass) {
  user = String(user || '').trim().toLowerCase(); pass = String(pass || '');
  if (!user || !pass) throw new Error('Lengkapi data masuk.');
  const kg = kunciGagal_(mode, user);
  cekBlok_(kg);
  muatSemua_(mode === 'admin' ? ['Pengguna'] : ['Siswa', 'Akun']);
  if (mode === 'admin') {
    if (!adminAda_()) throw new Error('Akun admin belum dibuat.');
    if (cekAdmin_(user, pass)) { CacheService.getScriptCache().remove(kg); return buatSesi_('admin', '', user); }
    const staf = baca_('Pengguna').find(u => u.Username === user && u.Hash === hash_(u.ID, pass));
    if (staf) { CacheService.getScriptCache().remove(kg); return buatSesi_('staf', staf.ID, staf.Nama); }
  } else {
    const akun = baca_('Akun');
    const cocok = baca_('Siswa').find(s => String(s.NIS).trim().toLowerCase() === user &&
      akun.some(a => a.SiswaID === s.ID && a.Hash === hash_(s.ID, pass)));
    if (cocok) { CacheService.getScriptCache().remove(kg); return buatSesi_('siswa', cocok.ID, cocok.Nama); }
  }
  catatGagal_(kg);
  throw new Error('Nama pengguna / NIS atau kata sandi / PIN salah.');
}

/* ---------- API terproteksi (wajib token) ---------- */

function api_cekSesi(token) {
  const s = sesi_(token);
  return { role: s.role, nama: s.nama };
}

function api_logout(token) {
  CacheService.getScriptCache().remove('tok_' + token);
  return true;
}

// --- Admin ---

/* ---------- Hak akses guru / wali kelas ---------- */

function pisah_(t) { return String(t || '').split(',').filter(Boolean); }

// Normalisasi peran & kelas satu pengguna. Satu akun boleh wali kelas dan guru mapel sekaligus:
// wali = kelas yang diwalikan (hak penuh), mengajar = kelas tempat mengajar mapel.
// Akun lama satu peran tanpa KelasWali/KelasMengajar memakai kolom Kelas.
function perluas_(u) {
  const roles = pisah_(u.Peran), semua = pisah_(u.Kelas);
  const wali = roles.indexOf('wali') >= 0 ? (pisah_(u.KelasWali).length ? pisah_(u.KelasWali) : semua) : [];
  const mengajar = roles.indexOf('guru') >= 0 ? (pisah_(u.KelasMengajar).length ? pisah_(u.KelasMengajar) : semua) : [];
  return { roles: roles, wali: wali, mengajar: mengajar };
}

// Mengembalikan {peran, izin, wali, guru}. izin = null untuk admin (semua kelas); untuk staf = semua kelas yang ditugaskan.
// wali = kelas yang diwalikan; guru = kelas tempat hanya mengajar. Data dibaca ulang setiap panggilan,
// jadi perubahan peran/kelas atau penghapusan akun langsung berlaku.
function staf_(token) {
  const s = sesi_(token);
  if (s.role === 'admin') return { peran: 'admin', izin: null, nama: s.nama };
  if (s.role !== 'staf') throw new Error('Akses ditolak.');
  const u = baca_('Pengguna').find(x => x.ID === s.sid);
  if (!u) throw new Error('SESI_HABIS');
  const p = perluas_(u), guru = p.mengajar.filter(k => p.wali.indexOf(k) < 0);
  return { peran: p.roles.join(','), izin: p.wali.concat(guru), wali: p.wali, guru: guru, nama: u.Nama, user: u };
}
// Kelas yang boleh ditulis pada sheet tertentu (null = semua, untuk admin).
function tulisKelas_(st, nama) {
  if (!st.izin) return null;
  return (IZIN_TULIS.wali.indexOf(nama) >= 0 ? st.wali : []).concat(IZIN_TULIS.guru.indexOf(nama) >= 0 ? st.guru : []);
}
function bolehTulis_(st, nama) { const k = tulisKelas_(st, nama); return !k || k.length > 0; }
function tulisDi_(st, nama, kelas) { const k = tulisKelas_(st, nama); return !k || k.indexOf(kelas) >= 0; }
function bolehPIN_(st, kelas) { return !st.izin || st.wali.indexOf(kelas) >= 0; }

function tugasIzin_(izin) {
  const milik = {}, semua = {};
  baca_('Tugas').forEach(t => { semua[t.ID] = true; if (izin.indexOf(t.Kelas) >= 0) milik[t.ID] = true; });
  return { milik: milik, semua: semua };
}

// Baca sheet; untuk guru/wali hanya baris dari kelas yang ditugaskan.
function bacaIzin_(nama, izin) {
  const rows = baca_(nama);
  if (!izin) return rows;
  if (nama === 'Kelas') return rows.filter(r => izin.indexOf(r.ID) >= 0);
  if (nama === 'Pengumpulan') { const t = tugasIzin_(izin); return rows.filter(r => t.milik[r.TugasID]); }
  if (SKEMA[nama].indexOf('Kelas') >= 0) return rows.filter(r => izin.indexOf(r.Kelas) >= 0);
  return rows;
}

// Gabungkan kiriman guru/wali dengan data kelas lain agar data kelas lain tidak tertimpa.
function gabungIzin_(nama, rows, izin) {
  const lama = baca_(nama);
  if (nama === 'Pengumpulan') {
    const t = tugasIzin_(izin);
    return lama.filter(r => t.semua[r.TugasID] && !t.milik[r.TugasID]).concat(rows.filter(r => t.milik[r.TugasID]));
  }
  if (SKEMA[nama].indexOf('Kelas') < 0) throw new Error('Akses ditolak.');
  return lama.filter(r => izin.indexOf(r.Kelas) < 0).concat(rows.filter(r => izin.indexOf(r.Kelas) >= 0));
}

function daftarPengguna_() {
  return baca_('Pengguna').map(u => {
    const p = perluas_(u), semua = p.wali.concat(p.mengajar.filter(k => p.wali.indexOf(k) < 0));
    return { ID: u.ID, Nama: u.Nama, Username: u.Username, Peran: p.roles.join(','), Kelas: semua.join(','),
      KelasWali: p.wali.join(','), KelasMengajar: p.mengajar.join(','), Mapel: u.Mapel };
  });
}

function api_load(token, segarkan) {
  if (segarkan) hapusCacheDb_();
  pastikanSkema_();
  muatSemua_(Object.keys(SKEMA));
  const st = staf_(token);
  const out = {};
  Object.keys(SKEMA).forEach(n => { if (SHEET_TERKUNCI.indexOf(n) < 0) out[n] = bacaIzin_(n, st.izin); });
  out.Pengaturan = pengaturan_();
  const pin = baca_('Akun').map(a => a.SiswaID);
  out.punyaPIN = st.izin ? pin.filter(id => out.Siswa.some(s => s.ID === id)) : pin;
  out.peran = st.peran;
  out.kelasWali = st.izin ? st.wali : null;
  out.namaPengguna = st.nama || '';
  // Nama guru + mapel yang diajar (tanpa nama pengguna/hash) untuk pilihan pada jadwal dan modul
  out.GuruList = baca_('Pengguna').map(u => { const p = perluas_(u); return { Nama: u.Nama, Mapel: u.Mapel, KelasWali: p.wali.join(','), KelasMengajar: p.mengajar.join(',') }; });
  out.mapelSaya = st.user ? String(st.user.Mapel || '') : '';
  const admin = st.peran === 'admin';
  out.adminUser = admin ? (PropertiesService.getScriptProperties().getProperty('ADM_USER') || '') : '';
  if (admin) { // tautan disimpan agar tidak perlu membuka spreadsheet setiap kali
    out.urlSheet = props_().SS_URL || '';
    if (!out.urlSheet) { out.urlSheet = ss_().getUrl(); PropertiesService.getScriptProperties().setProperty('SS_URL', out.urlSheet); }
  } else out.urlSheet = '';
  if (admin) out.Pengguna = daftarPengguna_();
  return out;
}

/* ---------- Validasi jadwal: tanpa bentrok ---------- */
const HARI_VALID_ = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function menit_(t) { const m = /^(\d{2}):(\d{2})$/.exec(String(t || '')); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1; }
const tumpang_ = (a, b) => menit_(a.Mulai) < menit_(b.Selesai) && menit_(b.Mulai) < menit_(a.Selesai);
const pekanTemu_ = (a, b) => !a.Pekan || !b.Pekan || a.Pekan === b.Pekan; // pekan A dan B tidak bertemu
const adalahPelajaran_ = r => !r.Jenis || r.Jenis === 'Pelajaran';

// rows = seluruh jadwal (semua kelas) setelah penggabungan. Hanya baris yang baru/berubah diperiksa,
// agar bentrok lama yang tidak diubah tidak menghalangi penyimpanan. Dua jenis bentrok ditolak:
// (1) dua kegiatan di kelas yang sama pada jam yang beririsan, (2) guru yang sama di dua kelas pada jam yang beririsan.
function validasiJadwal_(rows, lama) {
  const lamaMap = {}; lama.forEach(r => (lamaMap[r.ID] = r));
  const kunci = ['Kelas', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Jenis', 'Pekan'];
  const sama = (a, b) => kunci.every(k => String(a[k] || '') === String(b[k] || ''));
  const kelas = {}; baca_('Kelas').forEach(k => (kelas[k.ID] = k.Nama));
  rows.forEach(r => {
    if (lamaMap[r.ID] && sama(r, lamaMap[r.ID])) return;
    const nm = (kelas[r.Kelas] || 'kelas') + ' · ' + r.Mapel;
    if (HARI_VALID_.indexOf(r.Hari) < 0) throw new Error('Hari tidak valid pada ' + nm + '.');
    if (menit_(r.Mulai) < 0 || menit_(r.Selesai) <= menit_(r.Mulai)) throw new Error('Jam tidak valid pada ' + nm + ': jam selesai harus setelah jam mulai.');
    if (['', 'A', 'B'].indexOf(String(r.Pekan || '')) < 0) throw new Error('Pekan harus kosong, A, atau B.');
    const guru = String(r.Guru || '').trim().toLowerCase();
    rows.forEach(o => {
      if (o === r || o.ID === r.ID || o.Hari !== r.Hari || !tumpang_(r, o) || !pekanTemu_(r, o)) return;
      if (o.Kelas === r.Kelas) throw new Error('Jadwal bentrok di ' + (kelas[r.Kelas] || 'kelas ini') + ' hari ' + r.Hari + ': ' + r.Mapel + ' (' + r.Mulai + '–' + r.Selesai + ') dengan ' + o.Mapel + ' (' + o.Mulai + '–' + o.Selesai + ').');
      if (guru && adalahPelajaran_(r) && adalahPelajaran_(o) && String(o.Guru || '').trim().toLowerCase() === guru)
        throw new Error('Guru ' + r.Guru + ' sudah mengajar ' + o.Mapel + ' di kelas ' + (kelas[o.Kelas] || '?') + ' hari ' + r.Hari + ' ' + o.Mulai + '–' + o.Selesai + ', bentrok dengan ' + r.Mapel + ' di ' + (kelas[r.Kelas] || 'kelas ini') + '.');
    });
  });
}

function api_saveSheet(token, nama, rows) {
  const st = staf_(token);
  if (!SKEMA[nama] || SHEET_TERKUNCI.indexOf(nama) >= 0) throw new Error('Sheet tidak dikenal: ' + nama);
  if (!bolehTulis_(st, nama)) throw new Error('Anda tidak punya izin mengubah data ini.');
  const tk = tulisKelas_(st, nama);
  return kunci_(() => {
    rows = rows || [];
    if (st.izin) rows = gabungIzin_(nama, rows, tk);
    if (nama === 'Jadwal') validasiJadwal_(rows, baca_('Jadwal'));
    tulis_(nama, rows);
    if (nama === 'Siswa') { // bersihkan akun siswa yang sudah dihapus
      const ada = {}; rows.forEach(s => (ada[s.ID] = true));
      tulis_('Akun', baca_('Akun').filter(a => ada[a.SiswaID]));
    }
    return true;
  });
}

function api_savePengaturan(token, obj) {
  sesi_(token, 'admin');
  return kunci_(() => {
    tulis_('Pengaturan', Object.keys(obj).map(k => ({ Kunci: k, Nilai: obj[k] })));
    return true;
  });
}

function api_saveAbsensi(token, kelas, tanggal, recs) {
  const st = staf_(token);
  if (!tulisDi_(st, 'Absensi', kelas)) throw new Error('Anda tidak punya izin mengubah absensi kelas ini.');
  return kunci_(() => {
    const semua = baca_('Absensi').filter(a => !(a.Kelas === kelas && a.Tanggal === tanggal));
    (recs || []).forEach(r => semua.push({ Kelas: kelas, Tanggal: tanggal, SiswaID: r.SiswaID, Kode: r.Kode, Keterangan: r.Keterangan || '', Sumber: '' }));
    tulis_('Absensi', semua);
    return true;
  });
}

// Atur PIN satu siswa. pin kosong = dibuatkan acak. Mengembalikan PIN (hanya ditampilkan sekali).
function api_setPIN(token, sid, pin) {
  const st = staf_(token);
  const s = baca_('Siswa').find(x => x.ID === sid);
  if (!s) throw new Error('Siswa tidak ditemukan.');
  if (!bolehPIN_(st, s.Kelas)) throw new Error('Anda tidak punya izin mengatur PIN siswa ini. Hanya wali kelas yang dapat melakukannya.');
  if (!String(s.NIS).trim()) throw new Error('Isi NIS siswa dulu (NIS dipakai sebagai nama pengguna).');
  pin = String(pin || '').trim();
  if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('PIN harus 4-8 angka.');
  if (!pin) pin = pinAcak_();
  simpanAkun_([{ id: sid, pin: pin }]);
  return pin;
}

// Buat PIN acak untuk semua siswa di satu kelas. timpa=false: hanya yang belum punya PIN; timpa=true: reset semua.
function api_buatPINSemua(token, kelas, timpa, pinSeragam) {
  const st = staf_(token);
  if (!bolehPIN_(st, kelas)) throw new Error('Anda tidak punya izin mengatur PIN kelas ini. Hanya wali kelas yang dapat melakukannya.');
  pinSeragam = String(pinSeragam || '').trim();
  if (pinSeragam && !/^\d{4,8}$/.test(pinSeragam)) throw new Error('PIN harus 4-8 angka.');
  const sudah = {}; if (!timpa) baca_('Akun').forEach(a => (sudah[a.SiswaID] = true));
  const daftar = [], hasil = []; let dilewati = 0;
  baca_('Siswa').filter(s => s.Kelas === kelas && !sudah[s.ID]).forEach(s => {
    if (!String(s.NIS).trim()) { dilewati++; return; }
    const pin = pinSeragam || pinAcak_();
    daftar.push({ id: s.ID, pin: pin });
    hasil.push({ id: s.ID, nama: s.Nama, nis: s.NIS, pin: pin });
  });
  if (daftar.length) simpanAkun_(daftar);
  return { daftar: hasil, dilewati: dilewati };
}

function api_gantiAdmin(token, userBaru, passLama, passBaru) {
  sesi_(token, 'admin');
  const p = PropertiesService.getScriptProperties();
  if (!cekAdmin_(p.getProperty('ADM_USER'), String(passLama || ''))) throw new Error('Kata sandi lama salah.');
  const user = String(userBaru || '').trim() || p.getProperty('ADM_USER');
  if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
  passBaru = String(passBaru || '') || String(passLama);
  if (passBaru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  setAdmin_(user, passBaru);
  return true;
}

// --- Manajemen pengguna (guru / wali kelas), hanya admin ---

function sandiAcak_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

function api_simpanPengguna(token, d) {
  sesi_(token, 'admin');
  d = d || {};
  const nama = String(d.Nama || '').trim(), user = String(d.Username || '').trim().toLowerCase();
  let sandi = String(d.Sandi || '').trim();
  if (!nama) throw new Error('Nama wajib diisi.');
  if (user.length < 3) throw new Error('Nama pengguna minimal 3 karakter.');
  if (sandi && sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  if (user === PropertiesService.getScriptProperties().getProperty('ADM_USER')) throw new Error('Nama pengguna ini dipakai admin.');
  const ada = baca_('Kelas').map(k => k.ID), valid = ids => (ids || []).filter((id, i, a) => ada.indexOf(id) >= 0 && a.indexOf(id) === i);
  let kw = valid(d.KelasWali), km = valid(d.KelasMengajar);
  if (d.KelasWali === undefined && d.KelasMengajar === undefined) { // format lama: satu peran + daftar kelas
    const k = valid(d.Kelas);
    if (d.Peran === 'wali') kw = k; else if (d.Peran === 'guru') km = k; else throw new Error('Peran tidak valid.');
  }
  if (!kw.length && !km.length) throw new Error('Pilih minimal satu kelas sebagai wali kelas atau guru mapel.');
  const peran = (kw.length ? ['wali'] : []).concat(km.length ? ['guru'] : []);
  const semuaKelas = kw.concat(km.filter(k => kw.indexOf(k) < 0));
  const adaMapel = baca_('Mapel').map(m => m.ID), mapel = (d.Mapel || []).filter(id => adaMapel.indexOf(id) >= 0);
  return kunci_(() => {
    const semua = baca_('Pengguna');
    if (semua.some(u => u.Username === user && u.ID !== d.ID)) throw new Error('Nama pengguna sudah dipakai.');
    let u = d.ID ? semua.find(x => x.ID === d.ID) : null, tampil = '';
    if (!u) { u = { ID: Utilities.getUuid().replace(/-/g, '').slice(0, 12) }; semua.push(u); if (!sandi) sandi = sandiAcak_(); }
    if (sandi) { u.Hash = hash_(u.ID, sandi); tampil = sandi; }
    Object.assign(u, { Nama: nama, Username: user, Peran: peran.join(','), Kelas: semuaKelas.join(','),
      KelasWali: kw.join(','), KelasMengajar: km.join(','), Mapel: mapel.join(',') });
    tulis_('Pengguna', semua);
    return { daftar: daftarPengguna_(), sandi: tampil, username: user };
  });
}

function api_hapusPengguna(token, id) {
  sesi_(token, 'admin');
  return kunci_(() => { tulis_('Pengguna', baca_('Pengguna').filter(u => u.ID !== id)); return daftarPengguna_(); });
}

function api_resetSandiPengguna(token, id, sandi) {
  sesi_(token, 'admin');
  sandi = String(sandi || '').trim() || sandiAcak_();
  if (sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  return kunci_(() => {
    const semua = baca_('Pengguna'), u = semua.find(x => x.ID === id);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    u.Hash = hash_(u.ID, sandi); tulis_('Pengguna', semua);
    return { sandi: sandi, username: u.Username };
  });
}

// Guru / wali memilih mata pelajaran yang diajarnya sendiri (dari daftar mapel sekolah).
function api_setMapelSaya(token, ids) {
  const s = sesi_(token, 'staf');
  const ada = baca_('Mapel').map(m => m.ID), pilih = (ids || []).filter(id => ada.indexOf(id) >= 0);
  return kunci_(() => {
    const semua = baca_('Pengguna'), u = semua.find(x => x.ID === s.sid);
    if (!u) throw new Error('SESI_HABIS');
    u.Mapel = pilih.join(','); tulis_('Pengguna', semua);
    return pilih.join(',');
  });
}

// Guru / wali mengganti kata sandinya sendiri.
function api_gantiSandiSaya(token, lama, baru) {
  const s = sesi_(token, 'staf');
  baru = String(baru || '');
  if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  return kunci_(() => {
    const semua = baca_('Pengguna'), u = semua.find(x => x.ID === s.sid);
    if (!u || u.Hash !== hash_(u.ID, String(lama || ''))) throw new Error('Kata sandi lama salah.');
    u.Hash = hash_(u.ID, baru); tulis_('Pengguna', semua); return true;
  });
}

// --- Siswa ---

// Nama wali kelas dari akun pengguna yang ditugaskan sebagai wali kelas tersebut.
function waliKelas_(kelasId) {
  return baca_('Pengguna').filter(u => perluas_(u).wali.indexOf(kelasId) >= 0).map(u => u.Nama).join(', ');
}

function api_loadSiswa(token) {
  const sesi = sesi_(token, 'siswa');
  muatSemua_(['Siswa', 'Kelas', 'Absensi', 'Tugas', 'Pengumpulan', 'Nilai', 'Pengaturan', 'DenahAtur', 'Denah', 'Piket', 'Struktur', 'Jadwal', 'JadwalAtur', 'Akademik', 'Pengguna']);
  const siswa = baca_('Siswa').find(x => x.ID === sesi.sid);
  if (!siswa) throw new Error('SESI_HABIS');
  const kelas = baca_('Kelas').find(k => k.ID === siswa.Kelas) || {};
  const absKelas = baca_('Absensi').filter(a => a.Kelas === siswa.Kelas);
  const tanggal = {}; absKelas.forEach(a => (tanggal[a.Tanggal] = true));
  const tugas = baca_('Tugas').filter(t => t.Kelas === siswa.Kelas);
  const pg = baca_('Pengumpulan').filter(p => p.SiswaID === siswa.ID);
  const set = pengaturan_();
  // Denah, piket, struktur, jadwal (hanya nama teman sekelas yang dikirim, tanpa data pribadi lain)
  const nm = {}; baca_('Siswa').filter(s => s.Kelas === siswa.Kelas).forEach(s => (nm[s.ID] = s.Nama));
  const atur = baca_('DenahAtur').find(a => a.Kelas === siswa.Kelas) || { Baris: '5', Kolom: '6', Grup: '2' };
  const denah = {
    Baris: atur.Baris, Kolom: atur.Kolom, Grup: atur.Grup,
    kursi: baca_('Denah').filter(d => d.Kelas === siswa.Kelas && nm[d.SiswaID])
      .map(d => ({ Baris: d.Baris, Kolom: d.Kolom, Nama: nm[d.SiswaID], Saya: d.SiswaID === siswa.ID }))
  };
  const piket = baca_('Piket').filter(p => p.Kelas === siswa.Kelas && nm[p.SiswaID])
    .map(p => ({ Hari: p.Hari, Tugas: p.Tugas, Nama: nm[p.SiswaID], Saya: p.SiswaID === siswa.ID }));
  const struktur = baca_('Struktur').filter(s => s.Kelas === siswa.Kelas)
    .map(s => ({ Jabatan: s.Jabatan, Tingkat: s.Tingkat, Nama: nm[s.SiswaID] || '', Saya: s.SiswaID === siswa.ID }));
  const jadwal = baca_('Jadwal').filter(j => j.Kelas === siswa.Kelas)
    .map(j => ({ Hari: j.Hari, Mulai: j.Mulai, Selesai: j.Selesai, Mapel: j.Mapel, Guru: j.Guru, Jenis: j.Jenis, Pekan: j.Pekan }));
  return {
    siswa: { Nama: siswa.Nama, NIS: siswa.NIS },
    kelas: kelas.Nama || '', mapel: kelas.Mapel || '',
    sekolah: set.sekolah, semester: set.semester, wali: waliKelas_(siswa.Kelas) || set.wali, guru: set.guru,
    denah: denah, piket: piket, struktur: struktur, jadwal: jadwal,
    sekretaris: baca_('Struktur').some(j => j.Kelas === siswa.Kelas && j.SiswaID === siswa.ID && /sekretaris/i.test(j.Jabatan)),
    sistemJadwal: (baca_('JadwalAtur').find(a => a.Kelas === siswa.Kelas) || {}).Sistem || 'reguler', mulaiSemester: set.mulai,
    akademik: baca_('Akademik').map(a => ({ Mulai: a.Mulai, Selesai: a.Selesai, Kegiatan: a.Kegiatan, Jenis: a.Jenis })),
    pengaturan: { kkm: set.kkm, b_sikap: set.b_sikap, b_tugas: set.b_tugas, b_proyek: set.b_proyek, b_uts: set.b_uts, b_uas: set.b_uas },
    totalPertemuan: Object.keys(tanggal).length,
    absensi: absKelas.filter(a => a.SiswaID === siswa.ID).map(a => ({ Tanggal: a.Tanggal, Kode: a.Kode, Keterangan: a.Keterangan })),
    tugas: tugas.map(t => { const p = pg.find(x => x.TugasID === t.ID); return { Judul: t.Judul, Jenis: t.Jenis, Tenggat: t.Tenggat, Status: p ? p.Status : 'Belum', Nilai: p ? p.Nilai : '' }; }),
    nilai: baca_('Nilai').find(n => n.Kelas === siswa.Kelas && n.SiswaID === siswa.ID) || null
  };
}

/* ---------- Absensi oleh sekretaris kelas (akun siswa) ---------- */
const KODE_ABSEN_ = ['H', 'S', 'I', 'A', 'T', 'D'];

// Siswa memegang jabatan "Sekretaris" di Struktur kelasnya? Dicek ulang tiap panggilan.
function sekretaris_(token) {
  const sesi = sesi_(token, 'siswa');
  const s = baca_('Siswa').find(x => x.ID === sesi.sid);
  if (!s) throw new Error('SESI_HABIS');
  const ok = baca_('Struktur').some(j => j.Kelas === s.Kelas && j.SiswaID === s.ID && /sekretaris/i.test(j.Jabatan));
  return { siswa: s, ok: ok };
}
function wajibSekretaris_(token) {
  const sk = sekretaris_(token);
  if (!sk.ok) throw new Error('Hanya sekretaris kelas yang dapat mengisi absensi.');
  return sk.siswa;
}
function tanggalSekretaris_(t) {
  t = String(t || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('Tanggal tidak valid.');
  const fmt = ms => Utilities.formatDate(new Date(ms), 'Asia/Jakarta', 'yyyy-MM-dd');
  const sekarang = Date.now();
  if (t > fmt(sekarang)) throw new Error('Tanggal tidak boleh di masa depan.');
  if (t < fmt(sekarang - 7 * 86400000)) throw new Error('Sekretaris hanya dapat mengisi absensi 7 hari terakhir.');
  return t;
}

function api_absensiKelas(token, tanggal) {
  const s = wajibSekretaris_(token);
  tanggal = tanggalSekretaris_(tanggal);
  const rec = baca_('Absensi').filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
  return {
    tanggal: tanggal,
    siswa: baca_('Siswa').filter(x => x.Kelas === s.Kelas).sort((a, b) => a.Nama.localeCompare(b.Nama)).map(x => ({ ID: x.ID, Nama: x.Nama })),
    catatan: rec.map(a => ({ SiswaID: a.SiswaID, Kode: a.Kode, Keterangan: a.Keterangan })),
    terkunci: rec.some(a => a.Sumber !== 'sekretaris') // sudah diisi/dikonfirmasi guru
  };
}

function api_simpanAbsensiSekretaris(token, tanggal, recs) {
  const s = wajibSekretaris_(token);
  tanggal = tanggalSekretaris_(tanggal);
  return kunci_(() => {
    const semua = baca_('Absensi'), lama = semua.filter(a => a.Kelas === s.Kelas && a.Tanggal === tanggal);
    if (lama.some(a => a.Sumber !== 'sekretaris')) throw new Error('Absensi tanggal ini sudah diisi atau dikonfirmasi guru, sehingga tidak bisa diubah dari akun siswa.');
    const anggota = {}; baca_('Siswa').forEach(x => { if (x.Kelas === s.Kelas) anggota[x.ID] = true; });
    const dipakai = {}, baru = [];
    (recs || []).forEach(r => {
      if (!anggota[r.SiswaID] || dipakai[r.SiswaID] || KODE_ABSEN_.indexOf(r.Kode) < 0) return;
      dipakai[r.SiswaID] = true;
      baru.push({ Kelas: s.Kelas, Tanggal: tanggal, SiswaID: r.SiswaID, Kode: r.Kode, Keterangan: String(r.Keterangan || '').slice(0, 200), Sumber: 'sekretaris' });
    });
    tulis_('Absensi', semua.filter(a => !(a.Kelas === s.Kelas && a.Tanggal === tanggal)).concat(baru));
    return baru.length;
  });
}

function api_gantiPIN(token, lama, baru) {
  const sesi = sesi_(token, 'siswa');
  baru = String(baru || '').trim();
  if (!/^\d{4,8}$/.test(baru)) throw new Error('PIN baru harus 4-8 angka.');
  const a = baca_('Akun').find(x => x.SiswaID === sesi.sid);
  if (!a || a.Hash !== hash_(sesi.sid, String(lama || ''))) throw new Error('PIN lama salah.');
  simpanAkun_([{ id: sesi.sid, pin: baru }]);
  return true;
}
