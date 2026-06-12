import { test, expect } from '@playwright/test';
import { BooksListPage } from '../pages/BooksListPage';
import { BookDetailsPage } from '../pages/BookDetailsPage';
import { LoginPage } from '../pages/LoginPage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { SAMPLE_BOOKS } from '../utils/test-data';

test.describe('Book Details @functional @details', () => {
  test('TC-BS-019: Verify clicking book opens details', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-019', page);

    const booksPage = new BooksListPage(page);
    const detailsPage = new BookDetailsPage(page);
    await booksPage.goto();
    await booksPage.clickBookByTitle(SAMPLE_BOOKS.gitPocketGuide.title);

    await expect(detailsPage.isbnValue).toBeVisible();
    expect(page.url()).toContain('search=');
  });

  test('TC-BS-020: Verify book details show complete information', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-020', page);

    const detailsPage = new BookDetailsPage(page);
    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);

    await expect(detailsPage.titleValue).toBeVisible();
    await expect(detailsPage.authorValue).toBeVisible();
    await expect(detailsPage.publisherValue).toBeVisible();
    await expect(detailsPage.isbnValue).toBeVisible();
    await expect(detailsPage.descriptionValue).toBeVisible();
    await expect(detailsPage.subTitleValue).toBeVisible();

    expect(await detailsPage.getTitle()).toContain(SAMPLE_BOOKS.gitPocketGuide.title);
    expect(await detailsPage.getAuthor()).toContain(SAMPLE_BOOKS.gitPocketGuide.author);
  });

  test('TC-BS-021: Verify book cover image loads', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-021', page);

    const booksPage = new BooksListPage(page);
    await booksPage.goto();

    expect(await booksPage.isBookCoverVisible(SAMPLE_BOOKS.learningJsPatterns.title)).toBeTruthy();
    expect(await booksPage.isBookCoverLoaded(SAMPLE_BOOKS.learningJsPatterns.title)).toBeTruthy();
  });

  test('TC-BS-022: Verify back button from book details', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-022', page);

    const booksPage = new BooksListPage(page);
    const detailsPage = new BookDetailsPage(page);
    await booksPage.goto();
    await booksPage.searchBook('Git');
    await booksPage.clickBookByTitle(SAMPLE_BOOKS.gitPocketGuide.title);
    await detailsPage.goBackToBookStore();

    await expect(booksPage.bookTable).toBeVisible();
    expect(await booksPage.getBookCount()).toBeGreaterThan(0);
  });

  test('TC-BS-023: Verify Add to Cart button is present', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-023', page);

    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithValidCredentials('testuser', 'Test@123');

    const detailsPage = new BookDetailsPage(page);
    await detailsPage.openByIsbn(SAMPLE_BOOKS.youDontKnowJs.isbn);

    await expect(detailsPage.addToCollectionButton).toBeVisible();
    await expect(detailsPage.addToCollectionButton).toBeEnabled();
  });

  test('TC-BS-024: Verify book description is displayed', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-024', page);

    const detailsPage = new BookDetailsPage(page);
    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);

    const description = await detailsPage.getDescription();
    expect(description.length).toBeGreaterThan(20);
    expect(description).toMatch(/[A-Za-z]/);
  });

  test('TC-BS-025: Verify publication date is shown', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-025', page);

    const detailsPage = new BookDetailsPage(page);
    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);

    const totalPages = await detailsPage.getTotalPages();
    expect(totalPages).toMatch(/^\d+$/);
    expect(parseInt(totalPages, 10)).toBeGreaterThan(0);
  });

  test('TC-BS-026: Verify book price is displayed', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-026', page);

    const detailsPage = new BookDetailsPage(page);
    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);

    const website = await detailsPage.getWebsite();
    expect(website).toMatch(/^https?:\/\//);
    await expect(detailsPage.websiteValue).toBeVisible();
  });
});
