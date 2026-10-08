/* ======================================================================
 * tools/economy_model.ts — Uzun vade ekonomi ve tempo modeli (M9-F)
 *
 * Oyunun kendi tablolarını (eşya/reçete/makine kayıtları, roket yükseltmeleri,
 * menzil merdiveni, parseller, giriş fiyatları) okur ve üç şeyi yazar:
 *
 *   1. Eşya tablosu: bir birim için gereken hammadde, makine-saniyesi, değer.
 *   2. Roket tablosu: her sınıf için nakit, parça ve parçaların hammadde karşılığı.
 *   3. Büyüme simülasyonu: 10. aşamayı yeni bitirmiş bir fabrikadan başlayıp
 *      Sv.10'a kadar hangi sınıfa ne zaman ulaşıldığı.
 *
 * Çalıştırma:
 *   node --experimental-strip-types tools/economy_model.ts            # üç oyuncu profili
 *   node --experimental-strip-types tools/economy_model.ts --tables   # yalnız tablolar
 *   node --experimental-strip-types tools/economy_model.ts --no-effort  # kurma emeği sınırsız
 *
 * ÖNEMLİ: 3. bölüm bir MODELDİR, ölçüm değildir. Fabrika tek tek kurulmaz;
 * "saniyede işlenen hammadde" (kapasite) olarak soyutlanır ve oyuncu davranışı
 * birkaç parametreyle (verim, geri ödeme sabrı, uçuş sıklığı) temsil edilir.
 * Mutlak süreler ±%50 oynayabilir; model, kademeler arası oranı ve bir kalemin
 * diğerlerine göre ucuz/pahalı kaldığını görmek içindir.
 * ====================================================================== */

import { defaultItemRegistry } from '../src/factory/simulation/ItemRegistry.ts';
import { defaultRecipeRegistry } from '../src/factory/simulation/RecipeRegistry.ts';
import { defaultMachineRegistry } from '../src/factory/simulation/MachineRegistry.ts';
import { FACTORY_PLOTS } from '../src/factory/simulation/FactoryEconomy.ts';
import { getModuleUpgradeDefinition, type RocketModuleCategory } from '../src/factory/simulation/RocketHangarBridge.ts';
import { INTAKE_BUILD_COSTS, INTAKE_COST_GROWTH, PlacementMath } from '../src/factory/input/PlacementMath.ts';
import { machineUpgradeFactor } from '../src/factory/simulation/FactoryEconomy.ts';
import { RANGE_LADDER, RangeLadder } from '../src/flight/RangeLadder.ts';
import { MAX_ROCKET_LEVEL } from '../src/data/RocketData.ts';
import { FLIGHT_REWARD_MAX_SECONDS } from '../src/scenes/FlightReturnHelper.ts';

/* ----------------------------------------------------------------------
 * 1. Eşya tablosu
 * -------------------------------------------------------------------- */

interface ItemCost {
  /** Hammadde kimliği -> bir birim için gereken adet */
  raw: Record<string, number>;
  /** Makine kimliği -> bir birim için gereken makine-saniyesi (1. seviye) */
  machineSec: Record<string, number>;
}

const RAW_IDS = Object.keys(INTAKE_BUILD_COSTS);
const recipes = defaultRecipeRegistry.getAll();
const machines = defaultMachineRegistry.getAll();

/** Eşyayı ana çıktısı olarak üreten reçete ve onu işleyen makine */
function producerOf(itemId: string): { recipe: (typeof recipes)[number]; machineId: string } | null {
  const recipe = recipes.find((r) => r.outputs[0]?.itemId === itemId);
  if (!recipe) return null;
  const machine = machines.find((m) => m.supportedRecipeIds.includes(recipe.id));
  return machine ? { recipe, machineId: machine.id } : null;
}

const costCache = new Map<string, ItemCost>();

