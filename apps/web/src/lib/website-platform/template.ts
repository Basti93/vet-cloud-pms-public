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
  teamMembers?: { id: string; fullName: string; title?: string | null }[] | null;
}): TemplateVars {
  const vars: TemplateVars = {
    'praxis.name': context.projectName,
    'praxis.telefon': context.contactInfo?.phone ?? '',
    'praxis.email': context.contactInfo?.email ?? '',
    'praxis.adresse': [context.contactInfo?.address, context.contactInfo?.city].filter(Boolean).join(', '),
    'praxis.stadt': context.contactInfo?.city ?? '',
    'jahr': String(new Date().getFullYear()),
  };
  context.teamMembers?.forEach((m) => {
    const id8 = m.id.replace(/-/g, '').slice(0, 8);
    vars[`team.${id8}.name`] = m.fullName;
    if (m.title) vars[`team.${id8}.titel`] = m.title;
  });
  return vars;
}

// Static vars only — team vars are dynamic (generated from actual users in the editor)
export const TEMPLATE_VAR_DOCS: { key: string; desc: string }[] = [
  { key: '{{praxis.name}}', desc: 'Praxisname' },
  { key: '{{praxis.telefon}}', desc: 'Telefonnummer' },
  { key: '{{praxis.email}}', desc: 'E-Mail-Adresse' },
  { key: '{{praxis.adresse}}', desc: 'Adresse + Stadt' },
  { key: '{{praxis.stadt}}', desc: 'Stadt' },
  { key: '{{jahr}}', desc: 'Aktuelles Jahr' },
];
