import { Locator, Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly footer: Locator;
  readonly navbarToggler: Locator;
  readonly bookStoreNavLink: Locator;
  readonly profileNavLink: Locator;
  readonly bookStoreApiNavLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.footer = page.getByText(/TOOLSQA\.COM.*ALL RIGHTS RESERVED/i);
    this.navbarToggler = page.locator('.navbar-toggler');
    this.bookStoreNavLink = page.locator('a[href="/books"]');
    this.profileNavLink = page.locator('a[href="/profile"]');
    this.bookStoreApiNavLink = page.locator('a[href="/swagger"]');
  }

  async navigateToBookStore(): Promise<void> {
    await this.bookStoreNavLink.click();
    await this.page.waitForURL('**/books');
  }

  async navigateToProfile(): Promise<void> {
    await this.profileNavLink.click();
    await this.page.waitForURL('**/profile');
  }

  async navigateToBookStoreApi(): Promise<void> {
    await this.bookStoreApiNavLink.click();
    await this.page.waitForURL('**/swagger');
  }

  async openSidebarOnMobile(): Promise<void> {
    if (await this.navbarToggler.isVisible()) {
      await this.navbarToggler.click();
    }
  }

  async getFooterText(): Promise<string> {
    return (await this.footer.textContent()) ?? '';
  }
}
