/* ======================================================================
 * src/tutorial/TutorialGuide.ts — Öğretici (saf mantık)
 *
 * Oyunun başından ilk uçuşa kadar oyuncuya sıradaki adımı söyler. Adımlar
 * tıklama sırasına değil oyunun durumuna bakar: oyuncu bir adımı kendi
 * bildiği yoldan tamamladıysa (ya da eski bir kayıtla geldiyse) o adım
 * kendiliğinden geçilir. Yalnızca bilgi veren adımlar "Tamam" ile kapanır.
 *
 * Ekrandaki baloncuk ve vurgu `src/ui/TutorialCoach.ts` içindedir.
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

/** Öğreticinin baktığı oyun durumu (sahne her karede kurar) */
export interface TutorialContext {
  /** Tamamlanan aşama sayısı (0..10) */
  completedStages: number;
  /** Bu oturumda "Üret"e kaç kez basıldı */
  manualClicks: number;
  money: number;
  /** İlk makinenin (kırıcı) sıradaki yükseltme bedeli */
  firstUpgradeCost: number;
  /** Seviyesi 1'den büyük en az bir makine var mı? */
  hasUpgradedMachine: boolean;
  /** Fabrikada bu türden makine var mı? */
  hasMachine: (defId: string) => boolean;
  /** Bu eşyadan şimdiye dek kaç adet ihraç edildi */
  exported: (itemId: string) => number;
  isPlotUnlocked: (plotIndex: number) => boolean;
  hangarUnlocked: boolean;
  /** Lider tablosu gerçek oyuncularla (çevrimiçi) mı çalışıyor? */
  leaderboardOnline: boolean;
  totalFlights: number;
}

/** Vurgulanabilecek arayüz öğeleri; sahne bunları ekran dikdörtgenine çevirir */
export type TutorialTarget =
  | 'produce'
  | 'belt'
  | 'build'
  | 'demolish'
  | 'hangar'
  | 'objective'
  | 'firstMachine'
  | 'plotBadge'
  | 'leaderboard';

export interface TutorialStepView {
  id: string;
  /** Adımın sırası (1'den başlar) ve toplam adım sayısı */
  index: number;
  total: number;
  text: string;
  highlight: TutorialTarget | null;
  /** Bilgi adımı: oyuncu "Tamam"a basınca geçilir */
  needsConfirm: boolean;
}

export interface TutorialState {
  /** Öğretici bitti veya atlandı */
  done: boolean;
  /** "Tamam" ile kapatılmış bilgi adımları */
  confirmed: string[];
}

interface TutorialStep {
  id: string;
  text: (ctx: TutorialContext) => string;
  highlight?: (ctx: TutorialContext) => TutorialTarget | null;
  /** Durumdan anlaşılan tamamlanma; bilgi adımlarında yoktur */
  isDone?: (ctx: TutorialContext) => boolean;
  /** Bilgi adımı: `isObsolete` değilse "Tamam" bekler */
  needsConfirm?: boolean;
  /** Bilgi adımının artık gereksiz olduğu durum (oyuncu zaten ilerlemiş) */
  isObsolete?: (ctx: TutorialContext) => boolean;
}

const money = (value: number): string => `$${Math.ceil(value).toLocaleString('en-US')}`;

/**
 * Adım metinleri kısadır (en çok ~120 karakter): telefonda kutu üç satırı geçmesin
 * ve fabrikayı örtmesin.
 */
const STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    text: () =>
      'Fabrikana hoş geldin! Hammadde girişten çıkar, bantla makineye gider ve sandığa ulaşınca satılır.',
    needsConfirm: true,
    isObsolete: (ctx) => ctx.completedStages >= 1,
  },
  {
    id: 'produce',
    text: (ctx) => `Beklerken elle de kazanabilirsin: ÜRET'e 3 kez bas (${Math.min(3, ctx.manualClicks)}/3).`,
    highlight: () => 'produce',
    isDone: (ctx) => ctx.manualClicks >= 3 || ctx.completedStages >= 1,
  },
  {
    id: 'objective',
    text: () => 'Sıradaki hedefin hep bu kartta yazar. Tamamlayınca ödül alır, yeni makine ve alan açarsın.',
    highlight: () => 'objective',
    needsConfirm: true,
    isObsolete: (ctx) => ctx.completedStages >= 2,
  },
  {
    id: 'upgrade',
    text: (ctx) =>
      ctx.money >= ctx.firstUpgradeCost
        ? 'Paran yetti: kırıcıya dokun ve YÜKSELT\'e bas. Her seviye makineyi %20 hızlandırır.'
        : `Para birikiyor. ${money(ctx.firstUpgradeCost)} olunca kırıcıyı yükselteceğiz; o zamana dek ÜRET'e basabilirsin.`,
    highlight: (ctx) => (ctx.money >= ctx.firstUpgradeCost ? 'firstMachine' : 'produce'),
    isDone: (ctx) => ctx.hasUpgradedMachine || ctx.completedStages >= 2,
  },
  {
    id: 'stage2',
    text: () => 'Demir tozu sattıkça hedef ilerler. 20 adet satınca yeni makine açılacak: Fırın.',
    highlight: () => 'objective',
    isDone: (ctx) => ctx.completedStages >= 2,
  },
  {
    id: 'build_smelter',
    text: () =>
      'Fırın açıldı! İNŞA\'dan Yüksek Sıcaklık Fırını\'nı seç ve boş hücrelere kur. Yeşil ok girdi, turuncu ok çıktıdır.',
    highlight: () => 'build',
    isDone: (ctx) => ctx.hasMachine('smelter') || ctx.exported('iron_ingot') > 0 || ctx.completedStages >= 3,
  },
  {
    id: 'connect_smelter',
    text: () =>
      'Fırını hatta bağla: SÖK ile sandığa giden bandı ayır; BANT ile kırıcıdan fırının yeşil okuna, turuncu okundan sandığa hat çek.',
    highlight: () => 'belt',
    isDone: (ctx) => ctx.exported('iron_ingot') > 0 || ctx.completedStages >= 3,
  },
  {
    id: 'stage3',
    text: () => 'Külçe tozdan pahalıya satılır. 15 külçe satınca ilk parsel hazır olacak.',
    highlight: () => 'objective',
    isDone: (ctx) => ctx.completedStages >= 3,
  },
  {
    id: 'plot',
    text: () =>
      'Fabrikayı büyüt: zemindeki "Dökümhane Parseli" rozetine dokun (ya da İNŞA\'dan parseli seç) ve satın al.',
    highlight: () => 'plotBadge',
    isDone: (ctx) => ctx.isPlotUnlocked(1) || ctx.completedStages >= 4,
  },
  {
    id: 'stage4',
    text: () =>
      'Yeni alan açıldı. İNŞA > Hammadde Girişleri\'nden ikinci bir demir girişi kurabilirsin. Hedef: $600 ciro.',
    highlight: () => 'build',
    isDone: (ctx) => ctx.completedStages >= 4,
  },
  {
    id: 'press',
    text: () =>
      'Pres açıldı: külçeyi Çelik Levha\'ya çevirir. Fırından sonra bir Hidrolik Pres kur ve levhaları sandığa ulaştır.',
    highlight: () => 'build',
    isDone: (ctx) => ctx.exported('iron_plate') > 0 || ctx.completedStages >= 5,
  },
  {
    id: 'stage5',
    text: () => '20 levha satınca Hassas Kesici açılacak. Makineleri yükseltmek ve hattı çoğaltmak işi hızlandırır.',
    highlight: () => 'objective',
    isDone: (ctx) => ctx.completedStages >= 5,
  },
  {
    id: 'cutter',
    text: () =>
      'Hassas Kesici\'yi kur, sonra ona dokunup reçeteyi "Hassas Dişli" seç. Yanlış reçetede hat durur.',
    highlight: () => 'build',
    isDone: (ctx) => ctx.exported('steel_gear') > 0 || ctx.completedStages >= 6,
  },
  {
    id: 'stage6',
    text: () => '20 dişli ve $2.500 ciro: ROKET HANGARI açılacak. Az kaldı!',
    highlight: () => 'objective',
    isDone: (ctx) => ctx.hangarUnlocked,
  },
  {
    // Pencere açıkken kutu gizlendiği için uçuşun nasıl yapılacağı burada anlatılır
    id: 'hangar',
    text: () =>
      'Hangar açıldı! HANGAR\'a bas ve UÇUŞU BAŞLAT. İmleç yeşildeyken ateşle; havada basılı tutarak nitro kullan.',
    highlight: () => 'hangar',
    isDone: (ctx) => ctx.totalFlights >= 1,
  },
  {
    id: 'after_flight',
    text: () =>
      'İlk uçuşun tamam! Daha uzağa gitmek geliri kalıcı artırır: sevkiyata ulaşan parçalarla roketi yükselt.',
    needsConfirm: true,
  },
  {
    id: 'leaderboard',
    text: (ctx) =>
      ctx.leaderboardOnline
        ? 'Rekorun lider tablosunda: kupaya dokun. Diğer pilotlarla yarışıyorsun; daha uzağa git, sıralamada yüksel. Öğretici bitti.'
        : 'Rekorun lider tablosuna yazıldı: kupaya dokun, yerini gör ve daha uzağa giderek sıralamada yüksel. Öğretici bitti.',
    highlight: () => 'leaderboard',
    needsConfirm: true,
  },
];

export class TutorialGuide {
  private done = false;
  private confirmed = new Set<string>();

  get isDone(): boolean {
    return this.done;
  }

  /**
   * Geçerli adımı döner; durumdan tamamlandığı anlaşılan adımlar atlanır.
   * Öğretici bittiyse (ya da hiç gerekmiyorsa) null döner.
   */
  current(ctx: TutorialContext): TutorialStepView | null {
    if (this.done) return null;

    for (let index = 0; index < STEPS.length; index++) {
      const step = STEPS[index];
      const finished = step.needsConfirm
        ? this.confirmed.has(step.id) || (step.isObsolete?.(ctx) ?? false)
        : (step.isDone?.(ctx) ?? false);
      if (finished) continue;

      return {
        id: step.id,
        index: index + 1,
        total: STEPS.length,
        text: step.text(ctx),
        highlight: step.highlight?.(ctx) ?? null,
        needsConfirm: step.needsConfirm ?? false,
      };
    }

    this.done = true;
    return null;
  }

  /** Bilgi adımını kapatır ("Tamam") */
  confirm(stepId: string): void {
    this.confirmed.add(stepId);
  }

  /** Öğreticiyi kapatır (oyuncu atladı) */
  skip(): void {
    this.done = true;
  }

  /** Öğreticiyi baştan başlatır (Ayarlar'dan) */
  restart(): void {
    this.done = false;
    this.confirmed.clear();
  }

  serialize(): TutorialState {
    return { done: this.done, confirmed: Array.from(this.confirmed) };
  }

  /**
   * Kayıttan yükler. Öğretici eklenmeden önce oynanmış ve en az bir uçuş yapmış
   * kayıtlarda öğretici hiç gösterilmez.
   */
  deserialize(state: Partial<TutorialState> | undefined, totalFlights: number): void {
    this.confirmed = new Set(Array.isArray(state?.confirmed) ? state.confirmed : []);
    this.done = state ? Boolean(state.done) : totalFlights >= 1;
  }
}
