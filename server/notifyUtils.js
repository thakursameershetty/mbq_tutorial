const sanitizeForTemplate = (str) => String(str || '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/ {2,}/g, ' ')
  .trim();

const buildNameWithTests = (firstName, testNames) => {
  const cleanName = sanitizeForTemplate(firstName) || 'User';
  const cleanTests = (Array.isArray(testNames) ? testNames : [testNames])
    .map(sanitizeForTemplate)
    .filter(Boolean);
  const testsStr = cleanTests.length ? cleanTests.join(', ') : 'Test';
  return sanitizeForTemplate(`${cleanName} (${testsStr})`);
};

const firstNameOf = (user) => (user && user.full_name)
  ? String(user.full_name).split(' ')[0]
  : (user && user.username ? String(user.username) : 'User');

// Mirrors GENE_PANEL_LABEL in src/lib/geneCatalog.ts — report_answers is keyed by
// these panel names, one entry per panel the patient purchased.
const GENE_PANEL_LABEL = {
  CYP1A2: 'Caffeine Sensitivity',
  ADORA2A: 'Caffeine Sensitivity',
  ACTN3: 'Muscle Performance',
  ACE: 'Muscle Performance',
  FGFR2: 'Hair',
  EDAR: 'Hair',
};

// Unique panel names the patient has to answer a survey for, derived from the
// stored gene_type string the same way getRequiredGenes does on the client.
const getRequiredPanels = (geneType) => {
  if (!geneType) return [];
  const panels = new Set();
  String(geneType).split(/,\s*(?![^(]*\))/).forEach((entry) => {
    const match = entry.match(/\(([^)]+)\)/);
    if (!match) return;
    match[1].split(',').forEach((g) => {
      const panel = GENE_PANEL_LABEL[g.trim().toUpperCase()];
      if (panel) panels.add(panel);
    });
  });
  return [...panels];
};

module.exports = { sanitizeForTemplate, buildNameWithTests, firstNameOf, getRequiredPanels };
