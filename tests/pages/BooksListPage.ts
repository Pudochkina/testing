import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BooksListPage extends BasePage {
  readonly bookTable: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly bookRows: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  readonly pageInfo: Locator;
  readonly columnHeaders: Locator;
  readonly bookImages: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.bookTable = page.locator('table');
    this.searchInput = page.locator('#searchBox');
    this.searchButton = page.locator('.input-group .btn');
    this.bookRows = page.locator('tbody tr');
    this.previousButton = page.getByRole('button', { name: 'Previous' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
    this.pageInfo = page.getByText(/Page \d+ of \d+/);
    this.columnHeaders = page.locator('thead th');
    this.bookImages = page.locator('tbody tr img[alt="book-image"]');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/books', { waitUntil: 'domcontentloaded' });
    await expect(this.bookTable).toBeVisible();
  }

  async searchBook(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForURL(/\/books/);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.fill('');
    await this.searchButton.click();
    await expect(this.bookRows).not.toHaveCount(0);
  }

  async getBookCount(): Promise<number> {
    return this.bookRows.count();
  }

  async getColumnHeaderTexts(): Promise<string[]> {
    return this.columnHeaders.allTextContents();
  }

  async getBookTitles(): Promise<string[]> {
    return this.page.locator('tbody tr td:nth-child(2) a').allTextContents();
  }

  async getAuthors(): Promise<string[]> {
    return this.page.locator('tbody tr td:nth-child(3)').allTextContents();
  }

  async getPublishers(): Promise<string[]> {
    return this.page.locator('tbody tr td:nth-child(4)').allTextContents();
  }

  async getSearchIsbnsFromLinks(): Promise<string[]> {
    const hrefs = await this.page.locator('tbody tr td:nth-child(2) a').evaluateAll(
      (anchors) => anchors.map((a) => {
        const href = a.getAttribute('href') ?? '';
        const match = href.match(/search=(\d+)/);
        return match ? match[1] : '';
      }),
    );
    return hrefs.filter(Boolean);
  }

  async clickBookByTitle(title: string): Promise<void> {
    await this.page.locator('tbody tr td:nth-child(2) a', { hasText: title }).click();
    await this.page.waitForURL(/search=/);
  }

  async sortByColumn(columnName: string): Promise<void> {
    await this.columnHeaders.filter({ hasText: columnName }).click();
    await expect(this.bookRows.first()).toBeVisible();
  }

  async getPageInfoText(): Promise<string> {
    return (await this.pageInfo.textContent()) ?? '';
  }

  async refresh(): Promise<void> {
    await this.page.reload();
    await expect(this.bookTable).toBeVisible();
  }

  async isTableVisible(): Promise<boolean> {
    return this.bookTable.isVisible();
  }

  async waitForTableLoaded(): Promise<void> {
    await expect(this.bookTable).toBeVisible();
    await expect(this.bookRows.first()).toBeVisible();
  }

  async isBookCoverVisible(title: string): Promise<boolean> {
    const row = this.page.locator('tbody tr', { has: this.page.locator('a', { hasText: title }) });
    return row.locator('img[alt="book-image"]').isVisible();
  }

  async isBookCoverLoaded(title: string): Promise<boolean> {
    const img = this.page.locator('tbody tr', { has: this.page.locator('a', { hasText: title }) })
      .locator('img[alt="book-image"]');
    return img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
  }
}
