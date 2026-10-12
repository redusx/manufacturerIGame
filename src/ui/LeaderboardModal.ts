/* ======================================================================
 * LeaderboardModal.ts — Lider tablosu penceresi
 *
 * Sıralamayı CrazyGames tutar ve kendi arayüzünde gösterir; SDK'da listeyi okuyan
 * bir çağrı yoktur (DEC-054). Bu yüzden pencere başka oyuncu göstermez, satır
 * uydurmaz. Gösterdikleri: oyuncunun rekoru, bu haftaki en iyi uçuşu, son uçuşun
 * skoruna ne olduğu, hangi hesapla sıralandığı ve gerçek tablonun nerede görüleceği.
 *
 * Oyunun kendi skor sunucusu bağlıysa (isteğe bağlı, 'online') o sunucunun listesi
 * de altında gösterilir.
 * ====================================================================== */

import Phaser from 'phaser';
import type { CrazyGamesBoardState, ScoreSubmitStatus } from '../leaderboard/leaderboard.ts';
import type { LeaderboardEntry, LeaderboardSnapshot } from '../leaderboard/LeaderboardService.ts';
import { formatDistance } from '../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, createCard, createInset } from './system/UiWidgets.ts';
import { t } from '../i18n/i18n.ts';

/** CrazyGames hesabının durumu */
export interface LeaderboardAccount {
  /** Hesap sistemi bu ortamda var mı? */
  available: boolean;
  /** Giriş yapılmışsa kullanıcı adı; misafirse null */
  username: string | null;
}

export interface LeaderboardModalConfig {
  /** Oyuncunun güncel rekoru (metre) ve (kendi sunucumuz bağlıysa) tablodaki adı */
  getPlayer: () => { name: string; bestDistance: number };
  /** CrazyGames lider tablosunun durumu */
  getBoardState: () => CrazyGamesBoardState;
  /** CrazyGames hesabını sorar */
  loadAccount: () => Promise<LeaderboardAccount>;
  /** CrazyGames'in giriş penceresini açar (yalnızca oyuncu düğmeye basınca) */
  requestLogin: () => Promise<void>;
  /** Oyunun kendi skor sunucusundaki tablo (bağlı değilse boş, 'local') */
  loadSnapshot: () => Promise<LeaderboardSnapshot>;
  /** Hangarı açar ("daha uzağa git" çağrısı); hangar kilitliyken null döndürülür */
  getOpenHangar?: () => (() => void) | null;
}

const ROW_HEIGHT = 28;
const LOGIN_BUTTON_WIDTH = 132;
const LOGIN_BUTTON_HEIGHT = 34;

/** Son uçuşun skoruna ne olduğunu anlatan cümle */
function statusText(status: ScoreSubmitStatus): string {
  switch (status) {
    case 'sent':
      return t('board.status.sent');
    case 'not-season-best':
      return t('board.status.notBest');
    case 'disabled':
      return t('board.status.disabled');
    case 'invalid':
      return t('board.status.invalid');
    case 'failed':
      return t('board.status.failed');
  }
}

export class LeaderboardModal extends UiModal {
  private readonly callbacks: LeaderboardModalConfig;
  private snapshot: LeaderboardSnapshot | null = null;
  private account: LeaderboardAccount | null = null;
  private requestId = 0;
  private hangarButton: UiButton | null = null;

  constructor(layer: UiLayer, config: LeaderboardModalConfig) {
    super(layer, { title: t('board.title'), maxWidth: 420, depth: 206, accent: SEMANTIC.money });
    this.callbacks = config;
  }

  protected onOpened(): void {
    void this.reload();
  }

