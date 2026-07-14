import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '@/lib/api/client';
import type { ImportJob, ImportResponse, Paginated } from '@/lib/api/types';

export const TEMPLATE_URL = `${API_BASE}/imports/animals/template`;

export function reportUrl(jobId: string): string {
  return `${API_BASE}/imports/${jobId}/report`;
}

export function useImportJobs(query: { offset?: number } = {}) {
  return useQuery({
    queryKey: ['imports', query],
    queryFn: () => api<Paginated<ImportJob>>('/imports', { query }),
  });
}

export function useImportAnimals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const body = new FormData();
      body.append('file', file);
      return api<ImportResponse>('/imports/animals', {
        method: 'POST',
        query: { dry_run: dryRun },
        body,
      });
    },
    onSuccess: (_, { dryRun }) => {
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
      // A commit creates animals; refresh lists and stats.
      if (!dryRun) {
        void queryClient.invalidateQueries({ queryKey: ['animals'] });
      }
    },
  });
}
