import { test, expect } from '@playwright/test';
import { BooksListPage } from '../pages/BooksListPage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { EXPECTED_COLUMNS, TOTAL_BOOKS_COUNT } from '../utils/test-data';

test.describe('Book List @smoke @book-list', () => {
  test('TC-BS-001: Verify book list loads successfully', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-001', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await expect(booksPage.bookTable).toBeVisible();
    const count = await booksPage.getBookCount();
    expect(count).toBeGreaterThan(0);
  });

  test('TC-BS-002: Verify all book columns are displayed correctly', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-002', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const headers = await booksPage.getColumnHeaderTexts();
    for (const column of EXPECTED_COLUMNS) {
      expect(headers.some((h) => h.includes(column))).toBeTruthy();
    }

    const rowCount = await booksPage.getBookCount();
    const titles = await booksPage.getBookTitles();
    const authors = await booksPage.getAuthors();
    const publishers = await booksPage.getPublishers();

    expect(titles).toHaveLength(rowCount);
    expect(authors).toHaveLength(rowCount);
    expect(publishers).toHaveLength(rowCount);
    titles.forEach((title) => expect(title.trim().length).toBeGreaterThan(0));
    authors.forEach((author) => expect(author.trim().length).toBeGreaterThan(0));
    publishers.forEach((publisher) => expect(publisher.trim().length).toBeGreaterThan(0));
  });

  test('TC-BS-003: Verify ISBN format is correct', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-003', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const isbns = await booksPage.getSearchIsbnsFromLinks();
    expect(isbns.length).toBeGreaterThan(0);
    isbns.forEach((isbn) => {
      expect(isbn).toMatch(/^\d{13}$/);
    });
  });

  test('TC-BS-004: Verify book titles are not empty', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-004', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const titles = await booksPage.getBookTitles();
    expect(titles.length).toBeGreaterThan(0);
    titles.forEach((title) => {
      expect(title.trim()).not.toBe('');
    });
  });

  test('TC-BS-005: Verify author names are displayed', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-005', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const authors = await booksPage.getAuthors();
    expect(authors.length).toBeGreaterThan(0);
    authors.forEach((author) => {
      expect(author.trim().length).toBeGreaterThan(1);
      expect(author).toMatch(/[A-Za-z]/);
    });
  });

  test('TC-BS-006: Verify publisher information is displayed', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-006', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const publishers = await booksPage.getPublishers();
    expect(publishers.length).toBeGreaterThan(0);
    publishers.forEach((publisher) => {
      expect(publisher.trim().length).toBeGreaterThan(0);
    });
  });

  test('TC-BS-007: Verify pagination controls are present', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-007', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await expect(booksPage.previousButton).toBeVisible();
    await expect(booksPage.nextButton).toBeVisible();
    const pageInfo = await booksPage.getPageInfoText();
    expect(pageInfo).toMatch(/Page \d+ of \d+/);
  });

  test('TC-BS-008: Verify rows per page selector works', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-008', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const count = await booksPage.getBookCount();
    expect(count).toBe(TOTAL_BOOKS_COUNT);
    const pageInfo = await booksPage.getPageInfoText();
    expect(pageInfo).toContain('Page 1 of 1');
  });

  test('TC-BS-009: Verify table sorting functionality', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-009', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const titlesBefore = await booksPage.getBookTitles();
    await booksPage.sortByColumn('Title');
    const titlesAsc = await booksPage.getBookTitles();
    const sortedAsc = [...titlesAsc].sort((a, b) => a.localeCompare(b));
    expect(titlesAsc).toEqual(sortedAsc);

    await booksPage.sortByColumn('Title');
    const titlesDesc = await booksPage.getBookTitles();
    expect(titlesDesc).not.toEqual(titlesBefore);
    expect(titlesDesc.length).toBe(titlesBefore.length);
  });

  test('TC-BS-010: Verify book list updates on page refresh', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-010', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const titlesBefore = await booksPage.getBookTitles();
    await booksPage.refresh();
    const titlesAfter = await booksPage.getBookTitles();

    expect(titlesAfter).toEqual(titlesBefore);
    expect(await booksPage.getBookCount()).toBe(titlesBefore.length);
  });
});
