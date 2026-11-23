import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import CodeLoginPage from '@/features/auth/code-login-page';
import { API, server, testUser } from '@/test/server';
import { renderAt } from '@/test/render';

describe('CodeLoginPage', () => {
  it('asks for the email, then signs in with the emailed code', async () => {
    let verifiedWith: unknown;
    server.use(
      http.post(`${API}/auth/otp/request`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API}/auth/otp/verify`, async ({ request }) => {
        verifiedWith = await request.json();
        return HttpResponse.json({
          user: testUser,
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 900,
        });
      }),
    );
    const user = userEvent.setup();
    renderAt('/login/code', <CodeLoginPage />);

    await user.type(await screen.findByLabelText('Correo electrónico'), testUser.email);
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    // Regression: the code input must start empty, not reuse the email input.
    const code = await screen.findByLabelText('Código');
    expect(code).toHaveValue('');

    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/');
    expect(verifiedWith).toEqual({ email: testUser.email, code: '123456' });
  });

  it('rejects a code that is not 6 digits before calling the API', async () => {
    server.use(
      http.post(`${API}/auth/otp/request`, () => new HttpResponse(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderAt('/login/code', <CodeLoginPage />);

    await user.type(await screen.findByLabelText('Correo electrónico'), testUser.email);
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(await screen.findByLabelText('Código'), '12');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('El código tiene 6 dígitos')).toBeInTheDocument();
  });
});
