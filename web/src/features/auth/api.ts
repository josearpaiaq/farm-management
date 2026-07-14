import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setCsrfToken } from '@/lib/api/client';
import type { AuthResponse, AuthUser } from '@/lib/api/types';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<AuthUser> => {
      const response = await api<AuthResponse>('/auth/me');
      setCsrfToken(response.csrf_token);
      return response.user;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (response) => {
      setCsrfToken(response.csrf_token);
      queryClient.setQueryData(ME_QUERY_KEY, response.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setCsrfToken(null);
      queryClient.clear();
    },
  });
}
