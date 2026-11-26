import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import MembersPage from '@/features/members/members-page';
import type { Member } from '@/lib/api/types';
import { API, server, testUser } from '@/test/server';
import { renderAt } from '@/test/render';

const ownerRow: Member = {
  id: testUser.id,
  email: testUser.email,
  first_name: testUser.first_name,
  last_name: testUser.last_name,
  role: 'owner',
  status: 'active',
  created_at: '2026-11-01T00:00:00Z',
};

function signedInAs(role: 'owner' | 'viewer') {
  server.use(
    http.get(`${API}/auth/me`, () =>
      HttpResponse.json({ user: { ...testUser, role } }),
    ),
    http.get(`${API}/members`, () => HttpResponse.json({ data: [ownerRow] })),
  );
}

async function invite(firstName: string, lastName: string, email: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Invitar/ }));
  await user.type(screen.getByLabelText('Nombre'), firstName);
  await user.type(screen.getByLabelText('Apellidos'), lastName);
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));
}

describe('MembersPage', () => {
  it('lets the owner invite someone, who shows up as pending', async () => {
    signedInAs('owner');
    const invited: Member = {
      id: 'user-2',
      email: 'papa@test.local',
      first_name: 'Papá',
      last_name: 'Arpaia',
      role: 'viewer',
      status: 'invited',
      created_at: '2026-11-02T00:00:00Z',
    };
    let members = [ownerRow];
    let sent: unknown;
    server.use(
      http.get(`${API}/members`, () => HttpResponse.json({ data: members })),
      http.post(`${API}/members`, async ({ request }) => {
        sent = await request.json();
        members = [ownerRow, invited];
        return HttpResponse.json(invited, { status: 201 });
      }),
    );
    renderAt('/members', <MembersPage />);

    await invite('Papá', 'Arpaia', 'papa@test.local');

    expect(await screen.findByText('Papá Arpaia')).toBeInTheDocument();
    expect(screen.getByText('Invitación pendiente')).toBeInTheDocument();
    // Read only unless the owner picks otherwise.
    expect(sent).toEqual({
      first_name: 'Papá',
      last_name: 'Arpaia',
      email: 'papa@test.local',
      role: 'viewer',
    });
  });

  it('explains when the email already has an account', async () => {
    signedInAs('owner');
    server.use(
      http.post(`${API}/members`, () =>
        HttpResponse.json(
          { statusCode: 409, error: 'conflict', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    renderAt('/members', <MembersPage />);

    await invite('Vecino', 'Pérez', 'vecino@test.local');

    expect(
      await screen.findByText('Ese correo ya tiene una cuenta en la app'),
    ).toBeInTheDocument();
  });

  it('shows others the list without invite or remove actions', async () => {
    signedInAs('viewer');
    renderAt('/members', <MembersPage />);

    expect(
      await screen.findByText(
        'Solo el dueño puede invitar, quitar o cambiar los permisos de las personas.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Owner Test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invitar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull();
  });
});
