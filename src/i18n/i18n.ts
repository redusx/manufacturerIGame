/* ======================================================================
 * src/i18n/i18n.ts — Çoklu dil altyapısı
 *
 * Oyuncuya görünen her metin bir anahtarla buradan alınır: `t('hud.income', { value })`.
 * Anahtarların ve yer tutucuların tek kaynağı İngilizce sözlüktür (locales/en.ts);
 * `t` hem anahtarı hem de o anahtarın istediği parametreleri derleme anında denetler.
 *
 * Dil seçimi (öncelik sırasıyla):
 *   1. Oyuncunun Ayarlar'dan seçtiği dil (tarayıcıda saklanır; kayıt dosyasına girmez),
 *   2. platformun bildirdiği dil (CrazyGames `user.systemInfo.locale`),
 *   3. tarayıcının dil tercihleri (`navigator.languages`, `navigator.language`),
 *   4. İngilizce.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node testlerinde de çalışır (varsayılan: İngilizce).
 * ====================================================================== */

import { en, type TranslationKey } from './locales/en.ts';
import { DICTIONARIES, type LocaleCode } from './locales/index.ts';

export type { TranslationKey, LocaleCode };

export interface LocaleInfo {
  code: LocaleCode;
  /** Dilin kendi dilindeki adı (dil seçicide böyle görünür) */
  nativeName: string;
  /** Sağdan sola yazılan dil mi? */
  rtl: boolean;
  /**
   * Yazı yüksekliği ölçülürken kullanılan örnek harfler: Latin dışı yazılarda harfler
   * daha yüksek ya da daha derin olabilir; ölçüme katılmazlarsa üstleri/altları kırpılır.
   */
  sample: string;
  /** Sözcükler boşlukla ayrılmıyor (Japonca, Çince): satırlar harf arasından bölünür */
  charWrap?: boolean;
}

