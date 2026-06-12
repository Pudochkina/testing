import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly userNameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly newUserButton: Locator;
  readonly errorMessage: Locator;
  readonly welcomeHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.userNameInput = page.locator('#userName');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#login');
    this.newUserButton = page.locator('#newUser');
    this.errorMessage = page.locator('#output');
    this.welcomeHeading = page.getByText('Welcome,');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.userNameInput).toBeVisible();
  }

  async login(userName: string, password: string): Promise<void> {
    await this.userNameInput.fill(userName);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async loginWithValidCredentials(userName: string, password: string): Promise<void> {
    await this.login(userName, password);
    await this.page.waitForURL('**/profile');
  }

  async clickNewUser(): Promise<void> {
    await this.newUserButton.click();
    await this.page.waitForURL('**/register');
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent())?.trim() ?? '';
  }

  async submitEmptyForm(): Promise<void> {
    await this.userNameInput.fill('');
    await this.passwordInput.fill('');
    await this.loginButton.click();
  }

  async isUsernameInvalid(): Promise<boolean> {
    return this.userNameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
  }

  async isPasswordInvalid(): Promise<boolean> {
    return this.passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
  }
}
