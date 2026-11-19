// Neon Coast entry program (Node 22, standard library only).
// Copies app/ and screenshots/ from this repository into the output directory
// (MAKEFUN_OUTPUT_DIR outside the grader, /output inside it), writes
// dossier.json with buildDossier from vendor/makefun-app.ts, and then verifies
// the dossier by rebuilding it from the output tree and comparing bytes, so a
// stale or partial copy can never be handed in silently.
import { accessSync, constants, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in the repository`);
  cpSync(src, join(outDir, name), { recursive: true });
}

function checkScreenshots(): void {
  const dir = join(outDir, 'screenshots');
  const shots = readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/: expected 3 or 4 images, found ${shots.length}`);
  }
  for (const f of shots) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(f)) throw new Error(`screenshots/${f}: bad file name`);
  }
  console.log(`screenshots: ${shots.join(', ')}`);
}

// Clear only the contents of outDir, never outDir itself: in the grading
// sandbox /output can be a mount point, and removing it fails (exit 1).
mkdirSync(outDir, { recursive: true });
for (const name of ['app', 'screenshots', 'dossier.json']) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}
copyTree('app');
copyTree('screenshots');
checkScreenshots();
const dossier = buildDossier(outDir, DOSSIER_CAPS);
// The output directory must still be there and writable when the dossier
// is written: recreate it if something removed it, fail loudly otherwise.
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
accessSync(outDir, constants.W_OK);
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Verify: rebuild from the finished output tree and demand identical bytes.
const rebuilt = buildDossier(outDir, DOSSIER_CAPS);
const written = readFileSync(join(outDir, 'dossier.json'));
if (!written.equals(rebuilt)) throw new Error('dossier.json does not match a fresh buildDossier run');
console.log(`wrote ${outDir} (app/, screenshots/, dossier.json ${written.length} bytes, verified)`);
