// Creates the "Table Tests" book and the fixture pages that e2e.js checks.
// Talks to the BookStack API with the throwaway token created by run-version.sh.
const BASE = process.env.BASE || 'http://localhost:6875';
const AUTH = {
    Authorization: 'Token testtokenid:testsecret',
    'Content-Type': 'application/json',
};

async function api(path, body) {
    const res = await fetch(`${BASE}/api/${path}`, {method: 'POST', headers: AUTH, body: JSON.stringify(body)});
    const json = await res.json();
    if (!res.ok) throw new Error(`${path} ${JSON.stringify(json)}`);
    return json;
}

const header = ['Name', 'Qty', 'Price', 'Date'];
const rows = [
    ['Delta', '1,200', '$5.50', '2024-03-01'],
    ['alpha', '30', '$12.00', '2023-12-25'],
    ['Charlie', '', '$0.99', '2024-01-15'],
    ['bravo', '4', '', '2022-07-04'],
    ['Echo 10', '250', '$100', '2024-02-02'],
    ['Echo 9', '7', '$7.25', '2024-02-03'],
];
const bodyRows = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');

// BookStack rewrites element ids unless they already start with "bkmrk-".
// TinyMCE saves a header row as <thead> with <td> cells.
const tinymce = `<table id="bkmrk-t1" style="border-collapse: collapse; width: 100%;"><thead><tr>${header.map(h => `<td>${h}</td>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`;
// Lexical saves <th> header cells inside <tbody>, with a <colgroup> for widths.
const lexical = `<table id="bkmrk-t2" style="width: 100%;"><colgroup><col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;"><col style="width: 25%;"></colgroup><tbody><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>${bodyRows}</tbody></table>`;
// A table with no header markup at all.
const plain = `<table id="bkmrk-t3"><tbody><tr>${header.map(h => `<td><strong>${h}</strong></td>`).join('')}</tr>${bodyRows}</tbody></table>`;
const wideHeader = Array.from({length: 14}, (_, i) => `Column ${i + 1}`);
const wide = `<table id="bkmrk-t4" style="width: 100%;"><thead><tr>${wideHeader.map(h => `<td>${h}</td>`).join('')}</tr></thead><tbody>${[3, 1, 2].map(n => `<tr>${wideHeader.map((_, i) => `<td>r${n}c${i + 1} some longer text</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const rowspan = `<table id="bkmrk-t5"><thead><tr><td>A</td><td>B</td></tr></thead><tbody><tr><td rowspan="2">x</td><td>2</td></tr><tr><td>1</td></tr></tbody></table>`;
const nested = `<table id="bkmrk-t6"><thead><tr><td>Outer</td><td>Other</td></tr></thead><tbody><tr><td><table id="bkmrk-t6in"><thead><tr><td>In</td></tr></thead><tbody><tr><td>b</td></tr><tr><td>a</td></tr></tbody></table></td><td>2</td></tr><tr><td>z</td><td>1</td></tr></tbody></table>`;
const linkHeader = `<table id="bkmrk-t7"><thead><tr><td><a href="#x">Linked head</a></td><td>N</td></tr></thead><tbody><tr><td>b</td><td>2</td></tr><tr><td>a</td><td>10</td></tr></tbody></table>`;

(async () => {
    const book = await api('books', {name: 'Table Tests'});
    const page = (name, html, tags) => api('pages', {book_id: book.id, name, html, ...(tags ? {tags} : {})});
    await page('Tiny (thead td)', `<p>x</p>${tinymce}<p>after</p>`);
    await page('Lexical (th)', lexical);
    await page('No header', plain);
    await page('Wide', wide);
    await page('Rowspan', rowspan);
    await page('Nested', nested);
    await page('Link header', linkHeader);
    await page('Opted out', tinymce, [{name: 'tablesextended', value: 'off'}]);
    console.log('fixtures created');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
