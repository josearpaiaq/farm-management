import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import FarmsPage from '@/features/farms/farms-page';
import type { Farm } from '@/lib/api/types';
import { API, server, testUser } from '@/test/server';
import { renderAt } from '@/test/render';

const farm: Farm = {
  id: 'farm-1',
  name: 'Fundo el Corozo',
  location: 'Portuguesa',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

let meServed = false;

function signedInAs(role: 'owner' | 'editor' | 'viewer') {
  meServed = false;
  server.use(
    http.get(`${API}/auth/me`, () => {
      meServed = true;
      return HttpResponse.json({ user: { ...testUser, role } });
    }),
    http.get(`${API}/farms`, () =>
      HttpResponse.json({ data: [farm], total: 1, limit: 20, offset: 0 }),
    ),
  );
}

// The buttons each role sees once the farm list has loaded.
async function visibleActions() {
  await screen.findByText(farm.name);
  // The role comes from /auth/me; wait until it has been served and
  // rendered, so a viewer's empty toolbar is not just "not loaded yet".
  await waitFor(() => expect(meServed).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    create: screen.queryByRole('button', { name: /Nueva finca/ }) !== null,
    edit: screen.queryByRole('button', { name: 'Editar' }) !== null,
    remove: screen.queryByRole('button', { name: 'Eliminar' }) !== null,
  };
}

describe('FarmsPage permissions', () => {
  it('gives the owner every action', async () => {
    signedInAs('owner');
    renderAt('/farms', <FarmsPage />);
    expect(await visibleActions()).toEqual({
      create: true,
      edit: true,
      remove: true,
    });
  });

  it('lets an editor add and edit but not delete', async () => {
    signedInAs('editor');
    renderAt('/farms', <FarmsPage />);
    expect(await visibleActions()).toEqual({
      create: true,
      edit: true,
      remove: false,
    });
  });

  it('shows a viewer the list only', async () => {
    signedInAs('viewer');
    renderAt('/farms', <FarmsPage />);
    expect(await visibleActions()).toEqual({
      create: false,
      edit: false,
      remove: false,
    });
  });
});