/** Desteklenen diller; dil seçicide bu sırayla görünür */
export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', rtl: false, sample: '' },
  { code: 'tr', nativeName: 'Türkçe', rtl: false, sample: 'ÇĞİŞ' },
  { code: 'es', nativeName: 'Español', rtl: false, sample: 'Ññ' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', rtl: false, sample: 'Çã' },
  { code: 'fr', nativeName: 'Français', rtl: false, sample: 'Éç' },
  { code: 'de', nativeName: 'Deutsch', rtl: false, sample: 'ÄÜß' },
  { code: 'ru', nativeName: 'Русский', rtl: false, sample: 'ЙЩр' },
  { code: 'ja', nativeName: '日本語', rtl: false, sample: '国あグ', charWrap: true },
  { code: 'ko', nativeName: '한국어', rtl: false, sample: '한글뷁' },
  { code: 'zh-CN', nativeName: '简体中文', rtl: false, sample: '国语', charWrap: true },
  { code: 'hi', nativeName: 'हिन्दी', rtl: false, sample: 'कीर्तिऋृ' },
  { code: 'ar', nativeName: 'العربية', rtl: true, sample: 'ئِيلأ' },
  { code: 'id', nativeName: 'Bahasa Indonesia', rtl: false, sample: '' },
  { code: 'bn', nativeName: 'বাংলা', rtl: false, sample: 'কীর্তিঋৃ' },
  { code: 'ur', nativeName: 'اردو', rtl: true, sample: 'ئِیلأٹگ' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';
export const LOCALE_STORAGE_KEY = 'manufacturer_locale_v1';

/** Bir metindeki `{ad}` yer tutucularının adları */
type PlaceholderNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;

/** Bir anahtarın istediği parametreler (İngilizce metinden çıkarılır) */
export type TranslationParams<K extends TranslationKey> = PlaceholderNames<(typeof en)[K]>;

type TranslationArgs<K extends TranslationKey> = [TranslationParams<K>] extends [never]
  ? []
  : [params: Record<TranslationParams<K>, string | number>];

let currentCode: LocaleCode = DEFAULT_LOCALE;
let currentDictionary: Readonly<Record<TranslationKey, string>> = en;
const listeners = new Set<(code: LocaleCode) => void>();

/**
 * Anahtarın etkin dildeki metnini döner; `{ad}` yer tutucularını parametrelerle doldurur.
 * Etkin dilde anahtar boşsa İngilizcesi kullanılır (derleme zaten eksik anahtara izin vermez).
 */
export function t<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
  const template = currentDictionary[key] || en[key];
  const params = args[0] as Record<string, string | number> | undefined;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Anahtar çalışma anında kuruluyorsa (ör. `item.${id}`) ve sözlükte varsa metnini, yoksa `fallback`'i döner */
export function tDynamic(key: string, fallback: string): string {
  return (currentDictionary as Record<string, string>)[key] || (en as Record<string, string>)[key] || fallback;
}

/** Listeyi etkin dilin ayracıyla birleştirir (ör. "a, b", "a、b", "a، b") */
export function joinList(items: readonly string[]): string {
  return items.join(t('common.listSeparator'));
}

export function getLocale(): LocaleCode {
  return currentCode;
}

export function getLocaleInfo(code: LocaleCode = currentCode): LocaleInfo {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}

export function isRtl(): boolean {
  return getLocaleInfo().rtl;
}

/** Dil değişince çağrılır; dönen işlev dinleyiciyi kaldırır */
export function onLocaleChange(listener: (code: LocaleCode) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isSupported(code: string): code is LocaleCode {
  return LOCALES.some((locale) => locale.code === code);
}

/**
 * Bir dil etiketini ("pt-PT", "zh-Hans-SG", "ar_EG") desteklenen dile eşler: önce tam
 * eşleşme, sonra yalnızca dil kısmı ("pt" → pt-BR, "zh" → zh-CN). Eşleşme yoksa null.
 */
export function matchLocale(tag: string | null | undefined): LocaleCode | null {
  if (!tag) return null;
  const normalized = tag.replace(/_/g, '-').toLowerCase();
  const exact = LOCALES.find((locale) => locale.code.toLowerCase() === normalized);
  if (exact) return exact.code;
  const language = normalized.split('-')[0];
  const byLanguage = LOCALES.find((locale) => locale.code.toLowerCase().split('-')[0] === language);
  return byLanguage?.code ?? null;
}

/** Tercih listesindeki ilk desteklenen dil; yoksa İngilizce */
export function detectLocale(preferred: ReadonlyArray<string | null | undefined>): LocaleCode {
  for (const tag of preferred) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

function readSavedLocale(): LocaleCode | null {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    return saved && isSupported(saved) ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Etkin dili değiştirir. `persist` true ise oyuncunun kendi seçimi olarak saklanır ve
 * sonraki açılışlarda tarayıcı dilinden önce gelir.
 */
export function setLocale(code: LocaleCode, persist = false): void {
  if (!isSupported(code)) return;
  if (persist) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      // Depolama kapalıysa seçim yalnız bu oturumda geçerlidir
    }
  }
  // Sayfanın dili ekran okuyucular ve tarayıcı içindir (index.html'deki değerin yerini alır);
  // tuvalin düzeni aynalanmaz
  if (typeof document !== 'undefined') document.documentElement.lang = code;
  if (code === currentCode) return;
  currentCode = code;
  currentDictionary = DICTIONARIES[code];
  numberFormats.clear();
  for (const listener of listeners) listener(code);
}

/**
 * Açılışta dili seçer: kayıtlı seçim → platformun bildirdiği dil → tarayıcı tercihleri → İngilizce.
 * Otomatik seçim saklanmaz; oyuncu tarayıcı dilini değiştirirse oyun da onu izler.
 */
export function initLocale(platformLocale?: string | null): LocaleCode {
  const saved = readSavedLocale();
  if (saved) {
    setLocale(saved);
    return saved;
  }
  const browser: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) browser.push(...navigator.languages);
    if (navigator.language) browser.push(navigator.language);
  }
  const detected = detectLocale([platformLocale, ...browser]);
  setLocale(detected);
  return detected;
}

// ---------------------------------------------------------------------
// Sayılar
// ---------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * Sayıyı etkin dilin ondalık ve binlik ayraçlarıyla yazar (ör. tr: "1,25", en: "1.25").
 * Rakamlar her dilde Latin rakamıdır: dar düğmelerde ve tabloda hizayı bozmasınlar diye.
 * Yalnızca gösterim içindir; hesaplar ve kayıt sayıların kendisini kullanır.
 */
export function formatDecimal(value: number, minDigits = 0, maxDigits = minDigits): string {
  const key = `${minDigits}:${maxDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(`${currentCode}-u-nu-latn`, {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
      });
    } catch {
      format = new Intl.NumberFormat('en', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
    }
    numberFormats.set(key, format);
  }
  return format.format(value);
}
