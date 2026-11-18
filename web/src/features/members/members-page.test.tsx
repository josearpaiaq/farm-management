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
  full_name: testUser.full_name,
  role: 'owner',
  status: 'active',
  created_at: '2026-11-01T00:00:00Z',
};

function signedInAs(role: 'owner' | 'member') {
  server.use(
    http.get(`${API}/auth/me`, () =>
      HttpResponse.json({ user: { ...testUser, role } }),
    ),
    http.get(`${API}/members`, () => HttpResponse.json({ data: [ownerRow] })),
  );
}

async function invite(name: string, email: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Invitar/ }));
  await user.type(screen.getByLabelText('Nombre'), name);
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));
}

describe('MembersPage', () => {
  it('lets the owner invite someone, who shows up as pending', async () => {
    signedInAs('owner');
    const invited: Member = {
      id: 'user-2',
      email: 'papa@test.local',
      full_name: 'Papá',
      role: 'member',
      status: 'invited',
      created_at: '2026-11-02T00:00:00Z',
    };
    let members = [ownerRow];
    server.use(
      http.get(`${API}/members`, () => HttpResponse.json({ data: members })),
      http.post(`${API}/members`, () => {
        members = [ownerRow, invited];
        return HttpResponse.json(invited, { status: 201 });
      }),
    );
    renderAt('/members', <MembersPage />);

    await invite('Papá', 'papa@test.local');

    expect(await screen.findByText('Papá')).toBeInTheDocument();
    expect(screen.getByText('Invitación pendiente')).toBeInTheDocument();
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

    await invite('Vecino', 'vecino@test.local');

    expect(
      await screen.findByText('Ese correo ya tiene una cuenta en la app'),
    ).toBeInTheDocument();
  });

  it('shows members the list without invite or remove actions', async () => {
    signedInAs('member');
    renderAt('/members', <MembersPage />);

    expect(
      await screen.findByText('Solo el dueño puede invitar o quitar personas.'),
    ).toBeInTheDocument();
    expect(screen.getByText(ownerRow.full_name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invitar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull();
  });
});
