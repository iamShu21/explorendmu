// One-off media pipeline: cuts and compresses the team's own recordings into the small files the site ships.
// It is not part of `npm run build` (the raw footage never enters the repository); run it by hand:
//
//   npm run media            everything
//   npm run media -- clips   only the groups named
//
// Sources are read-only. Set NDMU_ASSETS / NDMU_UNITY if the folders live somewhere else.
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.NDMU_ASSETS ?? 'C:/Users/USER/OneDrive/Documents/ExploreNDMU Video Assets';
const UNITY = process.env.NDMU_UNITY ?? 'C:/Users/USER/ExploreNDMU Final';
const pub = (...p) => join(root, 'public', ...p);
const only = new Set(process.argv.slice(2));
const want = (g) => !only.size || only.has(g);
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} KB`;

const ff = (args) => {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
};
const ensure = (f) => mkdirSync(dirname(f), { recursive: true });

/** H.264 loop, no audio, fast start. `vf` is the filter chain after the fps filter. */
const clip = (src, out, { ss, t, vf, crf = 28, fps = 24 }) => {
  ensure(out);
  ff(['-ss', String(ss), '-t', String(t), '-i', src, '-an', '-vf', `fps=${fps},${vf}`,
    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow',
    '-g', String(fps * 2), '-movflags', '+faststart', out]);
  console.log('clip  ', out.slice(root.length + 1), kb(out));
};
/** One frame as WebP (the video poster). */
const still = (src, out, { ss, vf, q = 74 }) => {
  ensure(out);
  ff(['-ss', String(ss), '-i', src, '-frames:v', '1', '-vf', vf, '-c:v', 'libwebp', '-q:v', String(q), out]);
  console.log('still ', out.slice(root.length + 1), kb(out));
};

const A = {
  nav: join(SRC, 'small copies/ar nav small.mp4'),
  tour: join(SRC, 'small copies/campus tour small.mp4'),
  cam: join(SRC, '04 AR Navigation to Library - uncut, start to arrival card/2nd person.MOV'),
  home: join(SRC, '02 Home screen recording/Screen_Recording_20261112_154359_ExploreNDMU Final.mp4'),
  dir: join(SRC, '03 Campus Directory, place details and Saved/Screen_Recording_20261112_154502_ExploreNDMU Final.mp4'),
  saved: join(SRC, 'Saved Places/Screen_Recording_20261112_154553_ExploreNDMU Final.mp4'),
  statues: join(SRC, '06 3D Models scan (Mother Mary, Champagnat, Stallion)'),
  turn: join(SRC, 'turntables'),
  film: join(SRC, '13 Final film v3'),
  logo: join(SRC, '09 Logo - bigger N logo, transparent PNG (optional)/N logo.png'),
};
const SCREEN = 'scale=540:864:flags=lanczos'; // the app recordings are 5:8

/* ------------------------------------------------------------------ clips */
if (want('clips')) {
  // Follow the arrows: the camera clip ends on 0:31, the same moment as 3:23 in the screen recording.
  clip(A.cam, pub('video/follow-cam.mp4'), { ss: 24, t: 7, vf: 'scale=960:540:flags=lanczos', crf: 29 });
  still(A.cam, pub('video/follow-cam.webp'), { ss: 24, vf: 'scale=960:540:flags=lanczos' });
  still(A.cam, pub('video/follow-cam-end.webp'), { ss: 31, vf: 'scale=960:540:flags=lanczos' });
  clip(A.nav, pub('video/follow-screen.mp4'), { ss: 203, t: 12, vf: SCREEN });
  still(A.nav, pub('video/follow-screen.webp'), { ss: 203, vf: SCREEN });

  // Hear every turn
  clip(A.nav, pub('video/turn-left.mp4'), { ss: 226, t: 12, vf: SCREEN });
  still(A.nav, pub('video/turn-left.webp'), { ss: 235, vf: SCREEN });
  clip(A.tour, pub('video/turn-right.mp4'), { ss: 28, t: 12, vf: SCREEN });
  still(A.tour, pub('video/turn-right.webp'), { ss: 36, vf: SCREEN });

  // Arrive and learn: the gold pin and the place card at the Library
  clip(A.nav, pub('video/arrive.mp4'), { ss: 264, t: 16, vf: SCREEN });
  still(A.nav, pub('video/arrive.webp'), { ss: 276, vf: SCREEN });

  // Find any place, Saved places, home, campus tour stop
  clip(A.dir, pub('video/directory.mp4'), { ss: 25, t: 15, vf: SCREEN, crf: 30 });
  still(A.dir, pub('video/directory.webp'), { ss: 34, vf: SCREEN });
  clip(A.saved, pub('video/saved.mp4'), { ss: 5, t: 13, vf: SCREEN, crf: 30 });
  still(A.saved, pub('video/saved.webp'), { ss: 7, vf: SCREEN });
  clip(A.home, pub('video/home.mp4'), { ss: 19, t: 12, vf: SCREEN, crf: 30 });
  still(A.home, pub('video/home.webp'), { ss: 20, vf: SCREEN });
  clip(A.tour, pub('video/tour-stop.mp4'), { ss: 93, t: 15, vf: SCREEN });
  still(A.tour, pub('video/tour-stop.webp'), { ss: 107, vf: SCREEN });
}

/* ------------------------------------------------- scroll-to-walk frames */
if (want('walk')) {
  // One frame every 2 s of the real walk, from the first arrows (1:02) to the arrival (4:30).
  const dir = pub('seq/walk');
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  ff(['-ss', '62', '-t', '208', '-i', A.nav, '-vf', 'fps=1/2,scale=320:512:flags=lanczos', '-c:v', 'libwebp', '-q:v', '58', join(dir, '%03d.webp')]);
  const files = readdirSync(dir);
  const total = files.reduce((s, f) => s + statSync(join(dir, f)).size, 0);
  console.log('walk  ', files.length, 'frames', (total / 1024).toFixed(0), 'KB');
}

/* ---------------------------------------------------------------- statues */
if (want('statues')) {
  // In-app scans (real captures)
  clip(join(A.statues, 'mother mary ar.mp4'), pub('video/scan-mary.mp4'), { ss: 1, t: 10, vf: SCREEN });
  still(join(A.statues, 'mother mary ar.mp4'), pub('video/scan-mary.webp'), { ss: 6, vf: SCREEN });
  clip(join(A.statues, 'smc ar.mp4'), pub('video/scan-champagnat.mp4'), { ss: 5, t: 10, vf: SCREEN });
  still(join(A.statues, 'smc ar.mp4'), pub('video/scan-champagnat.webp'), { ss: 9, vf: SCREEN });
  clip(join(A.statues, 'stallion ar.mp4'), pub('video/scan-stallion.mp4'), { ss: 8, t: 10, vf: SCREEN });
  still(join(A.statues, 'stallion ar.mp4'), pub('video/scan-stallion.webp'), { ss: 12, vf: SCREEN });

  // Turntables of our own two models, on the stage colour (#04170F).
  // The Champagnat plinth carries a misspelt label, so the render is cropped above it.
  clip(join(A.turn, 'mary_dark.mp4'), pub('video/turn-mary.mp4'), { ss: 0, t: 8, vf: 'scale=540:720:flags=lanczos', crf: 30 });
  still(join(A.turn, 'mary_dark.mp4'), pub('video/turn-mary.webp'), { ss: 2, vf: 'scale=540:720:flags=lanczos' });
  clip(join(A.turn, 'champagnat_dark.mp4'), pub('video/turn-champagnat.mp4'), { ss: 0, t: 8, vf: 'crop=1080:1230:0:0,scale=540:616:flags=lanczos', crf: 30 });
  still(join(A.turn, 'champagnat_dark.mp4'), pub('video/turn-champagnat.webp'), { ss: 2, vf: 'crop=1080:1230:0:0,scale=540:616:flags=lanczos' });

  // The Bronze Stallion is CC BY-ND (Amitesh Nandan): the renders are copied byte for byte, never re-encoded.
  mkdirSync(pub('stallion'), { recursive: true });
  for (const f of ['stallion.webm', 'stallion_dark.mp4', 'stallion_still.png']) {
    copyFileSync(join(A.turn, f), pub('stallion', f));
    console.log('copy  ', `public/stallion/${f}`, kb(pub('stallion', f)));
  }

  // The real statues on campus (frames of the team's own camera clips)
  const real = [['mother mary.MOV', 'mary', 6], ['saint marcellin champagnat.MOV', 'champagnat', 6], ['stallion.MOV', 'stallion', 4]];
  for (const [file, name, ss] of real) {
    const tmp = pub(`img/statue-${name}.png`);
    ff(['-ss', String(ss), '-i', join(A.statues, file), '-frames:v', '1', tmp]);
    for (const w of [960, 480]) {
      await sharp(tmp).resize(w).avif({ quality: 52 }).toFile(pub(`img/statue-${name}-${w}.avif`));
      await sharp(tmp).resize(w).webp({ quality: 72 }).toFile(pub(`img/statue-${name}-${w}.webp`));
    }
    rmSync(tmp);
    console.log('image ', `public/img/statue-${name}-960.avif`, kb(pub(`img/statue-${name}-960.avif`)));
  }
}

/* ------------------------------------------------------------------- film */
if (want('film')) {
  mkdirSync(pub('film'), { recursive: true });
  copyFileSync(join(A.film, 'explorendmu-film-720p.mp4'), pub('film/explorendmu-film-720p.mp4'));
  await sharp(join(A.film, 'explorendmu-film-poster.jpg')).resize(1280).avif({ quality: 55 }).toFile(pub('film/poster.avif'));
  await sharp(join(A.film, 'explorendmu-film-poster.jpg')).resize(1280).jpeg({ quality: 78, mozjpeg: true }).toFile(pub('film/poster.jpg'));
  // SRT -> WebVTT
  const srt = readFileSync(join(A.film, 'explorendmu-final-v3.srt'), 'utf8').replace(/\r/g, '').replace(/^\uFEFF/, '');
  const cues = srt.trim().split(/\n\n+/).map((b) => {
    const lines = b.split('\n');
    const time = lines[1].replace(/,/g, '.');
    return { time, text: lines.slice(2).join('\n') };
  });
  writeFileSync(pub('film/captions.vtt'), 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${c.time}\n${c.text}`).join('\n\n') + '\n');
  // The same words as plain text, for the transcript on the page
  writeFileSync(join(root, 'src/data/film-transcript.json'), JSON.stringify(cues.map((c) => ({ at: c.time.slice(3, 8), text: c.text.replace(/\n/g, ' ') })), null, 1) + '\n');
  console.log('film  ', kb(pub('film/explorendmu-film-720p.mp4')), `${cues.length} caption cues`);
}

