import { APIRequestContext } from '@playwright/test';

export interface RegisterUserPayload {
  userName: string;
  password: string;
}

export interface AuthTokenResponse {
  token: string;
  expires: string;
  status: string;
  result: string;
}

export async function registerUserViaApi(
  request: APIRequestContext,
  user: RegisterUserPayload,
): Promise<{ status: number; body: string }> {
  const response = await request.post('/Account/v1/User', {
    data: user,
  });
  return {
    status: response.status(),
    body: await response.text(),
  };
}

export async function loginViaApi(
  request: APIRequestContext,
  userName: string,
  password: string,
): Promise<AuthTokenResponse | null> {
  const response = await request.post('/Account/v1/Authorized', {
    data: { userName, password },
  });

  if (!response.ok()) {
    return null;
  }

  return response.json();
}

export async function deleteUserViaApi(
  request: APIRequestContext,
  userId: string,
  token: string,
): Promise<number> {
  const response = await request.delete(`/Account/v1/User/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.status();
}
