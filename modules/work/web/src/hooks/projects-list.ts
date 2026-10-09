import type { CreateProjectBody, Project } from '@bemmoly/module-work/shared';
import { ApiError, queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

const KEY = /^[A-Z][A-Z0-9]{1,9}$/;

/** "Platform Core" → "PC", "Mobile" → "MOB": a key to start from, edited freely after. */
export function suggestKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const key = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '');
  return key.replace(/^[0-9]+/, '').slice(0, words.length > 1 ? 10 : 3);
}

export interface ProjectDraft {
  name: string;
  key: string;
  method: 'scrum' | 'kanban';
  teamId: string;
}

/** The teams a project can belong to, for the create dialog. */
export function useTeams() {
  return useQuery({ queryKey: queryKeys.teams.all(), queryFn: () => api.teams.list() });
}

/**
 * The create project dialog's state: the key follows the name until it is typed, the checks
 * match the server's, and a taken key comes back as the key's own error.
 */
export function useCreateProject(onCreated: (project: Project) => void) {
  const [draft, setDraft] = useState<ProjectDraft>({
    name: '',
    key: '',
    method: 'scrum',
    teamId: '',
  });
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectDraft | 'form', string>>>({});
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (body: CreateProjectBody) => api.work.projectCatalog.create(body),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: workKeys.projects() });
      onCreated(project);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'conflict') {
        setErrors({ key: 'Another project already uses this key.' });
      } else setErrors({ form: error.message });
    },
  });

  const setName = (name: string) => {
    setDraft((current) => ({ ...current, name, key: keyTouched ? current.key : suggestKey(name) }));
    setErrors(({ name: _name, ...rest }) => rest);
  };
  const setKey = (key: string) => {
    setKeyTouched(true);
    setDraft((current) => ({ ...current, key: key.toUpperCase().replace(/[^A-Z0-9]/g, '') }));
    setErrors(({ key: _key, ...rest }) => rest);
  };
  const set = <K extends 'method' | 'teamId'>(field: K, value: ProjectDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const submit = () => {
    const found: typeof errors = {};
    if (!draft.name.trim()) found.name = 'Give the project a name.';
    if (!KEY.test(draft.key))
      found.key = 'Use 2 to 10 capital letters or digits, starting with a letter.';
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate({
      key: draft.key,
      name: draft.name.trim(),
      method: draft.method,
      ...(draft.teamId ? { teamId: draft.teamId } : {}),
    });
  };

  return { draft, setName, setKey, set, errors, submit, isSubmitting: create.isPending };
}
