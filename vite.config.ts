import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Yayın modu `--mode` ile seçilir ve her modun kendi çıktı klasörü vardır; bir derleme
 * diğerinin dosyalarına dokunmaz (Vite yalnız kendi `outDir`'ini boşaltır):
 *
 *   vite build --mode basic → dist-basic/  (CrazyGames Basic Launch)
 *   vite build --mode full  → dist-full/   (Full Launch)
 *   vite build              → dist/        (eski komut; Full yapılandırması)
 *
 * Özelliklerin hangi modda açık olduğu src/config/release.ts içindedir.
 */
const OUT_DIRS: Readonly<Record<string, string>> = {
  basic: 'dist-basic',
  full: 'dist-full',
};

/** Çıktı klasörüne hangi modla derlendiğini yazar (yüklemeden önce bakılabilsin) */
function buildInfo(releaseMode: string, outDir: string): Plugin {
  return {
    name: 'manufacturer-build-info',
    apply: 'build',
    closeBundle() {
      writeFileSync(
        resolve(outDir, 'build-info.json'),
        `${JSON.stringify({ releaseMode, builtAt: new Date().toISOString() }, null, 2)}\n`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const outDir = OUT_DIRS[mode] ?? 'dist';
  return {
    base: './',
    build: {
      outDir,
      target: 'es2020',
    },
    plugins: [buildInfo(mode === 'basic' ? 'basic' : 'full', outDir)],
  };
});
