# BookStack Tables Extended

A script for [BookStack](https://www.bookstackapp.com) that adds sorting, Excel-style column filtering and horizontal scrolling to the tables on your pages, and lets editors create tables with more than 10 columns.

> **Disclaimer**
>
> Custom HTML head scripts like this one are **not officially supported by BookStack**. They depend on BookStack's internal page markup and styling, which is not a stable interface, so this script **may break without notice in future BookStack releases**.
>
> Only use this script with the BookStack versions listed under [Supported BookStack versions](#supported-bookstack-versions). Other versions have not been tested and are not supported by this project, and issues raised for unsupported versions will not be accepted.
>
> **Never report problems with this script to the BookStack project.** BookStack does not support it. If BookStack behaves unexpectedly, remove the script from Custom HTML Head Content and check again before contacting BookStack about anything.

## Features

**When viewing a page**

- **Sort by column.** Select a column heading to sort ascending, select it again for descending, and a third time to return to the original order. Headings are also reachable with the keyboard (Tab, then Enter or Space).
- **Filter by column.** Each heading has a small funnel button. It opens a menu with sort options, a search box and a checklist of the values in that column, like a spreadsheet filter. The search matches text anywhere in a cell and ignores case. Filters in several columns combine. The funnel is highlighted while a filter is active, and a line under the table shows how many rows match, with a link to clear all filters.
- **Horizontal scroll.** Each column keeps a minimum width (120 px by default). Tables with more columns than fit on screen scroll sideways inside the page instead of squeezing every column.
- **Understands your data.** Columns of numbers sort numerically, including values like `1,200`, `$5.50` and `12%`. Text sorts alphabetically without regard to case, and `Item 9` sorts before `Item 10`. Empty cells always sort last.
- **Display only.** Sorting and filtering change what you see in the browser. They never change the saved page, and they reset when the page reloads.
- **Works on every table automatically.** Every table in viewed page content is enhanced, whether the page was written in the WYSIWYG Editor or the new WYSIWYG. Tables inside other tables are left alone.
- **Follows your theme.** Colours come from your BookStack theme, so the script works in light and dark mode.

**When editing a page**

- **Tables wider than 10 columns.** BookStack's editors offer a 10 by 10 grid for new tables. With this script, the WYSIWYG Editor keeps that grid and adds an **Advanced…** button under it that asks for the number of columns and rows, and the new WYSIWYG gets an extra toolbar button for the same purpose. The largest table that can be created in one step is configurable (50 columns by 200 rows by default). See [Editors](#editors).
- **Changing the size of an existing table.** In the WYSIWYG Editor, **Table > Table properties** also shows **Cols** and **Rows**, filled in with the table's current size. Changing them adds or removes columns and rows at the end of the table.

## Supported BookStack versions

This script is tested against the exact BookStack releases below. **Use it only with these releases.** Any other release, including other patch releases of the same version line, is unsupported.

| BookStack release | Viewing pages from either editor | Larger tables in the WYSIWYG Editor | Larger tables in the new WYSIWYG (beta) |
| ----------------- | -------------------------------- | ----------------------------------- | --------------------------------------- |
| v23.05            | Supported                        | Not supported                       | Not available in this release           |
| v23.12.3          | Supported                        | Not supported                       | Not available in this release           |
| v24.02.3          | Supported                        | Not supported                       | Not available in this release           |
| v26.09            | Supported                        | Supported                           | Supported                               |

Releases that are not listed are unsupported, including every other release between and after these, and every release older than v23.05.

When a new BookStack release comes out, keep running the version you have listed here until this table lists the new release.

## Editors

BookStack has two visual editors. Choose the default under **Settings > Customization > Default Page Editor**, or switch a single page with **Switch to new WYSIWYG** while editing it.

The script works with pages saved by either editor, and viewing behaves identically. While editing, the script leaves the page content alone. The only change to the editing screen is the table size feature described below.

| | WYSIWYG Editor | new WYSIWYG (beta) |
| --- | --- | --- |
| Available in | All supported releases | v24.10.3 and later |
| How a header row is stored | A separate header section. The script uses the last row of that section as the headings. | Heading cells in the first row of the table. The script uses the first row as the headings. |
| Tables without a header row | The first row is used as the headings. | The first row is used as the headings. |
| Creating a table | **Table > Table** shows the usual 10 by 10 grid. An **Advanced…** button under the size label opens a dialog asking for columns and rows. | The built-in 10 by 10 grid stays. A second toolbar button, **Insert table (custom size)**, next to the built-in table button asks for columns and rows. |
| Size limit when creating | Columns and rows are capped at the configured maximum. | The dialog refuses sizes above the configured maximum. |
| Changing the size of an existing table | **Table > Table properties** has **Cols** and **Rows**. Growing adds empty columns and rows at the end. Shrinking removes them from the end and asks first if any removed cell has content. The whole change is one undo step. | Use the editor's own insert and delete row and column actions. Its table properties dialog has no column or row count. |
| Requires | Nothing extra | The editor hooks that BookStack provides from v25.12 onwards. |
| Viewing | Identical | Identical |

Columns and rows can also be added to an existing table at any time with the editor's own insert column and insert row actions. The maximum applies only to creating a table in one step.

Pages written in the Markdown editor are not covered by this project's tests.

## Installation

1. Sign in to BookStack as an administrator.
2. Go to **Settings > Customization**.
3. In **Custom HTML Head Content**, add the script using one of these methods:
   - **Paste it.** Open `bookstack-tables-extended.js`, copy the whole file, and paste it between `<script>` and `</script>` tags.
   - **Serve it.** Copy `bookstack-tables-extended.js` into BookStack's `public` folder and add `<script src="/bookstack-tables-extended.js"></script>`.
4. Save the settings and reload a page that contains a table.

Custom HTML Head Content is not applied on the Settings pages, so check the result on a normal page.

## Configuration

To change a default, define `window.BookStackTablesExtended` in a `<script>` tag placed **before** the script:

```html
<script>
    window.BookStackTablesExtended = {
        minColumnWidth: 160,
        filter: false,
        editor: {
            maxColumns: 30,
        },
    };
</script>
<script src="/bookstack-tables-extended.js"></script>
```

| Option                | Default                         | Description                                                                                  |
| --------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `sort`                | `true`                          | Turns column sorting on or off.                                                              |
| `filter`              | `true`                          | Turns the column filter buttons on or off.                                                   |
| `scroll`              | `true`                          | Turns horizontal scrolling on or off.                                                        |
| `minColumnWidth`      | `120`                           | Minimum column width in pixels before a table scrolls sideways.                              |
| `minRows`             | `2`                             | Tables with fewer body rows get horizontal scrolling only, without sorting or filtering.     |
| `maxListValues`       | `200`                           | A column with more distinct values than this shows the search box without the checklist.     |
| `skipSelector`        | `'.bte-skip, [data-bte="off"]'` | CSS selector for tables that are left completely alone.                                      |
| `editor.largeTables`  | `true`                          | Turns the larger table support in the editors on or off.                                     |
| `editor.maxColumns`   | `50`                            | Most columns that can be created in one step.                                                |
| `editor.maxRows`      | `200`                           | Most rows that can be created in one step.                                                   |
| `labels`              | English text                    | Text shown in the interface. See the list below.                                             |

Set `editor: {largeTables: false}` to leave both editors exactly as BookStack ships them.

The keys of `labels` are `filterColumn(name)`, `sortAscending`, `sortDescending`, `search`, `selectAll`, `blanks`, `noValues`, `clearFilter`, `clear`, `showing(shown, total)`, `noMatches`, `advanced`, `removeContent`, `insertTable`, `columns`, `rows`, `insert` and `cancel`. Any key you leave out keeps its English text. Example of translating part of the interface:

```html
<script>
    window.BookStackTablesExtended = {
        labels: {
            sortAscending: 'Aufsteigend sortieren',
            sortDescending: 'Absteigend sortieren',
            search: 'Suchen',
            clearFilter: 'Filter zurücksetzen',
            clear: 'Alle Filter zurücksetzen',
            showing: (shown, total) => `${shown} von ${total} Zeilen`,
            noMatches: 'Keine passenden Zeilen',
        },
    };
</script>
```

## Turning the script off for a page

Add a tag to the page with the name `tablesextended` and the value `off`. The script leaves every table on that page alone when the page is viewed.

BookStack removes punctuation from tag names when it builds the page's CSS classes, so the name has no hyphen. A tag named `tablesextendedoff` with no value has the same effect.

The tag does not affect the editing features. Use `editor.largeTables` to turn those off.

## How tables are read

- **Header row.** If the table has a header section, its last row is the header. Otherwise the first row is the header.
- **Body rows.** Every other row, except rows in a table footer, can be sorted and filtered.
- **Numbers.** A column sorts numerically when every non-empty cell in it is a number. Currency symbols (`$ € £ ¥`), `%` and thousands separators (`1,200`) are accepted. A dot is the decimal separator.
- **Dates.** Dates sort as text, so use the `YYYY-MM-DD` format if a date column needs to sort chronologically.
- **Filter checklist.** Values are compared as the text shown in the cell. Empty cells appear as **(Blanks)**.

## Known limitations

- Tables with merged cells that span several rows (`rowspan`) get horizontal scrolling only. Sorting and filtering are switched off for them.
- In a cell that spans several columns (`colspan`), the cell belongs to the first column it covers for sorting and filtering.
- A table without a designated header row uses its first row as the header, so that row cannot be sorted or filtered as data.
- Numbers written with a decimal comma (`1,5`) are not read as numbers.
- Sorting and filtering are not saved. They reset when the page is reloaded and do not appear in exports or printouts.
- The filter search matches text only. Operators such as `>5` are not interpreted.
- Tables that are added to the page after it has loaded are not enhanced.
- Changing **Cols** or **Rows** in the table properties of the WYSIWYG Editor always works from the end of the table. Removing a column or row in the middle uses the editor's own delete column and delete row actions.
- In a table with merged cells, the Cols and Rows fields follow the editor's own insert and delete column and row commands, which may adjust merged cells.
- The Cols and Rows fields in table properties are not available in the new WYSIWYG.
- In the new WYSIWYG, the size limit is enforced by the dialog. A table inserted some other way, for example by pasting, is not limited.

## Testing with Docker

`docker-compose.yml` starts a disposable BookStack with the script already served from its web root. Nothing in it is meant for production use.

```sh
docker compose up -d
```

1. Open <http://localhost:6875> and sign in with `admin@admin.com` and `password`. The first start takes a minute while the database is prepared.
2. Go to **Settings > Customization** and set **Custom HTML Head Content** to `<script src="/bookstack-tables-extended.js"></script>`.
3. Create a page with a table and view it. The file `tables-test.md` contains ready-made Markdown tables to paste into a page.

The container reads `bookstack-tables-extended.js` directly from this folder, so edits apply the next time a page loads (hard-refresh to bypass the browser cache).

To test a specific BookStack release, set `BOOKSTACK_VERSION` to an image tag from the [linuxserver/bookstack tag list](https://github.com/linuxserver/docker-bookstack/pkgs/container/bookstack):

```sh
BOOKSTACK_VERSION=version-v23.05 docker compose up -d
```

To remove the containers and all test data:

```sh
docker compose down -v
```

## Automated tests

The `test` folder contains browser tests that run the script against each supported BookStack release. See [test/README.md](test/README.md) for how to run them.
