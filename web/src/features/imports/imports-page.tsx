import { Download, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  reportUrl,
  TEMPLATE_URL,
  useImportAnimals,
  useImportJobs,
} from '@/features/imports/api';
import type { ImportResponse, ImportRowStatus } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/form';
import { cn } from '@/lib/utils';

const ROW_STATUS_CLASSES: Record<ImportRowStatus, string> = {
  valid: 'text-status-active',
  imported: 'text-status-active',
  skipped: 'text-status-inactive',
  invalid: 'text-status-danger',
  error: 'text-status-danger',
};

function ResultPanel({ result }: { result: ImportResponse }) {
  const { t } = useTranslation();
  const okCount = result.summary.valid ?? result.summary.imported ?? 0;
  return (
    <div className="mt-4 space-y-3">
      <p className="font-medium">
        {t(
          result.job.dry_run
            ? 'imports.dryRunSummary'
            : 'imports.commitSummary',
          {
            total: result.summary.total,
            ok: okCount,
            skipped: result.summary.skipped,
            errors: result.summary.errors,
          },
        )}
      </p>
      {result.results.some((row) => row.message) && (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {result.results
            .filter((row) => row.status !== 'valid' && row.status !== 'imported')
            .map((row) => (
              <p
                key={row.row_number}
                className="border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">
                  {t('imports.row', { number: row.row_number })}
                </span>{' '}
                <span
                  className={cn('font-medium', ROW_STATUS_CLASSES[row.status])}
                >
                  {t(`imports.rowStatus.${row.status}`)}
                </span>
                {row.message && (
                  <span className="text-muted-foreground"> — {row.message}</span>
                )}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ImportsPage() {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const importAnimals = useImportAnimals();
  const jobs = useImportJobs({ offset });

  const run = (dryRun: boolean) => {
    if (!file) return;
    importAnimals.mutate(
      { file, dryRun },
      {
        onSuccess: (response) => {
          setResult(response);
          if (!dryRun) {
            toast.success(t('imports.committed'));
            setFile(null);
            if (fileInput.current) fileInput.current.value = '';
          }
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <>
      <PageHeader title={t('nav.imports')}>
        <Button variant="outline" asChild>
          <a href={TEMPLATE_URL} download>
            <Download className="size-4" /> {t('imports.template')}
          </a>
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('imports.uploadTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {t('imports.uploadHelp')}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="import-file">{t('imports.file')}</Label>
              <Input
                id="import-file"
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="w-72"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
            </div>
            <Button
              variant="outline"
              disabled={!file || importAnimals.isPending}
              onClick={() => run(true)}
            >
              <FileUp className="size-4" /> {t('imports.validate')}
            </Button>
            <Button
              disabled={
                !file || importAnimals.isPending || result?.job.dry_run !== true
              }
              onClick={() => run(false)}
            >
              {t('imports.commit')}
            </Button>
          </div>
          {result && <ResultPanel result={result} />}
        </CardContent>
      </Card>

      <h2 className="mb-3 font-heading text-lg font-semibold">
        {t('imports.history')}
      </h2>
      {jobs.isPending && <Skeleton className="h-32 w-full" />}
      {jobs.isError && (
        <p className="text-destructive">{errorMessage(jobs.error)}</p>
      )}
      {jobs.data?.data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('imports.noJobs')}
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {jobs.data?.data.map((job) => (
          <Card key={job.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {job.filename}
                  {job.dry_run && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({t('imports.dryRun')})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(job.created_at)} ·{' '}
                  {t('imports.jobCounts', {
                    ok: job.ok_rows ?? 0,
                    errors: job.error_rows ?? 0,
                  })}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={reportUrl(job.id)} download>
                  <Download className="size-4" /> {t('imports.report')}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {jobs.data && (
        <PaginationControls
          total={jobs.data.total}
          limit={jobs.data.limit}
          offset={jobs.data.offset}
          onOffsetChange={setOffset}
        />
      )}
    </>
  );
}
