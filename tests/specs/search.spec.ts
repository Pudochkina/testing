import { test, expect } from '@playwright/test';
import { BooksListPage } from '../pages/BooksListPage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { SAMPLE_BOOKS } from '../utils/test-data';

test.describe('Search & Filter @functional @search', () => {
  test('TC-BS-011: Verify search box is present', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-011', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await expect(booksPage.searchInput).toBeVisible();
    await expect(booksPage.searchInput).toBeEditable();
    await expect(booksPage.searchButton).toBeVisible();
  });

  test('TC-BS-012: Verify search by book title', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-012', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.searchBook('Git');

    const titles = await booksPage.getBookTitles();
    expect(titles.length).toBeGreaterThan(0);
    titles.forEach((title) => {
      expect(title.toLowerCase()).toContain('git');
    });
  });

  test('TC-BS-013: Verify search by author name', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-013', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.searchBook('Osmani');

    const authors = await booksPage.getAuthors();
    expect(authors.length).toBeGreaterThan(0);
    authors.forEach((author) => {
      expect(author.toLowerCase()).toContain('osmani');
    });
  });

  test('TC-BS-014: Verify search with no results', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-014', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.searchBook('xyzabc123nonexistent');

    expect(await booksPage.getBookCount()).toBe(0);
    const pageInfo = await booksPage.getPageInfoText();
    expect(pageInfo).toContain('Page 1 of 0');
  });

  test('TC-BS-015: Verify search is case-insensitive', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-015', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await booksPage.searchBook('git');
    const lowerTitles = await booksPage.getBookTitles();

    await booksPage.searchBook('GIT');
    const upperTitles = await booksPage.getBookTitles();

    expect(upperTitles).toEqual(lowerTitles);
    expect(lowerTitles.length).toBeGreaterThan(0);
  });

  test('TC-BS-016: Verify search with partial match', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-016', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.searchBook('Prog');

    const titles = await booksPage.getBookTitles();
    expect(titles.length).toBeGreaterThan(0);
    titles.forEach((title) => {
      expect(title.toLowerCase()).toMatch(/prog/);
    });
  });

  test('TC-BS-017: Verify clear search functionality', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-017', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    const fullCount = await booksPage.getBookCount();
    await booksPage.searchBook(SAMPLE_BOOKS.gitPocketGuide.title);
    expect(await booksPage.getBookCount()).toBeLessThan(fullCount);

    await booksPage.clearSearch();
    expect(await booksPage.getBookCount()).toBe(fullCount);
  });

  test('TC-BS-018: Verify search with special characters', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-018', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.searchBook('@#$%');

    expect(await booksPage.getBookCount()).toBe(0);
    await expect(booksPage.bookTable).toBeVisible();
    const pageInfo = await booksPage.getPageInfoText();
    expect(pageInfo).toContain('Page 1 of 0');
  });
});
