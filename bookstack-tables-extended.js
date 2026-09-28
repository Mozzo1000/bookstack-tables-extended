/*!
 * BookStack Tables Extended
 *
 * Viewing a page: adds column sorting, Excel-style column filters and horizontal scrolling to
 * tables. Display-only: saved page content is never modified.
 * Editing a page: lets the editor create tables with more than 10 columns (configurable) and change the
 * number of columns and rows of an existing table from its properties dialog (WYSIWYG Editor).
 *
 * Install: Settings > Customization > Custom HTML Head Content
 *   <script src="/bookstack-tables-extended.js"></script>
 * or paste this file's contents between <script> and </script> tags.
 *
 * Optional configuration, defined in a <script> tag placed BEFORE this one:
 *   window.BookStackTablesExtended = { minColumnWidth: 160, editor: { maxColumns: 30 } };
 */
(function () {
    'use strict';

    if (window.__bookStackTablesExtendedLoaded) {
        return;
    }
    window.__bookStackTablesExtendedLoaded = true;

    const userConfig = window.BookStackTablesExtended || {};
    const config = {
        // Enable/disable individual viewing features.
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
        // Columns with more distinct values than this show the search box only, without a checklist.
        maxListValues: 200,
        ...userConfig,
        editor: {
            // Let editors create tables larger than the built-in 10 x 10 picker allows.
            largeTables: true,
            // Largest table that can be created in one step (columns can still be added afterwards).
            maxColumns: 50,
            maxRows: 200,
            ...(userConfig.editor || {}),
        },
        labels: {
            filterColumn: name => (name ? `Filter: ${name}` : 'Filter column'),
            sortAscending: 'Sort ascending',
            sortDescending: 'Sort descending',
            search: 'Search',
            selectAll: '(Select all)',
            blanks: '(Blanks)',
            noValues: 'No matching values',
            clearFilter: 'Clear filter',
            clear: 'Clear filters',
            showing: (shown, total) => `Showing ${shown} of ${total} rows`,
            noMatches: 'No matching rows',
            insertTable: 'Insert table (custom size)',
            advanced: 'Advanced…',
            removeContent: 'Making the table smaller removes cells that contain content. Continue?',
            columns: 'Columns',
            rows: 'Rows',
            insert: 'Insert',
            cancel: 'Cancel',
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
.bte-sortable:focus-visible, .bte-fbtn:focus-visible, .bte-clear:focus-visible {
    outline: 2px solid var(--color-primary, #206ea7); outline-offset: -2px;
}
.bte-ind { display: inline-block; margin-left: .4em; font-size: .75em; opacity: .35; }
.bte-ind::after { content: "\\2195"; }
[aria-sort="ascending"] > .bte-ind, [aria-sort="descending"] > .bte-ind { opacity: 1; color: var(--color-primary, #206ea7); }
[aria-sort="ascending"] > .bte-ind::after { content: "\\25B2"; }
[aria-sort="descending"] > .bte-ind::after { content: "\\25BC"; }
.bte-fbtn {
    display: inline-block; margin: 0 0 0 .3em; padding: 2px; vertical-align: middle; line-height: 1;
    color: inherit; background: none; border: 0; border-radius: 3px; opacity: .4; cursor: pointer;
}
.bte-fbtn:hover, .bte-fbtn[aria-expanded="true"] { opacity: 1; }
.bte-fbtn.bte-active { opacity: 1; color: var(--color-primary, #206ea7); }
.bte-fbtn svg { display: block; width: 12px; height: 12px; fill: currentColor; }
.bte-hidden { display: none !important; }
.bte-status { display: flex; gap: .75em; align-items: center; margin: .35em 0 1em; font-size: .85em; opacity: .85; }
.bte-clear {
    font: inherit; color: var(--color-link, var(--color-primary, #206ea7)); background: none;
    border: 0; padding: 0; cursor: pointer; text-decoration: underline;
}
.bte-pop, .bte-modal {
    box-sizing: border-box; font-size: 14px; line-height: 1.4; text-align: left; font-weight: normal;
    border: 1px solid rgba(128, 128, 128, .55); border-radius: 6px; box-shadow: 0 4px 16px rgba(0, 0, 0, .25);
}
.bte-pop { position: fixed; z-index: 10000; width: 250px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.bte-pop button.bte-item {
    font: inherit; color: inherit; background: none; border: 0; border-radius: 4px;
    padding: 5px 6px; text-align: left; cursor: pointer;
}
.bte-pop button.bte-item:hover, .bte-pop button.bte-item:focus-visible { background: rgba(128, 128, 128, .22); outline: none; }
.bte-pop hr { width: 100%; margin: 0; border: 0; border-top: 1px solid rgba(128, 128, 128, .4); }
.bte-pop input[type="search"], .bte-modal input[type="number"] {
    box-sizing: border-box; width: 100%; margin: 0; padding: 5px 7px; font: inherit; color: inherit;
    background: transparent; border: 1px solid rgba(128, 128, 128, .6); border-radius: 4px;
}
.bte-list { overflow-y: auto; display: flex; flex-direction: column; }
.bte-list label { display: flex; gap: 6px; align-items: center; padding: 3px 4px; cursor: pointer; border-radius: 3px; }
.bte-list label:hover { background: rgba(128, 128, 128, .18); }
.bte-list input { margin: 0; }
.bte-list .bte-val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bte-list .bte-count { opacity: .6; font-size: .85em; }
.bte-empty { padding: 4px 6px; opacity: .7; }
/* TinyMCE's skin resets buttons with a more specific selector, so this one is qualified with .tox. */
.tox button.bte-advanced {
    display: block; box-sizing: border-box; width: 100%; margin: 6px 0 0; padding: 7px 8px;
    font: inherit; font-size: 14px; text-align: center; color: inherit; background: none;
    border: 0; border-top: 1px solid rgba(128, 128, 128, .4); cursor: pointer;
}
.tox button.bte-advanced:hover, .tox button.bte-advanced:focus-visible { background: rgba(128, 128, 128, .22); outline: none; }
.bte-modal-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .4); }
.bte-modal { width: 280px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.bte-modal label { display: flex; flex-direction: column; gap: 3px; }
.bte-modal .bte-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.bte-modal button {
    font: inherit; color: inherit; padding: 6px 14px; cursor: pointer; background: transparent;
    border: 1px solid rgba(128, 128, 128, .6); border-radius: 4px;
}
.bte-modal button.bte-primary { color: #fff; background: var(--color-primary, #206ea7); border-color: var(--color-primary, #206ea7); }
@media print {
    .bte-fbtn, .bte-status, .bte-ind { display: none !important; }
    .bte-scroll { overflow: visible; }
}`;

    const FUNNEL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>';
    // A small table with a plus badge, so it reads differently from the built-in table icon.
    const TABLE_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h14v8h-2V6H5v8h6v2H3zM9 6h2v8H9zM5 9h10v2H5zM17 14h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>';

    function injectStyles() {
        if (document.getElementById('bte-styles')) return;
        const style = document.createElement('style');
        style.id = 'bte-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

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
     * `column` is {index, name, values: [{value, label, count}], filter: {text, selected}, surface, onChange, onSort}
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
        sortAsc.addEventListener('click', () => { column.onSort('ascending'); closePopover(true); });
        sortDesc.addEventListener('click', () => { column.onSort('descending'); closePopover(true); });

        const clear = el('button', {type: 'button', className: 'bte-item', textContent: t.clearFilter});
        const useList = column.values.length > 0 && column.values.length <= config.maxListValues;

        const isChecked = value => filter.selected === null || filter.selected.has(value);
        const visibleValues = () => {
            const needle = search.value.trim().toLowerCase();
            return column.values.filter(v => needle === '' || v.value.toLowerCase().includes(needle));
        };

        const renderList = () => {
            list.textContent = '';
            if (!useList) return;
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
            for (const v of visible) {
                const box = el('input', {type: 'checkbox'});
                box.checked = isChecked(v.value);
                box.addEventListener('change', () => {
                    const selected = filter.selected === null ? new Set(column.values.map(x => x.value)) : filter.selected;
                    if (box.checked) selected.add(v.value); else selected.delete(v.value);
                    filter.selected = selected.size === column.values.length ? null : selected;
                    column.onChange();
                    syncAll();
                });
                const label = el('label', {}, [
                    box,
                    el('span', {className: 'bte-val', textContent: v.label, title: v.label}),
                    el('span', {className: 'bte-count', textContent: String(v.count)}),
                ]);
                list.append(label);
            }
        };

        search.addEventListener('input', () => {
            filter.text = search.value.trim().toLowerCase();
            column.onChange();
            renderList();
        });
        clear.addEventListener('click', () => {
            filter.text = '';
            filter.selected = null;
            search.value = '';
            column.onChange();
            renderList();
            search.focus();
        });

        node.append(sortAsc, sortDesc, el('hr'), search);
        if (useList) node.append(list);
        node.append(el('hr'), clear);
        renderList();

        document.body.appendChild(node);
        applySurface(node, column.surface);

        // Position below the button, kept inside the viewport. Closes if the button scrolls out of view.
        const place = () => {
            const rect = button.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                closePopover(false);
                return;
            }
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - node.offsetWidth - 8));
            const top = rect.bottom + 4;
            node.style.left = left + 'px';
            node.style.top = top + 'px';
            list.style.maxHeight = Math.max(120, Math.min(260, window.innerHeight - top - 150)) + 'px';
        };
        place();

        const onDocClick = event => {
            if (!node.contains(event.target) && !button.contains(event.target)) closePopover(false);
        };
        const onKey = event => {
            if (event.key === 'Escape') { event.stopPropagation(); closePopover(true); }
        };
        const onScroll = event => {
            if (!node.contains(event.target)) place();
        };
        const onResize = place;
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
     * Viewing: sorting and filtering for one table
     * ------------------------------------------------------------------------------------- */

    function enhanceInteractive(table, wrapper, info) {
        const {headerRow, bodyRows, columnCount} = info;
        const t = config.labels;
        const rows = bodyRows.map((tr, index) => {
            const cells = rowToColumns(tr, columnCount);
            const texts = cells.map(cellText);
            return {tr, texts, lower: texts.map(x => x.toLowerCase()), index};
        });

        // A column is numeric when every non-empty cell parses as a number.
        const numericColumn = Array.from({length: columnCount}, (_, col) => {
            const values = rows.map(r => r.texts[col]).filter(x => x !== '');
            return values.length > 0 && values.every(x => parseNumber(x) !== null);
        });

        const headerCells = rowToColumns(headerRow, columnCount);
        const filters = Array.from({length: columnCount}, () => ({text: '', selected: null}));
        const funnels = new Array(columnCount).fill(null);
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
                status.hidden = !filters.some(isActive);
                statusText.textContent = shown === 0 ? t.noMatches : t.showing(shown, rows.length);
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
                        return collator.compare(a.value, b.value);
                    });
                    showPopover(button, {
                        index: col,
                        name,
                        values,
                        filter: filters[col],
                        surface: cell,
                        onChange: applyFilters,
                        onSort: dir => setSort(col, dir),
                    });
                });
                cell.appendChild(button);
            });

            status = el('div', {className: 'bte-status'});
            status.setAttribute('role', 'status');
            status.hidden = true;
            statusText = el('span');
            const clear = el('button', {type: 'button', className: 'bte-clear', textContent: t.clear});
            clear.addEventListener('click', () => {
                for (const f of filters) {
                    f.text = '';
                    f.selected = null;
                }
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
