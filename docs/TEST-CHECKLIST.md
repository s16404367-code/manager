# Test checklist
Automated (`node tests/run-tests.mjs`, ~270k assertions):
- A quick race on all 16 circuits. Every tick checks that positions are unique, with no NaN, wear within 0–100 and fuel ≥ 0.
- Classification has 20 rows and valid points. More than one strategy type finishes in the top 5. DNF rate < 25%.
- Same seed gives the same result.
- A 3-season career with automatic decisions: state is valid after every race, season transitions work, every team keeps 2 drivers, and saves round-trip.

Browser (`python tests/e2e_smoke.py URL`), run at desktop 1440×900 and mobile 390×844: menu → quick race full flow → race → debrief → new career → visit all management screens → project → weekend → race → continue → reload → continue. Fails on any console or page error.

Manual: Android Chrome, iPhone Safari, tablet in both orientations, fullscreen, and pause/resume while the race is running.
