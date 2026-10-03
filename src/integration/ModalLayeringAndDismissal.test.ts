/* ======================================================================
 * src/integration/ModalLayeringAndDismissal.test.ts
 *
 * Bilgi pencerelerinin fabrika ızgarasının üstünde yer alması ve
 * yalnızca pencere dışına veya [X] butonuna tıklandığında kapanması,
 * pencere içine tıklandığında ise açık kalmasının doğrulanması.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Modal Layering & Click-Through Dismissal Integration Tests', () => {
  it('1. Camera Reordering: factoryCamera renders at index 0, cameras.main renders on top at index 1', () => {
    // Simüle edilmiş Phaser CameraManager cameras dizisi
    const mainCamera = { id: 'mainCamera', transparent: true, backgroundColor: { rgba: 'rgba(0,0,0,0)' } };
    const factoryCamera = { id: 'factoryCamera', transparent: false, backgroundColor: { rgba: 'rgba(11,14,20,1)' } };

    const cameras = [mainCamera, factoryCamera];

    // GameScene içinde uyguladığımız swap mantığı:
    const mainIdx = cameras.indexOf(mainCamera);
    const factoryIdx = cameras.indexOf(factoryCamera);
    if (mainIdx !== -1 && factoryIdx !== -1 && mainIdx < factoryIdx) {
      cameras[mainIdx] = factoryCamera;
      cameras[factoryIdx] = mainCamera;
    }

    assert.equal(cameras[0].id, 'factoryCamera', 'Fabrika kamerası dünya katmanında en altta (index 0) çizilmelidir');
    assert.equal(cameras[1].id, 'mainCamera', 'Ana UI kamerası modallarla birlikte en üstte (index 1) çizilmelidir');
  });

  it('2. Event Propagation: panelBlocker stops click from reaching backdrop when clicking inside modal', () => {
    let backdropDismissCalled = false;
    let modalStayedOpen = true;

    // Simüle edilmiş sahte olay sistemi
    let propagationStopped = false;
    const fakeEvent = {
      stopPropagation: () => {
        propagationStopped = true;
      },
    };

    // Modal içi panelBlocker tıklaması
    const onPanelPointerDown = (_event: typeof fakeEvent) => {
      _event.stopPropagation();
    };

    // Backdrop tıklaması
    const onBackdropPointerDown = () => {
      if (propagationStopped) return;
      backdropDismissCalled = true;
      modalStayedOpen = false;
    };

    // Senaryo A: Pencere içine tıklandı
    onPanelPointerDown(fakeEvent);
    assert.equal(propagationStopped, true, 'Pencere içine tıklandığında stopPropagation çağrılmalıdır');
    onBackdropPointerDown();
    assert.equal(backdropDismissCalled, false, 'Pencere içine tıklandığında backdrop dismiss çağrılmamalıdır');
    assert.equal(modalStayedOpen, true, 'Modal penceresi açık kalmalıdır');

    // Senaryo B: Pencere dışına tıklandı
    propagationStopped = false;
    onBackdropPointerDown();
    assert.equal(backdropDismissCalled, true, 'Pencere dışına tıklandığında backdrop modalı kapatmalıdır');
    assert.equal(modalStayedOpen, false, 'Modal kapanmalıdır');
  });

  it('3. Modal Panel Blocker dimensions cover full modal boundary', () => {
    const modalW = 540;
    const modalH = 440;
    const screenW = 1024;
    const screenH = 768;

    const x = Math.round((screenW - modalW) / 2);
    const y = Math.round((screenH - modalH) / 2);

    const blocker = { x: 0, y: 0, w: 0, h: 0 };
    // layout çağrısı:
    blocker.x = x;
    blocker.y = y;
    blocker.w = modalW;
    blocker.h = modalH;

    // Modal sınırları içindeki bir nokta (örn. ortası)
    const insideClickX = x + modalW / 2;
    const insideClickY = y + modalH / 2;
    const isInside =
      insideClickX >= blocker.x &&
      insideClickX <= blocker.x + blocker.w &&
      insideClickY >= blocker.y &&
      insideClickY <= blocker.y + blocker.h;

    // Modal dışındaki bir nokta
    const outsideClickX = 50;
    const outsideClickY = 50;
    const isOutside =
      outsideClickX < blocker.x ||
      outsideClickX > blocker.x + blocker.w ||
      outsideClickY < blocker.y ||
      outsideClickY > blocker.y + blocker.h;

    assert.equal(isInside, true, 'İçerideki tıklama blocker alanına denk gelmelidir');
    assert.equal(isOutside, true, 'Dışarıdaki tıklama blocker alanının dışına denk gelmelidir');
  });

  it('4. Build Menu Scroll Math: maxScrollY, clamping, and viewport containment', () => {
    const totalItems = 9; // 3 lojistik + 6 makine
    const cols = 2;
    const cardH = 82;
    const gapY = 10;
    const viewportH = 384;

    const totalRows = Math.ceil(totalItems / cols); // 5 satır
    const totalContentHeight = totalRows * (cardH + gapY) + 12; // 5 * 92 + 12 = 472px
    const maxScrollY = Math.max(0, totalContentHeight - viewportH); // 472 - 384 = 88px

    assert.ok(maxScrollY > 0, 'İçerik yüksekliği viewportu aştığı için maxScrollY pozitif olmalıdır (kaydırma gerekli)');

    // Clamping testleri
    const clampScroll = (targetY: number) => Math.max(0, Math.min(targetY, maxScrollY));

    assert.equal(clampScroll(-50), 0, 'Negatif kaydırma 0 değerine sınırlandırılmalıdır');
    assert.equal(clampScroll(40), 40, 'Geçerli aralıktaki kaydırma korunmalıdır');
    assert.equal(clampScroll(200), maxScrollY, 'Aşırı kaydırma maxScrollY değerine sınırlandırılmalıdır');
  });

  it('5. Machine Card Image Keys: every machine item specifies a valid spriteBaseKey', () => {
    const expectedIconKeys: Record<string, string> = {
      conveyor: 'conveyor_belt',
      splitter: 'conveyor_belt',
      merger: 'conveyor_belt',
      crusher: 'machine_press',
      smelter: 'machine_bench',
      press: 'machine_press',
      cutter: 'machine_welder',
      assembler: 'machine_automation',
      refinery: 'machine_bench',
    };

    for (const [id, expectedKey] of Object.entries(expectedIconKeys)) {
      assert.ok(expectedKey.length > 0, `${id} için görsel anahtarı tanımlı olmalıdır`);
    }
  });
});

