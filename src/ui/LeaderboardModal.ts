/* ======================================================================
 * LeaderboardModal.ts — Lider tablosu penceresi
 *
 * Rekor mesafeye göre sıralama. Üstte oyuncunun kendi rekoru ve sırası, altında
 * tablo. Tablonun nereden geldiği her zaman yazar: çevrimiçi (gerçek oyuncular),
 * örnek veri (geliştirme sürümü) ya da yerel (sunucu yok; yalnız oyuncu ve menzil
 * hedefleri). Pencere her açılışta tabloyu yeniden ister.
 * ====================================================================== */

import Phaser from 'phaser';
import type { LeaderboardEntry, LeaderboardSnapshot } from '../leaderboard/LeaderboardService.ts';
import { formatDistance } from '../utils/format.ts';
import { SEMANTIC, SPACE } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, createCard, createInset } from './system/UiWidgets.ts';

export interface LeaderboardModalConfig {
  /** Oyuncunun güncel rekoru (metre) ve tablodaki adı */
  getPlayer: () => { name: string; bestDistance: number };
  /** Tabloyu getirir (ağ isteği olabilir) */
  loadSnapshot: () => Promise<LeaderboardSnapshot>;
  /** Hangarı açar ("daha uzağa git" çağrısı); hangar kilitliyken null döndürülür */
  getOpenHangar?: () => (() => void) | null;
}

const ROW_HEIGHT = 28;

const MODE_NOTES = {
  online: 'Bütün oyuncuların rekor mesafeleri. Daha uzağa git, sıralamada yüksel.',
  sample:
    'ÖRNEK VERİ: bu satırlar gerçek oyuncu değildir. Çevrimiçi sıralama sunucusu bağlanınca gerçek oyuncular görünür.',
  local:
    'Çevrimiçi sıralama henüz bağlı değil; başka oyuncu gösterilmiyor. Rekorun menzil hedefleriyle birlikte sıralanıyor.',
} as const;

export class LeaderboardModal extends UiModal {
  private readonly callbacks: LeaderboardModalConfig;
  private snapshot: LeaderboardSnapshot | null = null;
  private loading = false;
  private requestId = 0;
  private hangarButton: UiButton | null = null;

  constructor(layer: UiLayer, config: LeaderboardModalConfig) {
    super(layer, { title: 'Lider Tablosu', maxWidth: 420, depth: 206, accent: SEMANTIC.money });
    this.callbacks = config;
  }

  protected onOpened(): void {
    void this.reload();
  }

  /** Tabloyu yeniden ister; yanıt gelene dek "yükleniyor" gösterilir */
  private async reload(): Promise<void> {
    const request = ++this.requestId;
    this.loading = true;
    this.rebuild();
    const snapshot = await this.callbacks.loadSnapshot();
    // Pencere kapandıysa ya da daha yeni bir istek varsa bu yanıt yok sayılır
    if (!this.isOpen || request !== this.requestId) return;
    this.snapshot = snapshot;
    this.loading = false;
    this.rebuild();
    this.scrollToPlayer();
  }

  /** Oyuncunun satırını görünür alana getirir */
  private scrollToPlayer(): void {
    const rank = this.snapshot?.playerRank;
    // Üst sıralardaysa pencere baştan görünür; yalnız aşağıdaki satır için kaydırılır
    if (!rank || rank <= 8) return;
    this.scrollTo(this.listTop + (rank - 4) * ROW_HEIGHT);
  }

  private listTop = 0;

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;
    const player = this.callbacks.getPlayer();
    const snapshot = this.snapshot;
    let y = 0;

