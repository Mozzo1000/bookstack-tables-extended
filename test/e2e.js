// End-to-end checks for bookstack-tables-extended.js against a running BookStack.
// Run through run-version.sh (or see test/README.md).
// Environment: BASE, SHOTS_DIR, EDITOR_MODE (tinymce|lexical), BS_VERSION (for example 26.03.5).
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:6875';
const MODE = process.env.EDITOR_MODE || 'tinymce';
const OUT = process.env.SHOTS_DIR || path.join(__dirname, '..', 'screenshots', 'adhoc');
fs.mkdirSync(OUT, {recursive: true});

// The new editor's JavaScript API (used for the custom table size button) exists from v25.12.
const VERSION = (process.env.BS_VERSION || '99.99').replace(/^v/, '');
const [major, minor] = VERSION.split('.').map(Number);
const LEXICAL_API = major > 25 || (major === 25 && minor >= 12);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => {
  const same = JSON.stringify(a) === JSON.stringify(b);
  ok(same, m + (same ? '' : `  got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`));
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1100, height: 800}});
  const page = await ctx.newPage();
  const errors = [];
  const where = () => page.url().replace(BASE, '');
  page.on('pageerror', e => errors.push(`${where()} :: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${where()} :: ${m.text()}`);
  });

  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', 'admin@admin.com');
  await page.fill('input[name=password]', 'password');
  await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

  const shot = name => page.screenshot({path: `${OUT}/${name}.png`, fullPage: true});
  const open = slug => page.goto(`${BASE}/books/table-tests/page/${slug}`);
  // Click near the top-left corner of a header cell so the click never lands on the filter button.
  const clickHead = locator => locator.click({position: {x: 4, y: 4}});
  const col = (sel, i) => page.$$eval(
    `${sel} tbody tr:not(.bte-hidden):not(:has(.bte-sortable))`,
    (trs, i) => trs.map(tr => tr.cells[i].textContent.trim()), i);
  const nameOrder = ['Delta', 'alpha', 'Charlie', 'bravo', 'Echo 10', 'Echo 9'];
  const popover = '.bte-pop';

  const variants = [
    ['tiny-thead-td', '#bkmrk-t1', 'thead tr:first-child'],
    ['lexical-th', '#bkmrk-t2', 'tbody tr:first-child'],
  ];
  for (const [slug, t, headSel] of variants) {
    console.log(`\n== ${slug}`);
    await open(slug);
    ok(await page.$(`.bte-scroll > ${t}`) !== null, 'table wrapped in .bte-scroll');
    eq(await page.$$eval(`${t} .bte-fbtn`, b => b.length), 4, 'one filter button per column');
    ok(await page.$(`${t} input`) === null, 'no filter inputs shown until a filter button is used');
    const head = n => page.locator(`${t} ${headSel} > :nth-child(${n})`);
    const funnel = n => page.locator(`${t} ${headSel} > :nth-child(${n}) .bte-fbtn`);
    const statusSel = `.bte-scroll:has(${t}) + .bte-status`;

    // sorting
    await clickHead(head(1));
    eq(await col(t, 0), ['alpha', 'bravo', 'Charlie', 'Delta', 'Echo 9', 'Echo 10'], 'name asc (case-insensitive, natural)');
    eq(await head(1).getAttribute('aria-sort'), 'ascending', 'aria-sort ascending');
    await clickHead(head(1));
    eq(await col(t, 0), ['Echo 10', 'Echo 9', 'Delta', 'Charlie', 'bravo', 'alpha'], 'name desc');
    await clickHead(head(1));
    eq(await col(t, 0), nameOrder, 'third click restores original order');
    eq(await head(1).getAttribute('aria-sort'), 'none', 'aria-sort none');
    await clickHead(head(2));
    eq(await col(t, 1), ['4', '7', '30', '250', '1,200', ''], 'qty numeric asc, blank last');
    await clickHead(head(2));
    eq(await col(t, 1), ['1,200', '250', '30', '7', '4', ''], 'qty numeric desc, blank still last');
    await clickHead(head(3));
    eq(await col(t, 2), ['$0.99', '$5.50', '$7.25', '$12.00', '$100', ''], 'currency column numeric asc');
    eq(await head(2).getAttribute('aria-sort'), 'none', 'previous column aria-sort cleared');
    await head(1).focus();
    await page.keyboard.press('Enter');
    eq((await col(t, 0))[0], 'alpha', 'keyboard Enter sorts');

    // filter popover: search
    await funnel(1).click();
    await page.waitForSelector(popover);
    eq(await funnel(1).getAttribute('aria-expanded'), 'true', 'filter button reports expanded');
    eq(await page.$$eval('.bte-list .bte-val', s => s.map(x => x.textContent)),
      ['(Select all)', 'alpha', 'bravo', 'Charlie', 'Delta', 'Echo 9', 'Echo 10'], 'checklist lists distinct values in natural order');
    await page.fill(`${popover} input[type=search]`, 'ECHO');
    await page.waitForTimeout(150);
    eq(await col(t, 0), ['Echo 9', 'Echo 10'], 'search is a case-insensitive contains filter and keeps the sort');
    eq(await page.$$eval('.bte-list .bte-val', s => s.map(x => x.textContent)), ['(Select all)', 'Echo 9', 'Echo 10'], 'checklist narrows to matches');
    await shot(`${slug}-popover-search`);
    await page.keyboard.press('Escape');
    ok(await page.$(popover) === null, 'Escape closes the popover');
    ok(await funnel(1).evaluate(b => b.classList.contains('bte-active')), 'filter button highlights while a filter is active');
    ok(/Showing 2 of 6/.test(await page.textContent(statusSel)), 'status line shows the count');
    await shot(`${slug}-sorted-filtered`);

    // filters in two columns combine
    await funnel(2).click();
    await page.waitForSelector(popover);
    await page.fill(`${popover} input[type=search]`, '25');
    await page.waitForTimeout(150);
    eq(await col(t, 0), ['Echo 10'], 'filters in different columns combine (AND)');
    await page.fill(`${popover} input[type=search]`, 'zzz');
    await page.waitForTimeout(150);
    ok(/No matching values/.test(await page.textContent('.bte-list')), 'popover says when no values match');
    ok(/No matching rows/.test(await page.textContent(statusSel)), 'status line says when no rows match');
    await page.keyboard.press('Escape');
    await page.click(`${statusSel} .bte-clear`);
    eq((await col(t, 0)).length, 6, 'Clear filters restores all rows');
    eq(await page.$$eval(`${t} .bte-fbtn.bte-active`, b => b.length), 0, 'no filter button stays highlighted');

    // filter popover: checklist
    await funnel(1).click();
    await page.waitForSelector(popover);
    await page.locator('.bte-list label:has-text("alpha") input').uncheck();
    await page.locator('.bte-list label:has-text("bravo") input').uncheck();
    eq((await col(t, 0)).length, 4, 'unchecking values hides those rows');
    ok(await page.$eval('.bte-list label:first-child input', i => i.indeterminate), '"(Select all)" shows a mixed state');
    await shot(`${slug}-popover-checklist`);
    await page.locator('.bte-list label:first-child input').check();
    eq((await col(t, 0)).length, 6, '"(Select all)" restores every value');
    await page.locator('.bte-list label:has-text("Delta") input').uncheck();
    await page.click(`${popover} button:has-text("Clear filter")`);
    eq((await col(t, 0)).length, 6, '"Clear filter" resets the column');
    await page.keyboard.press('Escape');

    // blanks, popover sort, outside click
    await funnel(2).click();
    await page.waitForSelector(popover);
    ok((await page.$$eval('.bte-list .bte-val', s => s.map(x => x.textContent))).includes('(Blanks)'), 'blank cells appear as "(Blanks)"');
    await page.keyboard.press('Escape');
    await funnel(3).click();
    await page.click(`${popover} button:has-text("Sort descending")`);
    ok(await page.$(popover) === null, 'choosing a sort option closes the popover');
    eq(await col(t, 2), ['$100', '$12.00', '$7.25', '$5.50', '$0.99', ''], 'sort descending from the popover');
    await funnel(1).click();
    await page.waitForSelector(popover);
    await page.click('h1');
    ok(await page.$(popover) === null, 'clicking outside closes the popover');
    await shot(`${slug}-final`);
  }

  console.log('\n== no header markup');
  await open('no-header');
  await clickHead(page.locator('#bkmrk-t3 tbody tr:first-child td:nth-child(2)'));
  eq(await page.$eval('#bkmrk-t3 tbody tr:first-child td', td => td.textContent.trim()), 'Name', 'first row stays the header after sorting');
  eq(await col('#bkmrk-t3', 1), ['4', '7', '30', '250', '1,200', ''], 'sorted by qty');
  await shot('no-header-sorted');

  console.log('\n== wide');
  await open('wide');
  const m = await page.$eval('.bte-scroll:has(#bkmrk-t4)', w => ({sw: w.scrollWidth, cw: w.clientWidth, ox: getComputedStyle(w).overflowX}));
  ok(m.sw > m.cw && m.ox === 'auto', `horizontal scroll active (scrollWidth ${m.sw} > clientWidth ${m.cw})`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'page itself does not scroll horizontally');
  await page.locator('#bkmrk-t4 .bte-fbtn').nth(12).scrollIntoViewIfNeeded();
  await page.locator('#bkmrk-t4 .bte-fbtn').nth(12).click();
  await page.waitForSelector(popover);
  const box = await page.$eval(popover, p => { const r = p.getBoundingClientRect(); return {l: r.left, r: r.right, w: innerWidth}; });
  ok(box.l >= 0 && box.r <= box.w, 'popover stays inside the viewport for a far-right column');
  await shot('wide');
  await page.keyboard.press('Escape');

  console.log('\n== rowspan');
  await open('rowspan');
  ok(await page.$('.bte-scroll > #bkmrk-t5') !== null, 'scroll wrapper still applied');
  ok(await page.$('#bkmrk-t5 .bte-fbtn') === null && await page.$('#bkmrk-t5 .bte-sortable') === null, 'sort/filter skipped');
  await shot('rowspan');

  console.log('\n== nested');
  await open('nested');
  ok(await page.$('#bkmrk-t6[data-bte-init]') !== null, 'outer enhanced');
  ok(await page.$('#bkmrk-t6in[data-bte-init]') === null, 'inner table untouched');
  await shot('nested');

  console.log('\n== link in header');
  await open('link-header');
  await page.click('#bkmrk-t7 a');
  eq(await page.$$eval('#bkmrk-t7 tbody tr', trs => trs.map(t => t.cells[0].textContent.trim())), ['b', 'a'], 'clicking a link does not sort');
  await clickHead(page.locator('#bkmrk-t7 .bte-sortable:nth-child(2)'));
  eq(await page.$$eval('#bkmrk-t7 tbody tr', trs => trs.map(t => t.cells[1].textContent.trim())), ['2', '10'], 'numeric not lexical (2 < 10)');

  console.log('\n== opted out via page tag');
  await open('opted-out');
  ok(await page.$('.bte-scroll') === null && await page.$('.bte-fbtn') === null, 'no enhancement when tag tablesextended=off');
  await shot('opted-out');
  console.log('   body tag classes:', JSON.stringify(await page.$eval('body', b => [...b.classList].filter(c => c.startsWith('tag-')))));

  // ---- editing --------------------------------------------------------------------------------
  const inEditor = async () => {
    let n = 0;
    for (const f of page.frames()) {
      try { n += await f.evaluate(() => document.querySelectorAll('.bte-scroll,.bte-fbtn,.bte-sortable,.bte-pop').length); } catch (e) { /* cross-origin frame */ }
    }
    return n;
  };

  if (MODE === 'tinymce') {
    console.log('\n== editor: WYSIWYG Editor (TinyMCE)');
    await page.goto(`${BASE}/books/table-tests/page/tiny-thead-td/edit`);
    await page.waitForFunction(() => window.tinymce && window.tinymce.activeEditor && window.tinymce.activeEditor.initialized, null, {timeout: 30000});
    ok(await inEditor() === 0, 'no viewing-mode markup inside the editor');
    const insertViaDialog = async (cols, rows) => {
      await page.evaluate(() => window.tinymce.activeEditor.setContent('<p>x</p>'));
      await page.locator('.tox-tbtn[aria-label="Table"]').first().click();
      await page.waitForTimeout(300);
      await page.locator('.tox-collection__item:has-text("Table")').first().click();
      await page.waitForSelector('.tox-dialog');
      const inputs = page.locator('.tox-dialog input[type=text]');
      await inputs.nth(0).fill(String(cols));
      await inputs.nth(1).fill(String(rows));
      await page.click('.tox-dialog button:has-text("Save")');
      await page.waitForTimeout(400);
      return page.evaluate(() => {
        const t = window.tinymce.activeEditor.dom.select('table')[0];
        return {cols: t.rows[0].cells.length, rows: t.rows.length};
      });
    };
    eq(await insertViaDialog(15, 3), {cols: 15, rows: 3}, 'insert table dialog creates a 15 column table');
    eq(await insertViaDialog(80, 2), {cols: 50, rows: 2}, 'columns are capped at the configured maximum (50)');
    await shot('editor');
  } else {
    console.log('\n== editor: new WYSIWYG (Lexical)');
    await page.goto(`${BASE}/books/table-tests/page/lexical-th/edit`);
    await page.waitForSelector('[component="wysiwyg-editor"] [contenteditable]', {timeout: 30000});
    await page.waitForTimeout(1500);
    ok(await inEditor() === 0, 'no viewing-mode markup inside the editor');
    const button = page.locator('button[title="Insert table (custom size)"], button[aria-label="Insert table (custom size)"]');
    if (LEXICAL_API) {
      eq(await button.count(), 1, 'toolbar has the custom size table button');
      const sizes = () => page.$$eval('[component="wysiwyg-editor"] [contenteditable] table', ts => ts.map(x => `${x.rows[0].cells.length}x${x.rows.length}`));
      const insertViaDialog = async (cols, rows) => {
        await page.click('[component="wysiwyg-editor"] [contenteditable] p, [component="wysiwyg-editor"] [contenteditable] td');
        await button.first().click();
        await page.waitForSelector('.bte-modal');
        const nums = page.locator('.bte-modal input[type=number]');
        await nums.nth(0).fill(String(cols));
        await nums.nth(1).fill(String(rows));
        await page.click('.bte-modal button[type=submit]');
        await page.waitForTimeout(700);
        return sizes();
      };
      ok((await insertViaDialog(15, 4)).includes('15x4'), 'custom size dialog inserts a 15 column table');

      // The dialog refuses a size above the configured maximum and stays open, so the limit is visible.
      const tableCount = () => page.$$eval('[component="wysiwyg-editor"] [contenteditable] table', t => t.length);
      const before = await tableCount();
      await page.click('[component="wysiwyg-editor"] [contenteditable] p');
      await button.first().click();
      await page.waitForSelector('.bte-modal');
      const nums = page.locator('.bte-modal input[type=number]');
      await nums.nth(0).fill('80');
      await nums.nth(1).fill('2');
      await page.click('.bte-modal button[type=submit]');
      await page.waitForTimeout(400);
      ok(await page.$('.bte-modal') !== null && await tableCount() === before, 'dialog refuses more columns than the maximum (50) and stays open');
      await nums.nth(0).fill('50');
      await page.click('.bte-modal button[type=submit]');
      await page.waitForTimeout(700);
      ok((await sizes()).includes('50x2'), 'the maximum size (50 columns) can be inserted');

      await page.click('[component="wysiwyg-editor"] [contenteditable] p');
      await button.first().click();
      await page.waitForSelector('.bte-modal');
      await page.keyboard.press('Escape');
      ok(await page.$('.bte-modal') === null, 'Escape closes the dialog without inserting');
      await shot('editor');
    } else {
      eq(await button.count(), 0, `custom size button is not offered on v${VERSION} (the editor API needs v25.12+)`);
      await shot('editor');
    }
  }

  const viewErrors = errors.filter(e => !e.includes('/edit :: '));
  const editErrors = errors.filter(e => e.includes('/edit :: '));
  if (editErrors.length) console.log('   editor-page console errors (informational):', JSON.stringify(editErrors));
  ok(viewErrors.length === 0, 'no console/page errors on view pages' + (viewErrors.length ? ': ' + viewErrors.join(' | ') : ''));
  await browser.close();
  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
