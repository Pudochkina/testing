import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { ProfilePage } from '../pages/ProfilePage';
import { FlakySimulator } from '../utils/flaky-simulator';
import { registerUserViaApi } from '../utils/auth-api';
import { generateUniqueUserName, VALID_USER } from '../utils/test-data';

test.describe('User Authentication @functional @auth', () => {
  test('TC-BS-037: Verify login page is accessible', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-037', page);

    const login = new LoginPage(page);
    await login.goto();

    await expect(login.userNameInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.loginButton).toBeVisible();
    await expect(login.welcomeHeading).toBeVisible();
  });

  test('TC-BS-038: Verify successful login with valid credentials', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-038', page);

    const login = new LoginPage(page);
    const profile = new ProfilePage(page);

    await login.goto();
    await login.loginWithValidCredentials(VALID_USER.userName, VALID_USER.password);

    await profile.waitForLoggedIn();
    expect(page.url()).toContain('/profile');
  });

  test('TC-BS-039: Verify login with invalid credentials', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-039', page);

    const login = new LoginPage(page);
    await login.goto();
    await login.login('invalid_user_xyz', 'wrong_password');

    expect(page.url()).toContain('/login');
    const error = await login.getErrorMessage();
    expect(error).toContain('Invalid username or password');
  });

  test('TC-BS-040: Verify login with empty fields', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-040', page);

    const login = new LoginPage(page);
    await login.goto();
    await login.submitEmptyForm();

    expect(await login.isUsernameInvalid()).toBeTruthy();
    expect(await login.isPasswordInvalid()).toBeTruthy();
    expect(page.url()).toContain('/login');
  });

  test('TC-BS-041: Verify registration page is accessible', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-041', page);

    const login = new LoginPage(page);
    const registration = new RegistrationPage(page);

    await login.goto();
    await login.clickNewUser();

    await expect(registration.firstNameInput).toBeVisible();
    await expect(registration.lastNameInput).toBeVisible();
    await expect(registration.userNameInput).toBeVisible();
    await expect(registration.passwordInput).toBeVisible();
    await expect(registration.registerButton).toBeVisible();
  });

  test('TC-BS-042: Verify successful registration', async ({ page, request }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-042', page);

    const userName = generateUniqueUserName('reg');
    const password = 'Test@123';
    const result = await registerUserViaApi(request, { userName, password });

    expect(result.status).toBe(201);
    expect(result.body).toContain(userName);

    const login = new LoginPage(page);
    const profile = new ProfilePage(page);
    await login.goto();
    await login.loginWithValidCredentials(userName, password);
    await profile.waitForLoggedIn();
    expect(page.url()).toContain('/profile');
  });

  test('TC-BS-043: Verify registration with existing username', async ({ page, request }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-043', page);

    const result = await registerUserViaApi(request, {
      userName: VALID_USER.userName,
      password: VALID_USER.password,
    });

    expect(result.status).toBe(406);
    expect(result.body.toLowerCase()).toMatch(/exist|not acceptable/i);
  });

  test('TC-BS-044: Verify logout functionality', async ({ page }) => {
    const simulator = FlakySimulator.getInstance();
    await simulator.maybeInjectFailure('TC-BS-044', page);

    const login = new LoginPage(page);
    const profile = new ProfilePage(page);

    await login.goto();
    await login.loginWithValidCredentials(VALID_USER.userName, VALID_USER.password);
    await profile.waitForLoggedIn();
    await profile.logout();

    expect(page.url()).toContain('/login');
    await expect(login.userNameInput).toBeVisible();
  });
});
