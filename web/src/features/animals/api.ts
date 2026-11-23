import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  Animal,
  AnimalListItem,
  AnimalStatus,
  HealthEvent,
  HerdStats,
  Note,
  Paginated,
  Sex,
  Species,
  Tenure,
  WeightRecord,
} from '@/lib/api/types';

export interface AnimalFilters {
  farm_id?: string;
  species?: Species;
  status?: AnimalStatus;
  sex?: Sex;
  limit?: number;
  offset?: number;
}

export interface AnimalInput {
  farm_id: string;
  species: Species;
  sex: Sex;
  tag: string;
  breed_id?: string;
  birth_date?: string;
  tenure?: Tenure;
  status?: AnimalStatus;
  sire_id?: string;
  dam_id?: string;
}

export function useAnimals(
  filters: AnimalFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['animals', filters],
    queryFn: () =>
      api<Paginated<AnimalListItem>>('/animals', { query: { ...filters } }),
    enabled: options.enabled,
  });
}

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: ['animals', 'detail', id],
    queryFn: () => api<Animal>(`/animals/${id}`),
    enabled: Boolean(id),
  });
}

export function useHerdStats() {
  return useQuery({
    queryKey: ['animals', 'stats'],
    queryFn: () => api<HerdStats>('/animals/stats'),
  });
}

function useInvalidateAnimals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['animals'] });
}

export function useCreateAnimal() {
  const invalidate = useInvalidateAnimals();
  return useMutation({
    mutationFn: (input: AnimalInput) =>
      api<Animal>('/animals', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateAnimal() {
  const invalidate = useInvalidateAnimals();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AnimalInput> & { id: string }) =>
      api<Animal>(`/animals/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteAnimal() {
  const invalidate = useInvalidateAnimals();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/animals/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// --- Per-animal records (weights, health events, notes) ---

function recordHooks<TRecord, TInput>(resource: string) {
  const useList = (animalId: string, query: { offset?: number } = {}) =>
    useQuery({
      queryKey: ['animals', animalId, resource, query],
      queryFn: () =>
        api<Paginated<TRecord>>(`/animals/${animalId}/${resource}`, { query }),
    });

  const useAdd = (animalId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: TInput) =>
        api<TRecord>(`/animals/${animalId}/${resource}`, {
          method: 'POST',
          body: input,
        }),
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: ['animals', animalId, resource],
        }),
    });
  };

  const useRemove = (animalId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) =>
        api<void>(`/animals/${animalId}/${resource}/${id}`, {
          method: 'DELETE',
        }),
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: ['animals', animalId, resource],
        }),
    });
  };

  return { useList, useAdd, useRemove };
}

export interface WeightInput {
  weight_kg: number;
  recorded_on: string;
}

export interface HealthEventInput {
  event_type: string;
  occurred_on: string;
  product?: string;
  description?: string;
  withdrawal_until?: string;
}

export interface NoteInput {
  body: string;
}

export const weightsApi = recordHooks<WeightRecord, WeightInput>('weights');
export const healthEventsApi = recordHooks<HealthEvent, HealthEventInput>(
  'health-events',
);
export const notesApi = recordHooks<Note, NoteInput>('notes');