    // --- Oyuncunun rekoru ve sırası --------------------------------------
    const headH = 64;
    body.add(createCard(scene, 0, y, width, headH));
    body.add(scene.add.image(SPACE.md + 10, y + headH / 2, 'icon_trophy').setOrigin(0.5).setScale(1.5));
    body.add(layer.text(SPACE.md + 30, y + 12, 'SENİN REKORUN', 'captionBold', { color: SEMANTIC.textMuted }));
    body.add(
      layer.text(
        SPACE.md + 30,
        y + 28,
        player.bestDistance > 0 ? formatDistance(player.bestDistance) : 'Henüz uçuş yok',
        'title',
        { color: SEMANTIC.rocketHex },
      ),
    );
    if (snapshot?.playerRank) {
      const chip = new UiChip(layer, 0, y + 20, `${snapshot.playerRank}. sıra`, SEMANTIC.money, { icon: 'icon_flag' });
      chip.setX(width - SPACE.md - chip.chipWidth);
      body.add(chip);
    }
    y += headH + SPACE.sm;

    // --- Tablonun kaynağı -------------------------------------------------
    const mode = snapshot?.mode ?? 'local';
    const noteText =
      snapshot?.failed === true
        ? `Sıralama sunucusuna ulaşılamadı. ${MODE_NOTES.local}`
        : this.loading && !snapshot
          ? 'Sıralama yükleniyor…'
          : MODE_NOTES[mode];
    const note = layer.text(0, y, noteText, 'caption', {
      color: mode === 'sample' ? SEMANTIC.warningHex : SEMANTIC.textMuted,
      wrapWidth: width,
    });
    body.add(note);
    y += note.height + SPACE.sm;

    // --- Tablo ---------------------------------------------------------------
    this.listTop = y;
    const entries = snapshot?.entries ?? [];
    if (entries.length === 0 && !this.loading) {
      const empty = layer.text(0, y, 'Tabloda henüz kimse yok. İlk rekoru sen kır!', 'body', { wrapWidth: width });
      body.add(empty);
      return y + empty.height;
    }
    for (const entry of entries) {
      this.addRow(body, width, y, entry);
      y += ROW_HEIGHT;
    }
    return y;
  }

  private addRow(body: Phaser.GameObjects.Container, width: number, y: number, entry: LeaderboardEntry): void {
    const layer = this.layer;
    const centerY = y + ROW_HEIGHT / 2;
    // Oyuncunun satırı kutuyla vurgulanır; hedef satırları soluktur
    if (entry.isPlayer) body.add(createInset(this.scene, 0, y + 1, width, ROW_HEIGHT - 2));

    const color = entry.isPlayer ? SEMANTIC.moneyHex : entry.isBenchmark ? SEMANTIC.textMuted : SEMANTIC.textPrimary;
    const variant = entry.isPlayer ? 'bodyBold' : 'body';
    body.add(layer.text(SPACE.sm, centerY, `${entry.rank}.`, variant, { color }).setOrigin(0, 0.5));
    const distance = layer
      .text(width - SPACE.sm, centerY, formatDistance(entry.distanceMeters), variant, { color })
      .setOrigin(1, 0.5);
    body.add(distance);
    const name = layer.text(SPACE.sm + 34, centerY, '', variant, { color }).setOrigin(0, 0.5);
    const label = entry.isPlayer ? `${entry.name} (sen)` : entry.isBenchmark ? `Hedef: ${entry.name}` : entry.name;
    UiLayer.ellipsize(name, label, width - SPACE.sm * 2 - 34 - distance.width - SPACE.sm);
    body.add(name);
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const onOpenHangar = this.callbacks.getOpenHangar?.() ?? null;
    if (!onOpenHangar) {
      this.hangarButton = null;
      return 0;
    }
    const height = 44;
    this.hangarButton = new UiButton(this.layer, width / 2, height / 2, {
      width: Math.min(width, 280),
      height,
      variant: 'rocket',
      label: 'HANGARA GİT',
      icon: 'icon_rocket',
      onClick: () => {
        this.close();
        onOpenHangar();
      },
    });
    footer.add(this.hangarButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.hangarButton;
  }
}
