import { EconomyManager } from '../economy/EconomyManager';
import { MACHINES } from '../data/MachineData';
import { formatNumber } from '../utils/format';
import { ROCKET_UPGRADES } from '../data/RocketData';

export class DOMUIManager {
  private moneyEl: HTMLElement;
  private incomeEl: HTMLElement;
  private distanceEl: HTMLElement;

  private upgradesContainer: HTMLElement;
  private rocketUpgradesContainer: HTMLElement;
  private btnLaunch: HTMLButtonElement;

  private tabFactory: HTMLButtonElement;
  private tabRocket: HTMLButtonElement;
  private panelFactory: HTMLElement;
  private panelRocket: HTMLElement;

  private economy: EconomyManager;
  private onLaunchCallback: () => void;
  private onUpgradeMachine: (index: number) => void;
  private onUpgradeRocket: (partIndex: number) => void;

  constructor(
    economy: EconomyManager,
    onLaunch: () => void,
    onUpgradeMachine: (index: number) => void,
    onUpgradeRocket: (partIndex: number) => void
  ) {
    this.economy = economy;
    this.onLaunchCallback = onLaunch;
    this.onUpgradeMachine = onUpgradeMachine;
    this.onUpgradeRocket = onUpgradeRocket;

    this.moneyEl = document.getElementById('ui-money')!;
    this.incomeEl = document.getElementById('ui-income')!;
    this.distanceEl = document.getElementById('ui-distance')!;

    this.upgradesContainer = document.getElementById('ui-upgrades')!;
    this.rocketUpgradesContainer = document.getElementById('ui-rocket-upgrades')!;
    this.btnLaunch = document.getElementById('ui-btn-launch') as HTMLButtonElement;

    this.tabFactory = document.getElementById('tab-btn-factory') as HTMLButtonElement;
    this.tabRocket = document.getElementById('tab-btn-rocket') as HTMLButtonElement;
    this.panelFactory = document.getElementById('panel-factory')!;
    this.panelRocket = document.getElementById('panel-rocket')!;

    this.initTabs();
    this.initUpgrades();
    this.initRocketUpgrades();

    this.btnLaunch.onclick = () => {
      this.onLaunchCallback();
    };
  }

  private initTabs() {
    this.tabFactory.onclick = () => {
      this.tabFactory.classList.add('active');
      this.tabRocket.classList.remove('active');
      this.panelFactory.classList.add('active');
      this.panelRocket.classList.remove('active');
    };
    this.tabRocket.onclick = () => {
      this.tabRocket.classList.add('active');
      this.tabFactory.classList.remove('active');
      this.panelRocket.classList.add('active');
      this.panelFactory.classList.remove('active');
    };
  }

  private initUpgrades() {
    this.upgradesContainer.innerHTML = '';
    for (let i = 0; i < MACHINES.length; i++) {
      const def = MACHINES[i];
      const card = document.createElement('div');
      card.className = 'px-card';
      card.id = `ui-machine-${i}`;

      card.innerHTML = `
        <div class="px-card-header">
          <span class="px-card-title">${def.name}</span>
          <span class="px-card-level" id="ui-machine-level-${i}">Lvl 0</span>
        </div>
        <div class="px-card-desc" id="ui-machine-desc-${i}"></div>
        <div class="px-card-actions">
          <span style="color:var(--px-gold); font-size:10px;" id="ui-machine-cost-${i}">0</span>
          <button class="px-button" id="ui-machine-btn-${i}">AL</button>
        </div>
      `;

      this.upgradesContainer.appendChild(card);

      const btn = document.getElementById(`ui-machine-btn-${i}`) as HTMLButtonElement;
      btn.onclick = () => {
        this.onUpgradeMachine(i);
        this.update(); // Hemen güncelle
      };
    }
  }

