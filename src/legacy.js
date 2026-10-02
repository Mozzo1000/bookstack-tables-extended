import { injectStyles } from './lib/styles.js';
import { config } from './config.js';

(function () {
    'use strict';

    if (window.__bookStackTablesExtendedLoaded) {
        return;
    }
    window.__bookStackTablesExtendedLoaded = true;

    const EDITOR_SELECTOR = '[contenteditable], .editor-container, [component="wysiwyg-editor"], [component="markdown-editor"]';
    const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

    const FUNNEL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>';
    // A small table with a plus badge, so it reads differently from the built-in table icon.
    const TABLE_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h14v8h-2V6H5v8h6v2H3zM9 6h2v8H9zM5 9h10v2H5zM17 14h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>';

    /* ---------------------------------------------------------------------------------------
     * Shared helpers
     * ------------------------------------------------------------------------------------- */

    /** Copies the visible background and text colours of `source` onto `target` (theme aware). */
    function applySurface(target, source) {
        let bg = 'rgb(255, 255, 255)';
        for (let el = source; el; el = el.parentElement) {
            const value = getComputedStyle(el).backgroundColor;
            if (value && value !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(value)) {
                bg = value;
                break;
            }
        }
        target.style.backgroundColor = bg;
        target.style.color = getComputedStyle(source).color;
    }

    function el(tag, props, children) {
        const node = document.createElement(tag);
        Object.assign(node, props || {});
        for (const child of children || []) {
            node.append(child);
        }
        return node;
    }

    /* ---------------------------------------------------------------------------------------
     * Viewing: table analysis
     * ------------------------------------------------------------------------------------- */

    /** Clean, single-spaced text of a cell. */
    function cellText(cell) {
        return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    /** Map a row to an array indexed by grid column. Cells with a colspan occupy their first column only. */
    function rowToColumns(row, columnCount) {
        const columns = new Array(columnCount).fill(null);
        let col = 0;
        for (const cell of row.cells) {
            if (col >= columnCount) break;
            columns[col] = cell;
            col += Math.max(1, cell.colSpan || 1);
        }
        return columns;
    }

    function rowWidth(row) {
        let width = 0;
        for (const cell of row.cells) {
            width += Math.max(1, cell.colSpan || 1);
        }
        return width;
    }

    /** Returns a number for numeric-looking text (currency, thousands commas and % tolerated), else null. */
    function parseNumber(text) {
        const stripped = text.replace(/[$€£¥%\s]/g, '');
        if (!/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(stripped) || !/\d/.test(stripped)) {
            return null;
        }
        return Number(stripped.replace(/,/g, ''));
    }

    const MONTH_NAMES = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const MONTH_LABELS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    /** Builds a timestamp from year/month/day, or null if the combination isn't a real calendar date. */
    function makeDate(year, month, day) {
        const d = new Date(year, month, day);
        if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
        return d.getTime();
    }

    /**
     * Returns a timestamp for date-looking text, else null. Accepts ISO (2026-01-31), day-month-year
     * with a month name (31 Jan 2026, 31-Jan-2026) or numeric (31/01/2026, 31.01.2026), and
     * month-day-year with a month name (Jan 31, 2026). Numeric day/month is treated as day-first.
     */
    function parseDate(text) {
        const s = text.trim();

        let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
        if (m) return makeDate(+m[1], +m[2] - 1, +m[3]);

        m = s.match(/^(\d{1,2})[\s.\-/]+([A-Za-z]{3,9})[\s.,\-/]+(\d{4})$/);
        if (m) {
            const month = MONTH_NAMES[m[2].toLowerCase()];
            return month === undefined ? null : makeDate(+m[3], month, +m[1]);
        }

        m = s.match(/^([A-Za-z]{3,9})[\s.\-]+(\d{1,2}),?\s+(\d{4})$/);
        if (m) {
            const month = MONTH_NAMES[m[1].toLowerCase()];
            return month === undefined ? null : makeDate(+m[3], month, +m[2]);
        }

        m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (m) {
            const day = +m[1], month = +m[2];
            if (month > 12 || day > 31) return null;
            return makeDate(+m[3], month - 1, day);
        }

        return null;
    }

    /** Groups a date column's filter values into a year -> month -> day-values tree, blanks kept aside. */
    function buildDateTree(values) {
        const years = new Map();
        const blanks = [];
        for (const v of values) {
            if (v.value === '') { blanks.push(v); continue; }
            const d = new Date(parseDate(v.value));
            const year = d.getFullYear();
            const month = d.getMonth();
            if (!years.has(year)) years.set(year, new Map());
            const months = years.get(year);
            if (!months.has(month)) months.set(month, []);
            months.get(month).push(v);
        }
        const tree = Array.from(years.keys()).sort((a, b) => a - b).map(year => {
            const months = years.get(year);
            return {
                year,
                items: Array.from(months.values()).flat(),
                months: Array.from(months.keys()).sort((a, b) => a - b).map(month => ({
                    month,
                    items: months.get(month),
                })),
            };
        });
        return {tree, blanks};
    }

    /** Finds the header row and body rows of a table, or null if the table can't be handled. */
    function analyse(table) {
        const thead = table.tHead;
        const allRows = Array.from(table.rows);
        if (allRows.length === 0) return null;

        // Header: last row of <thead> if present, otherwise the first row.
        const headerRow = thead && thead.rows.length ? thead.rows[thead.rows.length - 1] : allRows[0];
        const bodyRows = allRows.filter(row => {
            return row !== headerRow
                && !(thead && thead.contains(row))
                && !(row.parentElement && row.parentElement.tagName === 'TFOOT');
        });

        const hasRowspan = allRows.some(row => Array.from(row.cells).some(c => c.rowSpan > 1));
        const columnCount = allRows.reduce((max, row) => Math.max(max, rowWidth(row)), 0);
        return {headerRow, bodyRows, columnCount, hasRowspan};
    }

    function enhanceScroll(table, columnCount) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bte-scroll';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        const min = columnCount * config.minColumnWidth;
        const current = parseFloat(table.style.minWidth) || 0;
        table.style.minWidth = Math.max(min, current) + 'px';
        return wrapper;
    }

    /* ---------------------------------------------------------------------------------------
     * Viewing: the column filter popover (one open at a time)
     * ------------------------------------------------------------------------------------- */

    let openPopover = null;

    function closePopover(restoreFocus) {
        if (!openPopover) return;
        const {node, button, cleanup} = openPopover;
        openPopover = null;
        cleanup();
        node.remove();
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
    }

    /**
     * Opens the filter popover for one column.
     * `column` is {index, name, values: [{value, label, count}], filter: {text, selected}, surface, onChange, onSort, onHide}
     */
    function showPopover(button, column) {
        closePopover(false);
        const {filter} = column;
        const t = config.labels;

        const search = el('input', {type: 'search', placeholder: t.search + '…'});
        search.setAttribute('aria-label', t.search);
        search.value = filter.text;

        const list = el('div', {className: 'bte-list'});
        const node = el('div', {className: 'bte-pop'});
        node.setAttribute('role', 'dialog');
        node.setAttribute('aria-label', t.filterColumn(column.name));

        const sortAsc = el('button', {type: 'button', className: 'bte-item', textContent: t.sortAscending});
        const sortDesc = el('button', {type: 'button', className: 'bte-item', textContent: t.sortDescending});
        const hideColumn = el('button', {type: 'button', className: 'bte-item', textContent: t.hideColumn});
        sortAsc.addEventListener('click', () => { column.onSort('ascending'); closePopover(true); });
        sortDesc.addEventListener('click', () => { column.onSort('descending'); closePopover(true); });
        hideColumn.addEventListener('click', () => { column.onHide(); closePopover(true); });

        const clear = el('button', {type: 'button', className: 'bte-item', textContent: t.clearFilter});

        let renderedCount = config.maxListValues;
        let collapsed = null; // Set of "y:<year>" / "y:<year>:m:<month>" keys, built on first date-tree render.
        const isChecked = value => filter.selected === null || filter.selected.has(value);
        const visibleValues = () => {
            const needle = search.value.trim().toLowerCase();
            return column.values.filter(v => needle === '' || v.value.toLowerCase().includes(needle));
        };
        const groupState = items => {
            if (filter.selected === null) return {checked: true, indeterminate: false};
            const checkedCount = items.filter(v => filter.selected.has(v.value)).length;
            return {checked: checkedCount === items.length && items.length > 0, indeterminate: checkedCount > 0 && checkedCount < items.length};
        };
        const setGroupChecked = (items, checked) => {
            const selected = filter.selected === null ? new Set(column.values.map(v => v.value)) : filter.selected;
            for (const v of items) {
                if (checked) selected.add(v.value); else selected.delete(v.value);
            }
            filter.selected = selected.size === column.values.length ? null : selected;
            column.onChange();
            renderList();
        };
        const appendLeaf = (v, indentLevel) => {
            const box = el('input', {type: 'checkbox'});
            box.checked = isChecked(v.value);
            box.addEventListener('change', () => {
                const selected = filter.selected === null ? new Set(column.values.map(x => x.value)) : filter.selected;
                if (box.checked) selected.add(v.value); else selected.delete(v.value);
                filter.selected = selected.size === column.values.length ? null : selected;
                column.onChange();
                renderList();
            });
            const label = el('label', {style: indentLevel ? `padding-left:${8 + indentLevel * 18}px` : ''}, [
                box,
                el('span', {className: 'bte-val', textContent: v.label, title: v.label}),
                el('span', {className: 'bte-count', textContent: String(v.count)}),
            ]);
            list.append(label);
        };
        const appendGroup = (label, items, indentLevel, key) => {
            const isCollapsed = collapsed.has(key);
            const toggle = el('button', {
                type: 'button', className: 'bte-toggle', textContent: isCollapsed ? '▶' : '▼',
            });
            toggle.addEventListener('click', () => {
                if (isCollapsed) collapsed.delete(key); else collapsed.add(key);
                renderList();
            });
            const box = el('input', {type: 'checkbox'});
            const state = groupState(items);
            box.checked = state.checked;
            box.indeterminate = state.indeterminate;
            box.addEventListener('change', () => setGroupChecked(items, box.checked));
            const count = items.reduce((sum, v) => sum + v.count, 0);
            const row = el('div', {className: 'bte-group-row', style: `padding-left:${indentLevel * 18}px`}, [
                toggle, box,
                el('span', {className: 'bte-val', textContent: label}),
                el('span', {className: 'bte-count', textContent: String(count)}),
            ]);
            list.append(row);
            return isCollapsed;
        };

        const renderDateTree = visible => {
            const {tree, blanks} = buildDateTree(visible);
            if (collapsed === null) collapsed = new Set(tree.map(g => 'y:' + g.year));
            for (const yearGroup of tree) {
                const yearKey = 'y:' + yearGroup.year;
                const yearCollapsed = appendGroup(String(yearGroup.year), yearGroup.items, 0, yearKey);
                if (yearCollapsed) continue;
                for (const monthGroup of yearGroup.months) {
                    const monthKey = yearKey + ':m:' + monthGroup.month;
                    const monthCollapsed = appendGroup(MONTH_LABELS[monthGroup.month], monthGroup.items, 1, monthKey);
                    if (monthCollapsed) continue;
                    for (const v of monthGroup.items) appendLeaf(v, 2);
                }
            }
            for (const v of blanks) appendLeaf(v, 0);
        };

        const renderList = () => {
            list.textContent = '';
            const visible = visibleValues();
            if (visible.length === 0) {
                list.append(el('div', {className: 'bte-empty', textContent: t.noValues}));
                return;
            }
            const all = el('input', {type: 'checkbox'});
            const syncAll = () => {
                const checked = visible.filter(v => isChecked(v.value)).length;
                all.checked = checked === visible.length;
                all.indeterminate = checked > 0 && checked < visible.length;
            };
            syncAll();
            all.addEventListener('change', () => {
                const selected = filter.selected === null ? new Set(column.values.map(v => v.value)) : filter.selected;
                for (const v of visible) {
                    if (all.checked) selected.add(v.value); else selected.delete(v.value);
                }
                filter.selected = selected.size === column.values.length ? null : selected;
                column.onChange();
                renderList();
            });
            list.append(el('label', {}, [all, el('span', {className: 'bte-val', textContent: t.selectAll})]));

            // Dates are grouped into a collapsible year/month tree, unless a search narrows the list, in
            // which case a flat, batched list of matches is clearer.
            if (column.isDate && search.value.trim() === '') {
                renderDateTree(visible);
                return;
            }

            // Only a batch of the (possibly very long) list is rendered at a time, to stay responsive.
            const shown = visible.slice(0, renderedCount);
            for (const v of shown) appendLeaf(v, 0);
            if (visible.length > shown.length) {
                const loadMore = el('button', {
                    type: 'button', className: 'bte-item',
                    textContent: t.loadMore(visible.length - shown.length),
                });
                loadMore.addEventListener('click', () => {
                    renderedCount += config.maxListValues;
                    renderList();
                });
                list.append(loadMore);
            }
        };

        search.addEventListener('input', () => {
            filter.text = search.value.trim().toLowerCase();
            renderedCount = config.maxListValues;
            column.onChange();
            renderList();
        });
        clear.addEventListener('click', () => {
            filter.text = '';
            filter.selected = null;
            search.value = '';
            renderedCount = config.maxListValues;
            column.onChange();
            renderList();
            search.focus();
        });

        node.append(sortAsc, sortDesc, hideColumn, el('hr'), search, list, el('hr'), clear);
        renderList();

        document.body.appendChild(node);
        applySurface(node, column.surface);

        // Position below the button, kept inside the viewport. Scrolling the button out of view closes the
        // menu. A resize only repositions it, because some browsers report odd sizes while resizing.
        const place = closeIfHidden => {
            const rect = button.getBoundingClientRect();
            if (closeIfHidden && (rect.bottom < 0 || rect.top > window.innerHeight)) {
                closePopover(false);
                return;
            }
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - node.offsetWidth - 8));
            const top = rect.bottom + 4;
            node.style.left = left + 'px';
            node.style.top = top + 'px';
            list.style.maxHeight = Math.max(120, Math.min(260, window.innerHeight - top - 150)) + 'px';
        };
        place(false);

        const onDocClick = event => {
            if (!node.contains(event.target) && !button.contains(event.target)) closePopover(false);
        };
        const onKey = event => {
            if (event.key === 'Escape') { event.stopPropagation(); closePopover(true); }
        };
        const onScroll = event => {
            if (!node.contains(event.target)) place(true);
        };
        const onResize = () => place(false);
        document.addEventListener('mousedown', onDocClick, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);

        button.setAttribute('aria-expanded', 'true');
        openPopover = {
            node,
            button,
            cleanup() {
                document.removeEventListener('mousedown', onDocClick, true);
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('scroll', onScroll, true);
                window.removeEventListener('resize', onResize);
            },
        };
        search.focus();
    }

    /* ---------------------------------------------------------------------------------------
     * Viewing: exporting the current view as an Excel file (no libraries: an .xlsx file is a zip of small XML files)
     * ------------------------------------------------------------------------------------- */

    const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

    /**
     * A number when the text is a plain number that survives a round trip, so codes such as 007 or 1.50 stay
     * text. Thousands separators are dropped. Currency symbols and percent signs keep the value as text.
     */
    function exportNumber(text) {
        if (!/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(text) || !/\d/.test(text)) return null;
        const plain = text.replace(/,/g, '').replace(/^\+/, '');
        const value = Number(plain);
        return Number.isFinite(value) && String(value) === plain ? value : null;
    }

    function xmlEscape(text) {
        return text
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** 0 -> A, 25 -> Z, 26 -> AA */
    function columnName(index) {
        let name = '';
        for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
            name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
        }
        return name;
    }

    const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /** A zip file without compression. `files` is a list of {name, data} where data is a Uint8Array. */
    function buildZip(files) {
        const encoder = new TextEncoder();
        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const parts = [];
        const directory = [];
        let offset = 0;

        for (const file of files) {
            const name = encoder.encode(file.name);
            const crc = crc32(file.data);

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034B50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true); // file names are UTF-8
            local.setUint16(10, dosTime, true);
            local.setUint16(12, dosDate, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, file.data.length, true);
            local.setUint32(22, file.data.length, true);
            local.setUint16(26, name.length, true);
            parts.push(new Uint8Array(local.buffer), name, file.data);

            const entry = new DataView(new ArrayBuffer(46));
            entry.setUint32(0, 0x02014B50, true);
            entry.setUint16(4, 20, true);
            entry.setUint16(6, 20, true);
            entry.setUint16(8, 0x0800, true);
            entry.setUint16(12, dosTime, true);
            entry.setUint16(14, dosDate, true);
            entry.setUint32(16, crc, true);
            entry.setUint32(20, file.data.length, true);
            entry.setUint32(24, file.data.length, true);
            entry.setUint16(28, name.length, true);
            entry.setUint32(42, offset, true);
            directory.push(new Uint8Array(entry.buffer), name);

            offset += 30 + name.length + file.data.length;
        }

        const directorySize = directory.reduce((sum, chunk) => sum + chunk.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054B50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, directorySize, true);
        end.setUint32(16, offset, true);
        return [...parts, ...directory, new Uint8Array(end.buffer)];
    }

    /** The sheet with a bold, frozen heading row. Text is stored as plain strings, so a cell such as =1+1 is never a formula. */
    function buildSheetXml(header, rows) {
        const numeric = header.map((_, col) => {
            const values = rows.map(row => row[col]).filter(value => value !== '');
            return values.length > 0 && values.every(value => exportNumber(value) !== null);
        });
        const text = (ref, value, style) => value === ''
            ? ''
            : `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;

        const widths = header.map((name, col) => {
            const longest = Math.max(name.length, ...rows.map(row => row[col].length));
            return Math.min(60, Math.max(8, longest + 2));
        });
        const cols = widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('');

        let sheetData = '<row r="1">' + header.map((name, col) => text(columnName(col) + '1', name, 1)).join('') + '</row>';
        rows.forEach((row, r) => {
            const cells = row.map((value, col) => {
                const ref = columnName(col) + (r + 2);
                return numeric[col] && value !== '' ? `<c r="${ref}"><v>${exportNumber(value)}</v></c>` : text(ref, value, 0);
            }).join('');
            sheetData += `<row r="${r + 2}">${cells}</row>`;
        });

        return XML_HEAD + `<worksheet xmlns="${SPREADSHEET_NS}"><sheetViews><sheetView workbookViewId="0">`
            + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            + `<cols>${cols}</cols><sheetData>${sheetData}</sheetData></worksheet>`;
    }

    function buildXlsx(header, rows, sheetName) {
        const encoder = new TextEncoder();
        const safeName = sheetName.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Table';
        const files = [
            ['[Content_Types].xml', XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
                + `<Default Extension="xml" ContentType="application/xml"/>`
                + `<Override PartName="/xl/workbook.xml" ContentType="${XLSX_TYPE}.main+xml"/>`
                + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
                + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
            ['_rels/.rels', XML_HEAD + `<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OFFICE_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
            ['xl/workbook.xml', XML_HEAD + `<workbook xmlns="${SPREADSHEET_NS}" xmlns:r="${OFFICE_REL}"><sheets><sheet name="${xmlEscape(safeName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
            ['xl/_rels/workbook.xml.rels', XML_HEAD + `<Relationships xmlns="${REL_NS}">`
                + `<Relationship Id="rId1" Type="${OFFICE_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
                + `<Relationship Id="rId2" Type="${OFFICE_REL}/styles" Target="styles.xml"/></Relationships>`],
            ['xl/styles.xml', XML_HEAD + `<styleSheet xmlns="${SPREADSHEET_NS}">`
                + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
                + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
            ['xl/worksheets/sheet1.xml', buildSheetXml(header, rows)],
        ].map(([name, xml]) => ({name, data: encoder.encode(xml)}));
        return new Blob(buildZip(files), {type: XLSX_TYPE});
    }

    /** "<page title>.xlsx", with " - table N" added when the page has several tables. */
    function exportFileName(table) {
        const title = document.title.split(' | ')[0].trim() || 'table';
        const tables = Array.from(document.querySelectorAll('table[data-bte-init]'));
        const suffix = tables.length > 1 ? ` - table ${tables.indexOf(table) + 1}` : '';
        const clean = (title + suffix).replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        return (clean || 'table') + '.xlsx';
    }

    /** Downloads the rows that are visible now, in the order they are shown now. */
    function exportCurrentView(table, header, rows) {
        const blob = buildXlsx(header, rows, document.title.split(' | ')[0]);
        const url = URL.createObjectURL(blob);
        const link = el('a', {href: url, download: exportFileName(table)});
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    /* ---------------------------------------------------------------------------------------
     * Viewing: sorting and filtering for one table
     * ------------------------------------------------------------------------------------- */

    function enhanceInteractive(table, wrapper, info) {
        const {headerRow, bodyRows, columnCount} = info;
        const t = config.labels;
        // Header cells get forced onto one line (see .bte-head), so let the browser size columns
        // to fit their natural content instead of the fixed layout used by plain tables.
        table.classList.add('bte-auto');
        const rows = bodyRows.map((tr, index) => {
            const cells = rowToColumns(tr, columnCount);
            const texts = cells.map(cellText);
            return {tr, cells, texts, lower: texts.map(x => x.toLowerCase()), index};
        });

        // A column is numeric when every non-empty cell parses as a number.
        const numericColumn = Array.from({length: columnCount}, (_, col) => {
            const values = rows.map(r => r.texts[col]).filter(x => x !== '');
            return values.length > 0 && values.every(x => parseNumber(x) !== null);
        });

        // A column is a date column when every non-empty cell parses as a date (mixed formats allowed).
        const dateColumn = Array.from({length: columnCount}, (_, col) => {
            if (numericColumn[col]) return false;
            const values = rows.map(r => r.texts[col]).filter(x => x !== '');
            return values.length > 0 && values.every(x => parseDate(x) !== null);
        });

        const headerCells = rowToColumns(headerRow, columnCount);
        headerCells.forEach(cell => { if (cell) cell.classList.add('bte-head'); });
        const filters = Array.from({length: columnCount}, () => ({text: '', selected: null}));
        const funnels = new Array(columnCount).fill(null);
        const hiddenColumns = new Set();
        let sortState = {col: -1, dir: 'none'};
        let status = null;
        let statusText = null;
        let clearButton = null;
        let exportButton = null;
        let showAllButton = null;

        function setColumnHidden(col, isHidden) {
            if (isHidden) hiddenColumns.add(col); else hiddenColumns.delete(col);
            if (headerCells[col]) headerCells[col].classList.toggle('bte-hidden', isHidden);
            for (const row of rows) {
                if (row.cells[col]) row.cells[col].classList.toggle('bte-hidden', isHidden);
            }
            if (showAllButton) showAllButton.hidden = hiddenColumns.size === 0;
            updateStatusVisibility();
        }

        function updateStatusVisibility() {
            if (status) status.hidden = !filters.some(isActive) && hiddenColumns.size === 0;
        }

        const parent = rows[0].tr.parentNode;
        let currentOrder = rows.slice();

        function render() {
            const ordered = rows.slice();
            if (sortState.dir !== 'none') {
                const {col, dir} = sortState;
                const factor = dir === 'ascending' ? 1 : -1;
                const numeric = numericColumn[col];
                const date = dateColumn[col];
                ordered.sort((a, b) => {
                    const ta = a.texts[col];
                    const tb = b.texts[col];
                    if (ta === '' || tb === '') {
                        // Blank cells always sort last, whatever the direction.
                        return ta === tb ? a.index - b.index : (ta === '' ? 1 : -1);
                    }
                    const result = numeric ? parseNumber(ta) - parseNumber(tb)
                        : date ? parseDate(ta) - parseDate(tb)
                        : collator.compare(ta, tb);
                    return result * factor || a.index - b.index;
                });
            } else {
                ordered.sort((a, b) => a.index - b.index);
            }
            for (const row of ordered) {
                parent.appendChild(row.tr);
            }
            currentOrder = ordered;
        }

        const isActive = f => f.text !== '' || f.selected !== null;

        function applyFilters() {
            let shown = 0;
            for (const row of rows) {
                const match = filters.every((f, col) => {
                    if (f.text !== '' && !row.lower[col].includes(f.text)) return false;
                    return f.selected === null || f.selected.has(row.texts[col]);
                });
                row.tr.classList.toggle('bte-hidden', !match);
                if (match) shown++;
            }
            filters.forEach((f, col) => {
                if (funnels[col]) funnels[col].classList.toggle('bte-active', isActive(f));
            });
            if (status) {
                updateStatusVisibility();
                statusText.textContent = shown === 0 ? t.noMatches : t.showing(shown, rows.length);
                clearButton.hidden = !filters.some(isActive);
                if (exportButton) exportButton.hidden = shown === 0;
            }
        }

        function setSort(col, dir) {
            sortState = {col, dir};
            headerCells.forEach((c, i) => {
                if (c && config.sort) c.setAttribute('aria-sort', i === col ? dir : 'none');
            });
            render();
        }

        if (config.sort) {
            headerCells.forEach(cell => {
                if (!cell) return;
                cell.classList.add('bte-sortable');
                cell.tabIndex = 0;
                cell.setAttribute('role', 'columnheader');
                cell.setAttribute('aria-sort', 'none');
                const indicator = el('span', {className: 'bte-ind'});
                indicator.setAttribute('aria-hidden', 'true');
                cell.appendChild(indicator);
            });

            const toggle = cell => {
                const col = headerCells.indexOf(cell);
                if (col < 0) return;
                const next = sortState.col === col
                    ? {none: 'ascending', ascending: 'descending', descending: 'none'}[sortState.dir]
                    : 'ascending';
                setSort(col, next);
            };

            headerRow.addEventListener('click', event => {
                if (event.target.closest('a, input, button')) return;
                const cell = event.target.closest('th, td');
                if (cell && cell.parentNode === headerRow) toggle(cell);
            });
            headerRow.addEventListener('keydown', event => {
                if ((event.key === 'Enter' || event.key === ' ') && event.target.parentNode === headerRow) {
                    event.preventDefault();
                    toggle(event.target);
                }
            });
        }

        if (config.filter) {
            headerCells.forEach((cell, col) => {
                if (!cell) return;
                const name = cellText(cell);
                const button = el('button', {type: 'button', className: 'bte-fbtn', innerHTML: FUNNEL_SVG});
                button.setAttribute('aria-label', t.filterColumn(name));
                button.setAttribute('aria-haspopup', 'dialog');
                button.setAttribute('aria-expanded', 'false');
                funnels[col] = button;
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    if (openPopover && openPopover.button === button) {
                        closePopover(true);
                        return;
                    }
                    const counts = new Map();
                    for (const row of rows) {
                        counts.set(row.texts[col], (counts.get(row.texts[col]) || 0) + 1);
                    }
                    const values = Array.from(counts, ([value, count]) => ({
                        value, count, label: value === '' ? t.blanks : value,
                    }));
                    values.sort((a, b) => {
                        if (a.value === '' || b.value === '') return a.value === '' ? 1 : -1;
                        return dateColumn[col] ? parseDate(a.value) - parseDate(b.value) : collator.compare(a.value, b.value);
                    });
                    showPopover(button, {
                        index: col,
                        name,
                        values,
                        isDate: dateColumn[col],
                        filter: filters[col],
                        surface: cell,
                        onChange: applyFilters,
                        onSort: dir => setSort(col, dir),
                        onHide: () => setColumnHidden(col, true),
                    });
                });
                cell.appendChild(button);
            });

            status = el('div', {className: 'bte-status'});
            status.setAttribute('role', 'status');
            status.hidden = true;
            statusText = el('span');
            clearButton = el('button', {type: 'button', className: 'bte-clear', textContent: t.clear});
            clearButton.hidden = true;
            clearButton.addEventListener('click', () => {
                for (const f of filters) {
                    f.text = '';
                    f.selected = null;
                }
                applyFilters();
            });
            showAllButton = el('button', {type: 'button', className: 'bte-clear', textContent: t.showColumns});
            showAllButton.hidden = true;
            showAllButton.addEventListener('click', () => {
                for (const col of [...hiddenColumns]) setColumnHidden(col, false);
            });
            status.append(statusText, clearButton, showAllButton);
            if (config.export) {
                exportButton = el('button', {type: 'button', className: 'bte-clear bte-export', textContent: t.exportView});
                exportButton.addEventListener('click', () => {
                    const cols = headerCells.map((c, i) => i).filter(i => !hiddenColumns.has(i));
                    const header = cols.map(i => cellText(headerCells[i]));
                    const visible = currentOrder.filter(row => !row.tr.classList.contains('bte-hidden'));
                    exportCurrentView(table, header, visible.map(row => cols.map(i => row.texts[i])));
                });
                status.append(exportButton);
            }
            wrapper.after(status);
        }
    }

    function enhanceTable(table) {
        if (table.dataset.bteInit) return;
        if (table.matches(config.skipSelector) || table.closest(EDITOR_SELECTOR)) return;
        if (table.parentElement && table.parentElement.closest('table')) return; // nested table
        const info = analyse(table);
        if (!info || info.columnCount === 0) return;
        table.dataset.bteInit = '1';

        const wrapper = config.scroll ? enhanceScroll(table, info.columnCount) : table;
        const interactive = (config.sort || config.filter)
            && !info.hasRowspan
            && info.bodyRows.length >= config.minRows;
        if (interactive) {
            // The status line needs a wrapper even when scrolling is off.
            enhanceInteractive(table, config.scroll ? wrapper : wrapWithoutScroll(table), info);
        }
    }

    function wrapWithoutScroll(table) {
        const wrapper = document.createElement('div');
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        return wrapper;
    }

    function runViewer() {
        if (config.disableBodyClasses.some(cls => document.body.classList.contains(cls))) return;
        if (config.disableSortBodyClasses.some(cls => document.body.classList.contains(cls))) config.sort = false;
        if (config.disableFilterBodyClasses.some(cls => document.body.classList.contains(cls))) config.filter = false;
        const tables = document.querySelectorAll('.page-content table');
        if (tables.length === 0) return;
        injectStyles();
        tables.forEach(enhanceTable);
    }

    /* ---------------------------------------------------------------------------------------
     * Editing: tables with more than 10 columns
     * ------------------------------------------------------------------------------------- */

    const clamp = (value, max) => Math.max(1, Math.min(Number(value) || 1, max));

    // WYSIWYG Editor (TinyMCE): keep the 10 x 10 picker, add an "Advanced..." button under it that opens
    // TinyMCE's own size dialog (any number of columns and rows), and cap what that dialog can create.
    window.addEventListener('editor-tinymce::setup', event => {
        if (!config.editor.largeTables) return;
        const editor = event.detail.editor;
        injectStyles();

        editor.on('BeforeExecCommand', e => {
            if (e.command === 'mceInsertTable' && e.value && typeof e.value === 'object') {
                if (e.value.columns) e.value.columns = clamp(e.value.columns, config.editor.maxColumns);
                if (e.value.rows) e.value.rows = clamp(e.value.rows, config.editor.maxRows);
            }
        });

        // Add Cols and Rows to the properties dialog of an existing table.
        editor.on('init', () => {
            const windowManager = editor.windowManager;
            const open = windowManager.open;
            windowManager.open = function (spec, params) {
                return open.call(this, extendTablePropertiesDialog(editor, spec), params);
            };
        });

        // The picker is built each time the Table menu opens, so add the button as it appears.
        const addAdvancedButton = picker => {
            if (picker.dataset.bteAdvanced) return;
            picker.dataset.bteAdvanced = '1';
            const button = el('button', {type: 'button', className: 'bte-advanced', textContent: config.labels.advanced});
            // Keep focus in the editor so the menu logic is not disturbed by the click.
            button.addEventListener('mousedown', mouseEvent => mouseEvent.preventDefault());
            button.addEventListener('click', () => {
                // Close the Table menu first so it does not stay open behind the dialog.
                const menuButton = document.querySelector('.tox-tbtn[aria-expanded="true"]');
                if (menuButton) menuButton.click();
                editor.execCommand('mceInsertTableDialog');
            });
            picker.after(button);
        };
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches('.tox-insert-table-picker')) addAdvancedButton(node);
                    node.querySelectorAll('.tox-insert-table-picker').forEach(addAdvancedButton);
                }
            }
        });
        observer.observe(document.body, {childList: true, subtree: true});
        editor.on('remove', () => observer.disconnect());
    });

    /** Number of grid columns of a table (cells with a colspan count for every column they cover). */
    function tableColumnCount(table) {
        return Array.from(table.rows).reduce((max, row) => Math.max(max, rowWidth(row)), 0);
    }

    /** True when removing columns >= cols or rows >= rows would delete cells that hold content. */
    function resizeRemovesContent(table, cols, rows) {
        const hasContent = cell => cell.textContent.trim() !== '' || cell.querySelector('img, iframe, video, pre, table') !== null;
        return Array.from(table.rows).some((row, r) => {
            return Array.from(row.cells).some((cell, c) => (r >= rows || c >= cols) && hasContent(cell));
        });
    }

    /** Adds or removes columns and rows at the end of a table with TinyMCE's own commands (one undo step). */
    function resizeTable(editor, table, cols, rows) {
        const run = () => editor.undoManager.transact(() => {
            const put = cell => editor.selection.setCursorLocation(cell, 0);
            const firstRow = () => table.rows[0];
            const lastCellOf = row => row.cells[row.cells.length - 1];
            while (tableColumnCount(table) < cols) {
                put(lastCellOf(firstRow()));
                editor.execCommand('mceTableInsertColAfter');
            }
            while (tableColumnCount(table) > cols && firstRow().cells.length > 1) {
                put(lastCellOf(firstRow()));
                editor.execCommand('mceTableDeleteCol');
            }
            while (table.rows.length < rows) {
                put(table.rows[table.rows.length - 1].cells[0]);
                editor.execCommand('mceTableInsertRowAfter');
            }
            while (table.rows.length > rows && table.rows.length > 1) {
                put(table.rows[table.rows.length - 1].cells[0]);
                editor.execCommand('mceTableDeleteRow');
            }
            put(table.rows[0].cells[0]);
        });

        if (tableColumnCount(table) === cols && table.rows.length === rows) return;
        if (resizeRemovesContent(table, cols, rows)) {
            editor.windowManager.confirm(config.labels.removeContent, confirmed => { if (confirmed) run(); });
        } else {
            run();
        }
    }

    /**
     * TinyMCE builds its dialogs from a specification object. When it opens the properties dialog of an
     * existing table (the same General tab as the insert dialog, but without Cols and Rows), add those two
     * fields, pre-filled with the current size, and apply them after TinyMCE has applied its own settings.
     */
    function extendTablePropertiesDialog(editor, spec) {
        try {
            const general = spec && spec.body && spec.body.type === 'tabpanel' && spec.body.tabs && spec.body.tabs[0];
            const grid = general && general.items && general.items[0];
            if (!grid || grid.type !== 'grid' || !Array.isArray(grid.items)) return spec;
            const names = grid.items.map(item => item.name);
            if (!names.includes('width') || !names.includes('cellspacing') || names.includes('cols')) return spec;
            const table = editor.dom.getParent(editor.selection.getStart(), 'table');
            if (!table || table.rows.length === 0) return spec;

            grid.items.unshift(
                {type: 'input', name: 'cols', label: 'Cols', inputMode: 'numeric'},
                {type: 'input', name: 'rows', label: 'Rows', inputMode: 'numeric'},
            );
            spec.initialData = {...spec.initialData, cols: String(tableColumnCount(table)), rows: String(table.rows.length)};

            const originalSubmit = spec.onSubmit;
            spec.onSubmit = api => {
                const data = api.getData();
                originalSubmit(api);
                const cols = parseInt(data.cols, 10);
                const rows = parseInt(data.rows, 10);
                if (cols >= 1 && rows >= 1) {
                    resizeTable(editor, table, clamp(cols, config.editor.maxColumns), clamp(rows, config.editor.maxRows));
                }
            };
        } catch (error) {
            // Never break the properties dialog: fall back to TinyMCE's own version.
        }
        return spec;
    }

    // New WYSIWYG editor (Lexical): add an "Insert table" button that asks for a size.
    function openSizeDialog(api) {
        const t = config.labels;
        const {maxColumns, maxRows} = config.editor;
        injectStyles();

        const columns = el('input', {type: 'number', min: 1, max: maxColumns, value: 3});
        const rows = el('input', {type: 'number', min: 1, max: maxRows, value: 3});
        const cancel = el('button', {type: 'button', textContent: t.cancel});
        const insert = el('button', {type: 'submit', className: 'bte-primary', textContent: t.insert});
        const form = el('form', {className: 'bte-modal'}, [
            el('strong', {textContent: t.insertTable}),
            el('label', {}, [el('span', {textContent: `${t.columns} (1-${maxColumns})`}), columns]),
            el('label', {}, [el('span', {textContent: `${t.rows} (1-${maxRows})`}), rows]),
            el('div', {className: 'bte-actions'}, [cancel, insert]),
        ]);
        form.setAttribute('role', 'dialog');
        form.setAttribute('aria-label', t.insertTable);
        const backdrop = el('div', {className: 'bte-modal-backdrop'}, [form]);
        document.body.appendChild(backdrop);
        applySurface(form, document.body);

        const close = () => backdrop.remove();
        cancel.addEventListener('click', close);
        backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
        form.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const cols = clamp(columns.value, maxColumns);
            const rowCount = clamp(rows.value, maxRows);
            close();
            // Same default column width as the built-in table picker.
            const width = Math.min(Math.round(840 / cols), 240);
            const colgroup = '<colgroup>' + `<col style="width: ${width}px;">`.repeat(cols) + '</colgroup>';
            const row = '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>';
            api.content.insertHtml(`<table>${colgroup}<tbody>${row.repeat(rowCount)}</tbody></table>`);
        });
        columns.focus();
        columns.select();
    }

    /** Translate an English editor label the same way BookStack's own editor does. */
    const editorText = text => (window.editor_translations && window.editor_translations[text]) || text;

    /** A small yes/no dialog in the same style as the size dialog. Resolves true for Yes. */
    function confirmDialog(message) {
        injectStyles();
        return new Promise(resolve => {
            const yes = el('button', {type: 'submit', className: 'bte-primary', textContent: config.labels.yes});
            const no = el('button', {type: 'button', textContent: config.labels.no});
            const form = el('form', {className: 'bte-modal'}, [
                el('span', {textContent: message}),
                el('div', {className: 'bte-actions'}, [no, yes]),
            ]);
            form.setAttribute('role', 'alertdialog');
            const backdrop = el('div', {className: 'bte-modal-backdrop'}, [form]);
            document.body.appendChild(backdrop);
            applySurface(form, document.body);
            const done = value => { backdrop.remove(); resolve(value); };
            no.addEventListener('click', () => done(false));
            form.addEventListener('submit', event => { event.preventDefault(); done(true); });
            form.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); done(false); } });
            backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) done(false); });
            yes.focus();
        });
    }

    /** Covers the page and swallows key presses while a script-driven change is running. */
    function showBusy(message) {
        injectStyles();
        const card = el('div', {className: 'bte-modal', textContent: message});
        const backdrop = el('div', {className: 'bte-modal-backdrop bte-busy'}, [card]);
        backdrop.setAttribute('role', 'status');
        backdrop.setAttribute('aria-busy', 'true');
        const block = event => { event.preventDefault(); event.stopPropagation(); };
        document.body.appendChild(backdrop);
        applySurface(card, document.body);
        document.addEventListener('keydown', block, true);
        return {
            remove() {
                document.removeEventListener('keydown', block, true);
                backdrop.remove();
            },
        };
    }

    const LEXICAL_ROOT = '[component="wysiwyg-editor"] [contenteditable]';
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * The new editor has no public API for table structure, so an existing table is resized by moving the
     * selection into a cell and pressing the editor's own row and column buttons, as a user would.
     */
    async function resizeLexicalTable(table, cols, rows) {
        if (!table.isConnected) return;
        const root = table.closest('[contenteditable]');
        const selectCell = async cell => {
            root.focus();
            const range = document.createRange();
            range.selectNodeContents(cell.querySelector('p, span') || cell);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            document.dispatchEvent(new Event('selectionchange'));
            await sleep(80);
        };
        const press = async (label, cell) => {
            await selectCell(cell);
            const title = editorText(label);
            const button = Array.from(document.querySelectorAll('button[title]')).find(b => b.title === title && !b.disabled);
            if (!button) return false;
            button.click();
            await sleep(100);
            return true;
        };
        const lastCell = () => table.rows[0].cells[table.rows[0].cells.length - 1];
        const lastRowStart = () => table.rows[table.rows.length - 1].cells[0];

        if ((cols < tableColumnCount(table) || rows < table.rows.length) && resizeRemovesContent(table, cols, rows)) {
            if (!(await confirmDialog(config.labels.removeContent))) return;
        }
        const busy = showBusy(config.labels.updating);
        try {
            let guard = 0;
            while (table.isConnected && tableColumnCount(table) < cols && guard++ < 1000) {
                if (!(await press('Insert column after', lastCell()))) return;
            }
            while (table.isConnected && tableColumnCount(table) > cols && table.rows[0].cells.length > 1 && guard++ < 1000) {
                if (!(await press('Delete column', lastCell()))) return;
            }
            while (table.isConnected && table.rows.length < rows && guard++ < 1000) {
                if (!(await press('Insert row after', lastRowStart()))) return;
            }
            while (table.isConnected && table.rows.length > rows && table.rows.length > 1 && guard++ < 1000) {
                if (!(await press('Delete row', lastRowStart()))) return;
            }
            if (table.isConnected) await selectCell(table.rows[0].cells[0]);
        } finally {
            busy.remove();
        }
    }

    /** The table that holds the editor's current selection, if any. */
    function lexicalTableAtSelection() {
        const selection = window.getSelection();
        const node = selection && selection.anchorNode;
        const element = node && (node.nodeType === 1 ? node : node.parentElement);
        return element ? element.closest(LEXICAL_ROOT + ' table') : null;
    }

    /** Add Cols and Rows to the properties modal of an existing table. */
    function extendLexicalTableModal(modal, table) {
        const panel = modal.querySelector('.editor-form-tab-content');
        const form = modal.querySelector('form');
        if (!panel || !form || !table || panel.dataset.bteRows) return;
        // The table properties form has a "cell_spacing" field; the cell and row forms do not.
        if (!panel.querySelector('input[name="cell_spacing"]')) return;
        panel.dataset.bteRows = '1';

        const field = (name, label, value) => {
            const id = 'editor-form-field-' + name + '-' + Date.now();
            const input = el('input', {id, name, className: 'editor-form-field-input', value: String(value)});
            input.setAttribute('inputmode', 'numeric');
            const wrapper = el('div', {className: 'editor-form-field-wrapper'}, [
                el('label', {className: 'editor-form-field-label', htmlFor: id, textContent: editorText(label)}),
                input,
            ]);
            return {wrapper, input};
        };
        const cols = field('bte_cols', 'Cols', tableColumnCount(table));
        const rows = field('bte_rows', 'Rows', table.rows.length);
        panel.prepend(cols.wrapper, rows.wrapper);

        // Capture phase, so the values are read before the modal closes. Resize once the editor has applied
        // its own property changes.
        form.addEventListener('submit', () => {
            const c = parseInt(cols.input.value, 10);
            const r = parseInt(rows.input.value, 10);
            if (!(c >= 1 && r >= 1)) return;
            const targetCols = clamp(c, config.editor.maxColumns);
            const targetRows = clamp(r, config.editor.maxRows);
            setTimeout(() => resizeLexicalTable(table, targetCols, targetRows), 250);
        }, true);
    }

    /** Add an "Advanced..." button under the size display of the new editor's table grid. */
    function addLexicalAdvancedButton(creator, api) {
        if (creator.dataset.bteAdvanced) return;
        creator.dataset.bteAdvanced = '1';
        const button = el('button', {type: 'button', className: 'bte-advanced', textContent: config.labels.advanced});
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', () => {
            // The editor closes its menus on a click outside them, so send one to dismiss the Table menu.
            document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
            openSizeDialog(api);
        });
        creator.append(button);
    }

    function watchLexicalUi(api) {
        injectStyles();
        // Remember which table the properties action was started from: the modal takes focus when it opens.
        let propertiesTable = null;
        const remember = event => {
            const button = event.target.closest && event.target.closest('button[title]');
            if (button && button.title === editorText('Table properties')) propertiesTable = lexicalTableAtSelection();
        };
        document.addEventListener('mousedown', remember, true);
        document.addEventListener('click', remember, true);

        const inspect = node => {
            if (node.nodeType !== 1) return;
            const creators = node.matches('.editor-table-creator') ? [node] : Array.from(node.querySelectorAll('.editor-table-creator'));
            creators.forEach(creator => addLexicalAdvancedButton(creator, api));
            const modals = node.matches('.editor-modal-wrapper') ? [node] : Array.from(node.querySelectorAll('.editor-modal-wrapper'));
            modals.forEach(modal => extendLexicalTableModal(modal, propertiesTable));
        };
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) mutation.addedNodes.forEach(inspect);
        });
        observer.observe(document.body, {childList: true, subtree: true});
        inspect(document.body);
    }

    window.addEventListener('editor-wysiwyg::post-init', event => {
        const {usage, api} = event.detail;
        if (usage !== 'page-editor' || !config.editor.largeTables) return;
        const button = api.ui.createButton({
            label: config.labels.insertTable,
            icon: TABLE_SVG.replace('<svg ', '<svg fill="currentColor" '),
            action: () => openSizeDialog(api),
        });
        const toolbar = api.ui.getMainToolbar();
        const sections = toolbar ? toolbar.getSections() : [];
        // Sections collapse extra buttons into a "More" menu, so insert next to the built-in
        // link and table controls (positions 0 and 1) rather than appending to the end.
        const section = sections.find(s => s.getLabel() === 'inserts') || sections[sections.length - 1];
        if (section) {
            section.addButton(button, 2);
        }
        watchLexicalUi(api);
    });

    /* ---------------------------------------------------------------------------------------
     * Start
     * ------------------------------------------------------------------------------------- */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runViewer);
    } else {
        runViewer();
    }
})();
