export type StoredFont = { family: string; style: string; postscript: string; weight: number; italic: boolean; bytes: ArrayBuffer };
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('component-grabber-fonts', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('fonts', { keyPath: 'postscript' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function readFonts(): Promise<StoredFont[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('fonts').objectStore('fonts').getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function saveFonts(fonts: StoredFont[]) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('fonts', 'readwrite');
    for (const font of fonts) transaction.objectStore('fonts').put(font);
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  }); } finally { db.close(); }
}
export async function clearFonts() {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('fonts', 'readwrite');transaction.objectStore('fonts').clear();
    transaction.oncomplete = () => resolve();transaction.onerror = () => reject(transaction.error);
  }); } finally { db.close(); }
}
// CSS font matching favors a same-style face, then the appropriate weight.
export function matchFont(fonts: StoredFont[], family: string, weight: number, italic: boolean) {
  const candidates = fonts.filter(font => font.family.toLowerCase() === family.replace(/["']/g, '').trim().toLowerCase());
  const sameStyle = candidates.filter(font => font.italic === italic);
  const pool = sameStyle.length ? sameStyle : candidates;
  const weights = [...new Set(pool.map(font => font.weight))];
  const preferred = weight >= 400 && weight <= 500
    ? [...weights.filter(w => w >= weight && w <= 500).sort((a,b)=>a-b), ...weights.filter(w => w < weight).sort((a,b)=>b-a), ...weights.filter(w => w > 500).sort((a,b)=>a-b)]
    : weight < 400
      ? [...weights.filter(w=>w<=weight).sort((a,b)=>b-a),...weights.filter(w=>w>weight).sort((a,b)=>a-b)]
      : [...weights.filter(w=>w>=weight).sort((a,b)=>a-b),...weights.filter(w=>w<weight).sort((a,b)=>b-a)];
  return pool.find(font => font.weight === preferred[0]);
}
export function styleWeight(style: string) {
  const name = style.toLowerCase().replace(/[\s-]/g, '');
  if (/thin|hairline/.test(name)) return 100;
  if (/extralight|ultralight/.test(name)) return 200;
  if (/light/.test(name)) return 300;
  if (/medium/.test(name)) return 500;
  if (/semibold|demibold/.test(name)) return 600;
  if (/extrabold|ultrabold/.test(name)) return 800;
  if (/black|heavy/.test(name)) return 900;
  if (/bold/.test(name)) return 700;
  return 400;
}
