'use client';

/* eslint-disable @next/next/no-img-element */

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { TEMPLATE_VAR_DOCS } from '@/lib/website-platform/template';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDefaultBlock, WEBSITE_BLOCK_DEFINITIONS, type WebsiteBlockType } from '@/lib/website-platform/block-registry';
import { pageBlocksSchema, pageBlockSchema } from '@/lib/website-platform/schemas';
import { PageRenderer } from '@/components/website-platform/renderer/PageRenderer';
import { getServiceIcon, SERVICE_ICON_KEYS } from '@/components/website-platform/blocks/WebsiteBlocks';
import type { ResolvedWebsitePage, WebsiteAssetRef } from '@/lib/website-platform/types';
import type { z } from 'zod';

type Block = z.infer<typeof pageBlockSchema>;
type Asset = { id: string; url: string; alt?: string | null; storageKey: string };

function fieldClass() {
  return 'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm';
}

function TextField({ label, value, onChange, multiline = false }: { label: string; value?: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-fg">{label}</span>
      {multiline ? (
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={4} className={fieldClass()} />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={fieldClass()} />
      )}
    </label>
  );
}

function JsonField<T>({ label, value, onChange }: { label: string; value: T; onChange: (value: T) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-fg">{label}</span>
      <textarea
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            onChange(JSON.parse(next) as T);
            setError(null);
          } catch {
            setError('Ungültiges JSON');
          }
        }}
        rows={8}
        className={`${fieldClass()} font-mono text-xs`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

function assetFileName(storageKey: string) {
  const parts = storageKey.replace(/^local:/, '').split('/');
  return parts[parts.length - 1] ?? storageKey;
}

function MediaPicker({ projectId, value, onChange, label = 'Bild' }: { projectId: string; value?: WebsiteAssetRef; onChange: (value?: WebsiteAssetRef) => void; label?: string }) {
  const utils = trpc.useUtils();
  const { data: assets } = trpc.websitePlatform.listAssets.useQuery({ projectId });
  const deleteAsset = trpc.websitePlatform.deleteAsset.useMutation({
    onSuccess: () => utils.websitePlatform.listAssets.invalidate({ projectId }),
  });
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selectedAsset = value?.assetId ? assets?.find((asset) => asset.id === value.assetId) : undefined;

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/website-assets/upload?projectId=${projectId}`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { asset: Asset };
      onChange({ assetId: payload.asset.id, altOverride: payload.asset.alt ?? file.name });
      await utils.websitePlatform.listAssets.invalidate({ projectId });
    } finally {
      setUploading(false);
    }
  }

  const previewUrl = selectedAsset?.url ?? value?.url;

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
      <p className="text-sm font-medium">{label}</p>
      {previewUrl && <img src={previewUrl} alt={value?.altOverride ?? ''} className="h-28 w-full rounded-lg object-cover" />}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-muted-soft)] ${uploading ? 'opacity-50' : ''}`}>
          {uploading ? 'Lädt…' : '+ Hochladen'}
          <input type="file" accept="image/*" disabled={uploading} className="sr-only"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        </label>
        <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
          Bibliothek {(assets?.length ?? 0) > 0 ? `(${assets!.length})` : ''}
        </Button>
        {value && <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>Entfernen</Button>}
      </div>
      <TextField label="Alt-Text" value={value?.altOverride} onChange={(altOverride) => onChange(value ? { ...value, altOverride } : { altOverride })} />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Medienbibliothek</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-muted-soft)] ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Lädt…' : '+ Bild hochladen'}
              <input type="file" accept="image/*" disabled={uploading} className="sr-only"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
            </label>
            {(assets?.length ?? 0) === 0 && <p className="text-sm text-muted">Noch keine Bilder hochgeladen.</p>}
            <div className="grid grid-cols-3 gap-3 max-h-[480px] overflow-auto">
              {assets?.map((asset) => (
                <div key={asset.id} className={`group relative rounded-xl border-2 overflow-hidden ${value?.assetId === asset.id ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
                  <button onClick={() => { onChange({ assetId: asset.id, altOverride: asset.alt ?? undefined }); setLibraryOpen(false); }} className="block w-full">
                    <img src={asset.url} alt={asset.alt ?? ''} className="aspect-square w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-xs text-muted">{asset.alt || assetFileName(asset.storageKey)}</p>
                  </button>
                  <button
                    onClick={() => { if (confirm('Asset löschen?')) deleteAsset.mutate({ projectId, assetId: asset.id }); }}
                    className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                    title="Löschen"
                  >✕</button>
                  {value?.assetId === asset.id && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-accent)] py-0.5 text-center text-xs text-white">Ausgewählt</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TeamPerson = { id: string; name: string; title?: string; image?: WebsiteAssetRef; bio?: string; focus: string[] };
type TeamListBlock = Extract<Block, { type: 'teamList' }>;

function TeamListInspector({ projectId, block, replaceProps }: { projectId: string; block: TeamListBlock; replaceProps: (props: TeamListBlock['props']) => void }) {
  const { data: teamMembers } = trpc.websitePlatform.listTeamMembers.useQuery({ projectId });
  const people: TeamPerson[] = block.props.people ?? [];

  function updatePerson(index: number, patch: Partial<TeamPerson>) {
    const next = people.map((p, i) => i === index ? { ...p, ...patch } : p);
    replaceProps({ ...block.props, people: next });
  }
  function removePerson(index: number) {
    replaceProps({ ...block.props, people: people.filter((_, i) => i !== index) });
  }
  function addPerson() {
    replaceProps({ ...block.props, people: [...people, { id: crypto.randomUUID(), name: '', focus: [] }] });
  }
  function importFromTenant() {
    if (!teamMembers?.length) return;
    const imported: TeamPerson[] = teamMembers.map((u) => {
      const fullName = [u.title, u.firstName, u.lastName].filter(Boolean).join(' ');
      const existing = people.find((p) => p.name === fullName);
      return existing ?? { id: u.id, name: fullName, focus: [] };
    });
    replaceProps({ ...block.props, people: imported });
  }

  return (
    <div className="space-y-3">
      <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
      <TextField label="Intro" value={block.props.intro} multiline onChange={(intro) => replaceProps({ ...block.props, intro })} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Team-Mitglieder ({people.length})</p>
        <div className="flex gap-2">
          {(teamMembers?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={importFromTenant}>Von Praxis laden</Button>
          )}
          <Button size="sm" variant="outline" onClick={addPerson}>+ Hinzufügen</Button>
        </div>
      </div>
      {people.map((person, index) => (
        <div key={person.id} className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted">Person {index + 1}</p>
            <button onClick={() => removePerson(index)} className="text-xs text-muted hover:text-red-600">Entfernen</button>
          </div>
          <TextField label="Name" value={person.name} onChange={(name) => updatePerson(index, { name })} />
          <TextField label="Titel / Seit" value={person.title} onChange={(title) => updatePerson(index, { title })} />
          <TextField label="Bio" value={person.bio} multiline onChange={(bio) => updatePerson(index, { bio })} />
          <TextField label="Schwerpunkte (kommagetrennt)" value={person.focus.join(', ')} onChange={(v) => updatePerson(index, { focus: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
          <MediaPicker projectId={projectId} label="Foto" value={person.image} onChange={(image) => updatePerson(index, { image })} />
        </div>
      ))}
    </div>
  );
}

type ServiceItem = { id: string; title: string; description: string; iconKey?: string };
type ServicesGridBlock = Extract<Block, { type: 'servicesGrid' }>;

function ServiceIconDropdown({ value, onChange }: { value?: string; onChange: (iconKey: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedIcon = value ?? 'Heart';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white transition-colors hover:bg-[var(--color-muted-soft)] [&_svg]:h-5 [&_svg]:w-5"
        aria-label="Icon auswählen"
        aria-expanded={open}
      >
        {getServiceIcon(selectedIcon)}
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-xl">
          <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto pr-1">
            {SERVICE_ICON_KEYS.map((key) => {
              const selected = selectedIcon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors [&_svg]:h-4 [&_svg]:w-4 ${
                    selected
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border)] hover:bg-[var(--color-muted-soft)]'
                  }`}
                  aria-label="Icon"
                >
                  {getServiceIcon(key)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesGridInspector({ block, replaceProps }: { block: ServicesGridBlock; replaceProps: (props: ServicesGridBlock['props']) => void }) {
  const services: ServiceItem[] = block.props.services ?? [];

  function updateService(index: number, patch: Partial<ServiceItem>) {
    replaceProps({ ...block.props, services: services.map((s, i) => i === index ? { ...s, ...patch } : s) });
  }
  function removeService(index: number) {
    replaceProps({ ...block.props, services: services.filter((_, i) => i !== index) });
  }
  function addService() {
    replaceProps({ ...block.props, services: [...services, { id: crypto.randomUUID(), title: '', description: '', iconKey: 'Heart' }] });
  }

  return (
    <div className="space-y-3">
      <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
      <TextField label="Intro" value={block.props.intro} multiline onChange={(intro) => replaceProps({ ...block.props, intro })} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Leistungen ({services.length})</p>
        <Button size="sm" variant="outline" onClick={addService}>+ Hinzufügen</Button>
      </div>
      {services.map((service, index) => (
        <div key={service.id} className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted">Leistung {index + 1}</p>
            <button onClick={() => removeService(index)} className="text-xs text-muted hover:text-red-600">Entfernen</button>
          </div>
          <TextField label="Titel" value={service.title} onChange={(title) => updateService(index, { title })} />
          <TextField label="Beschreibung" value={service.description} multiline onChange={(description) => updateService(index, { description })} />
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Icon</span>
            <ServiceIconDropdown value={service.iconKey} onChange={(iconKey) => updateService(index, { iconKey })} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateVarsHelper({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers } = trpc.websitePlatform.listTeamMembers.useQuery({ projectId });

  const staticVars = TEMPLATE_VAR_DOCS;
  const teamVars = (teamMembers ?? []).flatMap((m) => {
    const id8 = m.id.replace(/-/g, '').slice(0, 8);
    const fullName = [m.title, m.firstName, m.lastName].filter(Boolean).join(' ');
    return [
      { key: `{{team.${id8}.name}}`, desc: fullName },
      ...(m.title ? [{ key: `{{team.${id8}.titel}}`, desc: `Titel: ${m.title}` }] : []),
    ];
  });

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium"
      >
        <span>Verfügbare Variablen</span>
        <span className="text-muted">{open ? '▲' : '▼'}</span>
      </button>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        In Textfeldern einfügen: z.B. <code className="rounded bg-[var(--color-muted-soft)] px-1">{'{{praxis.name}}'}</code>
      </p>
      {open && (
        <div className="space-y-1 rounded-xl border border-[var(--color-border)] p-2">
          {staticVars.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-[var(--color-muted-soft)]">
              <code className="text-xs" style={{ color: 'var(--color-accent-text)' }}>{key}</code>
              <span className="text-xs text-muted">{desc}</span>
            </div>
          ))}
          {teamVars.length > 0 && (
            <>
              <p className="px-2 pt-2 text-xs font-medium text-muted">Tierärzte</p>
              {teamVars.map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-[var(--color-muted-soft)]">
                  <code className="text-xs" style={{ color: 'var(--color-accent-text)' }}>{key}</code>
                  <span className="text-xs text-muted truncate">{desc}</span>
                </div>
              ))}
            </>
          )}
          {teamMembers?.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted">Keine aktiven Tierärzte gefunden.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BlockInspector({ projectId, block, onChange }: { projectId: string; block?: Block; onChange: (block: Block) => void }) {
  if (!block) return <p className="text-sm text-muted">Wählen Sie einen Block aus, um Inhalte zu bearbeiten.</p>;

  const replaceProps = (props: Block['props']) => onChange({ ...block, props } as Block);

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <TextField label="Eyebrow" value={block.props.eyebrow} onChange={(eyebrow) => replaceProps({ ...block.props, eyebrow })} />
          <TextField label="Titel" value={block.props.title} onChange={(title) => replaceProps({ ...block.props, title })} />
          <TextField label="Untertitel" value={block.props.subtitle} multiline onChange={(subtitle) => replaceProps({ ...block.props, subtitle })} />
          <TextField label="Primärer Button" value={block.props.primaryCtaLabel} onChange={(primaryCtaLabel) => replaceProps({ ...block.props, primaryCtaLabel })} />
          <TextField label="Sekundärer Button" value={block.props.secondaryCtaLabel} onChange={(secondaryCtaLabel) => replaceProps({ ...block.props, secondaryCtaLabel })} />
          <MediaPicker projectId={projectId} value={block.props.image} onChange={(image) => replaceProps({ ...block.props, image })} />
        </div>
      );
    case 'servicesGrid':
      return <ServicesGridInspector block={block} replaceProps={replaceProps} />;
    case 'teamList':
      return <TeamListInspector projectId={projectId} block={block} replaceProps={replaceProps} />;
    case 'hoursTable':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!block.props.useManualOverride}
              onChange={(e) => replaceProps({ ...block.props, useManualOverride: e.target.checked })}
              className="rounded border-[var(--color-border)]"
            />
            <span className="font-medium">Öffnungszeiten manuell überschreiben</span>
          </label>
          {block.props.useManualOverride ? (
            <JsonField label="Öffnungszeiten-Sektionen" value={block.props.sections} onChange={(sections) => replaceProps({ ...block.props, sections })} />
          ) : (
            <>
              <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-2">
                <p className="text-sm font-medium">Sprechzeiten</p>
                <TextField label="Titel" value={block.props.consultationTitle} onChange={(consultationTitle) => replaceProps({ ...block.props, consultationTitle })} />
                <TextField label="Chip" value={block.props.consultationChipLabel} onChange={(consultationChipLabel) => replaceProps({ ...block.props, consultationChipLabel })} />
                <TextField label="Hinweistext" value={block.props.consultationNote} multiline onChange={(consultationNote) => replaceProps({ ...block.props, consultationNote })} />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-2">
                <p className="text-sm font-medium">Öffnungszeiten</p>
                <TextField label="Titel" value={block.props.openingTitle} onChange={(openingTitle) => replaceProps({ ...block.props, openingTitle })} />
                <TextField label="Chip" value={block.props.openingChipLabel} onChange={(openingChipLabel) => replaceProps({ ...block.props, openingChipLabel })} />
                <TextField label="Hinweistext" value={block.props.openingNote} multiline onChange={(openingNote) => replaceProps({ ...block.props, openingNote })} />
              </div>
              <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-soft)] px-3 py-2 text-xs text-muted">
                Die Zeiten kommen aus den Praxisdaten. Hier bearbeitest du nur Website-Texte, Chips und Hinweise.
              </p>
            </>
          )}
        </div>
      );
    case 'specialHours':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <TextField label="Hinweistext" value={block.props.note} multiline onChange={(note) => replaceProps({ ...block.props, note })} />
          <TextField label="Leerzustand" value={block.props.emptyText} multiline onChange={(emptyText) => replaceProps({ ...block.props, emptyText })} />
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-soft)] px-3 py-2 text-xs text-muted">
            Die Zeiträume und abweichenden Zeiten kommen aus den Praxisdaten. Der Hinweistext hier eignet sich z.B. für Medikamentenabholung oder Erreichbarkeit.
          </p>
        </div>
      );
    case 'contactCard':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <TextField label="Beschreibung" value={block.props.description} multiline onChange={(description) => replaceProps({ ...block.props, description })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!block.props.useManualOverride} onChange={(e) => replaceProps({ ...block.props, useManualOverride: e.target.checked })} className="rounded border-[var(--color-border)]" />
            <span className="font-medium">Kontaktdaten manuell überschreiben</span>
          </label>
          {block.props.useManualOverride ? (
            <>
              <TextField label="Adresse" value={block.props.address} multiline onChange={(address) => replaceProps({ ...block.props, address })} />
              <TextField label="Telefon" value={block.props.phone} onChange={(phone) => replaceProps({ ...block.props, phone })} />
              <TextField label="E-Mail" value={block.props.email} onChange={(email) => replaceProps({ ...block.props, email })} />
            </>
          ) : (
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-soft)] px-3 py-2 text-xs text-muted">
              Zeigt automatisch Adresse, Telefon und E-Mail aus den Praxisdaten. Checkbox aktivieren zum manuellen Bearbeiten.
            </p>
          )}
        </div>
      );
    case 'contactForm':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!block.props.useManualOverride} onChange={(e) => replaceProps({ ...block.props, useManualOverride: e.target.checked })} className="rounded border-[var(--color-border)]" />
            <span className="font-medium">Consent-Text manuell anpassen</span>
          </label>
          {block.props.useManualOverride ? (
            <TextField label="Consent-Text" value={block.props.consentLabel} multiline onChange={(consentLabel) => replaceProps({ ...block.props, consentLabel })} />
          ) : (
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-soft)] px-3 py-2 text-xs text-muted">
              Standard DSGVO Einwilligungstext. Checkbox aktivieren zum manuellen Anpassen.
            </p>
          )}
        </div>
      );
    case 'bookingCta':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <TextField label="Text" value={block.props.text} multiline onChange={(text) => replaceProps({ ...block.props, text })} />
          <TextField label="Button" value={block.props.buttonLabel} onChange={(buttonLabel) => replaceProps({ ...block.props, buttonLabel })} />
        </div>
      );
    case 'mapEmbed':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <TextField label="Google Maps Embed URL" value={block.props.embedUrl} onChange={(embedUrl) => replaceProps({ ...block.props, embedUrl })} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!block.props.useManualOverride} onChange={(e) => replaceProps({ ...block.props, useManualOverride: e.target.checked })} className="rounded border-[var(--color-border)]" />
            <span className="font-medium">Adresse manuell überschreiben</span>
          </label>
          {block.props.useManualOverride ? (
            <TextField label="Adresse (Fallback ohne Embed-URL)" value={block.props.address} multiline onChange={(address) => replaceProps({ ...block.props, address })} />
          ) : (
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-soft)] px-3 py-2 text-xs text-muted">
              Adresse aus Praxisdaten als Fallback wenn keine Embed-URL gesetzt. Checkbox aktivieren zum manuellen Bearbeiten.
            </p>
          )}
        </div>
      );
    case 'richText':
    case 'legalText':
      return (
        <div className="space-y-3">
          <TextField label="Überschrift" value={block.props.heading} onChange={(heading) => replaceProps({ ...block.props, heading })} />
          <TextField label="HTML / Text" value={block.props.html} multiline onChange={(html) => replaceProps({ ...block.props, html })} />
        </div>
      );
    default:
      return null;
  }
}

