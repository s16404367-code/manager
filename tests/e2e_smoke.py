"""Browser smoke test (Playwright). Usage: python tests/e2e_smoke.py http://localhost:8080/ [shots_dir]"""
import sys, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
def click(page, sel, **kw):
    page.locator(sel).first.click(**kw); page.wait_for_timeout(150)
def shot(page, name): page.screenshot(path=f'{OUT}/{name}.png', full_page=False)
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp, tag in [({'width': 1440, 'height': 900}, 'desk'), ({'width': 390, 'height': 844}, 'mob')]:
        ctx = b.new_context(viewport=vp)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'{tag} pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'{tag} console: {m.text}') if m.type == 'error' else None)
        page.add_init_script("window.confirm=()=>true")
        page.goto(URL); page.wait_for_timeout(500); shot(page, f'{tag}_01_menu')
        # Quick race
        click(page, '[data-arg=quick]'); shot(page, f'{tag}_02_quick')
        click(page, '[data-act=startQuick]'); shot(page, f'{tag}_03_prep')
        click(page, '[data-act=applyEst]')
        click(page, '[data-act=toPractice]'); click(page, '[data-act=liveFP]')
        for _ in range(2):
            if page.locator('[data-act=liveOut]:not([disabled])').count(): page.locator('[data-act=liveOut]:not([disabled])').first.click(); page.wait_for_timeout(300)
        click(page, '[data-act=liveSpeed][data-arg=vfast]'); page.wait_for_timeout(3500); shot(page, f'{tag}_04_practice_live')
        page.locator('input[data-input=setup]').last.fill('7'); page.wait_for_timeout(100)
        click(page, '[data-act=liveSkip]'); click(page, '[data-act=modalOk]'); click(page, '[data-act=liveCommit]'); shot(page, f'{tag}_04b_practice_report')
        click(page, '[data-act=toQuali]'); click(page, '[data-act=liveQ]')
        for _ in range(2):
            if page.locator('[data-act=liveOut]:not([disabled])').count(): page.locator('[data-act=liveOut]:not([disabled])').first.click(); page.wait_for_timeout(300)
        click(page, '[data-act=liveSpeed][data-arg=vfast]'); page.wait_for_timeout(4000); shot(page, f'{tag}_05a_quali_live')
        click(page, '[data-act=liveSkip]'); click(page, '[data-act=modalOk]'); click(page, '[data-act=liveCommit]')
        for i in range(2): click(page, '[data-act=runQuali]')
        shot(page, f'{tag}_05_quali')
        click(page, '[data-act=toStrategy]'); shot(page, f'{tag}_06_strategy')
        click(page, '[data-act=startRace]'); page.wait_for_timeout(2500); shot(page, f'{tag}_07_race')
        # handle any decision modal then fast
        for _ in range(3):
            if page.locator('[data-act=dclose]').count(): click(page, '[data-act=dclose]')
        if page.locator('[data-act=rspeed][data-arg=vfast]').count(): click(page, '[data-act=rspeed][data-arg=vfast]')
        page.wait_for_timeout(3000)
        if page.locator('[data-act=dclose]').count(): shot(page, f'{tag}_07b_decision'); click(page, '[data-act=dclose]')
        shot(page, f'{tag}_08_race_fast')
        click(page, '[data-act=rpause]') if page.locator('[data-act=rpause]').count() else None
        for _ in range(4):
            if page.locator('[data-act=dclose]').count(): click(page, '[data-act=dclose]'); page.wait_for_timeout(200)
        if page.locator('[data-act=rskip]').count():
            click(page, '[data-act=rskip]'); click(page, '[data-act=modalOk]'); page.wait_for_timeout(500)
        click(page, '[data-act=toDebrief]'); page.wait_for_timeout(300); shot(page, f'{tag}_09_post')
        # Career
        page.goto(URL + '#/newcareer'); page.wait_for_timeout(300)
        # need state-less route: go via menu
        page.goto(URL); page.wait_for_timeout(300)
        click(page, '[data-act=menu]') if page.locator('[data-act=menu]').count() else None
        page.goto(URL + '#/menu'); page.wait_for_timeout(300)
        click(page, '[data-arg=newcareer]')
        boxes = page.locator('[data-change=cdriver]')
        boxes.nth(0).check(); page.wait_for_timeout(150); page.locator('[data-change=cdriver]').nth(1).check(); page.wait_for_timeout(150)
        shot(page, f'{tag}_10_newcareer')
        click(page, '[data-act=startCareer]'); click(page, '[data-act=modalOk]'); page.wait_for_timeout(300); shot(page, f'{tag}_11_hq')
        for r in ['car', 'staff', 'drivers', 'facilities', 'finance', 'sponsors', 'board', 'championship', 'regulations', 'history', 'achievements', 'help', 'settings', 'saves']:
            page.goto(URL + '#/' + r); page.wait_for_timeout(250)
            if page.locator('text=Something went wrong').count(): errors.append(f'{tag} screen {r} crashed')
            if tag == 'desk': shot(page, f'{tag}_s_{r}')
        page.goto(URL + '#/car'); page.wait_for_timeout(200); click(page, '[data-act=startPrj]')
        if page.locator('[data-act=resolveEv]').count(): click(page, '[data-act=resolveEv]')
        page.goto(URL + '#/weekend'); page.wait_for_timeout(200)
        if page.locator('[data-act=beginWeekend]').count(): click(page, '[data-act=beginWeekend]')
        click(page, '[data-act=skipPractice]')
        for i in range(3): click(page, '[data-act=runQuali]')
        click(page, '[data-act=toStrategy]'); click(page, '[data-act=startRace]'); page.wait_for_timeout(800)
        if page.locator('[data-act=dclose]').count(): click(page, '[data-act=dclose]')
        click(page, '[data-act=rskip]'); click(page, '[data-act=modalOk]'); page.wait_for_timeout(400)
        click(page, '[data-act=toDebrief]'); click(page, '[data-act=postContinue]'); page.wait_for_timeout(300); shot(page, f'{tag}_12_hq_after')
        # reload persistence
        page.reload(); page.wait_for_timeout(400); click(page, '[data-act=continue]'); page.wait_for_timeout(300); shot(page, f'{tag}_13_continued')
        ctx.close()
    b.close()
print('ERRORS:' if errors else 'NO ERRORS', *errors[:30], sep='\n')
sys.exit(1 if errors else 0)
