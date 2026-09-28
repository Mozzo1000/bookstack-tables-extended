# Table test page

Paste this into a BookStack page written with the **Markdown editor** (or use **Switch to Markdown Editor** on a page), save it, and view the page.

## 1. Basic text and numbers

Sort every column. Names should ignore case, and `Item 9` should come before `Item 10`.

Select the funnel next to **Name** and type `ab` in the search box. Two rows remain (Kebab and Fabulous), and the checklist narrows to those two names as you type. Clear the search, then untick a few names in the checklist and watch the rows disappear. **(Select all)** shows a mixed state while only some names are ticked. Use **Sort descending** in the same menu, then **Clear filter**.

| Name    | Qty   | Price   | Added      |
| ------- | ----- | ------- | ---------- |
| Delta   | 1,200 | $5.50   | 2024-03-01 |
| alpha   | 30    | $12.00  | 2023-12-25 |
| Charlie |       | $0.99   | 2024-01-15 |
| bravo   | 4     |         | 2022-07-04 |
| Item 10 | 250   | $100    | 2024-02-02 |
| Item 9  | 7     | $7.25   | 2024-02-03 |
| Kebab   | 15    | $3.10   | 2024-01-02 |
| Fabulous | 8    | $45.00  | 2023-11-11 |

## 2. Percentages and mixed units

The Growth column should sort as numbers (`-3%` lowest, `120%` highest). Empty cells stay at the bottom in both directions. In the funnel menu for Growth, the empty cell appears as **(Blanks)**.

| Region | Growth | Revenue    | Notes          |
| ------ | ------ | ---------- | -------------- |
| North  | 12%    | €1,250,000 | On track       |
| South  | -3%    | €980,500   | Below target   |
| East   | 120%   | €45,000    |                |
| West   |        | €2,300,000 | Data pending   |
| Centre | 7.5%   | €760,250   | Steady         |

## 3. Wide table (horizontal scroll)

This has 14 columns. It should scroll sideways inside the page instead of squeezing the columns, and the page itself should not scroll sideways. Scroll to the right and open the funnel on the last column: its menu should stay fully on screen.

| ID | First name | Last name | Department | Role | Location | Start date | Salary | Manager | Team | Status | Phone | Email | Notes |
| -- | ---------- | --------- | ---------- | ---- | -------- | ---------- | ------ | ------- | ---- | ------ | ----- | ----- | ----- |
| 1  | Ada        | Lovelace  | Research   | Lead | London   | 2021-04-01 | 98,000 | Grace   | Core | Active | 555-0101 | ada@example.com | Founding member |
| 2  | Grace      | Hopper    | Research   | Director | New York | 2019-09-15 | 135,000 | | Core | Active | 555-0102 | grace@example.com | |
| 3  | Alan       | Turing    | Security   | Analyst | Manchester | 2022-01-10 | 76,500 | Grace | Crypto | Leave | 555-0103 | alan@example.com | Returns in June |
| 4  | Katherine  | Johnson   | Ops        | Engineer | Houston | 2020-06-30 | 88,250 | Grace | Flight | Active | 555-0104 | katherine@example.com | |
| 5  | Linus      | Torvalds  | Platform   | Architect | Portland | 2023-03-20 | 112,000 | Ada | Kernel | Active | 555-0105 | linus@example.com | Remote |

## 4. Links, formatting and alignment

Clicking a link in a cell or heading must follow the link and not sort. Bold and code in cells should not break sorting.

| Project                                   | Stars | Status     | Language |
| :---------------------------------------- | ----: | :--------: | -------- |
| [BookStack](https://www.bookstackapp.com) | 15000 | **Active** | PHP      |
| [Docker](https://www.docker.com)          | 68000 | **Active** | Go       |
| [Node.js](https://nodejs.org)             | 105000 | `Stable`  | C++      |
| [Playwright](https://playwright.dev)      | 60000 | **Active** | TypeScript |

## 5. Tables that should be left with scroll only

A table with fewer than two body rows gets horizontal scrolling only. There should be no filter row and no sort arrows on this one.

| Setting | Value |
| ------- | ----- |
| Mode    | Test  |

## 6. Duplicate values and stable order

Sort by Team. Rows with the same team should keep their original relative order (Ann before Bob before Cy for Red).

| Person | Team  | Score |
| ------ | ----- | ----- |
| Ann    | Red   | 10    |
| Dee    | Blue  | 10    |
| Bob    | Red   | 8     |
| Eli    | Blue  | 12    |
| Cy     | Red   | 8     |
| Fay    | Green | 8     |

## 7. Creating wide tables in the editor

Edit any page and create a new table with 15 columns and 3 rows.

- **WYSIWYG Editor:** choose **Table > Table**. A dialog asks for columns and rows. Enter 15 and 3.
- **new WYSIWYG (v25.12 and later):** use the toolbar button **Insert table (custom size)** (a small table with a plus), next to the built-in table button. Enter 15 and 3.

Asking for more than 50 columns is refused or capped at 50. The limit is configurable with `editor.maxColumns`.

## 8. Opting a page out

To confirm the opt-out works, add the page tag name `tablesextended` with the value `off` to any page containing these tables. Every table on that page should then look and behave like a normal BookStack table.
