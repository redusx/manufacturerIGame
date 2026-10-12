/* ======================================================================
 * src/i18n/locales/index.ts — Dil sözlüklerinin listesi
 *
 * Yeni dil eklemek: `<kod>.ts` dosyasını yaz (tipi `Dictionary` olduğu için eksik
 * ya da fazla anahtar derlenmez), buraya ekle, `i18n.ts` içindeki LOCALES listesine
 * satırını koy. `npm test` (src/i18n/i18n.test.ts) boş metinleri, yer tutucu
 * uyuşmazlıklarını ve yinelenen anahtarları ayrıca denetler.
 * ====================================================================== */

import { ar } from './ar.ts';
import { bn } from './bn.ts';
import { de } from './de.ts';
import { en, type TranslationKey } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { hi } from './hi.ts';
import { id } from './id.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import { ptBR } from './pt-BR.ts';
import { ru } from './ru.ts';
import { tr } from './tr.ts';
import { ur } from './ur.ts';
import { zhCN } from './zh-CN.ts';

/** Bir dilin sözlüğü: referans dildeki her anahtarı taşımak zorundadır */
export type Dictionary = Readonly<Record<TranslationKey, string>>;

export type LocaleCode = 'en' | 'tr' | 'es' | 'pt-BR' | 'fr' | 'de' | 'ru' | 'ja' | 'ko' | 'zh-CN' | 'hi' | 'ar' | 'id' | 'bn' | 'ur';

export const DICTIONARIES: Readonly<Record<LocaleCode, Dictionary>> = {
  en,
  tr,
  es,
  'pt-BR': ptBR,
  fr,
  de,
  ru,
  ja,
  ko,
  'zh-CN': zhCN,
  hi,
  ar,
  id,
  bn,
  ur,
};
