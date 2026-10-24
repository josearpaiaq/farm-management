import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import LoginPage from '@/features/auth/login-page';
import { API, server, testUser } from '@/test/server';
import { renderAt } from '@/test/render';

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Correo electrónico'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('LoginPage', () => {
  it('signs in and goes to the dashboard', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          user: testUser,
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 900,
        }),
      ),
    );
    renderAt('/login', <LoginPage />);

    await submit(testUser.email, 'secret-password');

    expect(await screen.findByTestId('location')).toHaveTextContent('/');
  });

  it('shows an error for wrong credentials', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, error: 'unauthorized', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    renderAt('/login', <LoginPage />);

    await submit(testUser.email, 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales inválidas',
    );
  });

  it('sends an unverified user to the verification step', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 403, error: 'forbidden', message: 'x' },
          { status: 403 },
        ),
      ),
    );
    renderAt('/login', <LoginPage />);

    await submit(testUser.email, 'secret-password');

    expect(await screen.findByTestId('location')).toHaveTextContent(
      `/verify-email?email=${encodeURIComponent(testUser.email)}`,
    );
  });
});
