/*!
 * BookStack Tables Extended
 * Adds column sorting, per-column filtering and horizontal scrolling to tables
 * in BookStack page content. Display-only: saved page content is never modified.
 *
 * Install: Settings > Customization > Custom HTML Head Content
 *   <script src="/bookstack-tables-extended.js"></script>
 * or paste this file's contents between <script> and </script> tags.
 *
 * Optional configuration, defined in a <script> tag placed BEFORE this one:
 *   window.BookStackTablesExtended = { minColumnWidth: 160, filter: false };
 */
(function () {
    'use strict';

    if (window.__bookStackTablesExtendedLoaded) {
        return;
    }
    window.__bookStackTablesExtendedLoaded = true;

    const userConfig = window.BookStackTablesExtended || {};
    const config = {
        // Enable/disable individual features.
        sort: true,
        filter: true,
        scroll: true,
        // Minimum width (px) of each column before the table scrolls horizontally.
        minColumnWidth: 120,
        // Tables with fewer body rows than this are left alone (scrolling still applies).
        minRows: 2,
        // Tables matching this selector are left completely untouched.
        skipSelector: '.bte-skip, [data-bte="off"]',
        // If <body> has any of these classes (generated from page tags) the page is skipped.
        // BookStack strips non-alphanumeric characters from tag class names, so:
        // tag "tablesextended" with value "off" => "tag-pair-tablesextended-off",
        // tag "tablesextendedoff" with no value => "tag-name-tablesextendedoff".
        disableBodyClasses: ['tag-pair-tablesextended-off', 'tag-name-tablesextendedoff'],
        ...userConfig,
        labels: {
            filter: 'Filter',
            clear: 'Clear filters',
            showing: (shown, total) => `Showing ${shown} of ${total} rows`,
            noMatches: 'No matching rows',
            ...(userConfig.labels || {}),
        },
    };

    const EDITOR_SELECTOR = '[contenteditable], .editor-container, [component="wysiwyg-editor"], [component="markdown-editor"]';
    const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

    const CSS = `
.bte-scroll { overflow-x: auto; max-width: 100%; }
.bte-scroll > table { max-width: none; table-layout: fixed; }
.bte-scroll > table:not([style*="width"]):not([width]) { width: 100%; }
.bte-sortable { cursor: pointer; user-select: none; }
.bte-sortable:focus-visible, .bte-filter-row input:focus-visible, .bte-clear:focus-visible {
    outline: 2px solid var(--color-primary, #206ea7); outline-offset: -2px;
}
.bte-ind { display: inline-block; margin-left: .4em; font-size: .75em; opacity: .35; }
.bte-ind::after { content: "\\2195"; }
[aria-sort="ascending"] > .bte-ind, [aria-sort="descending"] > .bte-ind { opacity: 1; color: var(--color-primary, #206ea7); }
[aria-sort="ascending"] > .bte-ind::after { content: "\\25B2"; }
[aria-sort="descending"] > .bte-ind::after { content: "\\25BC"; }
.bte-filter-row > td { padding: 4px; }
.bte-filter-row input {
    box-sizing: border-box; width: 100%; min-width: 0; margin: 0; padding: .25em .4em;
    font: inherit; font-size: .85em; color: inherit; background: transparent;
    border: 1px solid rgba(128, 128, 128, .55); border-radius: 3px;
}
.bte-hidden { display: none !important; }
.bte-status { display: flex; gap: .75em; align-items: center; margin: .35em 0 1em; font-size: .85em; opacity: .85; }
.bte-clear {
    font: inherit; color: var(--color-link, var(--color-primary, #206ea7)); background: none;
    border: 0; padding: 0; cursor: pointer; text-decoration: underline;
}
@media print {
    .bte-filter-row, .bte-status, .bte-ind { display: none !important; }
    .bte-scroll { overflow: visible; }
}`;

    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'bte-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

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
                && !(row.parentElement && row.parentElement.tagName === 'TFOOT')
                && !row.classList.contains('bte-filter-row');
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

    function enhanceInteractive(table, wrapper, info) {
        const {headerRow, bodyRows, columnCount} = info;
        const rows = bodyRows.map((tr, index) => {
            const cells = rowToColumns(tr, columnCount);
            const texts = cells.map(cellText);
            return {tr, texts, lower: texts.map(t => t.toLowerCase()), index};
        });

        // A column is numeric when every non-empty cell parses as a number.
        const numericColumn = Array.from({length: columnCount}, (_, col) => {
            const values = rows.map(r => r.texts[col]).filter(t => t !== '');
            return values.length > 0 && values.every(t => parseNumber(t) !== null);
        });

        const headerCells = rowToColumns(headerRow, columnCount);
        const filters = new Array(columnCount).fill('');
        let sortState = {col: -1, dir: 'none'};
        let status = null;
        let statusText = null;

        const parent = rows[0].tr.parentNode;

        function render() {
            const ordered = rows.slice();
            if (sortState.dir !== 'none') {
                const {col, dir} = sortState;
                const factor = dir === 'ascending' ? 1 : -1;
                const numeric = numericColumn[col];
                ordered.sort((a, b) => {
                    const ta = a.texts[col];
                    const tb = b.texts[col];
                    if (ta === '' || tb === '') {
                        // Blank cells always sort last, whatever the direction.
                        return ta === tb ? a.index - b.index : (ta === '' ? 1 : -1);
                    }
                    const result = numeric ? parseNumber(ta) - parseNumber(tb) : collator.compare(ta, tb);
                    return result * factor || a.index - b.index;
                });
            } else {
                ordered.sort((a, b) => a.index - b.index);
            }
            for (const row of ordered) {
                parent.appendChild(row.tr);
            }
        }

        function applyFilters() {
            let shown = 0;
            for (const row of rows) {
                const match = filters.every((f, col) => f === '' || row.lower[col].includes(f));
                row.tr.classList.toggle('bte-hidden', !match);
                if (match) shown++;
            }
            if (status) {
                const active = filters.some(f => f !== '');
                status.hidden = !active;
                statusText.textContent = shown === 0 ? config.labels.noMatches : config.labels.showing(shown, rows.length);
            }
        }

        if (config.sort) {
            headerCells.forEach((cell, col) => {
                if (!cell) return;
                cell.classList.add('bte-sortable');
                cell.tabIndex = 0;
                cell.setAttribute('role', 'columnheader');
                cell.setAttribute('aria-sort', 'none');
                const indicator = document.createElement('span');
                indicator.className = 'bte-ind';
                indicator.setAttribute('aria-hidden', 'true');
                cell.appendChild(indicator);
            });

            const toggle = cell => {
                const col = headerCells.indexOf(cell);
                if (col < 0) return;
                const next = sortState.col === col
                    ? {none: 'ascending', ascending: 'descending', descending: 'none'}[sortState.dir]
                    : 'ascending';
                sortState = {col, dir: next};
                for (const c of headerCells) {
                    if (c) c.setAttribute('aria-sort', 'none');
                }
                cell.setAttribute('aria-sort', next);
                render();
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
            const filterRow = document.createElement('tr');
            filterRow.className = 'bte-filter-row';
            let timer = null;
            for (let col = 0; col < columnCount; col++) {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'search';
                input.placeholder = config.labels.filter;
                const headerLabel = cellText(headerCells[col]);
                input.setAttribute('aria-label', headerLabel ? `${config.labels.filter}: ${headerLabel}` : config.labels.filter);
                input.addEventListener('input', () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        filters[col] = input.value.trim().toLowerCase();
                        applyFilters();
                    }, 120);
                });
                td.appendChild(input);
                filterRow.appendChild(td);
            }
            headerRow.parentNode.insertBefore(filterRow, headerRow.nextSibling);

            status = document.createElement('div');
            status.className = 'bte-status';
            status.setAttribute('role', 'status');
            status.hidden = true;
            statusText = document.createElement('span');
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'bte-clear';
            clear.textContent = config.labels.clear;
            clear.addEventListener('click', () => {
                filters.fill('');
                filterRow.querySelectorAll('input').forEach(i => { i.value = ''; });
                applyFilters();
            });
            status.append(statusText, clear);
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
            // Interactive features need a wrapper for the status line even when scrolling is off.
            enhanceInteractive(table, config.scroll ? wrapper : wrapWithoutScroll(table), info);
        }
    }

    function wrapWithoutScroll(table) {
        const wrapper = document.createElement('div');
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        return wrapper;
    }

    function run() {
        if (config.disableBodyClasses.some(cls => document.body.classList.contains(cls))) return;
        const tables = document.querySelectorAll('.page-content table');
        if (tables.length === 0) return;
        injectStyles();
        tables.forEach(enhanceTable);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
