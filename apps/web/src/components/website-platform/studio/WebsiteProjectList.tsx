'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'website';
}

export function WebsiteProjectList() {
  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.websitePlatform.listProjects.useQuery();
  const [name, setName] = useState('');
  const createProject = trpc.websitePlatform.createProject.useMutation({ onSuccess: () => { setName(''); utils.websitePlatform.listProjects.invalidate(); } });
  const hasWebsite = Boolean(projects?.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Websites</h1>
        <p className="text-muted">Praxis-Websites, Landingpages, Domains, Inhalte und Medien zentral verwalten.</p>
      </div>
      <Card className="p-5">
        <h2 className="font-semibold">Website anlegen</h2>
        {hasWebsite ? (
          <p className="mt-2 text-sm text-muted">Pro Praxis ist aktuell genau eine Website möglich. Bearbeite die bestehende Website unten.</p>
        ) : (
          <div className="mt-3 flex gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Tierarztpraxis Musterstraße" className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2" />
            <Button disabled={!name || createProject.isPending} onClick={() => createProject.mutate({ name, slug: slugify(name), layoutKey: 'praxis-classic' })}>{createProject.isPending ? 'Erstelle…' : 'Erstellen'}</Button>
          </div>
        )}
      </Card>
      {isLoading ? <p>Lade…</p> : <div className="grid gap-4 md:grid-cols-2">{projects?.map((project) => <Card key={project.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{project.name}</h2><p className="text-sm text-muted">/site/{project.slug} · {project.status}</p></div><Link href={`/dashboard/websites/${project.id}/editor`} className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-surface px-4 py-2.5 text-sm font-medium text-[var(--color-accent-text)] shadow-sm hover:bg-[var(--color-accent-soft)]">Bearbeiten</Link></div></Card>)}</div>}
    </div>
  );
}
