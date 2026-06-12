import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BookDetailsPage extends BasePage {
  readonly isbnValue: Locator;
  readonly titleValue: Locator;
  readonly subTitleValue: Locator;
  readonly authorValue: Locator;
  readonly publisherValue: Locator;
  readonly totalPagesValue: Locator;
  readonly descriptionValue: Locator;
  readonly websiteValue: Locator;
  readonly coverImage: Locator;
  readonly backToBookStoreButton: Locator;
  readonly addToCollectionButton: Locator;

  constructor(page: Page) {
    super(page);
    this.isbnValue = page.locator('#ISBN-wrapper .col-md-9 label');
    this.titleValue = page.locator('#title-wrapper .col-md-9 label');
    this.subTitleValue = page.locator('#subtitle-wrapper .col-md-9 label');
    this.authorValue = page.locator('#author-wrapper .col-md-9 label');
    this.publisherValue = page.locator('#publisher-wrapper .col-md-9 label');
    this.totalPagesValue = page.locator('#pages-wrapper .col-md-9 label');
    this.descriptionValue = page.locator('#description-wrapper .col-md-9 label');
    this.websiteValue = page.locator('#website-wrapper .col-md-9 label');
    this.coverImage = page.locator('img[src*="bookimage"], img[alt="book-image"]');
    this.backToBookStoreButton = page.getByRole('button', { name: 'Back To Book Store' });
    this.addToCollectionButton = page.getByRole('button', { name: /add to your collection/i });
  }

  async openByIsbn(isbn: string): Promise<void> {
    await this.page.goto(`/books?search=${isbn}`);
    await expect(this.isbnValue).toBeVisible();
  }

  async openByTitle(title: string, booksListPage: { clickBookByTitle: (t: string) => Promise<void> }): Promise<void> {
    await booksListPage.clickBookByTitle(title);
    await expect(this.isbnValue).toBeVisible();
  }

  async getIsbn(): Promise<string> {
    return (await this.isbnValue.textContent())?.trim() ?? '';
  }

  async getTitle(): Promise<string> {
    return (await this.titleValue.textContent())?.trim() ?? '';
  }

  async getAuthor(): Promise<string> {
    return (await this.authorValue.textContent())?.trim() ?? '';
  }

  async getPublisher(): Promise<string> {
    return (await this.publisherValue.textContent())?.trim() ?? '';
  }

  async getDescription(): Promise<string> {
    return (await this.descriptionValue.textContent())?.trim() ?? '';
  }

  async getTotalPages(): Promise<string> {
    return (await this.totalPagesValue.textContent())?.trim() ?? '';
  }

  async getWebsite(): Promise<string> {
    return (await this.websiteValue.textContent())?.trim() ?? '';
  }

  async isCoverImageLoaded(): Promise<boolean> {
    return this.coverImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  }

  async goBackToBookStore(): Promise<void> {
    await this.backToBookStoreButton.click();
    await this.page.waitForURL(/\/books$/);
  }

  async addToCollection(): Promise<void> {
    await expect(this.addToCollectionButton).toBeVisible();
    await expect(this.addToCollectionButton).toBeEnabled();
    await this.addToCollectionButton.click();
  }

  async isAddToCollectionVisible(): Promise<boolean> {
    return this.addToCollectionButton.isVisible();
  }
}
