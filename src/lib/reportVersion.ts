// Report schema versions. v1 is the original contract (and every report saved
// before v2 shipped - those are never migrated). v2 is the backend's
// rag/report_layout.py contract: page keys follow physical page order and
// `_meta.report_schema_version` is 2. A report's own version decides which
// template renders it, so old and new reports can coexist.

export type ReportVersion = 1 | 2;

export const reportSchemaVersion = (report: any): ReportVersion =>
  report?._meta?.report_schema_version === 2 ? 2 : 1;

export const reportTemplateUrl = (testId: string, version: ReportVersion) =>
  version === 2 ? `/templates/v2/${testId}-sample.html` : `/templates/${testId}-sample.html`;

// The template fill-in code reads the v1 field layout (science on page_2,
// action plan + coach on page_4). v2 moved those fields but kept their shapes,
// so map them back instead of forking the fill-in code; fields new in v2 stay
// on the original page keys, kept under `v2_pages`. v1 reports pass through
// unchanged.
export function toV1FieldLayout(report: any): any {
  if (!report || reportSchemaVersion(report) !== 2) return report;
  const { page_1 = {}, page_2, page_3 = {}, page_4 = {}, page_5, ...rest } = report;
  const science = page_4.science_behind_it;
  return {
    ...rest,
    page_1,
    page_2: {
      ...page_4,
      science_behind_it: science && !Array.isArray(science)
        ? [science.how_it_works, science.how_this_test_helps]
        : science,
    },
    page_4: { ...page_3, coach_recommendation: page_1.coach_recommendation },
    v2_pages: { page_2, page_3, page_4, page_5 },
  };
}
