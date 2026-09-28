// Takes the screenshots used in the main README and saves them to ../assets.
// Needs a running test instance with the script installed (see tests/README.md, "Marketing screenshots").
//
//   node marketing-screenshots.js viewer    viewing features, light and dark mode, and the WYSIWYG Editor screens
//   node marketing-screenshots.js lexical   the new WYSIWYG screens (run against an instance whose default editor is the new one)
//
// Environment: BASE (default http://localhost:6875), ASSETS_DIR (default ../assets).
const {chromium} = require('playwright');
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:6875';
const OUT = process.env.ASSETS_DIR || path.join(__dirname, '..', 'assets');
const MODE = process.argv[2] || 'viewer';
const AUTH = {Authorization: 'Token testtokenid:testsecret', 'Content-Type': 'application/json'};
fs.mkdirSync(OUT, {recursive: true});

async function api(route, body) {
  const res = await fetch(`${BASE}/api/${route}`, {method: 'POST', headers: AUTH, body: JSON.stringify(body)});
  const json = await res.json();
  if (!res.ok) throw new Error(`${route} ${JSON.stringify(json)}`);
  return json;
}

const table = (id, header, rows, extra = '') => {
  const head = `<thead><tr>${header.map(h => `<td>${h}</td>`).join('')}</tr></thead>`;
  const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table id="bkmrk-${id}" style="border-collapse: collapse; width: 100%;"${extra}>${head}<tbody>${body}</tbody></table>`;
};

const inventory = table('inventory',
  ['Product', 'Category', 'In stock', 'Price', 'Status', 'Updated'],
  [
    ['Aurora Desk Lamp', 'Lighting', '128', '$49.00', 'Available', '2026-09-02'],
    ['Basalt Grinder', 'Kitchen', '34', '$89.50', 'Low stock', '2026-09-11'],
    ['Cedar Bookshelf', 'Furniture', '12', '$329.00', 'Low stock', '2026-08-28'],
    ['Delta Charger', 'Electronics', '560', '$24.99', 'Available', '2026-09-15'],
    ['Ember Blanket', 'Home', '0', '$79.00', 'Sold out', '2026-09-01'],
    ['Fjord Water Bottle', 'Outdoors', '875', '$18.00', 'Available', '2026-09-09'],
    ['Glacier Backpack', 'Outdoors', '76', '$124.00', 'Available', '2026-09-12'],
    ['Harbor Desk Chair', 'Furniture', '21', '$249.00', 'Low stock', '2026-09-05'],
    ['Iris Headphones', 'Electronics', '143', '$199.00', 'Available', '2026-09-14'],
    ['Juniper Candle Set', 'Home', '0', '$32.00', 'Sold out', '2026-08-30'],
    ['Kestrel Trail Shoes', 'Outdoors', '58', '$139.00', 'Available', '2026-09-10'],
    ['Lumen Smart Bulb', 'Lighting', '402', '$36.00', 'Available', '2026-09-13'],
  ]);

const directory = table('directory',
  ['ID', 'Name', 'Role', 'Team', 'City', 'Started', 'Salary', 'Manager', 'Status', 'Level', 'Phone', 'Email'],
  [
    ['1001', 'Ada Lovelace', 'Engineer', 'Platform', 'London', '2021-04-01', '$98,000', 'Grace Hopper', 'Active', 'L5', '555-0101', 'ada@example.com'],
    ['1002', 'Grace Hopper', 'Director', 'Platform', 'New York', '2019-09-15', '$135,000', 'Alan Turing', 'Active', 'L8', '555-0102', 'grace@example.com'],
    ['1003', 'Alan Turing', 'VP Research', 'Research', 'Manchester', '2018-01-10', '$150,000', '', 'Active', 'L9', '555-0103', 'alan@example.com'],
    ['1004', 'Katherine Johnson', 'Analyst', 'Flight', 'Houston', '2020-06-30', '$88,250', 'Grace Hopper', 'On leave', 'L4', '555-0104', 'katherine@example.com'],
    ['1005', 'Linus Torvalds', 'Architect', 'Kernel', 'Portland', '2023-03-20', '$112,000', 'Ada Lovelace', 'Active', 'L7', '555-0105', 'linus@example.com'],
    ['1006', 'Margaret Hamilton', 'Principal', 'Flight', 'Boston', '2017-11-02', '$142,500', 'Grace Hopper', 'Active', 'L8', '555-0106', 'margaret@example.com'],
  ]);

const editable = table('editable',
  ['Name', 'Role', 'Team'],
  [
    ['Ada Lovelace', 'Engineering Lead', 'Platform'],
    ['Grace Hopper', 'Director', 'Platform'],
    ['Alan Turing', 'VP Research', 'Research'],
  ]);

(async () => {
  const browser = await chromium.launch({ignoreDefaultArgs: ['--hide-scrollbars']}); // keep scrollbars visible
  const context = await browser.newContext({viewport: {width: 1400, height: 900}, deviceScaleFactor: 2});
  const page = await context.newPage();

  const book = await api('books', {name: 'Handbook'});
  const mk = (name, html) => api('pages', {book_id: book.id, name, html});
  const pInventory = await mk('Product inventory', `<p>Current stock across all warehouses.</p>${inventory}`);
  const pDirectory = await mk('Team directory', `<p>Everyone on the platform and research teams.</p>${directory}`);
  const pEditable = await mk('Team roster', `<p>Draft roster for next quarter.</p>${editable}`);
  const url = p => `${BASE}/books/${book.slug}/page/${p.slug}`;

  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', 'admin@admin.com');
  await page.fill('input[name=password]', 'password');
  await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

  // Screenshot of the union of some elements (plus padding), clamped to the viewport.
  const snap = async (name, selectors, pad = 18, blur = false) => {
    if (blur) await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    const clip = await page.evaluate(([sels, pad]) => {
      const rects = sels.flatMap(s => Array.from(document.querySelectorAll(s)).map(e => e.getBoundingClientRect()));
      const left = Math.max(0, Math.min(...rects.map(r => r.left)) - pad);
      const top = Math.max(0, Math.min(...rects.map(r => r.top)) - pad);
      const right = Math.min(innerWidth, Math.max(...rects.map(r => r.right)) + pad);
      const bottom = Math.min(innerHeight, Math.max(...rects.map(r => r.bottom)) + pad);
      return {x: left, y: top, width: right - left, height: bottom - top};
    }, [selectors, pad]);
    await page.screenshot({path: path.join(OUT, name + '.png'), clip});
    console.log('saved', name + '.png', Math.round(clip.width) + 'x' + Math.round(clip.height));
  };
  const card = '.content-wrap, .card.content-wrap, main .page-content';

  // `full` takes every viewing shot; otherwise only the filter menu (used for dark mode).
  async function viewerShots(suffix, full) {
    await page.goto(url(pInventory));
    await page.waitForSelector('#bkmrk-inventory .bte-fbtn');
    await page.mouse.move(700, 5);
    // 1. sorted by price
    await page.locator('#bkmrk-inventory thead td:nth-child(4)').click({position: {x: 6, y: 6}});
    await page.locator('#bkmrk-inventory thead td:nth-child(4)').click({position: {x: 6, y: 6}});
    await page.mouse.move(700, 5);
    if (full) await snap('sort' + suffix, [card], 0, true);

    // 2. filter menu with a checklist and search
    await page.locator('#bkmrk-inventory thead td:nth-child(5) .bte-fbtn').click();
    await page.waitForSelector('.bte-pop');
    await page.locator('.bte-list label:has-text("Available") input').uncheck();
    await page.waitForTimeout(250);
    await snap('filter-menu' + suffix, [card, '.bte-pop'], 0, true);

    // 3. filter active: funnel highlighted, row count line
    await page.keyboard.press('Escape');
    await page.mouse.move(700, 5);
    await page.waitForTimeout(150);
    if (full) await snap('filter-active' + suffix, [card], 0, true);
  }

  if (MODE === 'viewer') {
    await viewerShots('', true);

    // 4. horizontal scroll with a visible scrollbar
    await page.goto(url(pDirectory));
    await page.waitForSelector('#bkmrk-directory .bte-fbtn');
    await page.evaluate(() => { document.querySelector('.bte-scroll').scrollLeft = 120; });
    await page.mouse.move(700, 5);
    await page.waitForTimeout(200);
    await snap('horizontal-scroll', [card], 0, true);

    // 5. the same in dark mode
    execSync(`docker compose -p bte-test exec -T bookstack-db mariadb -ubookstack -pbookstack-test bookstackapp -e "insert into settings (setting_key, \`value\`, created_at, updated_at, type) values ('user:1:dark-mode-enabled','true',now(),now(),'string') on duplicate key update \`value\`='true';"`, {cwd: __dirname, stdio: 'ignore'});
    await viewerShots('-dark', false);
    execSync(`docker compose -p bte-test exec -T bookstack-db mariadb -ubookstack -pbookstack-test bookstackapp -e "update settings set \`value\`='false' where setting_key='user:1:dark-mode-enabled';"`, {cwd: __dirname, stdio: 'ignore'});

    // ---- WYSIWYG Editor (TinyMCE) ----
    await page.goto(url(pEditable) + '/edit');
    await page.waitForFunction(() => window.tinymce && window.tinymce.activeEditor && window.tinymce.activeEditor.initialized, null, {timeout: 30000});
    await page.setViewportSize({width: 1400, height: 700});
    await page.waitForTimeout(500);
    const openTableMenu = async () => {
      await page.locator('.tox-tbtn[aria-label="Table"]').first().click();
      await page.waitForTimeout(300);
      await page.locator('.tox-collection__item:has-text("Table")').first().click();
      await page.waitForSelector('.bte-advanced');
      await page.waitForTimeout(300);
    };
    await page.evaluate(() => {
      const ed = window.tinymce.activeEditor;
      ed.setContent('<p>Monthly sign-ups by region.</p>');
      ed.selection.select(ed.getBody(), true);
      ed.selection.collapse(false);
    });
    await openTableMenu();
    await page.hover('.tox-insert-table-picker > div:nth-child(34)'); // 4 rows x 4 columns... hovers cell 34 (row 4, column 4)
    await page.waitForTimeout(200);
    await snap('editor-picker', ['.tox-editor-header', '.tox-menu', '.tox-insert-table-picker', '.bte-advanced'], 10);

    await page.click('.bte-advanced');
    await page.waitForSelector('.tox-dialog');
    const inputs = page.locator('.tox-dialog input[type=text]');
    await inputs.nth(0).fill('15');
    await inputs.nth(1).fill('4');
    await page.waitForTimeout(200);
    await snap('editor-advanced-dialog', ['.tox-dialog'], 0);
    await page.click('.tox-dialog button:has-text("Save")');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const t = window.tinymce.activeEditor.dom.select('table')[0];
      const heads = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Q1', 'Q2', 'Q3'];
      heads.forEach((h, i) => { t.rows[0].cells[i].innerHTML = '<strong>' + h + '</strong>'; });
      for (let r = 1; r < t.rows.length; r++) {
        for (let c = 0; c < 15; c++) t.rows[r].cells[c].textContent = String(((r * 37 + c * 53) % 90) + 10);
      }
      // Move the cursor out of the table so the floating table toolbar is hidden.
      const ed = window.tinymce.activeEditor;
      ed.selection.setCursorLocation(ed.dom.select('p')[0], 0);
      ed.nodeChanged();
    });
    await page.setViewportSize({width: 1400, height: 540});
    await page.waitForTimeout(400);
    await snap('editor-wide-table', ['.tox-tinymce'], 0);
    await page.setViewportSize({width: 1400, height: 700});
    await page.waitForTimeout(300);

  }

  if (MODE === 'lexical') {
    await page.goto(url(pEditable) + '/edit');
    await page.waitForSelector('[component="wysiwyg-editor"] [contenteditable] table', {timeout: 30000});
    await page.setViewportSize({width: 1400, height: 720});
    await page.waitForTimeout(1500);
    const ROOT = '[component="wysiwyg-editor"] [contenteditable]';
    await page.click(ROOT + ' p');
    await page.locator('button[title="Table"]').first().click();
    await page.waitForTimeout(300);
    await page.hover('button:has-text("Insert")');
    await page.waitForSelector('.editor-table-creator .bte-advanced');
    await page.hover('.editor-table-creator-cell[data-rows="4"][data-columns="4"]');
    await page.waitForTimeout(250);
    await snap('new-editor-picker', ['.editor-toolbar-main, [class*="editor-toolbar"]', '.editor-dropdown-menu:not([hidden])', '.editor-table-creator'], 14);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
