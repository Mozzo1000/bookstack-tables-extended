const userConfig = window.BookStackTablesExtended || {};

export const config = {
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
    // Same idea, but turns off only sorting or only filtering for the page, leaving the other on.
    disableSortBodyClasses: ['tag-pair-tablesextendedsort-off', 'tag-name-tablesextendedsortoff'],
    disableFilterBodyClasses: ['tag-pair-tablesextendedfilter-off', 'tag-name-tablesextendedfilteroff'],
    // The checklist in a column's filter menu is built in batches of this size, with a
    // "Load more" button for the rest, so columns with many distinct values stay responsive.
    maxListValues: 300,
    // Show "Export current view" next to "Clear filters" while a filter is active.
    export: true,
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
        hideColumn: 'Hide column',
        showColumns: 'Show all columns',
        loadMore: remaining => `Load more (${remaining} left)`,
        exportView: 'Export current view',
        showing: (shown, total) => `Showing ${shown} of ${total} rows`,
        noMatches: 'No matching rows',
        insertTable: 'Insert table (custom size)',
        advanced: 'Advanced...',
        removeContent: 'Making the table smaller removes cells that contain content. Continue?',
        yes: 'Yes',
        no: 'No',
        updating: 'Updating table…',
        columns: 'Columns',
        rows: 'Rows',
        insert: 'Insert',
        cancel: 'Cancel',
        ...(userConfig.labels || {}),
    },
};