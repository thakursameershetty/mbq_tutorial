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

// Display order for genes within a panel, so the lab dashboard always shows
// them in the order the lab team expects, regardless of how the stored
// gene_type string lists them. Panels not listed here keep their original order.
const PANEL_GENE_DISPLAY_ORDER: Record<string, string[]> = {
  'Caffeine Sensitivity': ['ADORA2A', 'CYP1A2'],
  'Muscle Performance': ['ACE', 'ACTN3'],
};

// ACTN3 genotypes are stored/submitted as RR/RX/XX (used throughout report
// generation), but the lab team reads them as CC/CT/TT. This only changes
// what's shown in the dropdown, not the underlying value.
const VARIANT_DISPLAY_LABEL: Record<string, Record<string, string>> = {
  ACTN3: { RR: 'CC', RX: 'CT', XX: 'TT' },
};

export const getVariantLabel = (gene: string, variant: string): string =>
  VARIANT_DISPLAY_LABEL[gene]?.[variant] || variant;

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
    const panelOfFirst = GENE_PANEL_LABEL[genes[0]];
    const displayOrder = panelOfFirst && PANEL_GENE_DISPLAY_ORDER[panelOfFirst];
    if (displayOrder) {
      genes.sort((a, b) => displayOrder.indexOf(a) - displayOrder.indexOf(b));
    }
    genes.forEach((gene) => {
      const variants = GENE_VARIANTS[gene];
      if (!variants) return;
      required.push({ panel: GENE_PANEL_LABEL[gene] || gene, name: gene, variants });
    });
  });
  return required;
};
