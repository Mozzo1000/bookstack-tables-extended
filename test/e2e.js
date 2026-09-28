// End-to-end checks for bookstack-tables-extended.js against a running BookStack.
// Run through run-version.sh (or see test/README.md). Environment: BASE, SHOTS_DIR.
const {chromium} = require('playwright');
const BASE = process.env.BASE || 'http://localhost:6875';

const fs = require('fs');
const path = require('path');
const OUT = process.env.SHOTS_DIR || path.join(__dirname, '..', 'screenshots', 'adhoc');
fs.mkdirSync(OUT, {recursive: true});
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
  page.on('pageerror', e => errors.push(page.url().replace(BASE, '') + ' :: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(page.url().replace(BASE, '') + ' :: ' + m.text());
  });

  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', 'admin@admin.com');
  await page.fill('input[name=password]', 'password');
  await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

  const shot = name => page.screenshot({path: `${OUT}/${name}.png`, fullPage: true});
  const open = slug => page.goto(`${BASE}/books/table-tests/page/${slug}`);
  const col = (sel, i) => page.$$eval(
    `${sel} tbody tr:not(.bte-filter-row):not(.bte-hidden):not(:has(.bte-sortable))`,
    (trs, i) => trs.map(tr => tr.cells[i].textContent.trim()), i);
  const nameOrder = ['Delta', 'alpha', 'Charlie', 'bravo', 'Echo 10', 'Echo 9'];

  const variants = [
    ['tiny-thead-td', '#bkmrk-t1', 'thead tr:first-child'],
    ['lexical-th', '#bkmrk-t2', 'tbody tr:first-child'],
  ];
  for (const [slug, t, headSel] of variants) {
    console.log(`\n== ${slug}`);
    await open(slug);
    ok(await page.$(`.bte-scroll > ${t}`) !== null, 'table wrapped in .bte-scroll');
    ok(await page.$(`${t} .bte-filter-row`) !== null, 'filter row present');
    const nameHead = page.locator(`${t} ${headSel} > :nth-child(1)`);
    const qtyHead = page.locator(`${t} ${headSel} > :nth-child(2)`);
    const priceHead = page.locator(`${t} ${headSel} > :nth-child(3)`);
    const statusSel = `.bte-scroll:has(${t}) + .bte-status`;

    await nameHead.click();
    eq(await col(t, 0), ['alpha', 'bravo', 'Charlie', 'Delta', 'Echo 9', 'Echo 10'], 'name asc (case-insensitive, natural)');
    eq(await nameHead.getAttribute('aria-sort'), 'ascending', 'aria-sort ascending');
    await nameHead.click();
    eq(await col(t, 0), ['Echo 10', 'Echo 9', 'Delta', 'Charlie', 'bravo', 'alpha'], 'name desc');
    await nameHead.click();
    eq(await col(t, 0), nameOrder, 'third click restores original order');
    eq(await nameHead.getAttribute('aria-sort'), 'none', 'aria-sort none');

    await qtyHead.click();
    eq(await col(t, 1), ['4', '7', '30', '250', '1,200', ''], 'qty numeric asc, blank last');
    await qtyHead.click();
    eq(await col(t, 1), ['1,200', '250', '30', '7', '4', ''], 'qty numeric desc, blank still last');
    await priceHead.click();
    eq(await col(t, 2), ['$0.99', '$5.50', '$7.25', '$12.00', '$100', ''], 'currency column numeric asc');
    eq(await qtyHead.getAttribute('aria-sort'), 'none', 'previous column aria-sort cleared');

    await nameHead.focus();
    await page.keyboard.press('Enter');
    eq((await col(t, 0))[0], 'alpha', 'keyboard Enter sorts');

    await page.fill(`${t} .bte-filter-row td:nth-child(1) input`, 'ECHO');
    await page.waitForTimeout(300);
    eq(await col(t, 0), ['Echo 9', 'Echo 10'], 'filter is case-insensitive substring and keeps sort');
    await shot(`${slug}-sorted-filtered`);
    const status = await page.textContent(statusSel);
    ok(/Showing 2 of 6/.test(status), 'status line: ' + status.trim());
    await page.fill(`${t} .bte-filter-row td:nth-child(2) input`, '25');
    await page.waitForTimeout(300);
    eq(await col(t, 0), ['Echo 10'], 'filters combine (AND)');
    await page.fill(`${t} .bte-filter-row td:nth-child(2) input`, 'zzz');
    await page.waitForTimeout(300);
    ok(/No matching/.test(await page.textContent(statusSel)), 'no-match message');
    await page.click('.bte-clear');
    eq((await col(t, 0)).length, 6, 'clear filters restores all rows');
    await shot(`${slug}-cleared`);
  }

  console.log('\n== no header markup');
  await open('no-header');
  await page.locator('#bkmrk-t3 tbody tr:first-child td:nth-child(2)').click();
  eq(await page.$eval('#bkmrk-t3 tbody tr:first-child td', td => td.textContent.trim()), 'Name', 'first row stays the header after sorting');
  eq(await col('#bkmrk-t3', 1), ['4', '7', '30', '250', '1,200', ''], 'sorted by qty');
  await shot('no-header-sorted');

  console.log('\n== wide');
  await open('wide');
  const m = await page.$eval('.bte-scroll:has(#bkmrk-t4)', w => ({sw: w.scrollWidth, cw: w.clientWidth, ox: getComputedStyle(w).overflowX}));
  ok(m.sw > m.cw && m.ox === 'auto', `horizontal scroll active (scrollWidth ${m.sw} > clientWidth ${m.cw})`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'page itself does not scroll horizontally');
  await shot('wide');

  console.log('\n== rowspan');
  await open('rowspan');
  ok(await page.$('.bte-scroll > #bkmrk-t5') !== null, 'scroll wrapper still applied');
  ok(await page.$('#bkmrk-t5 .bte-filter-row') === null && await page.$('#bkmrk-t5 .bte-sortable') === null, 'sort/filter skipped');
  await shot('rowspan');

  console.log('\n== nested');
  await open('nested');
  ok(await page.$('#bkmrk-t6[data-bte-init]') !== null, 'outer enhanced');
  ok(await page.$('#bkmrk-t6in[data-bte-init]') === null, 'inner table untouched');
  await shot('nested');

  console.log('\n== link in header');
  await open('link-header');
  await page.click('#bkmrk-t7 a');
  eq(await page.$$eval('#bkmrk-t7 tbody tr:not(.bte-filter-row)', trs => trs.map(t => t.cells[0].textContent.trim())), ['b', 'a'], 'clicking a link does not sort');
  await page.locator('#bkmrk-t7 .bte-sortable:nth-child(2)').click();
  eq(await page.$$eval('#bkmrk-t7 tbody tr', trs => trs.map(t => t.cells[1].textContent.trim())), ['2', '10'], 'numeric not lexical (2 < 10)');

  console.log('\n== opted out via page tag');
  await open('opted-out');
  ok(await page.$('.bte-scroll') === null && await page.$('.bte-filter-row') === null, 'no enhancement when tag tablesextended=off');
  await shot('opted-out');
  console.log('   body tag classes:', JSON.stringify(await page.$eval('body', b => [...b.classList].filter(c => c.startsWith('tag-')))));

  console.log('\n== editor untouched');
  await page.goto(`${BASE}/books/table-tests/page/tiny-thead-td/edit`);
  await page.waitForTimeout(4000);
  const count = () => document.querySelectorAll('.bte-scroll,.bte-filter-row,.bte-sortable').length;
  const info = await page.evaluate(() => ({
    tiny: !!document.querySelector('#html-editor_ifr'),
    lexical: !!document.querySelector('[component="wysiwyg-editor"] [contenteditable]'),
    tables: document.querySelectorAll('.page-content table, [contenteditable] table').length,
  }));
  let inEditor = 0;
  for (const f of page.frames()) {
    try { inEditor += await f.evaluate(count); } catch (e) { /* cross-origin frame */ }
  }
  console.log('   editor:', JSON.stringify(info));
  ok(inEditor === 0, 'no enhancement markup inside the editor (main doc + iframes)');
  await shot('editor');

  const viewErrors = errors.filter(e => !e.includes('/edit :: '));
  const editErrors = errors.filter(e => e.includes('/edit :: '));
  if (editErrors.length) console.log('   editor-page console errors (informational):', JSON.stringify(editErrors));
  ok(viewErrors.length === 0, 'no console/page errors on view pages' + (viewErrors.length ? ': ' + viewErrors.join(' | ') : ''));
  await browser.close();
  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
