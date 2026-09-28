# Tests

End-to-end tests that run `bookstack-tables-extended.js` in a real browser against real BookStack releases. Each run starts a fresh BookStack in Docker, installs the script, creates fixture pages, and checks sorting, filtering, scrolling and edge cases.

## Requirements

- Docker with Docker Compose
- Node.js 18 or later
- Bash (on Windows, Git Bash)
- Ports 6875 free on the machine

The first run installs [Playwright](https://playwright.dev) and its Chromium browser into `test/node_modules`, which is git-ignored.

## Running the tests

Run these from the repository root.

Test one BookStack release:

```sh
bash test/run-version.sh version-v26.09
```

Test one release with the Lexical editor set as the system default:

```sh
bash test/run-version.sh version-v26.09 lexical
```

Test every supported release (about 3 minutes each):

```sh
bash test/run-all.sh
```

The argument is an image tag from the [linuxserver/bookstack tag list](https://github.com/linuxserver/docker-bookstack/pkgs/container/bookstack), for example `version-v23.05`.

Each run prints `PASS` and `FAIL` lines and ends with `ALL PASSED` or a failure count. The exit code is 0 when everything passed, 1 when a check failed, and 3 when the environment could not be prepared (Docker failed, BookStack never became ready, fixtures could not be created).

Every run replaces the containers and volumes from the previous run. To clean up afterwards:

```sh
docker compose down -v
```

## Output

Screenshots and the full log of each run are saved to `screenshots/<version>/` in the repository root (`screenshots/<version>-lexical/` for Lexical runs), for example `screenshots/v26.09/results.txt` and `screenshots/v26.09/wide.png`. A run replaces the folder of the same name. The `screenshots` folder is git-ignored, so results stay on your machine and are not committed.

## What is checked

| Area                  | Checks                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Table markup          | A header row stored as `<thead>` with `<td>` cells, a header row of `<th>` cells in `<tbody>`, and a table with no header markup |
| Sorting               | Text (case-insensitive, natural order), numbers with thousands separators and currency, blanks last, ascending then descending then original order, keyboard use, `aria-sort` |
| Filtering             | Case-insensitive match, several columns combined, row count line, no-match message, clearing filters                          |
| Scrolling             | A 14-column table scrolls inside the page while the page itself does not scroll sideways                                      |
| Edge cases            | Merged rows (`rowspan`), nested tables, links in headings, pages opted out with the `tablesextended` tag                       |
| Editor                | The editor page contains none of the script's markup, and view pages log no console errors                                    |

Console errors raised on editor pages by BookStack itself (for example a Content Security Policy message on v23.05) are printed as informational and do not fail a run.

## Files

| File             | Purpose                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `run-version.sh` | Starts BookStack at one release, prepares it, runs the tests, saves screenshots                            |
| `run-all.sh`     | Runs `run-version.sh` for the full list of supported releases                                             |
| `fixtures.js`    | Creates the test book and pages through the BookStack API                                                  |
| `e2e.js`         | The browser checks and screenshots                                                                         |
| `package.json`   | Installs Playwright                                                                                        |

## Adding a supported release

1. Add its image tag to `TINYMCE_VERSIONS` in `run-all.sh`, and to `LEXICAL_VERSIONS` if it includes the Lexical editor.
2. Run `bash test/run-version.sh <tag>` and confirm `ALL PASSED`.
3. Add the release to the table in the main `README.md`.

## Notes for writing tests

- The test helper for reading a column skips the header row, so it works for both `<thead>` and `<tbody>` header layouts.
- BookStack rewrites element ids unless they start with `bkmrk-`, so fixture ids use that prefix.
- Page ids differ between BookStack releases, so tests find pages by slug rather than by number.
- The database preparation in `run-version.sh` writes directly to the `settings` and `api_tokens` tables. Those tables' shapes can change between BookStack releases, so a new release may need a small adjustment there.
