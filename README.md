# ExploreNDMU website

Showcase site for **ExploreNDMU**, an Android AR campus tour, navigation and information app for
Notre Dame of Marbel University (BS Information Technology capstone, 2026).

One scroll-story page (`index`) in fifteen scenes, plus `research` and a `404` page. The page is laid out as a
route: a gold path runs from the hero to an arrival card at the end, and an auto-scroll tour can walk it for you.

## Stack

- [Astro](https://astro.build) static site, Tailwind CSS v4
- GSAP (ScrollTrigger, SplitText) as the one animation engine, Lenis for smooth scroll on GSAP's ticker
- Three.js, loaded only when needed, for the clay campus island and the scroll-to-walk camera
- `<model-viewer>`, loaded only when needed, for the two statue models
- The living gradient is the site's own WebGL fragment shader (`src/scripts/gradient.js`)
- Fonts: Instrument Serif and Inter (self-hosted). Icons: Flaticon UIcons, regular rounded, subset at build time

## Run it

```bash
npm ci
npm run dev -- --host      # http://localhost:4321, and on your phone at the Network address it prints
npm run build              # static site in dist/, with every URL made relative
node scripts/verify/serve.mjs   # serves dist/ under /explorendmu/, like GitHub Pages
```

Useful addresses while testing: `?nointro` skips the intro, `?tour=1` starts the tour, `?defense=1` is the
presenter version, `?hour=20` pins the campus time of day, `?nowebgl` and `?weak` show the fallbacks.

## Defense mode (`?defense=1`)

Large type, no cursor, and a QR code on the first screen. The first key press or click starts the tour.
`PageDown` / `PageUp` and the arrow keys step scene by scene, `P` pauses, `B` blanks the screen, `F` is fullscreen.

## Deploy

Pushing to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`.
To turn on the download button, upload the APK to a GitHub Release and set `APK_URL` in `src/config.ts`.

## Stats

- **APK downloads:** the Download section shows the live total of every `ExploreNDMU.apk` across all GitHub Releases, read from GitHub's public API. It stays hidden if GitHub doesn't answer.
- **Visits:** private, on GoatCounter (no cookies). Set `STATS_URL` in `src/config.ts` to the site's count address, e.g. `https://explorendmu.goatcounter.com/count`; the dashboard is at the same address without `/count`. Visits from localhost are not counted.

## Data, and where every number comes from

- `src/data/campus-network.json`: the team's walked routes, projected to a flat plane.
- `src/data/info-cards.json` and `src/data/info-cards-app.json`: place card text from the app.
- `src/data/directory.ts`: the app's 42 directory entries, each linked to its card and its route.
- `src/config.ts` (`FACTS`): 37 places with AR routes, 60 walked routes, 39 junctions, 1,194 joined routes, 42 directory places.
- `npm run routes` builds `src/data/routes.gen.json`. Distances are the metres the app recorded for each walk
  (the number in the walk's name). The scale of the plane is the sum of those metres divided by the summed path
  lengths (0.3418 m per unit), which gives 191.6 m for Gate 03 to the Library against 192 m recorded.

## Media

`npm run media` (not part of the build) cuts the team's own recordings into the small clips in `public/`.
Raw footage never enters the repository. `node scripts/capture-posters.mjs` re-renders the hero still, the
gradient still and the social card from the live scenes.

## Checks

```bash
node scripts/verify/check.mjs        # Chromium, Firefox, WebKit at 7 widths, plus iPhone 13 and Pixel 7
node scripts/verify/behaviour.mjs    # tour, defense mode, sound, reduced motion, WebGL off, text contrast
node scripts/verify/lighthouse.mjs   # Lighthouse, mobile
```

## Credits

- Bronze Stallion: "Horse Run Cycle On Place" by Amitesh Nandan (Sketchfab), CC BY-ND 4.0. Its model file is not
  in this repository. The site shows only the unmodified turntable render, with the credit beside it.
- Film: narration voice by ElevenLabs (Sarah); original score and sound design.
- App voice lines: ElevenLabs (Matilda), copied unchanged from the app.
