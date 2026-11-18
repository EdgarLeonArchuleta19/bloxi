// Guardado a prueba de todo:
//  1) localStorage (principal, rápido)
//  2) IndexedDB (copia espejo): si el localStorage se borra, se recupera de aquí
//  3) navigator.storage.persist(): pide al navegador NO borrar los datos
//  4) Archivo de respaldo descargable (para pasar el progreso a otro iPad)

export const SAVE_KEY = 'bloxi-save';
const DB_NAME = 'bloxi';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: string) {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function lsGet(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

/** Al abrir la app: si el localStorage está vacío pero hay copia en IndexedDB, la restaura */
export async function restoreIfNeeded(): Promise<boolean> {
  try {
    if (lsGet()) return false;
    const copy = await idbGet(SAVE_KEY);
    if (copy) {
      localStorage.setItem(SAVE_KEY, copy);
      return true;
    }
  } catch {
    /* sin IndexedDB: seguimos con lo que haya */
  }
  return false;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Copia el guardado a IndexedDB cada vez que cambia (con un pequeño retraso) */
export function mirrorSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const v = lsGet();
    if (v) idbSet(SAVE_KEY, v).catch(() => {});
  }, 400);
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return;
    await navigator.storage?.persist?.();
  } catch {
    /* nada */
  }
}

/** Descarga un archivo con todo el progreso */
export function downloadBackup(name: string) {
  const data = lsGet();
  if (!data) return;
  const blob = new Blob([JSON.stringify({ app: 'bloxi', date: new Date().toISOString(), save: JSON.parse(data) }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bloxi-${(name || 'respaldo').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Carga un archivo de respaldo y reinicia la app */
export async function loadBackup(file: File): Promise<boolean> {
  try {
    const parsed = JSON.parse(await file.text());
    const save = parsed?.app === 'bloxi' ? parsed.save : parsed;
    if (!save?.state || typeof save.state !== 'object') return false;
    const value = JSON.stringify(save);
    localStorage.setItem(SAVE_KEY, value);
    await idbSet(SAVE_KEY, value);
    location.reload();
    return true;
  } catch {
    return false;
  }
}
