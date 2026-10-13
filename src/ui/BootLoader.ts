/* ======================================================================
 * BootLoader.ts — Açılış yükleme göstergesi
 *
 * index.html'deki çubuğu sürer: dosyalar inerken ekran boş kalmasın. Dolgu,
 * Phaser yükleyicisinin bildirdiği gerçek orandır; sahte ilerleme gösterilmez.
 * Sahne kurulunca kaldırılır. Öğe yoksa (testler) hiçbir şey yapmaz.
 * ====================================================================== */

const ROOT_ID = 'boot-loader';
const FILL_ID = 'boot-loader-fill';

/** Yüklenen dosyaların oranını (0..1) çubuğa yazar */
export function setBootProgress(ratio: number): void {
  if (typeof document === 'undefined') return;
  const fill = document.getElementById(FILL_ID);
  if (fill) fill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
}

/** Göstergeyi kaldırır (yalnızca ilk kurulumda etkilidir) */
export function hideBootLoader(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(ROOT_ID)?.remove();
}
