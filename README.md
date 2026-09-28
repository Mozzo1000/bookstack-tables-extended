# BookStack Tables Extended

A script for [BookStack](https://www.bookstackapp.com) that adds sorting, per-column filtering and horizontal scrolling to the tables on your pages.

> **Disclaimer**
>
> Custom HTML head scripts like this one are **not officially supported by BookStack**. They depend on BookStack's internal page markup and styling, which is not a stable interface, so this script **may break without notice in future BookStack releases**.
>
> Only use this script with the BookStack versions listed under [Supported BookStack versions](#supported-bookstack-versions). Other versions have not been tested and are not supported by this project, and issues raised for unsupported versions will not be accepted.
>
> **Never report problems with this script to the BookStack project.** BookStack does not support it. If BookStack behaves unexpectedly, remove the script from Custom HTML Head Content and check again before contacting BookStack about anything.

## Features

- **Sort by column.** Select a column heading to sort ascending, select it again for descending, and a third time to return to the original order. Headings are also reachable with the keyboard (Tab, then Enter or Space).
- **Filter by column.** A filter box under each heading shows only rows containing the typed text. The match ignores case, and boxes in several columns combine. A line under the table shows how many rows match, with a link to clear all filters.
- **Horizontal scroll.** Each column keeps a minimum width (120 px by default). Tables with more columns than fit on screen scroll sideways inside the page instead of squeezing every column.
- **Understands your data.** Columns of numbers sort numerically, including values like `1,200`, `$5.50` and `12%`. Text sorts alphabetically without regard to case, and `Item 9` sorts before `Item 10`. Empty cells always sort last.
- **Display only.** Sorting and filtering change what you see in the browser. They never change the saved page, and they reset when the page reloads.
- **Works on every table automatically.** Every table in viewed page content is enhanced, whether the page was written in the WYSIWYG Editor or the new WYSIWYG. Tables inside other tables are left alone.
- **Follows your theme.** Colours come from your BookStack theme, so the script works in light and dark mode.

## Supported BookStack versions

This script is tested against the exact BookStack releases below. **Use it only with these releases.** Any other release, including other patch releases of the same version line, is unsupported.

| BookStack release | Pages from the WYSIWYG Editor | Pages from the new WYSIWYG (beta) |
| ----------------- | ----------------------------- | --------------------------------- |
| v23.05            | Supported                     | Not available in this release     |
| v23.12.3          | Supported                     | Not available in this release     |
| v24.02.3          | Supported                     | Not available in this release     |
| v24.05.4          | Supported                     | Not available in this release     |
| v24.10.3          | Supported                     | Supported                         |
| v24.12.1          | Supported                     | Supported                         |
| v25.02            | Supported                     | Supported                         |
| v25.05            | Supported                     | Supported                         |
| v25.07            | Supported                     | Supported                         |
| v25.11            | Supported                     | Supported                         |
| v25.12            | Supported                     | Supported                         |
| v26.03.5          | Supported                     | Supported                         |
| v26.05.5          | Supported                     | Supported                         |
| v26.09            | Supported                     | Supported                         |

Releases older than v23.05 are unsupported.

When a new BookStack release comes out, keep running the version you have listed here until this table lists the new release.

## Editors

Sorting, filtering and scrolling apply when a page is **viewed**. The script does not run inside the page editor, so editing is unaffected.

BookStack has two visual editors, and the script works with pages saved by either one. Which editor a page uses does not change what you see, with the differences below:

| | WYSIWYG Editor | new WYSIWYG (beta) |
| --- | --- | --- |
| Where to choose it | **Settings > Customization > Default Page Editor**, or per page | Same setting, or **Switch to new WYSIWYG** on a page |
| Header row | Stored as a separate header section. The script uses the last row of that section as the headings. | Stored as heading cells in the first row of the table. The script uses the first row as the headings. |
| Tables without a header row | The first row is used as the headings. | The first row is used as the headings. |
| Availability | All supported releases | v24.10.3 and later |
| Appearance and behaviour when viewing | Identical | Identical |

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
    };
</script>
<script src="/bookstack-tables-extended.js"></script>
```

| Option           | Default                            | Description                                                                          |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `sort`           | `true`                             | Turns column sorting on or off.                                                      |
| `filter`         | `true`                             | Turns the filter row on or off.                                                      |
| `scroll`         | `true`                             | Turns horizontal scrolling on or off.                                                |
| `minColumnWidth` | `120`                              | Minimum column width in pixels before a table scrolls sideways.                      |
| `minRows`        | `2`                                | Tables with fewer body rows get horizontal scrolling only, without sorting or filtering. |
| `skipSelector`   | `'.bte-skip, [data-bte="off"]'`    | CSS selector for tables that are left completely alone.                              |
| `labels`         | English text                       | Text shown in the interface. Keys: `filter`, `clear`, `showing(shown, total)`, `noMatches`. |

Example of translating the interface:

```html
<script>
    window.BookStackTablesExtended = {
        labels: {
            filter: 'Filtern',
            clear: 'Filter zurücksetzen',
            showing: (shown, total) => `${shown} von ${total} Zeilen`,
            noMatches: 'Keine passenden Zeilen',
        },
    };
</script>
```

## Turning the script off for a page

Add a tag to the page with the name `tablesextended` and the value `off`. The script leaves every table on that page alone.

BookStack removes punctuation from tag names when it builds the page's CSS classes, so the name has no hyphen. A tag named `tablesextendedoff` with no value has the same effect.

## How tables are read

- **Header row.** If the table has a header section, its last row is the header. Otherwise the first row is the header.
- **Body rows.** Every other row, except rows in a table footer, can be sorted and filtered.
- **Numbers.** A column sorts numerically when every non-empty cell in it is a number. Currency symbols (`$ € £ ¥`), `%` and thousands separators (`1,200`) are accepted. A dot is the decimal separator.
- **Dates.** Dates sort as text, so use the `YYYY-MM-DD` format if a date column needs to sort chronologically.

## Known limitations

- Tables with merged cells that span several rows (`rowspan`) get horizontal scrolling only. Sorting and filtering are switched off for them.
- In a cell that spans several columns (`colspan`), the cell belongs to the first column it covers for sorting and filtering.
- A table without a designated header row uses its first row as the header, so that row cannot be sorted or filtered as data.
- Numbers written with a decimal comma (`1,5`) are not read as numbers.
- Sorting and filtering are not saved. They reset when the page is reloaded and do not appear in exports or printouts.
- Filters match text only. Operators such as `>5` are not interpreted.
- Tables that are added to the page after it has loaded are not enhanced.

## Testing with Docker

`docker-compose.yml` starts a disposable BookStack with the script already served from its web root. Nothing in it is meant for production use.

```sh
docker compose up -d
```

1. Open <http://localhost:6875> and sign in with `admin@admin.com` and `password`. The first start takes a minute while the database is prepared.
2. Go to **Settings > Customization** and set **Custom HTML Head Content** to `<script src="/bookstack-tables-extended.js"></script>`.
3. Create a page with a table and view it.

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

The `test` folder contains browser tests that run the script against each supported BookStack release and save screenshots of the results to `screenshots/<release>/`. See [test/README.md](test/README.md) for how to run them.
