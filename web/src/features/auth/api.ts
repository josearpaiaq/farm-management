import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken } from '@/lib/api/client';
import type { AuthResponse, AuthUser } from '@/lib/api/types';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    // Right after a reload there is no access token yet: the 401 makes the
    // client refresh from the cookie and retry (see lib/api/client).
    queryFn: async (): Promise<AuthUser> =>
      (await api<{ user: AuthUser }>('/auth/me')).user,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// Any auth endpoint that signs the user in (password, emailed code,
// password reset) answers with an AuthResponse; the refresh token arrives as
// an httpOnly cookie.
function useStartSession<TInput extends object>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) =>
      api<AuthResponse>(path, { method: 'POST', body: input }),
    onSuccess: (response) => {
      setAccessToken(response.access_token);
      queryClient.setQueryData(ME_QUERY_KEY, response.user);
    },
  });
}

// Endpoints that only trigger an email and answer 204.
function useSendEmail<TInput extends object>(path: string) {
  return useMutation({
    mutationFn: (input: TInput) =>
      api<void>(path, { method: 'POST', body: input }),
  });
}

export const useLogin = () =>
  useStartSession<{ email: string; password: string }>('/auth/login');

export const useRegister = () =>
  useSendEmail<{
    full_name: string;
    organization_name: string;
    email: string;
    password: string;
  }>('/auth/register');

export const useVerifyEmail = () =>
  useStartSession<{ email: string; code: string }>('/auth/verify-email');

export const useResendVerification = () =>
  useSendEmail<{ email: string }>('/auth/verify-email/resend');

export const useRequestLoginCode = () =>
  useSendEmail<{ email: string }>('/auth/otp/request');

export const useVerifyLoginCode = () =>
  useStartSession<{ email: string; code: string }>('/auth/otp/verify');

export const useForgotPassword = () =>
  useSendEmail<{ email: string }>('/auth/password/forgot');

export const useResetPassword = () =>
  useStartSession<{ email: string; code: string; password: string }>(
    '/auth/password/reset',
  );

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    // Revokes the refresh token server-side and clears its cookie.
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      setAccessToken(null);
      queryClient.clear();
    },
  });
}
