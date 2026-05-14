export type TemplateVars = Record<string, string>;

export function interpolate(text: string | undefined | null, vars: TemplateVars): string {
  if (!text) return text ?? '';
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const value = vars[key.trim()];
    return value !== undefined ? value : match;
  });
}

export function buildTemplateVars(context: {
  projectName: string;
  contactInfo?: { phone?: string | null; email?: string | null; address?: string | null; city?: string | null } | null;
  teamMembers?: { fullName: string; title?: string | null }[] | null;
}): TemplateVars {
  const vars: TemplateVars = {
    'praxis.name': context.projectName,
    'praxis.telefon': context.contactInfo?.phone ?? '',
    'praxis.email': context.contactInfo?.email ?? '',
    'praxis.adresse': [context.contactInfo?.address, context.contactInfo?.city].filter(Boolean).join(', '),
    'praxis.stadt': context.contactInfo?.city ?? '',
    'jahr': String(new Date().getFullYear()),
  };
  context.teamMembers?.forEach((m, i) => {
    vars[`team.${i + 1}.name`] = m.fullName;
    vars[`team.${i + 1}.titel`] = m.title ?? '';
  });
  return vars;
}

export const TEMPLATE_VAR_DOCS: { key: string; desc: string }[] = [
  { key: '{{praxis.name}}', desc: 'Praxisname' },
  { key: '{{praxis.telefon}}', desc: 'Telefonnummer' },
  { key: '{{praxis.email}}', desc: 'E-Mail-Adresse' },
  { key: '{{praxis.adresse}}', desc: 'Adresse + Stadt' },
  { key: '{{praxis.stadt}}', desc: 'Stadt' },
  { key: '{{jahr}}', desc: 'Aktuelles Jahr' },
  { key: '{{team.1.name}}', desc: 'Name Tierarzt 1' },
  { key: '{{team.1.titel}}', desc: 'Titel Tierarzt 1' },
  { key: '{{team.2.name}}', desc: 'Name Tierarzt 2' },
  { key: '{{team.2.titel}}', desc: 'Titel Tierarzt 2' },
];
