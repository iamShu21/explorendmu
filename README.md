# ExploreNDMU website

Showcase site for **ExploreNDMU**, an Android AR campus tour, navigation and information app for
Notre Dame of Marbel University (BS Information Technology capstone, 2026).

Pages: `index` (features, 3D statues, how it works, engineering notes, build timeline, team, download)
and `research` (abstract, objectives, method, system design figures, citation).

## Stack

- [Astro](https://astro.build) static site, Tailwind CSS v4
- GSAP (ScrollTrigger, SplitText, DrawSVG) and Lenis for motion; everything respects `prefers-reduced-motion`
- `<model-viewer>` for the 3D statues (meshopt-compressed GLB, about 1-1.5 MB each)
- Flaticon UIcons (regular rounded), subset to the icons in use by `scripts/build_icons.py`

## Run it

```bash
npm ci
pip install fonttools brotli   # for the icon subset step
npm run dev                    # http://localhost:4321
npm run build                  # static site in dist/
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`
(Settings → Pages → Source: GitHub Actions). All URLs are relative, so the site works at
`https://<user>.github.io/<repo>/`.

To turn on the APK button, upload `ExploreNDMU.apk` to a GitHub Release and set `APK_URL` in `src/config.ts`.

## Data and credits

- `src/data/campus-network.json`: the team's walked routes (export of Oct 30, 2026), projected for SVG.
- `src/data/info-cards.json`: the app's place information cards.
- Bronze Stallion: "Horse Run Cycle On Place" by Amitesh Nandan (Sketchfab), CC BY-ND 4.0. Used in the app only;
  the adjusted model is not published on this site.
