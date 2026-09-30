#!/usr/bin/env python3
"""Balance & data validator. Runs the Node headless suite (--json) N times and validates data files.
Usage: python tools/balance_report.py"""
import json, subprocess, sys, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
def validate_tracks():
    src = (ROOT / 'js/data/tracks.js').read_text()
    ids = re.findall(r"T\('(trk_[a-z]+)'", src)
    assert len(ids) == len(set(ids)), 'duplicate track ids'
    for v in re.findall(r"(?:df|drag|deg|ovt|sc|wx): ([0-9.]+)", src):
        assert 0 <= float(v) <= 1, f'track value out of range: {v}'
    return len(ids)
def main():
    n = validate_tracks(); print(f'Tracks OK: {n}')
    out = subprocess.run(['node', str(ROOT / 'tests/run-tests.mjs'), '--json'], capture_output=True, text=True)
    line = [l for l in out.stdout.splitlines() if l.startswith('{')]
    if not line: print(out.stdout, out.stderr); sys.exit(1)
    r = json.loads(line[0])
    print(f"Assertions: {r['pass']} passed, {r['fail']} failed")
    print('Winners by team :', r['winners'])
    print('Top-5 strategies:', r['top5Strategies'])
    print(f"DNF rate        : {r['dnfRate']*100:.1f}%  | neutralisations/race: {r['neutralisationsPerRace']}")
    print('Career seasons  :', r['careerSeasons'])
    top = max(r['winners'].values()) / max(1, sum(r['winners'].values()))
    if top > 0.75: print('WARNING: one team wins >75% of races — consider rebalancing.')
    sys.exit(1 if r['fail'] else 0)
if __name__ == '__main__': main()