/* ------------------------------------------------------------------ audio */
if (want('audio')) {
  // The app's own pre-generated voice lines (ElevenLabs "Matilda"), copied unchanged from the Unity project.
  mkdirSync(pub('audio'), { recursive: true });
  for (const f of ['follow_the_arrows', 'turn_left_now', 'turn_right_now', 'arrive_university_library']) {
    copyFileSync(join(UNITY, 'Assets/Resources/Voice', `${f}.mp3`), pub('audio', `${f.replace(/_/g, '-')}.mp3`));
    console.log('audio ', `public/audio/${f.replace(/_/g, '-')}.mp3`, kb(pub('audio', `${f.replace(/_/g, '-')}.mp3`)));
  }
}

/* ----------------------------------------------------------------- images */
if (want('images')) {
  // Logo
  for (const w of [96, 192, 512]) {
    await sharp(A.logo).resize(w, w, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(pub(`img/logo-n-${w}.webp`));
  }
  // Arrival screenshots (real captures)
  const shots = [['Screenshot_20261112_151245_ExploreNDMU Final.jpg', 'arrival-library'], ['library arrival marker.jpg', 'arrival-pin']];
  for (const [file, name] of shots) {
    for (const w of [540, 1080]) {
      await sharp(join(SRC, file)).resize(w).avif({ quality: 50 }).toFile(pub(`img/${name}-${w}.avif`));
      await sharp(join(SRC, file)).resize(w).webp({ quality: 74 }).toFile(pub(`img/${name}-${w}.webp`));
    }
    console.log('image ', `public/img/${name}-540.avif`, kb(pub(`img/${name}-540.avif`)));
  }
  // Place photos already in the repo: add AVIF and a small size next to each WebP.
  for (const f of readdirSync(pub('img')).filter((n) => /^(place|campus|welcome)-[a-z0-9_-]+\.webp$/.test(n) && !/-\d+\.webp$/.test(n))) {
    const base = f.replace(/\.webp$/, '');
    const meta = await sharp(pub('img', f)).metadata();
    const small = Math.round(meta.width / 2);
    await sharp(pub('img', f)).avif({ quality: 50 }).toFile(pub('img', `${base}.avif`));
    await sharp(pub('img', f)).resize(small).avif({ quality: 50 }).toFile(pub('img', `${base}-${small}.avif`));
    await sharp(pub('img', f)).resize(small).webp({ quality: 72 }).toFile(pub('img', `${base}-${small}.webp`));
    console.log('image ', `public/img/${base}.avif`, kb(pub('img', `${base}.avif`)), `(${meta.width}x${meta.height})`);
  }
}
