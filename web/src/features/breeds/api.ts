import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Breed, Paginated, Species } from '@/lib/api/types';

export function useBreeds(
  query: { species?: Species; limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: ['breeds', query],
    queryFn: () => api<Paginated<Breed>>('/breeds', { query }),
  });
}

export function useCreateBreed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { species: Species; name: string }) =>
      api<Breed>('/breeds', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breeds'] }),
  });
}
