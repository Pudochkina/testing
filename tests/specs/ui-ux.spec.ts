import { test, expect } from '@playwright/test';
import { BooksListPage } from '../pages/BooksListPage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { TOTAL_BOOKS_COUNT } from '../utils/test-data';

test.describe('UI/UX & Navigation @ui-ux', () => {
  test('TC-BS-045: Verify responsive design on mobile', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-045', page);

    await page.setViewportSize({ width: 375, height: 667 });
    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    expect(await booksPage.isTableVisible()).toBeTruthy();
    await expect(booksPage.searchInput).toBeVisible();
    await expect(booksPage.bookRows.first()).toBeVisible();
  });

  test('TC-BS-046: Verify navigation menu links work', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-046', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await booksPage.navigateToProfile();
    expect(page.url()).toContain('/profile');

    await booksPage.navigateToBookStore();
    expect(page.url()).toContain('/books');

    await booksPage.navigateToBookStoreApi();
    expect(page.url()).toContain('/swagger');
  });

  test('TC-BS-047: Verify footer is displayed', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-047', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    await expect(booksPage.footer).toBeVisible();
    const footerText = await booksPage.getFooterText();
    expect(footerText).toContain('TOOLSQA.COM');
    expect(footerText).toContain('ALL RIGHTS RESERVED');
  });

  test('TC-BS-048: Verify loading indicators', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-048', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();
    await booksPage.waitForTableLoaded();

    await expect(booksPage.bookTable).toBeVisible();
    expect(await booksPage.getBookCount()).toBeGreaterThan(0);
  });

  test('TC-BS-049: Verify error handling for network failure', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-049', page);

    await page.route('**/BookStore/**', (route) => route.abort('failed'));

    const booksPage = new BooksListPage(page);
    await page.goto('/books');

    const rowCount = await booksPage.getBookCount();
    expect(rowCount).toBe(0);
  });

  test('TC-BS-050: Verify browser back/forward navigation', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-050', page);

    const booksPage = new BooksListPage(page);
    const bookCountBefore = TOTAL_BOOKS_COUNT;

    await booksPage.goto();
    expect(await booksPage.getBookCount()).toBe(bookCountBefore);

    await booksPage.navigateToProfile();
    expect(page.url()).toContain('/profile');

    await page.goBack();
    await expect(booksPage.bookTable).toBeVisible();
    expect(page.url()).toContain('/books');
    expect(await booksPage.getBookCount()).toBe(bookCountBefore);

    await page.goForward();
    expect(page.url()).toContain('/profile');
  });
});