function LogoEditor({ projectId, initialLogo }: { projectId: string; initialLogo?: WebsiteAssetRef | null }) {
  const utils = trpc.useUtils();
  const { data: assets } = trpc.websitePlatform.listAssets.useQuery({ projectId });
  const [uploading, setUploading] = useState(false);
  const save = trpc.websitePlatform.updateProjectSettings.useMutation({
    onSuccess: () => void utils.websitePlatform.getProject.invalidate({ projectId }),
  });
  const currentAsset = initialLogo?.assetId
    ? assets?.find((a) => a.id === initialLogo.assetId)
    : null;

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/website-assets/upload?projectId=${projectId}`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { asset: Asset };
      save.mutate({ projectId, logoAsset: { assetId: payload.asset.id } });
      await utils.websitePlatform.listAssets.invalidate({ projectId });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Logo / Favicon</p>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Wird im Navigationsmenü und als Favicon verwendet. Ohne Logo: Monogramm aus erstem Buchstaben.
      </p>
      {currentAsset ? (
        <div className="flex items-center gap-3">
          <img src={currentAsset.url} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-[var(--color-border)]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate text-muted">{assetFileName(currentAsset.storageKey)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => save.mutate({ projectId, logoAsset: null })}>Entfernen</Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-3 text-center text-xs text-muted">
          Kein Logo — Monogramm wird verwendet
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-muted-soft)] ${uploading ? 'opacity-50' : ''}`}>
          {uploading ? 'Lädt…' : '+ Logo hochladen'}
          <input type="file" accept="image/*" disabled={uploading} className="sr-only"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        </label>
      </div>
      {(assets?.filter((a) => /\.(png|jpg|jpeg|svg|webp)$/i.test(a.storageKey))?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted">Aus Bibliothek wählen</p>
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {assets?.filter((a) => /\.(png|jpg|jpeg|svg|webp)$/i.test(a.storageKey)).map((asset) => (
              <button
                key={asset.id}
                onClick={() => save.mutate({ projectId, logoAsset: { assetId: asset.id } })}
                className={`relative rounded-lg border p-1 transition-colors hover:border-[var(--color-accent)] ${initialLogo?.assetId === asset.id ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]' : 'border-[var(--color-border)]'}`}
              >
                <img src={asset.url} alt={asset.alt ?? ''} className="h-10 w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomCssEditor({ projectId, initialCss }: { projectId: string; initialCss?: string | null }) {
  const utils = trpc.useUtils();
  const [css, setCss] = useState(initialCss ?? '');
  const [saved, setSaved] = useState(true);
  const save = trpc.websitePlatform.updateProjectSettings.useMutation({
    onSuccess: () => {
      setSaved(true);
      void utils.websitePlatform.getProject.invalidate({ projectId });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Custom CSS</p>
        {!saved && (
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate({ projectId, customCss: css || null })}
          >
            Speichern
          </Button>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        CSS-Variablen überschreiben: z.B. <code>:root {'{'} --color-secondary: #F5A623; {'}'}</code>
      </p>
      <textarea
        value={css}
        onChange={(e) => { setCss(e.target.value); setSaved(false); }}
        rows={10}
        placeholder=":root {\n  --color-secondary: #F5A623;\n  --color-secondary-hover: #e09100;\n}"
        className="w-full rounded-lg border px-3 py-2 font-mono text-xs"
        style={{ borderColor: 'var(--color-border)', background: 'white', resize: 'vertical' }}
      />
      {saved && css && <p className="text-xs text-green-600">✓ Gespeichert</p>}
    </div>
  );
}

export function WebsiteEditorShell({ projectId, tenantHoursRows, tenantConsultationHoursRows, tenantOpeningHoursRows, tenantSpecialHours, tenantContactInfo }: {
  projectId: string;
  tenantHoursRows?: { days: string; time: string }[] | null;
  tenantConsultationHoursRows?: { days: string; time: string }[] | null;
  tenantOpeningHoursRows?: { days: string; time: string }[] | null;
  tenantSpecialHours?: Array<{ id: string; title: string; startsOn?: string; endsOn?: string; rows: { days: string; time: string }[]; note?: string }> | null;
  tenantContactInfo?: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: project } = trpc.websitePlatform.getProject.useQuery({ projectId });
  const { data: pages } = trpc.websitePlatform.listPages.useQuery({ projectId });
  const ensureSystemPages = trpc.websitePlatform.ensureSystemPages.useMutation({ onSuccess: () => utils.websitePlatform.listPages.invalidate({ projectId }) });
  const createPage = trpc.websitePlatform.createPage.useMutation({ onSuccess: () => utils.websitePlatform.listPages.invalidate({ projectId }) });
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const currentPage = pages?.find((page) => page.id === selectedPageId) ?? pages?.[0];
  const { data: draft } = trpc.websitePlatform.getDraft.useQuery({ pageId: currentPage?.id ?? '' }, { enabled: Boolean(currentPage?.id) });
  const initialBlocks = useMemo(() => pageBlocksSchema.catch([]).parse(draft?.blocks ?? []), [draft?.blocks]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPagePath, setNewPagePath] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [rightTab, setRightTab] = useState<'content' | 'design'>('content');
  const [midTab, setMidTab] = useState<'structure' | 'preview'>('structure');
  const saveDraft = trpc.websitePlatform.saveDraft.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      setLastSavedAt(new Date());
      if (currentPage) void utils.websitePlatform.getDraft.invalidate({ pageId: currentPage.id });
    },
  });
  const publish = trpc.websitePlatform.publishPage.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      setLastSavedAt(new Date());
      void utils.websitePlatform.getProject.invalidate({ projectId });
      if (currentPage) void utils.websitePlatform.getDraft.invalidate({ pageId: currentPage.id });
    },
  });
  const { data: assets } = trpc.websitePlatform.listAssets.useQuery({ projectId });
  const assetMap = useMemo(() => Object.fromEntries((assets ?? []).map((asset) => [asset.id, asset.url])), [assets]);

  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId) setSelectedPageId(pages.find((page) => page.isHomepage)?.id ?? pages[0].id);
  }, [pages, selectedPageId]);

  useEffect(() => {
    if (project && pages && !ensureSystemPages.isPending) {
      const hasImpressum = pages.some((page) => page.path === '/impressum');
      const hasDatenschutz = pages.some((page) => page.path === '/datenschutz');
      if (!hasImpressum || !hasDatenschutz) ensureSystemPages.mutate({ projectId });
    }
  }, [ensureSystemPages, pages, project, projectId]);

  useEffect(() => {
    setBlocks(initialBlocks);
    setSelectedBlockId(initialBlocks[0]?.id ?? '');
    setIsDirty(false);
    setLastSavedAt(null);
  }, [currentPage?.id, draft?.id, initialBlocks]);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId);
  const addBlock = (type: WebsiteBlockType) => {
    const block = getDefaultBlock(type) as Block;
    setBlocks([...blocks, block]);
    setSelectedBlockId(block.id);
    setIsDirty(true);
  };
  const updateBlock = (next: Block) => { setBlocks(blocks.map((block) => (block.id === next.id ? next : block))); setIsDirty(true); };
  const removeBlock = (id: string) => {
    const next = blocks.filter((block) => block.id !== id);
    setBlocks(next);
    setSelectedBlockId(next[0]?.id ?? '');
    setIsDirty(true);
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setBlocks(next);
    setIsDirty(true);
  };

  const preview: ResolvedWebsitePage | null = project && currentPage ? {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      primaryDomain: project.primaryDomain,
      layoutKey: project.layoutKey,
      themeConfig: { palette: 'sage', typography: 'modern', radius: 'lg', density: 'comfortable', ...(project.themeConfig as object | null ?? {}) },
      capabilities: project.capabilities as ResolvedWebsitePage['project']['capabilities'],
      seoConfig: null,
      ownerTenantId: project.ownerTenantId,
      logoAsset: project.logoAsset as WebsiteAssetRef | null | undefined,
      teamMembers: null,
      tenantHoursRows,
      tenantConsultationHoursRows,
      tenantOpeningHoursRows,
      tenantSpecialHours,
      tenantContactInfo,
    },
    page: {
      id: currentPage.id,
      path: currentPage.path,
      title: currentPage.title,
      pageType: currentPage.pageType,
      seoConfig: null,
    },
    blocks,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
              onClick={() => {
                if (isDirty && !confirm('Ungespeicherte Änderungen gehen verloren. Trotzdem verlassen?')) return;
                router.push('/dashboard/websites');
              }}
              className="text-sm text-muted hover:text-fg"
            >← Websites</button>
          <h1 className="text-2xl font-bold">{project?.name ?? 'Website'}</h1>
          <p className="text-muted">Seiten, Blöcke, Inhalte, Medien und Veröffentlichung verwalten.</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <a href={project ? `/site/${project.slug}${currentPage?.path === '/' ? '' : currentPage?.path ?? ''}` : '#'} target="_blank" className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-surface px-4 py-2.5 text-sm font-medium text-[var(--color-accent-text)] shadow-sm hover:bg-[var(--color-accent-soft)]">Öffnen</a>
            <Button disabled={!currentPage || saveDraft.isPending} onClick={() => currentPage && saveDraft.mutate({ pageId: currentPage.id, blocks })}>
              {isDirty && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />}
              Entwurf speichern
            </Button>
            <Button disabled={!currentPage || publish.isPending} onClick={() => currentPage && publish.mutate({ pageId: currentPage.id })}>Seite veröffentlichen</Button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            {isDirty ? (
              <span className="text-amber-600">● Ungespeicherte Änderungen</span>
            ) : lastSavedAt ? (
              <span>Gespeichert {lastSavedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : draft?.createdAt ? (
              <span>Entwurf vom {new Date(draft.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            ) : null}
            {project?.publishedAt ? (
              <span>Veröffentlicht {new Date(project.publishedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Noch nicht veröffentlicht</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr_360px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold">Seiten</h2>
            <div className="mt-3 space-y-2">
              {pages?.map((page) => (
                <button key={page.id} onClick={() => setSelectedPageId(page.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${page.id === currentPage?.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border)] bg-white'}`}>
                  <span className="font-medium">{page.title}</span>
                  <span className="block text-xs text-muted">{page.path}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
              <input value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} placeholder="Seitentitel" className={fieldClass()} />
              <input value={newPagePath} onChange={(e) => setNewPagePath(e.target.value)} placeholder="/neue-seite" className={fieldClass()} />
              <Button size="sm" disabled={!newPageTitle || !newPagePath || createPage.isPending} onClick={() => {
                if (!newPageTitle || !newPagePath) return;
                createPage.mutate({ projectId, title: newPageTitle, path: newPagePath, pageType: 'default' });
                setNewPageTitle('');
                setNewPagePath('');
              }}>Seite hinzufügen</Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold">Blöcke hinzufügen</h2>
            <div className="mt-3 grid gap-2">{Object.entries(WEBSITE_BLOCK_DEFINITIONS).map(([type, def]) => <button key={type} onClick={() => addBlock(type as WebsiteBlockType)} className="rounded-lg border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-muted-soft)]"><p className="text-sm font-medium">{def.label}</p><p className="text-xs text-muted">{def.description}</p></button>)}</div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setMidTab('structure')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${midTab === 'structure' ? 'bg-[var(--color-accent)] text-white' : 'bg-white hover:bg-[var(--color-muted-soft)]'}`}
            >
              Struktur
            </button>
            <button
              onClick={() => setMidTab('preview')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${midTab === 'preview' ? 'bg-[var(--color-accent)] text-white' : 'bg-white hover:bg-[var(--color-muted-soft)]'}`}
            >
              {isDirty && midTab !== 'preview' && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />}
              Vorschau
            </button>
          </div>

          {midTab === 'structure' && (
            <Card className="p-4">
              <h2 className="font-semibold">Struktur: {currentPage?.title ?? 'Seite'}</h2>
              <div className="mt-4 space-y-3">
                {blocks.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-muted">Noch keine Blöcke. Starte mit Hero, Leistungen und Kontakt.</p> : blocks.map((block, index) => <div key={block.id} className={`rounded-xl border bg-white p-4 ${selectedBlockId === block.id ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]' : 'border-[var(--color-border)]'}`}><button onClick={() => setSelectedBlockId(block.id)} className="w-full text-left"><p className="font-medium">{WEBSITE_BLOCK_DEFINITIONS[block.type].label}</p><p className="text-xs text-muted">#{index + 1} · {block.type}</p></button><div className="mt-3 flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑ Hoch</Button><Button size="xs" variant="outline" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓ Runter</Button><Button size="xs" variant="ghost" onClick={() => removeBlock(block.id)}>Entfernen</Button></div></div>)}
              </div>
            </Card>
          )}

          {midTab === 'preview' && (
            <Card className="overflow-hidden p-0">
              <div className="max-h-[800px] overflow-auto bg-white">{preview && <PageRenderer resolved={preview} assetMap={assetMap} />}</div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setRightTab('content')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${rightTab === 'content' ? 'bg-[var(--color-accent)] text-white' : 'bg-white hover:bg-[var(--color-muted-soft)]'}`}
            >
              Inhalt
            </button>
            <button
              onClick={() => setRightTab('design')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${rightTab === 'design' ? 'bg-[var(--color-accent)] text-white' : 'bg-white hover:bg-[var(--color-muted-soft)]'}`}
            >
              Design
            </button>
          </div>

          {rightTab === 'content' && (
            <>
              <Card className="p-4">
                <h2 className="font-semibold">Inhalt bearbeiten</h2>
                <div className="mt-4"><BlockInspector projectId={projectId} block={selectedBlock} onChange={updateBlock} /></div>
              </Card>
              <Card className="p-4">
                <TemplateVarsHelper projectId={projectId} />
              </Card>
            </>
          )}

          {rightTab === 'design' && (
            <>
              <Card className="p-4">
                <LogoEditor projectId={projectId} initialLogo={project?.logoAsset as WebsiteAssetRef | null | undefined} />
              </Card>
              <Card className="p-4">
                <CustomCssEditor projectId={projectId} initialCss={project?.customCss} />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
