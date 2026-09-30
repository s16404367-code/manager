# Third-party notices

This project ships **one** piece of third-party data. Everything else (all JavaScript, CSS, HTML, SVG icon,
game data, team/driver names, tools and tests) was written for this project and is covered by `LICENSE`.
No third-party fonts, images, audio, libraries or CDN assets are bundled. The game has **zero runtime dependencies**.

## 1. Circuit geometry — bacinger/f1-circuits (MIT)

- Source: https://github.com/bacinger/f1-circuits
- Used in: `js/data/trackShapes.js`. It contains simplified 200-point outlines, rescaled and derived from the project's
  GeoJSON files, plus a corner radius for each point. The data was transformed; the original files are not redistributed.
- Licence text (reproduced as the MIT licence requires):

```
MIT License

Copyright (c) 2021 Tomislav Bacinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> Check the copyright line against the upstream `LICENSE` file whenever you update the data.

## 2. Development-only tools (not shipped in the game)

These run only in tests and CI. They are not bundled or redistributed:

| Tool | Licence | Use |
|---|---|---|
| Node.js | MIT | runs `tests/run-tests.mjs` |
| Python 3 | PSF License | `tools/balance_report.py`, local web server |
| Playwright for Python (+ Chromium) | Apache-2.0 (Chromium: BSD-style) | `tests/e2e_smoke.py` browser smoke test |
| GitHub Actions (`actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`) | MIT | CI / GitHub Pages deployment |

## 3. Factual information

The 2026 race calendar order, circuit names, countries and lap counts are public facts. Lap times, pit losses and all
circuit "characteristics" are the game's own estimates, not official data.
