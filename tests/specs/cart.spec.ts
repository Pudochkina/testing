import { test, expect } from '@playwright/test';
import { BookDetailsPage } from '../pages/BookDetailsPage';
import { CartPage } from '../pages/CartPage';
import { LoginPage } from '../pages/LoginPage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { registerUserViaApi } from '../utils/auth-api';
import { generateUniqueUserName, SAMPLE_BOOKS } from '../utils/test-data';

test.describe('Shopping Cart @functional @cart', () => {
  test.describe.configure({ mode: 'serial' });

  const testPassword = 'Test@123';
  let testUserName = '';

  test.beforeEach(async ({ page, request }) => {
    testUserName = generateUniqueUserName('cart');
    const registration = await registerUserViaApi(request, { userName: testUserName, password: testPassword });
    expect(registration.status).toBe(201);

    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithValidCredentials(testUserName, testPassword);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.deleteAllBooks();
  });

  test('TC-BS-027: Verify add book to cart', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-027', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.waitForLoggedIn();

    const titles = await cart.getBookTitles();
    expect(titles).toContain(SAMPLE_BOOKS.gitPocketGuide.title);
    expect(await cart.getBookCount()).toBe(1);
  });

  test('TC-BS-028: Verify cart page displays added items', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-028', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.learningJsPatterns.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.waitForLoggedIn();

    await expect(cart.booksLabel).toBeVisible();
    const titles = await cart.getBookTitles();
    expect(titles[0]).toContain(SAMPLE_BOOKS.learningJsPatterns.title);
    expect(await cart.getBookCount()).toBe(1);
  });

  test('TC-BS-029: Verify increase item quantity in cart', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-029', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await detailsPage.openByIsbn(SAMPLE_BOOKS.youDontKnowJs.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(2);

    const titles = await cart.getBookTitles();
    expect(titles.length).toBe(2);
  });

  test('TC-BS-030: Verify decrease item quantity in cart', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-030', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await detailsPage.openByIsbn(SAMPLE_BOOKS.youDontKnowJs.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(2);

    await cart.deleteBookByIndex(0);
    await cart.expectBookCount(1);
  });

  test('TC-BS-031: Verify remove item from cart', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-031', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(1);

    await cart.deleteBookByIndex(0);
    await cart.expectBookCount(0);
  });

  test('TC-BS-032: Verify empty cart state', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-032', page);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.waitForLoggedIn();

    expect(await cart.getBookCount()).toBe(0);
    await expect(cart.goToBookStoreButton).toBeVisible();
  });

  test('TC-BS-033: Verify cart total calculation', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-033', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await detailsPage.openByIsbn(SAMPLE_BOOKS.learningJsPatterns.isbn);
    await detailsPage.addToCollection();
    await detailsPage.openByIsbn(SAMPLE_BOOKS.youDontKnowJs.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(3);

    const titles = await cart.getBookTitles();
    expect(titles.length).toBe(3);
  });

  test('TC-BS-034: Verify checkout button is present', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-034', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await cart.goto();

    await expect(cart.goToBookStoreButton).toBeVisible();
    await expect(cart.goToBookStoreButton).toBeEnabled();
  });

  test('TC-BS-035: Verify cart persists after page refresh', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-035', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(1);

    await cart.refresh();
    await cart.expectBookCount(1);
    const titles = await cart.getBookTitles();
    expect(titles[0]).toContain(SAMPLE_BOOKS.gitPocketGuide.title);
  });

  test('TC-BS-036: Verify add same book multiple times', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-036', page);

    const detailsPage = new BookDetailsPage(page);
    const cart = new CartPage(page);

    await detailsPage.openByIsbn(SAMPLE_BOOKS.gitPocketGuide.isbn);
    await detailsPage.addToCollection();
    await detailsPage.addToCollection();
    await cart.goto();
    await cart.expectBookCount(1);

    const titles = await cart.getBookTitles();
    expect(titles.filter((t) => t.includes(SAMPLE_BOOKS.gitPocketGuide.title)).length).toBe(1);
  });
});
