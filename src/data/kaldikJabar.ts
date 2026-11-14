export interface KaldikEvent {
  ID: string;
  Mulai: string;
  Selesai: string;
  Kegiatan: string;
  Jenis: string;
  Sumber?: string;
}

export const KALDIK_JABAR_REF = {
  wilayah: 'Provinsi Jawa Barat',
  instansi: 'Dinas Pendidikan Provinsi Jawa Barat',
  dasarSurat: 'Surat Disdik Jabar No. 30234/PK.02.01.05/PSMA',
  tahunAjaran: '2026/2027',
  versi: '2026.2027.1'
};

/**
 * Kalender Pendidikan Provinsi Jawa Barat Tahun Ajaran 2026/2027
 * Sumber: Pedoman Penyusunan Kalender Pendidikan Dinas Pendidikan Provinsi Jawa Barat (TK/SD/SMP/SMA/SMK/SLB)
 */
export function getKaldikJabarEvents(tahunAjaran = '2026/2027'): KaldikEvent[] {
  const match = /^(\d{4})\s*\/\s*(\d{4})$/.exec(String(tahunAjaran || '').trim());
  const yStart = match ? Number(match[1]) : 2026;
  const yEnd = match ? Number(match[2]) : 2027;
  const src = `Kaldik Disdik Jabar ${yStart}/${yEnd}`;

  if (yStart === 2026 && yEnd === 2027) {
    return [
      {
        ID: 'jabar_2026_01',
        Mulai: '2026-07-01',
        Selesai: '2026-07-14',
        Kegiatan: 'Libur Kenaikan Kelas / Akhir Tahun Ajaran 2025/2026 (Jawa Barat)',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2026_02',
        Mulai: '2026-07-15',
        Selesai: '2026-07-15',
        Kegiatan: 'Hari Pertama Masuk Sekolah (HP) & Awal Semester Ganjil TA 2026/2027',
        Jenis: 'Kegiatan belajar',
        Sumber: src
      },
      {
        ID: 'jabar_2026_03',
        Mulai: '2026-07-15',
        Selesai: '2026-07-21',
        Kegiatan: 'Masa Pengenalan Lingkungan Sekolah (MPLS) & Administrasi Kelas',
        Jenis: 'Kegiatan sekolah',
        Sumber: src
      },
      {
        ID: 'jabar_2026_04',
        Mulai: '2026-08-17',
        Selesai: '2026-08-17',
        Kegiatan: 'Libur Nasional Hari Kemerdekaan Republik Indonesia',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2026_05',
        Mulai: '2026-08-25',
        Selesai: '2026-08-25',
        Kegiatan: 'Libur Nasional Maulid Nabi Muhammad SAW',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2026_06',
        Mulai: '2026-09-14',
        Selesai: '2026-09-19',
        Kegiatan: 'Prakiraan Penilaian Tengah Semester (PTS) / Sumatif Tengah Semester Ganjil',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2026_07',
        Mulai: '2026-10-26',
        Selesai: '2026-11-08',
        Kegiatan: 'Tes Kemampuan Akademik (TKA) / Asesmen Kelas Akhir SMA/SMK Jabar',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2026_08',
        Mulai: '2026-11-25',
        Selesai: '2026-11-25',
        Kegiatan: 'Peringatan Hari Guru Nasional & HUT PGRI',
        Jenis: 'Kegiatan sekolah',
        Sumber: src
      },
      {
        ID: 'jabar_2026_09',
        Mulai: '2026-11-30',
        Selesai: '2026-12-11',
        Kegiatan: 'Pelaksanaan Asesmen Sumatif Akhir Semester (SAS) Ganjil Jawa Barat',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2026_10',
        Mulai: '2026-12-23',
        Selesai: '2026-12-23',
        Kegiatan: 'Tanggal Penetapan & Pembagian Rapor Semester 1 (Ganjil)',
        Jenis: 'Rapor',
        Sumber: src
      },
      {
        ID: 'jabar_2026_11',
        Mulai: '2026-12-25',
        Selesai: '2026-12-25',
        Kegiatan: 'Libur Nasional Hari Raya Natal',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2026_12',
        Mulai: '2026-12-28',
        Selesai: '2027-01-08',
        Kegiatan: 'Libur Semester 1 (Ganjil) Provinsi Jawa Barat',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_01',
        Mulai: '2027-01-01',
        Selesai: '2027-01-01',
        Kegiatan: 'Libur Nasional Tahun Baru 2027 Masehi',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_02',
        Mulai: '2027-01-11',
        Selesai: '2027-01-11',
        Kegiatan: 'Hari Pertama Masuk Sekolah Semester Genap TA 2026/2027',
        Jenis: 'Kegiatan belajar',
        Sumber: src
      },
      {
        ID: 'jabar_2027_03',
        Mulai: '2027-01-16',
        Selesai: '2027-01-16',
        Kegiatan: 'Libur Nasional Isra Mi’raj Nabi Muhammad SAW',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_04',
        Mulai: '2027-02-06',
        Selesai: '2027-02-06',
        Kegiatan: 'Libur Nasional Tahun Baru Imlek 2578 Kongzili',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_05',
        Mulai: '2027-03-08',
        Selesai: '2027-03-13',
        Kegiatan: 'Prakiraan Penilaian Tengah Semester (PTS) / Sumatif Tengah Semester Genap',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2027_06',
        Mulai: '2027-03-18',
        Selesai: '2027-03-27',
        Kegiatan: 'Prakiraan Libur Hari Raya Idul Fitri 1448 H & Cuti Bersama',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_07',
        Mulai: '2027-04-05',
        Selesai: '2027-04-16',
        Kegiatan: 'Prakiraan Ujian Satuan Pendidikan (USP) / Uji Kompetensi Keahlian',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2027_08',
        Mulai: '2027-05-01',
        Selesai: '2027-05-01',
        Kegiatan: 'Libur Nasional Hari Buruh Internasional',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_09',
        Mulai: '2027-05-17',
        Selesai: '2027-05-17',
        Kegiatan: 'Libur Nasional Hari Raya Idul Adha 1448 H',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_10',
        Mulai: '2027-06-01',
        Selesai: '2027-06-01',
        Kegiatan: 'Libur Nasional Hari Lahir Pancasila',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_11',
        Mulai: '2027-06-06',
        Selesai: '2027-06-06',
        Kegiatan: 'Libur Nasional Tahun Baru Islam 1449 H',
        Jenis: 'Libur',
        Sumber: src
      },
      {
        ID: 'jabar_2027_12',
        Mulai: '2027-06-07',
        Selesai: '2027-06-18',
        Kegiatan: 'Prakiraan Asesmen Sumatif Akhir Tahun (SAT) / Penilaian Akhir Tahun Jabar',
        Jenis: 'Ujian',
        Sumber: src
      },
      {
        ID: 'jabar_2027_13',
        Mulai: '2027-06-25',
        Selesai: '2027-06-25',
        Kegiatan: 'Penetapan & Pembagian Rapor Semester 2 (Genap) Jawa Barat',
        Jenis: 'Rapor',
        Sumber: src
      },
      {
        ID: 'jabar_2027_14',
        Mulai: '2027-06-28',
        Selesai: '2027-07-09',
        Kegiatan: 'Masa Libur Akhir Tahun Pelajaran 2026/2027 Provinsi Jawa Barat',
        Jenis: 'Libur',
        Sumber: src
      }
    ];
  }

  // Dynamic template for other academic years (e.g. 2027/2028) following Disdik Jabar structure
  return [
    {
      ID: `jabar_${yStart}_01`,
      Mulai: `${yStart}-07-01`,
      Selesai: `${yStart}-07-14`,
      Kegiatan: `Libur Kenaikan Kelas Sebelum Tahun Ajaran ${yStart}/${yEnd}`,
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_02`,
      Mulai: `${yStart}-07-15`,
      Selesai: `${yStart}-07-15`,
      Kegiatan: `Hari Pertama Masuk Sekolah Semester Ganjil TA ${yStart}/${yEnd}`,
      Jenis: 'Kegiatan belajar',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_03`,
      Mulai: `${yStart}-07-15`,
      Selesai: `${yStart}-07-19`,
      Kegiatan: 'Masa Pengenalan Lingkungan Sekolah (MPLS) & Kontrak Belajar',
      Jenis: 'Kegiatan sekolah',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_04`,
      Mulai: `${yStart}-08-17`,
      Selesai: `${yStart}-08-17`,
      Kegiatan: 'Libur Nasional Hari Kemerdekaan Republik Indonesia',
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_05`,
      Mulai: `${yStart}-09-14`,
      Selesai: `${yStart}-09-19`,
      Kegiatan: 'Prakiraan Penilaian Tengah Semester (PTS) Ganjil',
      Jenis: 'Ujian',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_06`,
      Mulai: `${yStart}-11-25`,
      Selesai: `${yStart}-11-25`,
      Kegiatan: 'Peringatan Hari Guru Nasional & HUT PGRI',
      Jenis: 'Kegiatan sekolah',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_07`,
      Mulai: `${yStart}-12-01`,
      Selesai: `${yStart}-12-12`,
      Kegiatan: 'Prakiraan Asesmen Sumatif Akhir Semester (SAS) Ganjil',
      Jenis: 'Ujian',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_08`,
      Mulai: `${yStart}-12-23`,
      Selesai: `${yStart}-12-23`,
      Kegiatan: 'Penetapan & Pembagian Rapor Semester 1 (Ganjil)',
      Jenis: 'Rapor',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_09`,
      Mulai: `${yStart}-12-25`,
      Selesai: `${yStart}-12-25`,
      Kegiatan: 'Libur Nasional Hari Raya Natal',
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yStart}_10`,
      Mulai: `${yStart}-12-28`,
      Selesai: `${yEnd}-01-08`,
      Kegiatan: `Libur Semester 1 (Ganjil) TA ${yStart}/${yEnd}`,
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_01`,
      Mulai: `${yEnd}-01-01`,
      Selesai: `${yEnd}-01-01`,
      Kegiatan: `Libur Nasional Tahun Baru ${yEnd} Masehi`,
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_02`,
      Mulai: `${yEnd}-01-11`,
      Selesai: `${yEnd}-01-11`,
      Kegiatan: `Hari Pertama Masuk Sekolah Semester Genap TA ${yStart}/${yEnd}`,
      Jenis: 'Kegiatan belajar',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_03`,
      Mulai: `${yEnd}-05-01`,
      Selesai: `${yEnd}-05-01`,
      Kegiatan: 'Libur Nasional Hari Buruh Internasional',
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_04`,
      Mulai: `${yEnd}-06-01`,
      Selesai: `${yEnd}-06-01`,
      Kegiatan: 'Libur Nasional Hari Lahir Pancasila',
      Jenis: 'Libur',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_05`,
      Mulai: `${yEnd}-06-07`,
      Selesai: `${yEnd}-06-18`,
      Kegiatan: 'Prakiraan Asesmen Sumatif Akhir Tahun (SAT) Jawa Barat',
      Jenis: 'Ujian',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_06`,
      Mulai: `${yEnd}-06-25`,
      Selesai: `${yEnd}-06-25`,
      Kegiatan: 'Penetapan & Pembagian Rapor Semester 2 (Genap)',
      Jenis: 'Rapor',
      Sumber: src
    },
    {
      ID: `jabar_${yEnd}_07`,
      Mulai: `${yEnd}-06-28`,
      Selesai: `${yEnd}-07-10`,
      Kegiatan: `Libur Akhir Tahun Pelajaran ${yStart}/${yEnd} Provinsi Jawa Barat`,
      Jenis: 'Libur',
      Sumber: src
    }
  ];
}