  /** Hesabı ve (varsa) kendi sunucumuzdaki tabloyu yeniden ister */
  private async reload(): Promise<void> {
    const request = ++this.requestId;
    this.rebuild();
    const [account, snapshot] = await Promise.all([this.callbacks.loadAccount(), this.callbacks.loadSnapshot()]);
    // Pencere kapandıysa ya da daha yeni bir istek varsa bu yanıt yok sayılır
    if (!this.isOpen || request !== this.requestId) return;
    this.account = account;
    this.snapshot = snapshot;
    this.rebuild();
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;
    const player = this.callbacks.getPlayer();
    const board = this.callbacks.getBoardState();
    let y = 0;

    const paragraph = (text: string, color: string = SEMANTIC.textMuted, variant: 'caption' | 'body' = 'caption'): void => {
      const label = layer.text(0, y, text, variant, { color, wrapWidth: width });
      body.add(label);
      y += label.height + SPACE.sm;
    };

    // --- Oyuncunun rekoru --------------------------------------------------
    const headH = 64;
    body.add(createCard(scene, 0, y, width, headH));
    body.add(scene.add.image(SPACE.md + 10, y + headH / 2, 'icon_trophy').setOrigin(0.5).setScale(1.5));
    body.add(layer.text(SPACE.md + 30, y + 12, t('board.yourRecord'), 'captionBold', { color: SEMANTIC.textMuted }));
    body.add(
      layer.text(
        SPACE.md + 30,
        y + 28,
        player.bestDistance > 0 ? formatDistance(player.bestDistance) : t('board.noFlight'),
        'title',
        { color: SEMANTIC.rocketHex },
      ),
    );
    if (board.enabled && board.seasonBest > 0) {
      const chip = new UiChip(layer, 0, y + 20, t('board.thisWeek', { distance: formatDistance(board.seasonBest) }), SEMANTIC.money, {
        icon: 'icon_flag',
      });
      chip.setX(width - SPACE.md - chip.chipWidth);
      body.add(chip);
    }
    y += headH + SPACE.sm;

    // --- CrazyGames lider tablosu -----------------------------------------
    if (board.enabled) {
      paragraph(t('board.where'), SEMANTIC.textPrimary, 'body');
      paragraph(t('board.rule'));
      paragraph(
        board.lastStatus ? statusText(board.lastStatus) : t('board.autoSend'),
        board.lastStatus === 'sent' ? SEMANTIC.primaryHex : SEMANTIC.textMuted,
      );
      y = this.buildAccountRow(body, width, y);
    } else {
      paragraph(t('board.disabled'), SEMANTIC.textPrimary, 'body');
      paragraph(t('board.disabledHint'));
    }

    // --- Oyunun kendi skor sunucusu (bağlıysa) -----------------------------
    const snapshot = this.snapshot;
    if (snapshot?.mode === 'online') {
      const entries = snapshot.entries;
      paragraph(t('board.allPlayers'));
      if (entries.length === 0) {
        paragraph(t('board.empty'), SEMANTIC.textPrimary, 'body');
      }
      for (const entry of entries) {
        this.addRow(body, width, y, entry);
        y += ROW_HEIGHT;
      }
    } else if (snapshot?.failed) {
      paragraph(t('board.serverDown'), SEMANTIC.warningHex);
    }
    return Math.max(0, y - SPACE.sm);
  }

  /** Hangi CrazyGames hesabıyla sıralandığı; misafirse giriş düğmesi */
  private buildAccountRow(body: Phaser.GameObjects.Container, width: number, y: number): number {
    const layer = this.layer;
    const account = this.account;
    if (!account || !account.available) return y;

    if (account.username) {
      const label = layer.text(0, y, t('board.account', { name: account.username }), 'bodyBold', { wrapWidth: width });
      body.add(label);
      return y + label.height + SPACE.sm;
    }

    // Giriş ikincil bir eylemdir: küçük, nötr düğme; pencere açılınca kendiliğinden sorulmaz
    const textWidth = width - LOGIN_BUTTON_WIDTH - SPACE.sm;
    const label = layer.text(0, y, t('board.guest'), 'caption', {
      color: SEMANTIC.textMuted,
      wrapWidth: textWidth,
    });
    const rowHeight = Math.max(label.height, LOGIN_BUTTON_HEIGHT);
    label.setY(y + Math.round((rowHeight - label.height) / 2));
    body.add(label);
    body.add(
      new UiButton(layer, width - LOGIN_BUTTON_WIDTH / 2, y + rowHeight / 2, {
        width: LOGIN_BUTTON_WIDTH,
        height: LOGIN_BUTTON_HEIGHT,
        variant: 'secondary',
        label: t('board.login'),
        textVariant: 'buttonSmall',
        onClick: () => {
          void this.callbacks.requestLogin().then(() => {
            if (this.isOpen) void this.reload();
          });
        },
      }),
    );
    return y + rowHeight + SPACE.sm;
  }

  private addRow(body: Phaser.GameObjects.Container, width: number, y: number, entry: LeaderboardEntry): void {
    const layer = this.layer;
    const centerY = y + ROW_HEIGHT / 2;
    // Oyuncunun satırı kutuyla vurgulanır
    if (entry.isPlayer) body.add(createInset(this.scene, 0, y + 1, width, ROW_HEIGHT - 2));

    const color = entry.isPlayer ? SEMANTIC.moneyHex : SEMANTIC.textPrimary;
    const variant = entry.isPlayer ? 'bodyBold' : 'body';
    body.add(layer.text(SPACE.sm, centerY, `${entry.rank}.`, variant, { color }).setOrigin(0, 0.5));
    const distance = layer
      .text(width - SPACE.sm, centerY, formatDistance(entry.distanceMeters), variant, { color })
      .setOrigin(1, 0.5);
    body.add(distance);
    const name = layer.text(SPACE.sm + 34, centerY, '', variant, { color }).setOrigin(0, 0.5);
    UiLayer.ellipsize(
      name,
      entry.isPlayer ? t('board.you', { name: entry.name }) : entry.name,
      width - SPACE.sm * 2 - 34 - distance.width - SPACE.sm,
    );
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
      label: t('common.goToHangar'),
      icon: uiIcon('hangar'),
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
