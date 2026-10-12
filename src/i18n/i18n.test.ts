/* ======================================================================
 * src/i18n/i18n.test.ts — Çeviri sözlüklerinin denetimi
 *
 * Bir çeviri eksik, boş ya da bozuksa burada yakalanır:
 *   - her dilin sözlüğü var mı,
 *   - İngilizce'deki her anahtar her dilde var mı (ve fazlası yok mu),
 *   - boş metin var mı,
 *   - `{ad}` yer tutucuları İngilizce'dekiyle aynı mı,
 *   - kaynak dosyada aynı anahtar iki kez yazılmış mı,
 *   - bir dil İngilizce metinlerle doldurulup "çevrildi" sayılmış mı.
 * ====================================================================== */

import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  formatDecimal,
  getLocale,
  isRtl,
  joinList,
  matchLocale,
  setLocale,
  t,
  tDynamic,
} from './i18n.ts';
import { en } from './locales/en.ts';
import { DICTIONARIES } from './locales/index.ts';

const REFERENCE = en as Readonly<Record<string, string>>;
const KEYS = Object.keys(REFERENCE);

/** Bir metindeki yer tutucu adları (sıralı, yinelenmesiz) */
function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

/**
 * İngilizce'yle aynı kalan metinlerin en fazla oranı. Biçim kalıpları ("{n} km"),
 * özel adlar ("Nitro", "HANGAR") ve kısaltmalar aynı kalabilir; oran bunun üstündeyse
 * dil çevrilmemiş demektir.
 */
const MAX_IDENTICAL_SHARE = 0.2;

describe('i18n: sözlükler', () => {
  it('desteklenen her dilin sözlüğü vardır', () => {
    assert.strictEqual(LOCALES.length, 15);
    for (const locale of LOCALES) {
      assert.ok(DICTIONARIES[locale.code], `${locale.code}: sözlük yok`);
    }
    assert.deepStrictEqual(
      Object.keys(DICTIONARIES).sort(),
      LOCALES.map((locale) => locale.code).sort(),
      'DICTIONARIES ile LOCALES aynı dilleri listelemeli',
    );
  });

  for (const locale of LOCALES) {
    const dictionary = (DICTIONARIES[locale.code] ?? {}) as Readonly<Record<string, string>>;

    it(`${locale.code}: eksik ya da fazla anahtar yok`, () => {
      const missing = KEYS.filter((key) => !(key in dictionary));
      const extra = Object.keys(dictionary).filter((key) => !(key in REFERENCE));
      assert.deepStrictEqual(missing, [], `${locale.code}: eksik anahtarlar`);
      assert.deepStrictEqual(extra, [], `${locale.code}: İngilizce'de olmayan anahtarlar`);
    });

    it(`${locale.code}: boş metin yok`, () => {
      const empty = KEYS.filter((key) => typeof dictionary[key] !== 'string' || dictionary[key].trim() === '');
      assert.deepStrictEqual(empty, [], `${locale.code}: boş metinler`);
    });

    it(`${locale.code}: yer tutucular İngilizce ile aynı`, () => {
      const wrong = KEYS.filter(
        (key) => placeholders(dictionary[key] ?? '').join(',') !== placeholders(REFERENCE[key]).join(','),
      ).map((key) => `${key}: {${placeholders(dictionary[key] ?? '').join('},{')}} ≠ {${placeholders(REFERENCE[key]).join('},{')}}`);
      assert.deepStrictEqual(wrong, [], `${locale.code}: yer tutucu uyuşmazlığı`);
    });

    it(`${locale.code}: süslü parantezler dengeli`, () => {
      const broken = KEYS.filter((key) => /[{}]/.test((dictionary[key] ?? '').replace(/\{\w+\}/g, '')));
      assert.deepStrictEqual(broken, [], `${locale.code}: bozuk yer tutucu`);
    });

    it(`${locale.code}: kaynak dosyada yinelenen anahtar yok`, () => {
      const source = readFileSync(new URL(`./locales/${locale.code}.ts`, import.meta.url), 'utf8');
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const match of source.matchAll(/^\s*'([^']+)':/gm)) {
        if (seen.has(match[1])) duplicates.push(match[1]);
        seen.add(match[1]);
      }
      assert.deepStrictEqual(duplicates, [], `${locale.code}: yinelenen anahtarlar`);
      assert.strictEqual(seen.size, KEYS.length, `${locale.code}: kaynak dosyadaki anahtar sayısı`);
    });

    if (locale.code !== DEFAULT_LOCALE) {
      it(`${locale.code}: metinler gerçekten çevrilmiş (İngilizce bırakılmamış)`, () => {
        // Harf içermeyen kalıplar ("{n}%", "{size} · ${cost}") dilden bağımsızdır; sayılmaz
        const wordy = KEYS.filter((key) => /\p{L}{3,}/u.test(REFERENCE[key].replace(/\{\w+\}/g, '')));
        const identical = wordy.filter((key) => dictionary[key] === REFERENCE[key]);
        assert.ok(
          identical.length / wordy.length <= MAX_IDENTICAL_SHARE,
          `${locale.code}: ${identical.length}/${wordy.length} metin İngilizce ile aynı: ${identical.slice(0, 12).join(', ')}…`,
        );
      });
    }
  }
});

