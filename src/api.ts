export async function fetchJson<T = any>(url: string, init?: RequestInit, retries = 2): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      const rawText = await res.text();
      const trimmed = rawText.trim();

      let parsed: any = null;
      let isJson = false;
      if (trimmed) {
        try {
          parsed = JSON.parse(trimmed);
          isJson = true;
        } catch {
          isJson = false;
        }
      }

      if (isJson && parsed && typeof parsed === 'object') {
        return parsed as T;
      }

      const transient =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        /^the page\b/i.test(trimmed) ||
        /^bad gateway/i.test(trimmed) ||
        /^service unavailable/i.test(trimmed);

      if (transient && attempt < retries) {
        await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
        continue;
      }

      if (res.status === 413) {
        throw new Error('Ukuran data atau berkas melebihi batas maksimal server (25 MB).');
      }
      if (res.status === 404 || /^the page\b/i.test(trimmed) || trimmed.startsWith('<')) {
        throw new Error(
          'Layanan server sedang dimulai ulang atau belum tersedia sementara. Silakan muat ulang halaman dan coba lagi.'
        );
      }
      throw new Error(
        `Respons server tidak valid (HTTP ${res.status || 500}). Silakan coba lagi beberapa saat.`
      );
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const msg = lastErr.message || '';
      const isNetworkErr =
        e?.name === 'TypeError' ||
        /failed to fetch|networkerror|load failed/i.test(msg);
      if (isNetworkErr && attempt < retries) {
        await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error('Gagal menghubungi server.');
}

export async function callRaw<T = any>(fn: string, ...args: any[]): Promise<T> {
  const json = await fetchJson<{ ok: boolean; data?: T; error?: string }>('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args })
  });
  if (!json.ok) {
    throw new Error(json.error || 'Terjadi kesalahan pada server.');
  }
  return json.data as T;
}

export const num = (v: any): number | null => {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

export const fmt = (n: number | null | undefined): string =>
  n == null ? '-' : (Math.round(n * 10) / 10).toString().replace('.', ',');

export const pad = (n: number | string): string => String(n).padStart(2, '0');

export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const pesanErr = (e: any): string =>
  String((e && e.message) || e).replace(/^(Error|Exception):\s*/, '');

export const acak = <T>(a: T[]): T[] => {
  const copy = a.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const urlAman = (u: string): boolean => /^https?:\/\//i.test(String(u || '').trim());

export const waLink = (phone: string, text = ''): string => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${q}`;
};

export const tglParse = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const tglTambah = (s: string, n: number): string => {
  const d = tglParse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const tglIndo = (s: string): string => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1] || '';
  return `${Number(d)} ${bln} ${y}`;
};

export const menit = (t: string): number => {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : -1;
};

export const jamStr = (m: number): string => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const tumpang = (a: { Mulai: string; Selesai: string }, b: { Mulai: string; Selesai: string }): boolean =>
  menit(a.Mulai) < menit(b.Selesai) && menit(b.Mulai) < menit(a.Selesai);

export const pekanTemu = (a: { Pekan?: string }, b: { Pekan?: string }): boolean =>
  !a.Pekan || !b.Pekan || a.Pekan === b.Pekan;

export const adaPelajaran = (r: { Jenis?: string }): boolean => !r.Jenis || r.Jenis === 'Pelajaran';

export function slotJadwal(a: Record<string, string>) {
  const dur = +a.Durasi || 45;
  const n = +a.Jumlah || 0;
  const ist: Record<number, number> = {};
  String(a.Istirahat || '')
    .split(',')
    .forEach(x => {
      const [k, d] = x.split(':').map(Number);
      if (k > 0 && d > 0) ist[k] = d;
    });
  const nm = a.Sistem === 'blok' ? 'Blok ' : 'Jam ke-';
  let t = menit(a.Mulai);
  const out: { n: number; jenis: string; mulai: number; selesai: number; label: string }[] = [];
  if (t < 0) return out;
  for (let i = 1; i <= n; i++) {
    out.push({ n: i, jenis: 'Pelajaran', mulai: t, selesai: t + dur, label: nm + i });
    t += dur;
    if (ist[i] && i < n) {
      out.push({ n: i, jenis: 'Istirahat', mulai: t, selesai: t + ist[i], label: 'Istirahat' });
      t += ist[i];
    }
  }
  return out;
}

export function uraiCSV(t: string): string[][] {
  t = String(t || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const baris1 = t.split('\n')[0];
  const d = baris1.includes('\t') ? '\t' : baris1.includes(';') ? ';' : ',';
  const out: string[][] = [];
  let row: string[] = [];
  let sel = '';
  let kutip = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          sel += '"';
          i++;
        } else {
          kutip = false;
        }
      } else {
        sel += c;
      }
    } else if (c === '"') {
      kutip = true;
    } else if (c === d) {
      row.push(sel);
      sel = '';
    } else if (c === '\n') {
      row.push(sel);
      out.push(row);
      row = [];
      sel = '';
    } else {
      sel += c;
    }
  }
  row.push(sel);
  out.push(row);
  return out.filter(r => r.some(x => String(x).trim() !== ''));
}

export function petaKolom(kepala: string[]): Record<string, number> {
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const p: Record<string, number> = {};
  kepala.forEach((h, i) => {
    const n = norm(h);
    if (n === 'nis' || n === 'nisn') p.nis = i;
    else if (n.startsWith('nama')) p.nama = i;
    else if (n.includes('sikap') || n.includes('kehadiran')) p.Sikap = i;
    else if (n.includes('tugas') || n.includes('harian')) p.Tugas = i;
    else if (n.includes('proyek') || n.includes('praktik')) p.Proyek = i;
    else if (n === 'uts' || n.includes('tengahsemester')) p.UTS = i;
    else if (n === 'uas' || n.includes('akhirsemester')) p.UAS = i;
  });
  return p;
}