  private initRocketUpgrades() {
    this.rocketUpgradesContainer.innerHTML = '';
    for (let i = 0; i < ROCKET_UPGRADES.length; i++) {
      const def = ROCKET_UPGRADES[i];
      const card = document.createElement('div');
      card.className = 'px-card';
      card.id = `ui-rocket-${i}`;

      card.innerHTML = `
        <div class="px-card-header">
          <span class="px-card-title">${def.name}</span>
          <span class="px-card-level" id="ui-rocket-level-${i}">Lvl 0</span>
        </div>
        <div class="px-card-desc">${def.description}</div>
        <div class="px-card-actions">
          <span style="color:var(--px-gold); font-size:10px;" id="ui-rocket-cost-${i}">0</span>
          <button class="px-button" id="ui-rocket-btn-${i}">GELİŞTİR</button>
        </div>
      `;

      this.rocketUpgradesContainer.appendChild(card);

      const btn = document.getElementById(`ui-rocket-btn-${i}`) as HTMLButtonElement;
      btn.onclick = () => {
        this.onUpgradeRocket(i);
        this.update();
      };
    }
  }

  public update() {
    // Üst Bar
    this.moneyEl.innerText = formatNumber(this.economy.resources);
    this.incomeEl.innerText = formatNumber(this.economy.getTotalProductionPerSecond()) + '/sn';
    this.distanceEl.innerText = formatNumber(this.economy.flightStats.bestDistance) + ' m';

    // Fabrika Yükseltmeleri
    for (let i = 0; i < MACHINES.length; i++) {
      const isUnlocked = this.economy.isUnlocked(i);
      const state = this.economy.getMachineState(i);
      const cost = this.economy.getCost(i);
      const canAfford = this.economy.canAfford(i);
      const prod = this.economy.getProduction(i);
      
      const card = document.getElementById(`ui-machine-${i}`)!;
      const levelEl = document.getElementById(`ui-machine-level-${i}`)!;
      const descEl = document.getElementById(`ui-machine-desc-${i}`)!;
      const costEl = document.getElementById(`ui-machine-cost-${i}`)!;
      const btn = document.getElementById(`ui-machine-btn-${i}`) as HTMLButtonElement;

      if (!isUnlocked) {
        card.classList.add('disabled');
        levelEl.innerText = 'Kilitli';
        descEl.innerText = 'Önceki makineyi geliştirin.';
        costEl.innerText = '---';
        btn.disabled = true;
      } else {
        card.classList.toggle('disabled', !canAfford && state.level > 0);
        levelEl.innerText = 'Sv.' + state.level;
        descEl.innerText = state.level > 0 ? `+${formatNumber(prod)}/sn` : 'Henüz satın alınmadı';
        costEl.innerText = formatNumber(cost);
        btn.disabled = !canAfford;
        btn.innerText = state.level > 0 ? 'GELİŞTİR' : 'KUR';
      }
    }

    // Roket Yükseltmeleri
    for (let i = 0; i < ROCKET_UPGRADES.length; i++) {
      const level = this.economy.getRocketUpgradeLevel(ROCKET_UPGRADES[i].id);
      const cost = this.economy.getRocketUpgradeCost(ROCKET_UPGRADES[i].id);
      const canAfford = this.economy.canAffordRocketUpgrade(ROCKET_UPGRADES[i].id);

      const card = document.getElementById(`ui-rocket-${i}`)!;
      const levelEl = document.getElementById(`ui-rocket-level-${i}`)!;
      const costEl = document.getElementById(`ui-rocket-cost-${i}`)!;
      const btn = document.getElementById(`ui-rocket-btn-${i}`) as HTMLButtonElement;

      card.classList.toggle('disabled', !canAfford);
      levelEl.innerText = 'Sv.' + level;
      costEl.innerText = formatNumber(cost);
      btn.disabled = !canAfford;
    }
  }

  public toggleLaunchMode(isLaunchMode: boolean) {
    if (isLaunchMode) {
      this.tabRocket.click(); // Roket paneline geç
    }
  }
}