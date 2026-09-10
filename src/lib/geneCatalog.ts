export interface GeneOption {
  label: string;
  tier: 'lite' | 'pro';
  genes: string[];
}

export interface GeneCategory {
  name: string;
  options: GeneOption[];
}

// Each category offers two single-gene "Lite" options (one subgene) plus one
// two-gene "Pro" option (both subgenes) so admins can assign either tier per
// patient, matching the tiers PatientSurveyModal narrows the questionnaire to.
export const GENE_CATALOG: GeneCategory[] = [
  {
    name: 'Caffeine Response',
    options: [
      { label: 'Caffeine Metabolism (CYP1A2)', tier: 'lite', genes: ['CYP1A2'] },
      { label: 'Caffeine Sensitivity (ADORA2A)', tier: 'lite', genes: ['ADORA2A'] },
      { label: 'Caffeine Response (CYP1A2,ADORA2A)', tier: 'pro', genes: ['CYP1A2', 'ADORA2A'] },
    ],
  },
  {
    name: 'Muscle Power vs Endurance',
    options: [
      { label: 'Muscle Power (ACTN3)', tier: 'lite', genes: ['ACTN3'] },
      { label: 'Muscle Endurance (ACE)', tier: 'lite', genes: ['ACE'] },
      { label: 'Muscle Power vs Endurance (ACTN3,ACE)', tier: 'pro', genes: ['ACTN3', 'ACE'] },
    ],
  },
  {
    name: 'Hair Thickness & Root Structure',
    options: [
      { label: 'Hair Thickness (FGFR2)', tier: 'lite', genes: ['FGFR2'] },
      { label: 'Hair Root Structure (EDAR)', tier: 'lite', genes: ['EDAR'] },
      { label: 'Hair Thickness & Root Structure (EDAR,FGFR2)', tier: 'pro', genes: ['EDAR', 'FGFR2'] },
    ],
  },
];

// Flat list of every selectable option, for pages that just need all of them.
export const GENE_OPTIONS: GeneOption[] = GENE_CATALOG.flatMap((c) => c.options);

const GENE_VARIANTS: Record<string, string[]> = {
  CYP1A2: ['AA', 'AC', 'CC'],
  ADORA2A: ['TT', 'TC', 'CC'],
  ACTN3: ['RR', 'RX', 'XX'],
  ACE: ['II', 'ID', 'DD'],
  EDAR: ['GG', 'AG', 'AA'],
  FGFR2: ['TT', 'GT', 'GG'],
};

const GENE_PANEL_LABEL: Record<string, string> = {
  CYP1A2: 'Caffeine Sensitivity',
  ADORA2A: 'Caffeine Sensitivity',
  ACTN3: 'Muscle Performance',
  ACE: 'Muscle Performance',
  EDAR: 'Hair',
  FGFR2: 'Hair',
};

export interface RequiredGene {
  panel: string;
  name: string;
  variants: string[];
}

// Splits a stored gene_type string into its individual panel labels: commas
// outside of a "(...)" group.
export const splitGenePanels = (geneTypeString: string): string[] =>
  geneTypeString.split(/,\s*(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);

// Extracts the required genes (with their possible genotype variants) out of a
// stored gene_type string, by reading the gene codes out of each panel's
// trailing "(...)" group — works for both two-gene Pro panels and
// single-gene Lite panels without a case per option.
export const getRequiredGenes = (geneTypeString: string): RequiredGene[] => {
  if (!geneTypeString) return [];
  const required: RequiredGene[] = [];
  splitGenePanels(geneTypeString).forEach((panel) => {
    const match = panel.match(/\(([^)]+)\)/);
    if (!match) return;
    const genes = match[1].split(',').map((g) => g.trim().toUpperCase()).filter(Boolean);
    genes.forEach((gene) => {
      const variants = GENE_VARIANTS[gene];
      if (!variants) return;
      required.push({ panel: GENE_PANEL_LABEL[gene] || gene, name: gene, variants });
    });
  });
  return required;
};
