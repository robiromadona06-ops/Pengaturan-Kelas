export const KODE: Record<string, [string, string, string]> = {
  H: ['Hadir', '#10b981', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
  S: ['Sakit', '#3b82f6', 'bg-blue-50 text-blue-800 border-blue-200'],
  I: ['Izin', '#eab308', 'bg-amber-50 text-amber-800 border-amber-200'],
  A: ['Alpa', '#ef4444', 'bg-rose-50 text-rose-800 border-rose-200'],
  T: ['Terlambat', '#f97316', 'bg-orange-50 text-orange-800 border-orange-200'],
  D: ['Dispensasi', '#8b5cf6', 'bg-violet-50 text-violet-800 border-violet-200']
};

export const KODE_DESKRIPSI: Record<string, string> = {
  H: 'Siswa berada di kelas sepanjang pelajaran. Tidak perlu bukti tambahan.',
  S: 'Bukti: pesan orang tua, atau surat dokter untuk sakit lebih dari 2 hari. Tawarkan materi susulan.',
  I: 'Bukti: surat izin dari orang tua. Siswa bertanggung jawab menyusul tugas.',
  A: 'Tidak hadir tanpa keterangan. Hubungi orang tua pada hari yang sama.',
  T: 'Hadir setelah absensi dibuka. Catat jam datang dan alasannya.',
  D: 'Mewakili sekolah (lomba, kegiatan resmi). Bukti: surat tugas atau persetujuan guru.'
};

export const TABS: [string, string, string][] = [
  ['dash', 'Dasbor', 'LayoutDashboard'],
  ['cld', 'Cloud & Analisis AI', 'CloudUpload'],
  ['abs', 'Absensi', 'CheckSquare'],
  ['sis', 'Siswa', 'Users'],
  ['den', 'Denah', 'Grid'],
  ['pik', 'Piket', 'Sparkles'],
  ['str', 'Struktur', 'Network'],
  ['jad', 'Jadwal', 'CalendarClock'],
  ['ajar', 'Perangkat Ajar', 'BookOpen'],
  ['cbt', 'CBT & Soal AI', 'FileCheck2'],
  ['tug', 'Tugas', 'ClipboardList'],
  ['nil', 'Nilai', 'BarChart3'],
  ['per', 'Perilaku', 'Award'],
  ['kal', 'Kalender', 'CalendarDays'],
  ['pan', 'Panduan', 'Compass'],
  ['usr', 'Akun Saya', 'UserCheck'],
  ['set', 'Pengaturan', 'Settings'],
  ['rst', 'Reset & Database', 'RotateCcw']
];

export const TANGGA = [
  null,
  'Alpa 1 hari: pesan singkat kepada orang tua dan ajak siswa bicara saat kembali.',
  'Alpa 3 hari (akumulasi): wali kelas memanggil orang tua dan menyusun rencana kehadiran.',
  'Alpa 5 hari: libatkan guru BK, gali penyebab, dan tawarkan dukungan.',
  'Alpa 10 hari atau lebih: koordinasi kepala sekolah dan kunjungan rumah.'
];

export const KALENDER: [number, number, string, string, string][] = [
  [1, 1, 'Orientasi & kontrak belajar', 'Perkenalan, aturan kelas, asesmen diagnostik, pembentukan struktur kelas.', '#8b5cf6'],
  [2, 7, 'Pembelajaran inti I', 'Absensi harian, tugas, dan asesmen formatif berkala.', '#10b981'],
  [8, 8, 'Ujian Tengah Semester', 'Asesmen sumatif pertama dan laporan kemajuan.', '#3b82f6'],
  [9, 9, 'Analisis & tindak lanjut UTS', 'Bahas hasil, remedial, penguatan, dan pengayaan.', '#eab308'],
  [10, 15, 'Pembelajaran inti II & proyek', 'Materi lanjutan, pengerjaan proyek, presentasi, dan penilaian praktik.', '#f97316'],
  [16, 16, 'Review & penutupan materi', 'Rangkuman, latihan soal, dan konsultasi.', '#06b6d4'],
  [17, 18, 'Ujian Akhir Semester', 'Asesmen sumatif akhir dan pengumpulan produk proyek.', '#ec4899'],
  [19, 20, 'Olah nilai, rapor & refleksi', 'Remedial akhir, rekap, rapor, konferensi orang tua, dan refleksi.', '#f43f5e']
];

export const CHECKLIST = [
  'Data siswa dan kontak orang tua terbarui',
  'Denah, jadwal piket, dan aturan kelas terpasang',
  'Modul ajar dan tujuan pembelajaran siap',
  'Absensi harian direkap setiap minggu',
  'Rubrik tugas dan proyek dibagikan di awal',
  'Nilai formatif dan sumatif dicatat per tujuan pembelajaran',
  'Remedial dan pengayaan terdokumentasi',
  'Nilai akhir diverifikasi dua kali',
  'Rapor, refleksi, dan arsip selesai'
];

export const KOMUNIKASI: [string, string][] = [
  ['Awal semester', 'Pertemuan orang tua: paparkan aturan, sistem penilaian, dan saluran komunikasi resmi.'],
  ['Berkala', 'Laporan singkat perkembangan. Kabarkan hal baik, jangan hanya masalah.'],
  ['Saat ada kasus', 'Hubungi di hari yang sama dengan fakta, dampak, dan usulan solusi bersama.'],
  ['Akhir semester', 'Pembagian rapor dan konferensi: bahas kekuatan, area tumbuh, dan target semester depan.']
];

export const ATURAN: [string, string][] = [
  ['Tepat waktu', 'Hadir sebelum bel dan siap belajar.'],
  ['Saling menghormati', 'Dengarkan saat orang lain berbicara.'],
  ['Siap belajar', 'Bawa alat belajar dan ikut berpartisipasi.'],
  ['Tanggung jawab', 'Selesaikan tugas dan jujur dalam bekerja.'],
  ['Jaga lingkungan', 'Kelas bersih, fasilitas terawat.']
];

export const LEVEL: Record<number, [string, string, string]> = {
  1: ['Pengingat', 'Isyarat non-verbal, mendekat, atau pengingat singkat tanpa menghentikan kelas.', '#10b981'],
  2: ['Teguran pribadi', 'Bicara berdua, tanyakan penyebab, dan minta siswa menyebutkan perbaikannya.', '#eab308'],
  3: ['Kesepakatan perbaikan', 'Catat di jurnal perilaku, buat rencana tertulis, dan beri tahu orang tua.', '#f97316'],
  4: ['Libatkan pihak sekolah', 'Wali kelas, guru BK, dan kepala sekolah menyusun pendampingan.', '#ef4444']
};

export interface TahapItem {
  n: number;
  w: string;
  t: string;
  c: string;
  tab: string;
  k: string[];
  d: string[];
  i: string[];
}

export const TAHAP: TahapItem[] = [
  {
    n: 1,
    w: 'Sebelum semester dimulai',
    t: 'Persiapan & Penataan Kelas',
    c: '#8b5cf6',
    tab: 'sis',
    k: [
      'Susun daftar siswa dan data dasar: kontak orang tua, alamat, catatan kesehatan.',
      'Atur denah tempat duduk berdasarkan kebutuhan belajar, bukan hanya urutan abjad.',
      'Bentuk struktur kelas: ketua, sekretaris, bendahara, dan jadwal piket.',
      'Siapkan sudut kelas: jadwal, pengumuman, sudut baca, papan prestasi.',
      'Rumuskan kontrak belajar dan aturan kelas bersama siswa.'
    ],
    d: ['Daftar hadir', 'Denah tempat duduk', 'Jadwal piket', 'Kontrak belajar', 'Kalender akademik'],
    i: [
      'Data 100% siswa lengkap dan terverifikasi.',
      'Denah dan jadwal piket terpasang di pekan pertama.',
      'Aturan kelas disepakati dan ditandatangani bersama.'
    ]
  },
  {
    n: 2,
    w: 'Setiap pertemuan · 5 menit pertama',
    t: 'Absensi & Kehadiran',
    c: '#ec4899',
    tab: 'abs',
    k: [
      'Salam, doa pembuka, dan cek kesiapan siswa.',
      'Cek kehadiran lewat panggilan nama, lembar tanda tangan, kode QR, atau aplikasi.',
      'Catat status dengan kode H, S, I, A, T, atau D.',
      'Konfirmasi siswa yang tidak hadir kepada ketua kelas atau orang tua.',
      'Rekap mingguan dan tindak lanjut sesuai tingkat ketidakhadiran.'
    ],
    d: ['Lembar absensi harian', 'Rekap mingguan', 'Surat izin / keterangan sakit', 'Log keterlambatan'],
    i: [
      'Absensi tercatat sebelum menit ke-5.',
      'Kehadiran kelas minimal 90%.',
      'Tindak lanjut ketidakhadiran maksimal 2 hari kerja.'
    ]
  },
  {
    n: 3,
    w: 'Setiap pertemuan · 10 menit',
    t: 'Pembukaan Pembelajaran',
    c: '#f97316',
    tab: 'ajar',
    k: [
      'Apersepsi: hubungkan materi hari ini dengan materi sebelumnya.',
      'Tampilkan tujuan pembelajaran dan kriteria keberhasilan di papan tulis.',
      'Berikan pertanyaan pemantik atau kasus singkat.',
      'Periksa kesiapan alat, buku, dan perangkat belajar.',
      'Sampaikan pengumuman penting secara singkat.'
    ],
    d: ['Modul ajar / RPP', 'Slide pemantik', 'Daftar tujuan pembelajaran'],
    i: [
      'Siswa mampu menyebutkan tujuan belajar hari itu.',
      'Transisi dari absensi ke materi tidak lebih dari 10 menit.'
    ]
  },
  {
    n: 4,
    w: 'Inti pertemuan',
    t: 'Kegiatan Inti & Pengelolaan Perilaku',
    c: '#eab308',
    tab: 'per',
    k: [
      'Pembelajaran berdiferensiasi: variasikan konten, proses, dan produk sesuai kesiapan siswa.',
      'Kelompok fleksibel dan heterogen dengan peran jelas.',
      'Rutinitas transisi yang konsisten: isyarat, hitungan mundur, penghitung waktu.',
      'Monitoring keliling dan pencatatan anekdotal tentang keterlibatan siswa.',
      'Penguatan perilaku positif sebelum teguran.'
    ],
    d: ['Lembar kerja', 'Rubrik diskusi', 'Jurnal perilaku', 'Papan poin kelas'],
    i: [
      'Minimal 80% siswa terlibat aktif.',
      'Pelanggaran ditangani sesuai tingkat, tanpa menghentikan pelajaran terlalu lama.'
    ]
  },
  {
    n: 5,
    w: 'Sepanjang semester',
    t: 'Penugasan & Pengumpulan',
    c: '#10b981',
    tab: 'tug',
    k: [
      'Berikan tugas dengan instruksi, tenggat, dan rubrik yang jelas.',
      'Kumpulkan di satu tempat: kotak tugas atau platform digital.',
      'Catat status: terkumpul tepat waktu, terlambat, atau belum.',
      'Terapkan kebijakan keterlambatan yang adil dan konsisten.',
      'Kembalikan tugas dengan umpan balik tertulis.'
    ],
    d: ['Rubrik tugas', 'Daftar pengumpulan', 'Portofolio siswa'],
    i: [
      'Minimal 90% tugas terkumpul tepat waktu.',
      'Tugas dikembalikan paling lambat 7 hari.'
    ]
  },
  {
    n: 6,
    w: 'Selama dan setelah pembelajaran',
    t: 'Asesmen Formatif & Umpan Balik',
    c: '#06b6d4',
    tab: 'tug',
    k: [
      'Kuis singkat, tiket keluar (exit ticket), dan observasi saat siswa bekerja.',
      'Refleksi diri dan penilaian antarteman dengan panduan jelas.',
      'Umpan balik spesifik: apa yang sudah baik, apa yang perlu diperbaiki, dan langkah berikutnya.',
      'Analisis hasil untuk menyesuaikan rencana pertemuan berikutnya.',
      'Identifikasi siswa yang perlu pendampingan sejak dini.'
    ],
    d: ['Kuis harian', 'Lembar observasi', 'Jurnal refleksi', 'Catatan pendampingan'],
    i: [
      'Umpan balik diberikan dalam 1 minggu.',
      'Data formatif dipakai untuk merencanakan pembelajaran berikutnya.'
    ]
  },
  {
    n: 7,
    w: 'Minggu 8 dan minggu 17–18',
    t: 'Asesmen Sumatif (UTS, UAS, Proyek)',
    c: '#3b82f6',
    tab: 'nil',
    k: [
      'Susun kisi-kisi dan soal yang selaras dengan tujuan pembelajaran.',
      'Umumkan jadwal dan cakupan materi paling lambat 1 minggu sebelumnya.',
      'Terapkan tata tertib ujian dan pengawasan yang tegas namun ramah.',
      'Koreksi, analisis ketuntasan per tujuan pembelajaran, lalu bahas bersama siswa.',
      'Nilai proyek atau praktik dengan rubrik yang dibagikan di awal.'
    ],
    d: ['Kisi-kisi', 'Soal & kunci jawaban', 'Rubrik proyek', 'Analisis ketuntasan', 'Berita acara ujian'],
    i: [
      'Hasil dikembalikan dan dibahas dalam 7 hari.',
      'Setiap siswa menerima tindak lanjut: remedial, penguatan, atau pengayaan.'
    ]
  },
  {
    n: 8,
    w: 'Minggu 19–20 · akhir semester',
    t: 'Penilaian Akhir & Pelaporan',
    c: '#f43f5e',
    tab: 'nil',
    k: [
      'Rekap seluruh komponen nilai dalam satu lembar induk.',
      'Hitung nilai akhir berbobot dan tetapkan predikat.',
      'Verifikasi dua kali, terutama nilai di batas antarpredikat.',
      'Tulis deskripsi capaian dan catatan wali kelas.',
      'Bagikan rapor dan adakan konferensi dengan orang tua.',
      'Refleksi kelas dan susun rencana perbaikan semester berikutnya, lalu arsipkan dokumen.'
    ],
    d: ['Rekap nilai induk', 'Rapor', 'Catatan wali kelas', 'Laporan refleksi'],
    i: [
      'Nilai akhir tervalidasi dua kali sebelum dicetak.',
      'Rapor selesai tepat waktu.',
      'Refleksi tertulis dengan minimal tiga rencana perbaikan.'
    ]
  }
];

export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const TUGAS_PIKET = [
  'Menyapu lantai',
  'Mengepel',
  'Menghapus papan tulis',
  'Merapikan meja & kursi',
  'Membuang sampah',
  'Menyiram tanaman'
];
export const STRUKTUR_STD: [string, number][] = [
  ['Ketua Kelas', 1],
  ['Wakil Ketua', 1],
  ['Sekretaris', 2],
  ['Bendahara', 2],
  ['Seksi Kebersihan', 3],
  ['Seksi Keamanan', 3],
  ['Seksi Kesehatan', 3],
  ['Seksi Perlengkapan', 3]
];
export const LVL_STR: Record<number, [string, string]> = {
  1: ['Pimpinan kelas', '#8b5cf6'],
  2: ['Pengurus inti', '#3b82f6'],
  3: ['Seksi & koordinator', '#10b981']
};
export const JENIS_AK: Record<string, string> = {
  'Kegiatan belajar': '#10b981',
  Ujian: '#3b82f6',
  Rapor: '#ec4899',
  'Kegiatan sekolah': '#eab308',
  Libur: '#ef4444',
  Lainnya: '#8b5cf6'
};
export const STATUS_TP: Record<string, string> = {
  Belum: '#f1f5f9',
  Berjalan: '#fef3c7',
  Tercapai: '#d1fae5'
};
export const MAPEL_UMUM = [
  'Pendidikan Agama',
  'PPKn',
  'Bahasa Indonesia',
  'Matematika',
  'IPA',
  'IPS',
  'Bahasa Inggris',
  'PJOK',
  'Seni Budaya',
  'Informatika',
  'Prakarya',
  'Bahasa Daerah'
];
export const PERAN_NAMA: Record<string, string> = {
  admin: 'Admin',
  wali: 'Wali Kelas',
  guru: 'Guru Mapel'
};
export const TAB_PERAN: Record<string, string[]> = {
  wali: ['dash', 'cld', 'abs', 'sis', 'den', 'pik', 'str', 'jad', 'ajar', 'cbt', 'tug', 'nil', 'per', 'kal', 'pan', 'usr'],
  guru: ['dash', 'cld', 'abs', 'jad', 'ajar', 'cbt', 'tug', 'nil', 'per', 'kal', 'pan', 'usr']
};
export const TAB_WALI = ['sis', 'den', 'pik', 'str'];
export const KOLOM_NILAI: [string, string][] = [
  ['Sikap', 'Kehadiran & Sikap'],
  ['Tugas', 'Tugas & Harian'],
  ['Proyek', 'Proyek / Praktik'],
  ['UTS', 'UTS'],
  ['UAS', 'UAS']
];
export const ATUR_STD: Record<string, Record<string, string>> = {
  reguler: { Sistem: 'reguler', Mulai: '07:00', Durasi: '45', Jumlah: '8', Istirahat: '3:15,6:30' },
  blok: { Sistem: 'blok', Mulai: '07:00', Durasi: '90', Jumlah: '4', Istirahat: '2:30' }
};
export const MODUL_AWAL: Record<string, string> = {
  Pembuka: 'Salam, doa, dan cek kehadiran (5 menit)\nApersepsi: kaitkan dengan materi sebelumnya\nSampaikan tujuan pembelajaran dan pertanyaan pemantik',
  Inti: 'Kegiatan 1: ...\nKegiatan 2: ...\nDiferensiasi: sesuaikan konten, proses, dan produk dengan kesiapan siswa',
  Penutup: 'Rangkuman bersama\nRefleksi singkat (exit ticket)\nInformasi pertemuan berikutnya dan doa penutup',
  Asesmen: 'Formatif: observasi dan exit ticket\nSumatif: ...'
};

export const TAB_THEME: Record<string, { badge: string; active: string }> = {
  dash: { badge: 'bg-sky-500/20 text-sky-300', active: 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-950/30' },
  cld: { badge: 'bg-fuchsia-500/20 text-fuchsia-300', active: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-950/30' },
  abs: { badge: 'bg-emerald-500/20 text-emerald-300', active: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-950/30' },
  sis: { badge: 'bg-amber-500/20 text-amber-300', active: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-950/30' },
  den: { badge: 'bg-cyan-500/20 text-cyan-300', active: 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-md shadow-cyan-950/30' },
  pik: { badge: 'bg-lime-500/20 text-lime-300', active: 'bg-gradient-to-r from-lime-500 to-emerald-500 text-white shadow-md shadow-emerald-950/30' },
  str: { badge: 'bg-violet-500/20 text-violet-300', active: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-950/30' },
  jad: { badge: 'bg-orange-500/20 text-orange-300', active: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-950/30' },
  ajar: { badge: 'bg-pink-500/20 text-pink-300', active: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-950/30' },
  cbt: { badge: 'bg-cyan-500/20 text-cyan-300', active: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-950/30' },
  tug: { badge: 'bg-teal-500/20 text-teal-300', active: 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-950/30' },
  nil: { badge: 'bg-blue-500/20 text-blue-300', active: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-950/30' },
  per: { badge: 'bg-rose-500/20 text-rose-300', active: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-950/30' },
  kal: { badge: 'bg-indigo-500/20 text-indigo-300', active: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-950/30' },
  pan: { badge: 'bg-yellow-500/20 text-yellow-300', active: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-950/30' },
  usr: { badge: 'bg-sky-500/20 text-sky-300', active: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-950/30' },
  set: { badge: 'bg-slate-500/20 text-slate-300', active: 'bg-gradient-to-r from-indigo-600 to-slate-700 text-white shadow-md shadow-slate-950/30' },
  rst: { badge: 'bg-rose-500/20 text-rose-300', active: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-950/30' }
};

export const DAY_THEME: Record<string, { header: string; card: string; accent: string }> = {
  Senin: { header: 'from-indigo-600 to-blue-600', card: 'border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white', accent: 'text-indigo-700' },
  Selasa: { header: 'from-emerald-600 to-teal-600', card: 'border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white', accent: 'text-emerald-700' },
  Rabu: { header: 'from-amber-500 to-orange-500', card: 'border-amber-200 bg-gradient-to-b from-amber-50/50 to-white', accent: 'text-amber-700' },
  Kamis: { header: 'from-sky-500 to-cyan-600', card: 'border-sky-200 bg-gradient-to-b from-sky-50/50 to-white', accent: 'text-sky-700' },
  Jumat: { header: 'from-rose-500 to-pink-600', card: 'border-rose-200 bg-gradient-to-b from-rose-50/50 to-white', accent: 'text-rose-700' },
  Sabtu: { header: 'from-violet-600 to-purple-600', card: 'border-violet-200 bg-gradient-to-b from-violet-50/50 to-white', accent: 'text-violet-700' }
};

export const AVATAR_COLORS = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-indigo-500 to-violet-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-teal-600',
  'from-orange-500 to-red-500'
];

export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