function itemCost(itemId: string): ItemCost {
  const cached = costCache.get(itemId);
  if (cached) return cached;

  const cost: ItemCost = { raw: {}, machineSec: {} };
  const producer = RAW_IDS.includes(itemId) ? null : producerOf(itemId);
  if (!producer) {
    cost.raw[itemId] = 1;
  } else {
    const { recipe, machineId } = producer;
    const outputCount = recipe.outputs[0].count;
    cost.machineSec[machineId] = recipe.processingTimeSec / outputCount;
    for (const input of recipe.inputs) {
      const inner = itemCost(input.itemId);
      const share = input.count / outputCount;
      for (const [raw, count] of Object.entries(inner.raw)) cost.raw[raw] = (cost.raw[raw] ?? 0) + count * share;
      for (const [machine, sec] of Object.entries(inner.machineSec)) {
        cost.machineSec[machine] = (cost.machineSec[machine] ?? 0) + sec * share;
      }
    }
  }
  costCache.set(itemId, cost);
  return cost;
}

const sum = (record: Record<string, number>): number => Object.values(record).reduce((a, b) => a + b, 0);
const money = (value: number): string =>
  value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}K` : `$${Math.round(value)}`;
const minutes = (seconds: number): string => `${(seconds / 60).toFixed(1)} dk`;

function printItemTable(): void {
  console.log('\n== 1. Eşya tablosu (1 birim için) ==');
  console.log('eşya                     | değer | hammadde | $/hammadde | makine-sn | hammadde dağılımı');
  for (const item of defaultItemRegistry.getAll()) {
    if (RAW_IDS.includes(item.id) || !producerOf(item.id)) continue;
    const cost = itemCost(item.id);
    const raw = sum(cost.raw);
    const mix = Object.entries(cost.raw)
      .map(([id, n]) => `${id.split('_')[0]} ${n.toFixed(2)}`)
      .join(', ');
    console.log(
      `${item.id.padEnd(24)} | ${String(item.baseValue).padStart(5)} | ${raw.toFixed(2).padStart(8)} | ${(item.baseValue / raw)
        .toFixed(1)
        .padStart(10)} | ${sum(cost.machineSec).toFixed(1).padStart(9)} | ${mix}`,
    );
  }
}

/* ----------------------------------------------------------------------
 * 2. Roket tablosu
 * -------------------------------------------------------------------- */

const MODULES: readonly RocketModuleCategory[] = ['hull', 'engine', 'wings', 'boost'];

interface ModuleStep {
  module: RocketModuleCategory;
  level: number;
  cash: number;
  /** Parçaların hammadde karşılığı (adet) */
  partsRaw: number;
  /** Parçalar satılsaydı edeceği baz değer */
  partsValue: number;
}

function moduleStep(module: RocketModuleCategory, level: number): ModuleStep {
  const def = getModuleUpgradeDefinition(module, level);
  if (!def) throw new Error(`tanım yok: ${module} ${level}`);
  let partsRaw = 0;
  let partsValue = 0;
  for (const part of def.parts) {
    partsRaw += sum(itemCost(part.itemId).raw) * part.count;
    partsValue += (defaultItemRegistry.get(part.itemId)?.baseValue ?? 0) * part.count;
  }
  return { module, level, cash: def.cashCost, partsRaw, partsValue };
}

function printRocketTable(): void {
  console.log('\n== 2. Roket tablosu (sınıf başına: dört modülün toplamı) ==');
  console.log('sınıf | nakit      | parça hammaddesi | parçaların satış değeri | basamak (beklenen)');
  let totalCash = 0;
  for (let level = 2; level <= MAX_ROCKET_LEVEL; level++) {
    const steps = MODULES.map((module) => moduleStep(module, level));
    const cash = steps.reduce((a, s) => a + s.cash, 0);
    totalCash += cash;
    const rung = RANGE_LADDER.filter((r) => r.expectedClass === level)
      .map((r) => `${r.targetMeters / 1000} km`)
      .join(', ');
    console.log(
      `Sv.${String(level).padStart(2)} | ${money(cash).padStart(10)} | ${Math.round(steps.reduce((a, s) => a + s.partsRaw, 0))
        .toString()
        .padStart(16)} | ${money(steps.reduce((a, s) => a + s.partsValue, 0)).padStart(23)} | ${rung}`,
    );
  }
  console.log(`toplam nakit: ${money(totalCash)}`);

  console.log('\nParseller: ' + FACTORY_PLOTS.map((p) => `${p.targetWidth}x${p.targetHeight} ${money(p.cost)}`).join(' · '));
  console.log(
    'Giriş (n. giriş): ' +
      [1, 5, 10, 15, 20].map((n) => `${n}. demir ${money(PlacementMath.getIntakeCostForCount('iron_ore', n))}`).join(' · ') +
      ` (her yeni giriş ×${INTAKE_COST_GROWTH})`,
  );
}

/* ----------------------------------------------------------------------
 * 3. Büyüme simülasyonu
 * -------------------------------------------------------------------- */

/**
 * Fabrikanın sattığı ürün karışımı: itici blok ve güdüm bilgisayarı eşit sayıda.
 * İkisi birlikte dört hammaddeyi de kullanır ve en yüksek "hammadde başına değer"i verir.
 */
const EXPORT_MIX: ReadonlyArray<{ itemId: string; share: number }> = [
  { itemId: 'rocket_thruster_block', share: 1 },
  { itemId: 'guidance_computer', share: 1 },
];

const mixCost: ItemCost = { raw: {}, machineSec: {} };
let mixValue = 0;
for (const { itemId, share } of EXPORT_MIX) {
  const cost = itemCost(itemId);
  for (const [raw, n] of Object.entries(cost.raw)) mixCost.raw[raw] = (mixCost.raw[raw] ?? 0) + n * share;
  for (const [m, s] of Object.entries(cost.machineSec)) mixCost.machineSec[m] = (mixCost.machineSec[m] ?? 0) + s * share;
  mixValue += (defaultItemRegistry.get(itemId)?.baseValue ?? 0) * share;
}
const MIX_RAW = sum(mixCost.raw);
/** Karışımın hammadde başına değeri ($) */
const VALUE_PER_RAW = mixValue / MIX_RAW;
/** 1 hammadde/sn işlemek için gereken 1. seviye makinelerin bedeli ve kapladığı hücre */
let UNIT_MACHINE_COST = 0;
let UNIT_MACHINE_CELLS = 0;
for (const [machineId, sec] of Object.entries(mixCost.machineSec)) {
  const def = defaultMachineRegistry.getOrThrow(machineId);
  UNIT_MACHINE_COST += (sec / MIX_RAW) * def.baseCost;
  UNIT_MACHINE_CELLS += (sec / MIX_RAW) * def.width * def.height;
}
/**
 * 1 hammadde/sn için bant hücresi (makine seviyesiyle küçülmez; bir bant 2 eşya/sn taşır,
 * yan yana makineler birbirine doğrudan aktarır).
 */
const UNIT_BELT_CELLS = 8;
const BELT_COST = 5;
/** 1 hammadde/sn'lik parktaki makine sayısı (makine-saniyesi = 1. seviyede makine adedi) */
const UNIT_MACHINE_COUNT = sum(mixCost.machineSec) / MIX_RAW;
/** Parselin makine ve bantla doldurulabilen bölümü */
const USABLE_AREA_SHARE = 0.8;

interface Profile {
  name: string;
  /** Kurulu kapasitenin gerçekten çalışan oranı (dengesiz hat, tıkanma, boş kalan makine) */
  efficiency: number;
  /** Büyüme adımı, bedelini bu kadar dakikada çıkarıyorsa alınır */
  paybackMinutes: number;
  /** Kaç dakikada bir uçuş yapıldığı (uçuş primi = 180 sn gelir) */
  flightEveryMinutes: number;
  /** Parça toplarken kapasitenin parçaya ayrılan oranı */
  partsShare: number;
  /** Oyun süresinin fabrika kurmaya/düzenlemeye harcanan oranı */
  buildShare: number;
  /** 1 hammadde/sn'lik yeni hattı (makineler + bantlar + reçeteler) kurmanın süresi (sn) */
  secondsPerUnit: number;
}

/** Bir makineyi bir seviye yükseltmenin (makineye dokun, yükselt, kapat) süresi (sn) */
const SECONDS_PER_LEVEL_CLICK = 3;
const SECONDS_PER_INTAKE = 20;

const PROFILES: readonly Profile[] = [
  { name: 'rahat', efficiency: 0.45, paybackMinutes: 10, flightEveryMinutes: 10, partsShare: 0.4, buildShare: 0.35, secondsPerUnit: 420 },
  { name: 'ortalama', efficiency: 0.65, paybackMinutes: 20, flightEveryMinutes: 6, partsShare: 0.5, buildShare: 0.5, secondsPerUnit: 300 },
  { name: 'optimizasyoncu', efficiency: 0.9, paybackMinutes: 40, flightEveryMinutes: 4, partsShare: 0.6, buildShare: 0.6, secondsPerUnit: 200 },
];

interface SimRow {
  level: number;
  atSec: number;
  tookSec: number;
  income: number;
  multiplier: number;
  capacity: number;
  intakes: number;
  machineLevel: number;
  plot: string;
  /** Kademe boyunca nakit beklenen (parçası hazır, parası eksik) süre */
  cashWaitSec: number;
  /** Kademe boyunca parça toplanan süre */
  partsSec: number;
}

function simulate(profile: Profile): { rows: SimRow[]; longestWaitSec: number; plotLog: string[] } {
  // 10. aşamayı yeni bitirmiş fabrika: birkaç hat, toplam ~2,5 hammadde/sn işliyor
  let moneyNow = 10000;
  let multiplier = 2.25;
  let bestClass = 3;
  const intakes: Record<string, number> = { iron_ore: 3, copper_ore: 2, silica_sand: 1, crude_polymer: 1 };
  let machineUnits = 2.5; // 1. seviye makine parkı: bu kadar hammadde/sn işler
  let machineLevel = 1;
  let plotIndex = 4;
  let t = 0;
  /** Biriken kurma emeği (sn) */
  let effort = 0;
  const plotLog: string[] = [];

  const speedAt = (level: number): number => 1 + 0.2 * (level - 1);
  const speed = (): number => speedAt(machineLevel);
  const intakeTotal = (): number => sum(intakes);
  const capacity = (): number => Math.min(intakeTotal(), machineUnits * speed());
  const areaOf = (units: number, cap: number): number => units * UNIT_MACHINE_CELLS + cap * UNIT_BELT_CELLS;
  const areaTotal = (index: number): number => {
    const plot = FACTORY_PLOTS[index];
    return plot.targetWidth * plot.targetHeight * USABLE_AREA_SHARE;
  };
  const flightBonus = 1 + FLIGHT_REWARD_MAX_SECONDS / (profile.flightEveryMinutes * 60);
  const incomeOf = (cap: number): number => cap * VALUE_PER_RAW * profile.efficiency * multiplier * flightBonus;

  /** Karışım oranına göre en eksik hammaddenin sıradaki girişi */
  const nextIntake = (): { raw: string; cost: number } => {
    let pick = RAW_IDS[0];
    let lowest = Infinity;
    for (const raw of RAW_IDS) {
      const ratio = intakes[raw] / (mixCost.raw[raw] ?? 0.0001);
      if (ratio < lowest) {
        lowest = ratio;
        pick = raw;
      }
    }
    return { raw: pick, cost: PlacementMath.getIntakeCostForCount(pick, intakes[pick]) };
  };
  /** Makineyi 1. seviyeden `level` seviyesine getirmenin taban bedele oranı */
  const levelFactor = (level: number): number => {
    let factor = 1;
    for (let l = 1; l < level; l++) factor += machineUpgradeFactor(l);
    return factor;
  };
  const machineUnitCost = (): number => UNIT_MACHINE_COST * levelFactor(machineLevel);
  const levelUpCost = (): number => machineUnits * UNIT_MACHINE_COST * machineUpgradeFactor(machineLevel);

  interface Step {
    cost: number;
    effort: number;
    apply: () => void;
  }

  /**
   * Kapasiteyi 1 hammadde/sn artırmanın en ucuz yolu. Gerekiyorsa giriş alınır;
   * makine kapasitesi yetmiyorsa yeni makine kurulur (alan varsa), alan yoksa makineler
   * bir seviye yükseltilir veya (izni varsa) yeni parsel alınır.
   */
  const growthStep = (): Step | null => {
    const target = capacity() + 1;
    let cost = 0;
    let effortNeeded = 0;
    const actions: Array<() => void> = [];

    if (target > intakeTotal()) {
      const intake = nextIntake();
      cost += intake.cost;
      effortNeeded += profile.secondsPerUnit > 0 ? SECONDS_PER_INTAKE : 0;
      actions.push(() => {
        intakes[intake.raw] += 1;
      });
    }

    if (target > machineUnits * speed()) {
      const addUnits = (target - machineUnits * speed()) / speed();
      const addCost = addUnits * machineUnitCost() + UNIT_BELT_CELLS * BELT_COST;
      const addEffort = addUnits * profile.secondsPerUnit;
      const fitsNow = areaOf(machineUnits + addUnits, target) <= areaTotal(plotIndex);

      const nextPlot = FACTORY_PLOTS[plotIndex + 1];
      const permit = nextPlot ? RangeLadder.rungForPlot(nextPlot.index) : null;
      const plotAllowed = !!nextPlot && (!permit || bestClass >= permit.expectedClass);
      const fitsWithPlot = plotAllowed && areaOf(machineUnits + addUnits, target) <= areaTotal(plotIndex + 1);
      // Seviye yükseltme alan açmaz ama aynı makinelerle daha çok işler; bantlar yine yer ister
      const levelFits = areaOf(machineUnits, target) <= areaTotal(plotIndex);

      const options: Step[] = [];
      if (fitsNow) {
        options.push({ cost: addCost, effort: addEffort, apply: () => void (machineUnits += addUnits) });
      }
      if (levelFits) {
        options.push({
          cost: levelUpCost(),
          effort: profile.secondsPerUnit > 0 ? machineUnits * UNIT_MACHINE_COUNT * SECONDS_PER_LEVEL_CLICK : 0,
          apply: () => void (machineLevel += 1),
        });
      }
      if (!fitsNow && fitsWithPlot) {
        options.push({
          cost: nextPlot.cost + addCost,
          effort: addEffort,
          apply: () => {
            plotIndex += 1;
            machineUnits += addUnits;
            plotLog.push(`${nextPlot.targetWidth}x${nextPlot.targetHeight} @ ${(t / 3600).toFixed(2)} sa`);
          },
        });
      }
      if (options.length === 0) return null;
      const best = options.reduce((a, b) => (b.cost < a.cost ? b : a));
      cost += best.cost;
      effortNeeded += best.effort;
      actions.push(best.apply);
    }
    return { cost, effort: effortNeeded, apply: () => actions.forEach((run) => run()) };
  };

  // Sıradaki roket hedefleri: her sınıf için dört modül
  const goals: ModuleStep[] = [];
  for (let level = 4; level <= MAX_ROCKET_LEVEL; level++) {
    for (const module of MODULES) goals.push(moduleStep(module, level));
  }

  const rows: SimRow[] = [];
  let goalIndex = 0;
  let partsLeft = goals[0].partsRaw;
  let lastLevelAt = 0;
  let lastPurchaseAt = 0;
  let longestWaitSec = 0;
  let cashWaitSec = 0;
  let partsSec = 0;
  const DT = 1;
  const LIMIT = 300 * 3600;

  while (goalIndex < goals.length && t < LIMIT) {
    const goal = goals[goalIndex];
    const cap = capacity();
    const collecting = partsLeft > 0;
    const exportShare = collecting ? 1 - profile.partsShare : 1;
    moneyNow += incomeOf(cap) * exportShare * DT;
    if (collecting) {
      partsLeft -= cap * profile.efficiency * profile.partsShare * DT;
      partsSec += DT;
    } else if (moneyNow < goal.cash) {
      cashWaitSec += DT;
    }
    effort += profile.buildShare * DT;
    t += DT;

    // Hedefin nakdi ve parçası hazırsa yükselt
    if (partsLeft <= 0 && moneyNow >= goal.cash) {
      moneyNow -= goal.cash;
      longestWaitSec = Math.max(longestWaitSec, t - lastPurchaseAt);
      lastPurchaseAt = t;
      goalIndex += 1;
      if (goalIndex < goals.length) partsLeft = goals[goalIndex].partsRaw;

      if (goalIndex % MODULES.length === 0) {
        const level = goal.level;
        bestClass = level;
        // Sınıfın beklenen basamak(lar)ı geçilir: gelir çarpanı büyür
        for (const rung of RANGE_LADDER) {
          if (rung.expectedClass === level && rung.multiplierFactor) multiplier *= rung.multiplierFactor;
        }
        const plot = FACTORY_PLOTS[plotIndex];
        rows.push({
          level,
          atSec: t,
          tookSec: t - lastLevelAt,
          income: incomeOf(capacity()),
          multiplier,
          capacity: capacity(),
          intakes: intakeTotal(),
          machineLevel,
          plot: `${plot.targetWidth}x${plot.targetHeight}`,
          cashWaitSec,
          partsSec,
        });
        lastLevelAt = t;
        cashWaitSec = 0;
        partsSec = 0;
      }
      continue;
    }

    // Büyüme: emeği birikmiş, parası olan ve bedelini sabır süresinde çıkaran adım alınır
    const step = growthStep();
    if (step && step.effort <= effort && step.cost <= moneyNow) {
      const gain = incomeOf(capacity() + 1) - incomeOf(capacity());
      if (step.cost <= gain * profile.paybackMinutes * 60) {
        moneyNow -= step.cost;
        effort -= step.effort;
        step.apply();
        longestWaitSec = Math.max(longestWaitSec, t - lastPurchaseAt);
        lastPurchaseAt = t;
      }
    }
    // Emek sınırsız birikmez: oyuncu en fazla bir saatlik işi "bekletir"
    effort = Math.min(effort, 3600 * profile.buildShare);
  }

  return { rows, longestWaitSec, plotLog };
}

function printSimulation(): void {
  console.log('\n== 3. Büyüme simülasyonu (MODEL; reklam izlenmiyor) ==');
  console.log(
    `karışım: ${EXPORT_MIX.map((m) => m.itemId).join(' + ')} · hammadde başına $${VALUE_PER_RAW.toFixed(1)} · ` +
      `1 hammadde/sn için makine $${Math.round(UNIT_MACHINE_COST)} ve ${UNIT_MACHINE_CELLS.toFixed(1)} hücre + ${UNIT_BELT_CELLS} bant`,
  );
  // --no-effort: kurma emeği sınırsız; fabrika para yettiği an büyür (üst sınır senaryosu)
  const unlimitedEffort = process.argv.includes('--no-effort');
  for (const baseProfile of PROFILES) {
    const profile = unlimitedEffort ? { ...baseProfile, secondsPerUnit: 0, buildShare: 1 } : baseProfile;
    const { rows, longestWaitSec, plotLog } = simulate(profile);
    console.log(
      `\n-- ${profile.name}: verim ${profile.efficiency}, geri ödeme ${profile.paybackMinutes} dk, ${profile.flightEveryMinutes} dk'da bir uçuş, ` +
        `hat başına ${profile.secondsPerUnit} sn emek (sürenin %${Math.round(profile.buildShare * 100)}'i) --`,
    );
    console.log('sınıf | ulaşma    | kademe süresi | nakit bekleme | parça süresi | gelir $/sn | çarpan | kapasite | giriş | mak.sv | alan');
    for (const row of rows) {
      console.log(
        `Sv.${String(row.level).padStart(2)} | ${(row.atSec / 3600).toFixed(2).padStart(6)} sa | ${minutes(row.tookSec).padStart(13)} | ${minutes(
          row.cashWaitSec,
        ).padStart(13)} | ${minutes(row.partsSec).padStart(12)} | ${Math.round(row.income)
          .toString()
          .padStart(10)} | ${row.multiplier.toFixed(2).padStart(6)} | ${row.capacity.toFixed(1).padStart(8)} | ${String(row.intakes).padStart(
          5,
        )} | ${String(row.machineLevel).padStart(6)} | ${row.plot}`,
      );
    }
    if (rows.length < MAX_ROCKET_LEVEL - 3) console.log('  (süre sınırında Sv.10\'a ulaşılamadı)');
    console.log(`  alım yapılmayan en uzun süre: ${minutes(longestWaitSec)} · parseller: ${plotLog.join(', ') || 'alınmadı'}`);
  }
}

printItemTable();
printRocketTable();
if (!process.argv.includes('--tables')) printSimulation();