describe('i18n: çalışma anı', () => {
  it('t() yer tutucuları doldurur ve dil değişince metin değişir', () => {
    setLocale('en');
    assert.strictEqual(t('common.level', { n: 3 }), 'Level 3');
    assert.strictEqual(t('common.refund', { amount: '1.5K' }), '+$1.5K refund');
    setLocale('tr');
    assert.strictEqual(getLocale(), 'tr');
    assert.strictEqual(t('common.level', { n: 3 }), 'Seviye 3');
    assert.strictEqual(t('common.percent', { n: 20 }), '%20');
    setLocale('en');
    assert.strictEqual(t('common.percent', { n: 20 }), '20%');
  });

  it('tDynamic() bilinmeyen anahtarda yedeği döner', () => {
    setLocale('en');
    assert.strictEqual(tDynamic('item.iron_ore', 'x'), 'Iron Ore');
    assert.strictEqual(tDynamic('item.no_such_item', 'yedek'), 'yedek');
  });

  it('dil etiketlerini desteklenen dile eşler', () => {
    assert.strictEqual(matchLocale('tr-TR'), 'tr');
    assert.strictEqual(matchLocale('pt'), 'pt-BR');
    assert.strictEqual(matchLocale('pt-PT'), 'pt-BR');
    assert.strictEqual(matchLocale('zh-Hans-SG'), 'zh-CN');
    assert.strictEqual(matchLocale('zh_TW'), 'zh-CN');
    assert.strictEqual(matchLocale('AR-eg'), 'ar');
    assert.strictEqual(matchLocale('xx'), null);
    assert.strictEqual(matchLocale(''), null);
  });

  it('tercih listesinden ilk desteklenen dili seçer; yoksa İngilizce', () => {
    assert.strictEqual(detectLocale(['xx-YY', 'ja-JP', 'en-US']), 'ja');
    assert.strictEqual(detectLocale([null, undefined, 'bn']), 'bn');
    assert.strictEqual(detectLocale(['xx', 'yy']), 'en');
    assert.strictEqual(detectLocale([]), 'en');
  });

  it('yalnızca Arapça ve Urduca sağdan sola işaretlidir', () => {
    assert.deepStrictEqual(
      LOCALES.filter((locale) => locale.rtl).map((locale) => locale.code),
      ['ar', 'ur'],
    );
    setLocale('ar');
    assert.strictEqual(isRtl(), true);
    setLocale('en');
    assert.strictEqual(isRtl(), false);
  });

  it('sayılar her dilde Latin rakamıyla, o dilin ayraçlarıyla yazılır', () => {
    setLocale('en');
    assert.strictEqual(formatDecimal(1234.5, 2), '1,234.50');
    setLocale('tr');
    assert.strictEqual(formatDecimal(1234.5, 2), '1.234,50');
    for (const code of ['ar', 'hi', 'bn', 'ur'] as const) {
      setLocale(code);
      assert.match(formatDecimal(1234.5, 1), /^[0-9.,  ' ]+$/, `${code}: Latin rakamı bekleniyordu`);
    }
    setLocale('en');
  });

  it('listeler etkin dilin ayracıyla birleşir', () => {
    setLocale('en');
    assert.strictEqual(joinList(['a', 'b', 'c']), 'a, b, c');
  });
});
