import { queryKeys } from '@bemmoly/api-client';
import {
  IMPORT_FILE_MAX_BYTES,
  type ImportField,
  type ImportJob,
  type ImportSource,
} from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isActive, useImportActions, useImportJob, useImportSources } from './use-imports.ts';

export type ImportStep = 'source' | 'connect' | 'preview' | 'running' | 'report';

/** A field shows unless it waits on another field's value. */
export function visibleFields(source: ImportSource, values: Record<string, string>) {
  return source.fields.filter(
    (field) =>
      !field.showWhen || field.showWhen.values.includes(values[field.showWhen.field] ?? ''),
  );
}

/** Each select starts on its first option, so the form opens complete where it can. */
function initialValues(source: ImportSource): Record<string, string> {
  return Object.fromEntries(
    source.fields
      .filter((field) => field.kind === 'select' && field.options?.length)
      .map((field) => [field.name, field.options?.[0]?.value ?? '']),
  );
}

export const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** "This file is 12.4 MB; the limit is 10 MB…" or null when it fits. */
export function fileTooLarge(size: number): string | null {
  if (size <= IMPORT_FILE_MAX_BYTES) return null;
  return `This file is ${megabytes(size)}; the limit is ${megabytes(IMPORT_FILE_MAX_BYTES)}. Split it and import each part.`;
}

export function stepOf(source: ImportSource | null, job: ImportJob | undefined): ImportStep {
  if (job) {
    if (job.status === 'ready') return 'preview';
    return isActive(job.status) ? 'running' : 'report';
  }
  return source ? 'connect' : 'source';
}

/**
 * The whole import, one job at a time: pick a source, fill its connection form, connect,
 * choose what to bring in, preview the plan, run, watch, read the report. The step follows
 * from the job, so reopening a recent import lands where that job is.
 */
export function useImportFlow(options: { sourcesEnabled?: boolean } = {}) {
  const client = useQueryClient();
  const sources = useImportSources(options.sourcesEnabled ?? true);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const jobQuery = useImportJob(jobId);
  const job = jobId ? jobQuery.data : undefined;
  const actions = useImportActions((created) => setJobId(created.id));

  const items = sources.data?.items ?? [];
  const source = items.find((entry) => entry.id === (job?.source ?? sourceId)) ?? null;
  const fields = source ? visibleFields(source, values) : [];
  const containers = job?.discovery?.containers ?? [];
  const planned = job?.plan?.containers ?? null;
  const chosen = picked ?? planned ?? containers.map((container) => container.id);
  const planCurrent =
    planned !== null &&
    planned.length === chosen.length &&
    chosen.every((id) => planned.includes(id));

  const status = job?.status;
  useEffect(() => {
    if (status && !isActive(status)) {
      void client.invalidateQueries({ queryKey: queryKeys.imports.list() });
    }
  }, [status, client]);

  const reset = () => {
    actions.create.reset();
    setFileError(null);
    setPicked(null);
  };

  return {
    sources,
    items,
    source,
    fields,
    values,
    files,
    fileError,
    job,
    jobLoading: jobId !== null && jobQuery.isPending,
    jobError: jobQuery.error,
    step: stepOf(source, job),
    chosen,
    planCurrent,
    actions,
    canConnect:
      source !== null && fields.every((field) => !field.required || Boolean(values[field.name])),
    pick: (id: string) => {
      const next = items.find((entry) => entry.id === id);
      reset();
      setJobId(null);
      setSourceId(id);
      setValues(next ? initialValues(next) : {});
      setFiles({});
    },
    setValue: (field: ImportField, value: string) =>
      setValues((current) => ({ ...current, [field.name]: value })),
    chooseFile: async (field: ImportField, file: File | null) => {
      setFileError(null);
      if (!file) return;
      const tooLarge = fileTooLarge(file.size);
      if (tooLarge) return setFileError(tooLarge);
      const text = await file.text();
      setFiles((current) => ({ ...current, [field.name]: file.name }));
      setValues((current) => ({ ...current, [field.name]: text }));
    },
    connect: () => {
      if (!source) return;
      const sent = Object.fromEntries(
        fields.map((field) => [field.name, values[field.name] ?? '']),
      );
      actions.create.mutate({ source: source.id, values: sent });
    },
    toggle: (id: string) =>
      setPicked(chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id]),
    previewPlan: () => job && actions.plan.mutate({ id: job.id, containers: chosen }),
    start: () => job && actions.run.mutate(job.id),
    cancel: () => job && actions.cancel.mutate(job.id),
    open: (id: string) => {
      reset();
      setJobId(id);
    },
    startOver: () => {
      reset();
      setJobId(null);
      setSourceId(null);
      setValues({});
      setFiles({});
    },
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
