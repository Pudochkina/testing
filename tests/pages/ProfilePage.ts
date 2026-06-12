import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** Profile page acts as the user's book collection (cart equivalent). */
export class ProfilePage extends BasePage {
  readonly bookRows: Locator;
  readonly deleteButtons: Locator;
  readonly deleteAllBooksButton: Locator;
  readonly goToBookStoreButton: Locator;
  readonly logoutButton: Locator;
  readonly userNameDisplay: Locator;
  readonly notLoggedInMessage: Locator;
  readonly booksLabel: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    super(page);
    this.bookRows = page.locator('table tbody tr');
    this.deleteButtons = page.locator('span[id^="delete-record-"]');
    this.deleteAllBooksButton = page.getByRole('button', { name: 'Delete All Books' });
    this.goToBookStoreButton = page.getByRole('button', { name: 'Go To Book Store' });
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
    this.userNameDisplay = page.getByText(/User Name\s*:/i);
    this.notLoggedInMessage = page.getByText(/not logged into the Book Store/i);
    this.booksLabel = page.getByText('Books :');
    this.pageInfo = page.getByText(/Page \d+ of \d+/);
  }

  async goto(): Promise<void> {
    await this.page.goto('/profile');
  }

  async getBookCount(): Promise<number> {
    if (await this.notLoggedInMessage.isVisible()) {
      return 0;
    }
    if (!(await this.userNameDisplay.isVisible())) {
      return 0;
    }
    return this.bookRows.count();
  }

  async expectBookCount(expected: number): Promise<void> {
    await this.waitForLoggedIn();
    await expect(this.bookRows).toHaveCount(expected, { timeout: 15000 });
  }

  async getBookTitles(): Promise<string[]> {
    if (await this.getBookCount() === 0) {
      return [];
    }
    await expect(this.bookRows.first()).toBeVisible();
    return this.page.locator('table tbody tr td:nth-child(2) a').allTextContents();
  }

  private async confirmModal(): Promise<void> {
    const modal = this.page.locator('.modal.show .modal-content');
    await modal.waitFor({ state: 'visible' });
    await modal.getByRole('button', { name: 'OK' }).click();
    await this.page.locator('.modal.show').waitFor({ state: 'hidden' });
  }

  async deleteBookByIndex(index = 0): Promise<void> {
    await this.deleteButtons.nth(index).click();
    await this.confirmModal();
  }

  async deleteAllBooks(): Promise<void> {
    if (await this.notLoggedInMessage.isVisible()) {
      return;
    }

    let safety = 20;
    while ((await this.getBookCount()) > 0 && safety > 0) {
      await this.deleteBookByIndex(0);
      safety -= 1;
    }
  }

  async goToBookStore(): Promise<void> {
    await this.goToBookStoreButton.click();
    await this.page.waitForURL('**/books');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  async isEmpty(): Promise<boolean> {
    if (await this.notLoggedInMessage.isVisible()) {
      return true;
    }
    return (await this.getBookCount()) === 0;
  }

  async refresh(): Promise<void> {
    await this.page.reload();
  }

  async waitForLoggedIn(): Promise<void> {
    await expect(this.userNameDisplay).toBeVisible();
  }
}
