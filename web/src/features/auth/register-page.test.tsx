import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import RegisterPage from '@/features/auth/register-page';
import { API, server } from '@/test/server';
import { renderAt } from '@/test/render';

async function fillAndSubmit(password = 'long-enough-pass') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Nombre completo'), 'Ana');
  await user.type(
    screen.getByLabelText('Nombre de la finca o empresa'),
    'La Esperanza',
  );
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@test.local');
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

describe('RegisterPage', () => {
  it('requires a password of at least 8 characters', async () => {
    renderAt('/register', <RegisterPage />);

    await fillAndSubmit('short');

    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('goes to email verification after signing up', async () => {
    server.use(
      http.post(`${API}/auth/register`, () => new HttpResponse(null, { status: 204 })),
    );
    renderAt('/register', <RegisterPage />);

    await fillAndSubmit();

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/verify-email?email=ana%40test.local',
    );
  });

  it('flags an email that is already registered', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          { statusCode: 409, error: 'conflict', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    renderAt('/register', <RegisterPage />);

    await fillAndSubmit();

    expect(
      await screen.findByText('Ya existe una cuenta con este correo'),
    ).toBeInTheDocument();
  });
});
