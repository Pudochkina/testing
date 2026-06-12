import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegistrationPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly userNameInput: Locator;
  readonly passwordInput: Locator;
  readonly registerButton: Locator;
  readonly backToLoginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('#firstname');
    this.lastNameInput = page.locator('#lastname');
    this.userNameInput = page.locator('#userName');
    this.passwordInput = page.locator('#password');
    this.registerButton = page.locator('#register');
    this.backToLoginButton = page.getByRole('button', { name: 'Back to Login' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await expect(this.firstNameInput).toBeVisible();
  }

  async register(
    firstName: string,
    lastName: string,
    userName: string,
    password: string,
  ): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.userNameInput.fill(userName);
    await this.passwordInput.fill(password);
    await this.registerButton.click();
  }

  async goBackToLogin(): Promise<void> {
    await this.backToLoginButton.click();
    await this.page.waitForURL('**/login');
  }
}
