import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, Sparkles, FileText, ArrowRight, X, Download, ChevronLeft, ChevronRight, Shuffle, Lightbulb, ImageIcon, CheckCircle2 } from 'lucide-react';
import FloatingChatbot from '../components/FloatingChatbot';

// Tests for the "what's coming next" interest list shown during the download
// countdown, grouped the way the product catalog groups them. Mirrors
// ReportViewerModal.tsx so this dev preview matches the patient-facing flow.
// Tests already offered in the current panel (Muscle, Caffeine, Hair) are
// intentionally left out - this list is only what's still upcoming.
const UPCOMING_TEST_CATEGORIES = [
  {
    name: 'Daily Wellness',
    description: 'Discover how your genes can guide the everyday choices that support your health and well-being.',
    tests: [
      { name: 'Body Fuel Qode', image: '/assets/upcoming-tests/body-fuel-qode.svg', description: 'Trying to lose weight but wondering why your body responds differently?' },
      { name: 'Metabolism Qode', image: '/assets/upcoming-tests/metabolism-qode.svg', description: 'Ever wondered why some people seem to burn energy faster than others?' },
      { name: 'Sleep Qode', image: '/assets/upcoming-tests/sleep-qode-test.svg', description: 'Are you naturally an early bird - or do you come alive at night?' },
      { name: 'Dairy Qode', image: '/assets/upcoming-tests/dairy-qode-test.svg', description: 'Does milk or milk products make you feel uncomfortable?' },
      { name: 'Taste Qode', image: '/assets/upcoming-tests/taste-qode-test.svg', description: 'Why does the same food taste bitter to you but not to someone else?' },
      { name: 'City Shield Qode', image: '/assets/upcoming-tests/city-shield-qode-test.svg', description: 'Wondering how well your body handles everyday pollution and environmental stress?' },
    ],
  },
  {
    name: 'Daily Performance',
    description: 'Unlock your genetic potential and discover how your body is built to perform, adapt, and recover.',
    tests: [
      { name: 'Performance Qode', image: '/assets/upcoming-tests/performance-qode-test.svg', description: 'Do you want to know what kind of exercise your body may naturally enjoy?' },
    ],
  },
  {
    name: 'Daily Appearance',
    description: 'Your DNA holds clues to your skin and hair - see what they reveal about your natural appearance.',
    tests: [
      { name: 'Collagen Qode', image: '/assets/upcoming-tests/collagen-qode-test.svg', description: "Want to know how your genes may affect your skin's natural support?" },
      { name: 'Hair Fall Qode', image: '/assets/upcoming-tests/hair-fall-qode-test.svg', description: 'Worried about hair fall or thinning?' },
      { name: 'Grey Qode', image: '/assets/upcoming-tests/grey-qode-test.svg', description: 'Wondering why some people go grey earlier than others?' },
    ],
  },
];

const DOWNLOAD_COUNTDOWN_SECONDS = 10;

const LikeIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="#664FC2" d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2M4 10h2v9H4zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7z" />
  </svg>
);

const DislikeIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="#664FC2" d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2 2 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.36l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2m-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638zM18 14V5h2l.001 9z" />
  </svg>
);

// Every question's illustration lives at
// src/assets/questionare-images/<subgene>/<category>-<subgene>-q<n>.png (n is
// 1-based). Loading them all via import.meta.glob means a new image just has
// to be dropped in the right folder - no import to add here by hand. Mirrors
// PatientSurveyModal.tsx so this dev preview matches the patient-facing survey.
const questionImageModules = import.meta.glob('../assets/questionare-images/*/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const QUESTION_IMAGES: Record<string, string> = {};
for (const [path, src] of Object.entries(questionImageModules)) {
  const match = path.match(/-([a-z0-9]+)-q(\d+)\.png$/i);
  if (!match) continue;
  const [, subgene, questionNumber] = match;
  QUESTION_IMAGES[`${subgene.toUpperCase()}-${Number(questionNumber) - 1}`] = src;
}

interface Question {
  question: string;
  example: string;
  image?: string;
  options: { text: string; score: number }[];
  weightage: number;
}

interface TestData {
  id: number;
  test_name: string;
  subgene1_name: string;
  subgene2_name: string;
}

const VARIANT_OPTIONS: Record<string, string[]> = {
  CYP1A2: ['AA', 'AC', 'CC'],
  ADORA2A: ['TT', 'TC', 'CC'],
  ACTN3: ['RR', 'RX', 'XX'],
  ACE: ['II', 'ID', 'DD'],
  EDAR: ['GG', 'AG', 'AA'],
  FGFR2: ['TT', 'GT', 'GG'],
};

// Every question's 3 options are seeded in the same fixed order (score 1, 0, -1 -
// see server/createQuestionsTable.js), and each gene's 3 genotypes represent the
// same dominant/heterozygous/recessive tiers - so "High"/"Neutral"/"Low" picks a
// consistent tier across every question AND every gene, rather than the old
// per-question/per-gene random pick (which could land on a mix of tiers and
// produce an internally inconsistent-reading report). Note VARIANT_OPTIONS above
// is the raw lab-entry dropdown order (not always High-to-Low - e.g. ACE lists
// II first), so this maps genotypes explicitly by tier instead of by array index.
type RandomizeLevel = 'high' | 'neutral' | 'low';
const LEVEL_TO_OPTION_INDEX: Record<RandomizeLevel, number> = { high: 0, neutral: 1, low: 2 };
const LEVEL_GENOTYPE: Record<string, Record<RandomizeLevel, string>> = {
  CYP1A2: { high: 'AA', neutral: 'AC', low: 'CC' },
  ADORA2A: { high: 'TT', neutral: 'TC', low: 'CC' },
  ACTN3: { high: 'RR', neutral: 'RX', low: 'XX' },
  ACE: { high: 'DD', neutral: 'ID', low: 'II' },
  EDAR: { high: 'GG', neutral: 'AG', low: 'AA' },
  FGFR2: { high: 'TT', neutral: 'GT', low: 'GG' },
};

interface SelectedQuestion extends Question {
  test_name: string;
  subgene_name: string;
  uniqueId: string;
}

// Every template page is laid out at a fixed intrinsic size (matches the
// jsPDF page format used by downloadPDF) - the report itself is never
// responsive, so on a narrow viewport we scale the whole page down
// uniformly with a CSS transform rather than letting it overflow/crop.
// Mirrors ReportViewerModal.tsx so both viewers render identically.
const DESIGN_WIDTH = 1024;
const DESIGN_HEIGHT = 1449;

export default function TestReportPage() {
  const [allQuestions, setAllQuestions] = useState<SelectedQuestion[]>([]);
  const [tests, setTests] = useState<TestData[]>([]);
  const [selectedTestName, setSelectedTestName] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('Male');
  const [geneVariants, setGeneVariants] = useState<Record<string, string>>({});
  const [testMode, setTestMode] = useState<'both' | 'single'>('both');
  const [singleGene, setSingleGene] = useState<string>('');

  const [loadingQs, setLoadingQs] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [customAnswers, setCustomAnswers] = useState<{ [uniqueId: string]: string }>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [generating, setGenerating] = useState(false);
  // Simulated 0-100 progress for the (single, un-instrumented) generate-report call -
  // there's no real progress stream from the backend, so this eases toward 90% while
  // waiting and is snapped to 100% right before the result is shown.
  const [genProgress, setGenProgress] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);
  const [reportResult, setReportResult] = useState<any>(null);
  // The exact gene(s) actually sent to the backend for the current reportResult -
  // may be a single-gene subset of `geneVariants`, which can still hold a stale
  // second entry left over from switching modes.
  const [reportGenes, setReportGenes] = useState<Record<string, string>>({});
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  // Pages aren't all a uniform 1449px tall (some grow with content) - track the
  // currently-visible page's real rendered height so it's shown in full rather
  // than clipped to (or padded out to) one fixed length for every page.
  const [pageHeight, setPageHeight] = useState(DESIGN_HEIGHT);

  // Download countdown / "what's next" interest-collection flow - mirrors
  // ReportViewerModal.tsx so this preview shows exactly what patients see.
  // Interests are kept purely in local state here (no mbqId to persist
  // against in this dev tool), just for previewing the interaction.
  const [showDownloadFlow, setShowDownloadFlow] = useState(false);
  const [downloadCountdown, setDownloadCountdown] = useState(DOWNLOAD_COUNTDOWN_SECONDS);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [testInterests, setTestInterests] = useState<Record<string, boolean>>({});
  const isDownloadDone = showDownloadFlow && downloadCountdown === 0 && !pdfGenerating;

  const triggerDownload = () => {
    setPdfGenerating(true);
    const iframe = document.getElementById('report-iframe') as HTMLIFrameElement | null;
    const downloadFn = iframe?.contentWindow && (iframe.contentWindow as any).downloadPDF;
    const genPromise = downloadFn
      ? downloadFn(`${selectedTestName.toLowerCase().replace(/\s+/g, '-')}-report.pdf`)
      : Promise.resolve();
    Promise.resolve(genPromise)
      .catch((e: any) => console.error('PDF generation failed:', e))
      .finally(() => setPdfGenerating(false));
  };

  useEffect(() => {
    if (!showDownloadFlow) return;

    setDownloadCountdown(DOWNLOAD_COUNTDOWN_SECONDS);
    triggerDownload();

    const interval = setInterval(() => {
      setDownloadCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [showDownloadFlow]);

  useEffect(() => {
    fetchQuestions();
    return () => {
      if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const t = tests.find(t => t.test_name === selectedTestName);
    if (t) setSingleGene(t.subgene1_name);
  }, [selectedTestName, tests]);

  // The questionnaire is walked one question at a time - jump back to the
  // first one whenever the underlying question set changes (test, mode, or
  // which single gene is selected) so the step index can't point past the end.
  useEffect(() => {
    setCurrentQIndex(0);
  }, [selectedTestName, testMode, singleGene]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      // Fit the page to the viewport's width exactly (no side margins). The iframe's
      // own scrolling is disabled, so the outer viewport is the only scrollable
      // region if a page ends up taller than the visible area.
      if (width > 0) setScale(Math.min(1, width / DESIGN_WIDTH));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reportHtml]);

  useEffect(() => {
    setIframeReady(false);
    setPageHeight(DESIGN_HEIGHT);
  }, [reportHtml]);

  useEffect(() => {
    if (!iframeReady) return;
    const iframe = document.getElementById('report-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'SET_PAGE', pageIndex: currentPageIndex }, '*');

    // Measure the now-visible page's real height once the display swap (and the
    // resulting reflow) has settled - a single rAF isn't reliably after layout in
    // every browser, so wait a frame, then measure on the one after that.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const doc = iframe?.contentDocument;
        const pages = doc?.querySelectorAll('div[data-screen-label]');
        const visible = pages?.[currentPageIndex] as HTMLElement | undefined;
        const height = visible?.scrollHeight || doc?.body?.scrollHeight;
        if (height && height > 0) setPageHeight(height);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [iframeReady, currentPageIndex]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_QODAI_CHAT') {
        // Keep the report open — the chat panel floats on top of it (higher z-index).
        window.dispatchEvent(new CustomEvent('open-qodai-chat'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchQuestions = async () => {
    setLoadingQs(true);
    try {
      const res = await fetch('/api/admin/questions');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      const selectedQs: SelectedQuestion[] = [];
      const loadedTests: TestData[] = [];

      data.forEach((test: any) => {
        loadedTests.push({
          id: test.id,
          test_name: test.test_name,
          subgene1_name: test.subgene1_name,
          subgene2_name: test.subgene2_name
        });

        const parseQ = (qs: any) => (typeof qs === 'string' ? JSON.parse(qs) : qs);
        const sub1 = parseQ(test.subgene1_questions || "[]");
        const sub2 = parseQ(test.subgene2_questions || "[]");

        sub1.forEach((q: Question, idx: number) => {
          const image = QUESTION_IMAGES[`${test.subgene1_name}-${idx}`];
          selectedQs.push({ ...q, image, test_name: test.test_name, subgene_name: test.subgene1_name, uniqueId: `${test.id}-1-${idx}` });
        });
        sub2.forEach((q: Question, idx: number) => {
          const image = QUESTION_IMAGES[`${test.subgene2_name}-${idx}`];
          selectedQs.push({ ...q, image, test_name: test.test_name, subgene_name: test.subgene2_name, uniqueId: `${test.id}-2-${idx}` });
        });
      });

      setAllQuestions(selectedQs);
      setTests(loadedTests);
      if (loadedTests.length > 0) {
        setSelectedTestName(loadedTests[0].test_name);
      }
    } catch (err) {
      console.error("Failed to load questions", err);
    } finally {
      setLoadingQs(false);
    }
  };

  const handleRandomize = (level: RandomizeLevel) => {
    const optionIndex = LEVEL_TO_OPTION_INDEX[level];
    if (questions.length > 0) {
      setAnswers(prev => {
        const next = { ...prev };
        questions.forEach(q => {
          next[q.uniqueId] = Math.min(optionIndex, q.options.length - 1);
        });
        return next;
      });
    }

    if (currentTest) {
      const genesToRandomize = testMode === 'single'
        ? [singleGene]
        : [currentTest.subgene1_name, currentTest.subgene2_name];
      setGeneVariants(prev => {
        const next = { ...prev };
        genesToRandomize.forEach(gene => {
          const genotype = LEVEL_GENOTYPE[gene]?.[level];
          if (genotype) {
            next[gene] = genotype;
          }
        });
        return next;
      });
    }
  };

  const handleGenerate = async () => {
    const answeredQuestionIds = new Set([
      ...Object.keys(answers),
      ...Object.keys(customAnswers).filter(id => customAnswers[id].trim() !== '')
    ]);
    if (answeredQuestionIds.size < questions.length) {
      alert("Please answer all questions before generating.");
      return;
    }

    const selectedTest = tests.find(t => t.test_name === selectedTestName);
    if (selectedTest) {
      if (testMode === 'single') {
        if (!geneVariants[singleGene]) {
          alert("Please select a variant for the chosen gene.");
          return;
        }
      } else if (!geneVariants[selectedTest.subgene1_name] || !geneVariants[selectedTest.subgene2_name]) {
        alert("Please select variants for both genes.");
        return;
      }
    }

    const genesToSend = testMode === 'single'
      ? { [singleGene]: geneVariants[singleGene] }
      : geneVariants;

    setGenerating(true);
    setGenProgress(0);
    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      setGenProgress(prev => {
        if (prev >= 90) return prev;
        const step = Math.max(1, (90 - prev) * 0.08);
        return Math.min(90, prev + step);
      });
    }, 300);

    try {
      // Build raw string answers for the AI context
      const rawAnswers = questions.map(q => {
        let answerText = "";
        const optIdx = answers[q.uniqueId];
        if (optIdx !== undefined && q.options[optIdx]) {
          answerText = q.options[optIdx].text;
        }
        if (customAnswers[q.uniqueId] && customAnswers[q.uniqueId].trim() !== "") {
          if (answerText) answerText += " ";
          answerText += `(Custom remarks: ${customAnswers[q.uniqueId].trim()})`;
        }
        if (answerText) {
          return `Question: ${q.question} | Answer: ${answerText}`;
        }
        return "";
      }).filter(Boolean);

      const res = await fetch(`/api/test/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          rawAnswers,
          testName: selectedTestName,
          geneVariants: genesToSend
        }),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (data.success) {
        setGenProgress(100);
        setReportResult(data.report);
        setReportGenes(genesToSend);
        // Briefly hold at 100% before revealing the result, so the number is
        // actually visible rather than jumping straight past it.
        await new Promise(resolve => setTimeout(resolve, 400));
      } else {
        alert("Generation failed: " + data.error);
      }
    } catch (err) {
      console.error("Failed to generate", err);
      alert("Error calling generate endpoint");
    } finally {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setGenerating(false);
      setGenProgress(0);
    }
  };

  const questions = allQuestions.filter(q =>
    q.test_name === selectedTestName && (testMode === 'both' || q.subgene_name === singleGene)
  );
  const answeredQuestionIds = new Set([
    ...Object.keys(answers),
    ...Object.keys(customAnswers).filter(id => customAnswers[id].trim() !== '')
  ]);
  const allAnswered = questions.length > 0 && answeredQuestionIds.size === questions.length;
  const currentTest = tests.find(t => t.test_name === selectedTestName);
  const currentQuestion = questions[currentQIndex];
  const isCurrentAnswered = currentQuestion ? answeredQuestionIds.has(currentQuestion.uniqueId) : false;
  const isLastQuestion = currentQIndex === questions.length - 1;
  const qProgressPct = questions.length > 0 ? ((currentQIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] w-full max-w-7xl mx-auto px-4 gap-4 pb-6">
      {/* LEFT PANE - Questionnaire */}
      <div className="flex-1 bg-white rounded-3xl border border-[#E8E8E5] shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-[#E8E8E5] flex items-center gap-3 bg-[#F9F9F8]">
          <div className="flex-1 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="px-4 py-2 bg-white border border-[#E8E8E5] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#6057D7] min-w-[110px]"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              <select
                value={selectedTestName}
                onChange={(e) => {
                  setSelectedTestName(e.target.value);
                  setAnswers({});
                }}
                className="px-4 py-2 bg-white border border-[#E8E8E5] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#6057D7] min-w-[150px]"
              >
                {tests.map(t => (
                  <option key={t.id} value={t.test_name}>{t.test_name}</option>
                ))}
              </select>

              <div className="flex items-center bg-white border border-[#E8E8E5] rounded-xl p-1 text-sm font-bold">
                <button
                  onClick={() => setTestMode('both')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${testMode === 'both' ? 'bg-[#1A1A19] text-white' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
                >
                  2 Genes
                </button>
                <button
                  onClick={() => setTestMode('single')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${testMode === 'single' ? 'bg-[#1A1A19] text-white' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
                >
                  1 Gene
                </button>
              </div>
            </div>
          </div>
        </div>

        {!loadingQs && questions.length > 0 && (
          <div className="px-6 pt-4 bg-[#F9F9F8]">
            <div className="h-1.5 w-full bg-[#E8E8E5] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#6057D7] rounded-full"
                initial={false}
                animate={{ width: `${qProgressPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {currentTest && testMode === 'single' && (
          <div className="px-6 py-4 border-b border-[#E8E8E5] bg-indigo-50/30 flex gap-6">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#6057D7] mb-1">Gene</label>
              <select
                value={singleGene}
                onChange={(e) => setSingleGene(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E8E8E5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6057D7]"
              >
                <option value={currentTest.subgene1_name}>{currentTest.subgene1_name}</option>
                <option value={currentTest.subgene2_name}>{currentTest.subgene2_name}</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#6057D7] mb-1">{singleGene} Variant</label>
              <select
                value={geneVariants[singleGene] || ''}
                onChange={(e) => setGeneVariants(prev => ({ ...prev, [singleGene]: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-[#E8E8E5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6057D7]"
              >
                <option value="">Select Variant...</option>
                {VARIANT_OPTIONS[singleGene]?.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentTest && testMode === 'both' && (
          <div className="px-6 py-4 border-b border-[#E8E8E5] bg-indigo-50/30 flex gap-6">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#6057D7] mb-1">{currentTest.subgene1_name} Variant</label>
              <select
                value={geneVariants[currentTest.subgene1_name] || ''}
                onChange={(e) => setGeneVariants(prev => ({ ...prev, [currentTest.subgene1_name]: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-[#E8E8E5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6057D7]"
              >
                <option value="">Select Variant...</option>
                {VARIANT_OPTIONS[currentTest.subgene1_name]?.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#6057D7] mb-1">{currentTest.subgene2_name} Variant</label>
              <select
                value={geneVariants[currentTest.subgene2_name] || ''}
                onChange={(e) => setGeneVariants(prev => ({ ...prev, [currentTest.subgene2_name]: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-[#E8E8E5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6057D7]"
              >
                <option value="">Select Variant...</option>
                {VARIANT_OPTIONS[currentTest.subgene2_name]?.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-[#FDFDFD]">
          {loadingQs ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#6057D7]" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#8B8B86]">
              No questions found for the selected test.
            </div>
          ) : (
            <div className="max-w-xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.uniqueId}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="text-xs font-bold text-[#6057D7] bg-indigo-50 px-2.5 py-1 rounded-md mb-4 inline-block">
                    {currentQuestion.test_name} - {currentQuestion.subgene_name}
                  </span>

                  {/* Fixed height (not aspect-ratio) so every question's frame is the
                      same size regardless of that image's own ratio, and object-contain
                      so nothing is ever cropped - the source images range from 4:3 to 2:1. */}
                  <div className="w-full h-44 sm:h-52 rounded-2xl bg-[#F2F2F0] border border-[#E8E8E5] flex items-center justify-center mb-5 overflow-hidden">
                    {currentQuestion.image ? (
                      <img src={currentQuestion.image} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-[#C7C7C2]" />
                    )}
                  </div>

                  <h3 className="text-[#1A1A19] font-bold text-lg mb-3">
                    {currentQIndex + 1}. {currentQuestion.question}
                  </h3>

                  {currentQuestion.example && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900 leading-relaxed">
                        <span className="font-bold">Example: </span>
                        {currentQuestion.example}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {currentQuestion.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.uniqueId]: optIdx }))}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3
                          ${answers[currentQuestion.uniqueId] === optIdx
                            ? 'border-[#6057D7] bg-indigo-50/40 text-[#1A1A19]'
                            : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE] text-[#5A5A55]'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                          ${answers[currentQuestion.uniqueId] === optIdx ? 'border-[#6057D7]' : 'border-[#D4D4CE]'}`}
                        >
                          {answers[currentQuestion.uniqueId] === optIdx && <div className="w-2 h-2 bg-[#6057D7] rounded-full" />}
                        </div>
                        <span className="text-sm font-medium">{opt.text}</span>
                      </button>
                    ))}
                    <div className="pt-2">
                      <input
                        type="text"
                        value={customAnswers[currentQuestion.uniqueId] || ''}
                        onChange={(e) => setCustomAnswers(prev => ({ ...prev, [currentQuestion.uniqueId]: e.target.value }))}
                        placeholder="Any specific remarks or custom input..."
                        className="w-full p-3 text-sm border border-[#E8E8E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6057D7]/20 focus:border-[#6057D7] transition-all bg-white placeholder-[#B0B0AE] text-[#1A1A19]"
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E8E8E5] bg-white flex justify-between items-center gap-3">
          <button
            onClick={() => setCurrentQIndex(i => Math.max(i - 1, 0))}
            disabled={currentQIndex === 0}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-bold text-sm transition-all shrink-0
              ${currentQIndex === 0 ? 'text-[#C7C7C2] cursor-not-allowed' : 'text-[#5A5A55] hover:bg-[#F0F0ED]'}`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex flex-col items-center shrink-0">
            <span className="text-sm font-bold text-[#1A1A19]">
              Question {questions.length > 0 ? currentQIndex + 1 : 0} of {questions.length}
            </span>
            <span className="text-xs text-[#8B8B86]">
              Answered: {answeredQuestionIds.size} / {questions.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Shuffle className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#1A1A19]" />
              <select
                value=""
                onChange={(e) => {
                  const level = e.target.value as RandomizeLevel | '';
                  if (level) handleRandomize(level);
                  e.target.value = '';
                }}
                disabled={questions.length === 0}
                className="appearance-none cursor-pointer flex items-center gap-2 pl-9 pr-8 py-2.5 rounded-xl font-bold text-sm border border-[#E8E8E5] text-[#1A1A19] bg-white hover:bg-[#F0F0ED] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>Randomize</option>
                <option value="high">High</option>
                <option value="neutral">Neutral</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B8B86]" />
            </div>
            <button
              onClick={() => setCurrentQIndex(i => Math.min(i + 1, questions.length - 1))}
              disabled={isLastQuestion || !isCurrentAnswered}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all
                ${!isLastQuestion && isCurrentAnswered
                  ? 'bg-[#1A1A19] text-white hover:bg-black'
                  : 'bg-[#F0F0ED] text-[#A0A09D] cursor-not-allowed'
                }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANE - Report Preview */}
      <div className="flex-1 bg-white rounded-3xl border border-[#E8E8E5] shadow-sm flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-[#E8E8E5] flex items-center justify-between bg-[#F9F9F8]">
          <div className="flex items-center gap-3">
            <FileText className="text-[#3FC2AC]" />
            <div>
              <h2 className="text-xl font-bold text-[#1A1A19]">AI Report Preview</h2>
              <p className="text-sm text-[#8B8B86]">Generated JSON output</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Lives here (not tied to the last question in the questionnaire) so
                Randomize-filling every answer doesn't also require paging all the
                way to the end just to generate. */}
            <button
              onClick={handleGenerate}
              disabled={!allAnswered || generating}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors
                ${allAnswered && !generating
                  ? 'bg-[#1A1A19] text-white hover:bg-black'
                  : 'bg-[#F0F0ED] text-[#A0A09D] cursor-not-allowed'
                }`}
            >
              {generating ? null : <Sparkles className="w-4 h-4" />}
              {generating ? `${Math.round(genProgress)}%` : 'Generate'}
            </button>
            {reportResult && (
            <button
              onClick={async () => {
                try {
                  const testId = selectedTestName.split(' ')[0].toLowerCase();
                  // Drives the WhatsApp/Instagram share text below - "Caffeine"/"Muscle"/"Hair".
                  const categoryLabel = testId.charAt(0).toUpperCase() + testId.slice(1);
                  const res = await fetch(`/templates/${testId}-sample.html`);
                  if (!res.ok) throw new Error('Template not found');
                  let html = await res.text();

                  // Resolve `.dynamic-icon` placeholders (data-icon/data-color/data-size) into real
                  // inline SVGs before the JSON injection below runs. Mirrors the resolver in
                  // ReportViewerModal.tsx so the preview matches the patient-facing viewer.
                  const iconParser = new DOMParser();
                  const iconDoc = iconParser.parseFromString(html, 'text/html');
                  const dynamicIcons = Array.from(iconDoc.querySelectorAll('.dynamic-icon'));

                  await Promise.all(dynamicIcons.map(async (el) => {
                    let iconName = el.getAttribute('data-icon');
                    const color = el.getAttribute('data-color') || 'currentColor';
                    let size = el.getAttribute('data-size') || '24';

                    // Include the description alongside the (often generic, e.g. "Pace Yourself") title so
                    // icon matching has real content to key off of, not just a short heading.
                    const withDescription = (item: { title?: string; description?: string } | null | undefined) =>
                      item ? `${item.title || ''} ${item.description || ''}`.trim() : null;

                    const getDynamicTitleFromAI = (id: string, data: any): string | null => {
                      if (!data || !id) return null;
                      try {
                        const idx = () => parseInt(id.split('-').pop() as string) - 1;
                        if (id.startsWith('page1-wtm-card-title-')) return withDescription(data.page_1?.what_this_means_for_you_cards?.[idx()]);
                        if (id.startsWith('page3-research-title-')) return withDescription(data.page_3?.what_research_observes?.[idx()]);
                        if (id.startsWith('page3-told-us-')) return data.page_3?.what_you_told_us?.[idx()];
                        if (id.startsWith('page2-what-this-means-')) return data.page_2?.what_this_means?.[idx()];
                        if (id.startsWith('page2-what-you-may-notice-')) return data.page_2?.what_you_may_notice?.[idx()];
                        if (id.startsWith('page2-what-this-explains-')) return data.page_2?.what_this_explains?.[idx()];
                        if (id.startsWith('page4-train-title-')) {
                          return withDescription(
                            data.page_4?.train_like_this?.[idx()] ||
                            data.page_4?.consume_like_this?.[idx()] ||
                            data.page_4?.wash_like_this?.[idx()]
                          );
                        }
                        if (id.startsWith('page4-recover-title-')) {
                          return withDescription(
                            data.page_4?.recover_like_this?.[idx()] ||
                            data.page_4?.treat_like_this?.[idx()]
                          );
                        }
                        if (id.startsWith('page4-fuel-title-')) {
                          return withDescription(
                            data.page_4?.fuel_like_this?.[idx()] ||
                            data.page_4?.nourish_like_this?.[idx()] ||
                            data.page_4?.protect_like_this?.[idx()]
                          );
                        }
                      } catch (e) { /* ignore malformed id */ }
                      return null;
                    };

                    const getDynamicIcon = (title: string | null, defaultIcon: string | null): string | null => {
                      const t = (title || '').toLowerCase();
                      if (!t) return defaultIcon;
                      // Anchor at the start of a word only (no trailing \b) so plural/suffixed forms like
                      // "Balanced", "Hydrated", "Recovery", "Snacks" still match their root keyword,
                      // while "brunch" etc. still won't falsely match "run" (no boundary before it there).
                      const has = (...words: string[]) => words.some(w => new RegExp(`\\b${w}`, 'i').test(t));

                      if (has('sleep', 'rest', 'evening', 'late', 'night')) return 'bedtime';
                      if (has('time', 'hour', 'duration', 'schedule', 'timing', 'fast', 'rapid', 'quick')) return 'schedule';
                      if (has('anxiety', 'jitter', 'mindful', 'relax', 'calm', 'meditat')) return 'spa';
                      if (has('lot', 'amount', 'much', 'high', 'heavy', 'volume')) return 'battery_charging_full';
                      if (has('focus', 'clearance', 'alert', 'brain', 'mental')) return 'neurology';
                      if (has('hydrat', 'water', 'drink', 'fluid')) return 'water_drop';
                      if (has('massage', 'therapy', 'tension')) return 'spa';
                      if (has('protein', 'nutrition', 'vitamin')) return 'nutrition';
                      if (has('snack', 'diet', 'nourish', 'meal', 'food')) return 'restaurant';
                      if (has('track', 'progress', 'monitor', 'log')) return 'monitoring';
                      if (has('pace', 'gradual', 'adapt', 'overload')) return 'trending_up';
                      if (has('mix', 'variety', 'cross-train', 'cross train')) return 'layers';
                      if (has('strength', 'weight')) return 'exercise';
                      if (has('speed', 'sprint')) return 'speed';
                      if (has('stamina', 'endurance', 'run', 'prolong')) return 'directions_run';
                      if (has('growth', 'muscle', 'hypertrophy', 'build')) return 'fitness_center';
                      if (has('power', 'explosive', 'force')) return 'bolt';
                      if (has('stretch', 'yoga', 'mobility', 'active break')) return 'self_improvement';
                      if (has('recover', 'heal')) return 'healing';
                      if (has('thinning', 'baldness', 'loss')) return 'face';
                      if (has('alopecia', 'cut')) return 'content_cut';
                      if (has('fibrosing')) return 'face_retouching_natural';
                      if (has('telogen', 'effluvium', 'wave')) return 'waves';
                      if (has('hair', 'scalp', 'wash', 'shampoo')) return 'wash';
                      if (has('protect', 'sun', 'uv', 'damage')) return 'shield';
                      if (has('science', 'research', 'study', 'evidence')) return 'menu_book';
                      if (has('metabolism', 'rate')) return 'vital_signs';
                      if (has('balance', 'steady', 'moderate')) return 'tune';
                      if (has('system', 'process')) return 'hub';
                      if (has('multiple', 'several', 'many')) return 'layers';
                      if (has('issue', 'side effect')) return 'report_problem';
                      if (has('quality', 'good', 'well')) return 'verified';
                      if (has('taper', 'wear off', 'decrease', 'drop')) return 'trending_down';
                      if (has('energy', 'boost', 'coffee', 'caffeine', 'cup', 'dose')) return 'local_cafe';
                      if (has('gene', 'dna', 'variant')) return 'biotech';
                      return defaultIcon;
                    };

                    let targetText: string | null = null;

                    const nextEl = el.nextElementSibling as HTMLElement | null;
                    if (nextEl && nextEl.id) {
                      targetText = getDynamicTitleFromAI(nextEl.id, reportResult);
                    }
                    if (!targetText && el.parentElement) {
                      const parentNext = el.parentElement.nextElementSibling as HTMLElement | null;
                      if (parentNext) {
                        if (parentNext.id) {
                          targetText = getDynamicTitleFromAI(parentNext.id, reportResult);
                        } else {
                          const childWithId = parentNext.querySelector('[id]') as HTMLElement | null;
                          if (childWithId && childWithId.id) {
                            targetText = getDynamicTitleFromAI(childWithId.id, reportResult);
                          }
                        }
                      }
                    }
                    if (!targetText && nextEl && nextEl.tagName === 'SPAN' && nextEl.id) {
                      targetText = getDynamicTitleFromAI(nextEl.id, reportResult);
                    }

                    if (targetText) {
                      iconName = getDynamicIcon(targetText, iconName);
                    }

                    const next = el.nextElementSibling as HTMLElement | null;
                    const parentNext = el.parentElement ? (el.parentElement.nextElementSibling as HTMLElement | null) : null;
                    const looksLikeGenePill = (node: HTMLElement | null) =>
                      !!node && (node.id?.includes('genotype') || node.id?.includes('marker') || node.id?.includes('gene') ||
                        !!node.querySelector('[id*="genotype"], [id*="marker"], [id*="gene"]'));
                    if (looksLikeGenePill(next) || looksLikeGenePill(parentNext)) {
                      iconName = 'genetics';
                      size = '32';
                      el.setAttribute('data-size', '32');
                      const style = el.getAttribute('style') || '';
                      el.setAttribute('style', style.replace(/width:\s*\d+px;?/g, '').replace(/height:\s*\d+px;?/g, '').trim() + ' width:32px; height:32px; flex-shrink:0;');
                    }

                    const checkFrameworkText = (text: string | null | undefined): boolean => {
                      if (!text) return false;
                      const upper = text.toUpperCase();
                      if (upper.includes('GENETICS') && upper.length < 20) { iconName = 'genetics'; return true; }
                      if (upper.includes('QODE') && upper.includes('ALIGNMENT') && upper.length < 30) { iconName = 'join_right'; return true; }
                      if (upper.includes('LIFESTYLE') && upper.length < 20) { iconName = 'event'; return true; }
                      if (upper.includes('SELF UNDERSTANDING') && upper.length < 30) { iconName = 'person'; return true; }
                      return false;
                    };
                    if (next && checkFrameworkText(next.textContent)) {
                      // matched
                    } else if (parentNext && checkFrameworkText(parentNext.textContent)) {
                      // matched
                    }

                    const parentNextSibling = el.parentElement?.nextElementSibling as HTMLElement | null;
                    const evidenceTitleDiv = parentNextSibling?.querySelector('div[id*="evidence-title-"]') as HTMLElement | null;
                    if (evidenceTitleDiv) {
                      const num = evidenceTitleDiv.id.split('-').pop();
                      el.outerHTML = `<span style="font-size:22px; font-weight:800; color:${color}; line-height: 1; display:flex; align-items:center; justify-content:center;">${num}</span>`;
                      return;
                    }

                    // --- Branded share-button icons ---
                    if (el.parentElement?.id === 'share-btn-whatsapp' || el.parentElement?.id === 'share-btn-instagram') {
                      const assetName = el.parentElement.id === 'share-btn-whatsapp' ? 'whatsapp' : 'instagram';
                      try {
                        const res = await fetch('/assets/' + assetName + '.svg');
                        if (res.ok) {
                          let svgText = await res.text();
                          svgText = svgText.replace(/width="\d+"/i, `width="${size}"`);
                          svgText = svgText.replace(/height="\d+"/i, `height="${size}"`);
                          svgText = svgText.replace(/fill="[^"]*"/i, `fill="${color}"`);
                          el.outerHTML = svgText;
                        }
                      } catch (e) {
                        console.error('Failed to fetch brand icon', assetName);
                      }
                      return;
                    } else if (el.parentElement?.id === 'share-btn-download') {
                      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5 5-5-5M12 12.8V2.5"/></svg>';
                      el.outerHTML = svgText;
                      return;
                    }

                    if (el.parentElement?.id?.includes('evidence-link')) {
                      iconName = 'north_east';
                    } else if (nextEl && nextEl.textContent && nextEl.textContent.includes('Remember:')) {
                      iconName = 'bookmark';
                    } else if (
                      iconName === 'lucide-sparkles' ||
                      (parentNext && parentNext.textContent && parentNext.textContent.includes('QODAI COACH RECOMMENDATION')) ||
                      (el.parentElement?.textContent && el.parentElement.textContent.includes('Chat with Qodai Coach'))
                    ) {
                      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>';
                      el.outerHTML = svgText;
                      return;
                    }

                    if (iconName) {
                      try {
                        const iconRes = await fetch('/assets/material-symbols/' + iconName + '.svg');
                        if (iconRes.ok) {
                          let svgText = await iconRes.text();
                          svgText = svgText.replace(/width="\d+"/i, `width="${size}"`);
                          svgText = svgText.replace(/height="\d+"/i, `height="${size}"`);
                          svgText = svgText.replace('<svg ', `<svg fill="${color}" `);
                          const style = el.getAttribute('style');
                          if (style) {
                            svgText = svgText.replace('<svg ', `<svg style="${style}" `);
                          }
                          el.outerHTML = svgText;
                        }
                      } catch (e) {
                        console.error('Failed to fetch SVG icon', iconName);
                      }
                    }
                  }));

                  html = '<!DOCTYPE html>\n<html>' + iconDoc.documentElement.innerHTML + '</html>';

                  // Extract some fields from reportResult
                  let bio = reportResult.biological_narrative;
                  if (typeof bio === 'string') try { bio = JSON.parse(bio); } catch (e) { }

                  // Perform a simple injection by passing the JSON data to the window
                  const scriptString = `
                    <script>
                      window.REPORT_DATA = ${JSON.stringify(reportResult)};
                      window.GENE_VARIANTS = ${JSON.stringify(reportGenes)};
                      window.USER_GENDER = ${JSON.stringify(selectedGender || '')};
                      console.log("Report Data loaded:", window.REPORT_DATA);

                      try {
                        let data = window.REPORT_DATA;
                        let genesObj = window.GENE_VARIANTS || {};
                        let genes = Object.keys(genesObj);

                        // Page 1 hero image: swaps in a gender + genotype specific portrait.
                        // Each category only has one photo set, shot against its headline gene
                        // (CYP1A2 / ACTN3 / EDAR). A Lite purchase of the category's *other* gene
                        // (ADORA2A / ACE / FGFR2) has no photos of its own, so its genotype is
                        // mapped onto the equivalent tier (dominant / heterozygous / recessive) of
                        // the headline gene and that photo is reused. Mirrors ReportViewerModal.tsx.
                        (function() {
                            const heroConfigs = {
                                caffeine: {
                                    dir: 'CYP1A2',
                                    headlineGene: 'CYP1A2',
                                    fileName: (gt, genderKey) => genderKey === 'male' ? ('CYP1A2_male_' + gt + ' 1.png') : ('CYP1A2_' + gt + '_female 1.png'),
                                    genes: {
                                        CYP1A2: { normalize: gt => gt === 'CA' ? 'AC' : gt, tiers: ['AA', 'AC', 'CC'] },
                                        ADORA2A: { normalize: gt => gt === 'CT' ? 'TC' : gt, tiers: ['TT', 'TC', 'CC'] }
                                    }
                                },
                                muscle: {
                                    dir: 'ACTN3',
                                    headlineGene: 'ACTN3',
                                    fileName: (gt, genderKey) => 'ACTN3_' + gt + '_' + genderKey + '.png',
                                    genes: {
                                        ACTN3: { normalize: gt => gt === 'XR' ? 'RX' : gt, tiers: ['RR', 'RX', 'XX'] },
                                        ACE: { normalize: gt => gt === 'DI' ? 'ID' : gt, tiers: ['DD', 'ID', 'II'] }
                                    }
                                },
                                hair: {
                                    dir: 'EDAR:FGFR2',
                                    headlineGene: 'EDAR',
                                    fileName: (gt, genderKey) => 'EDAR_' + gt + '_' + (genderKey === 'male' ? 'Male' : 'female') + '.png',
                                    genes: {
                                        EDAR: { normalize: gt => gt === 'GA' ? 'AG' : gt, tiers: ['GG', 'AG', 'AA'] },
                                        FGFR2: { normalize: gt => gt === 'TG' ? 'GT' : gt, tiers: ['TT', 'GT', 'GG'] }
                                    }
                                }
                            };
                            const testKey = ${JSON.stringify(testId)};
                            const config = heroConfigs[testKey];
                            const heroEl = document.getElementById('page1-hero-image');
                            if (config && heroEl) {
                                const rawGender = (window.USER_GENDER || '').toLowerCase();
                                const genderKey = rawGender.startsWith('m') ? 'male' : rawGender.startsWith('f') ? 'female' : null;

                                let genotypeCode = null;
                                const headlineInfo = config.genes[config.headlineGene];
                                if (genesObj[config.headlineGene]) {
                                    genotypeCode = headlineInfo.normalize(genesObj[config.headlineGene]);
                                } else {
                                    const altGeneName = Object.keys(config.genes).find(g => g !== config.headlineGene && genesObj[g]);
                                    if (altGeneName) {
                                        const altInfo = config.genes[altGeneName];
                                        const altGenotype = altInfo.normalize(genesObj[altGeneName]);
                                        const tierIndex = altInfo.tiers.indexOf(altGenotype);
                                        if (tierIndex !== -1) genotypeCode = headlineInfo.tiers[tierIndex];
                                    }
                                }

                                if (genderKey && genotypeCode) {
                                    // The hair asset folder is literally named "EDAR:FGFR2" - encoding
                                    // that colon (%3A) makes Vite's static server 404 into the SPA
                                    // fallback instead of serving the file, so keep it unescaped while
                                    // still encoding everything else in the path.
                                    const dirPath = config.dir.split(':').map(encodeURIComponent).join(':');
                                    heroEl.src = 'assets/mbq-page1/' + dirPath + '/' + encodeURIComponent(config.fileName(genotypeCode, genderKey));
                                }
                            }
                        })();

                        // Single-gene mode: hide the unused gene's Page 5 boxes (chromatogram,
                        // "what does your result mean", "where is this variant located"). The
                        // text-only "what does your result mean" box spans the full row (matching
                        // the existing full-width row-1 "What is Sanger Sequencing" pattern), and
                        // is reordered to sit above the two image-heavy boxes, which are left at
                        // their natural half-width and placed side by side so the chromatogram and
                        // chromosome-location images don't blow up to full page width.
                        (function() {
                            const GENE_PAIRS_BY_CATEGORY = { caffeine: ['CYP1A2', 'ADORA2A'], muscle: ['ACTN3', 'ACE'], hair: ['EDAR', 'FGFR2'] };
                            if (genes.length !== 1) return;
                            const testKey = ${JSON.stringify(testId)};
                            const pair = GENE_PAIRS_BY_CATEGORY[testKey] || genes;
                            const usedGene = genes[0];

                            // Each box's numbered badge (1/2/3/4) is static template text tied to
                            // its original position, not its id - re-stamp it to match the new
                            // visual order so the badges read 1, 2, 3, 4 top-to-bottom again.
                            const setBadgeNumber = (boxEl, num) => {
                                const badge = boxEl && boxEl.firstElementChild && boxEl.firstElementChild.firstElementChild;
                                if (badge) badge.textContent = String(num);
                            };

                            const resultMeaningEl = document.getElementById('page3-' + usedGene + '-box');
                            if (resultMeaningEl) {
                                resultMeaningEl.style.gridColumn = '1 / -1';
                                resultMeaningEl.style.order = '1';
                                setBadgeNumber(resultMeaningEl, 2);
                            }
                            const chromatogramBoxEl = document.getElementById('page5-' + usedGene + '-chromatogram-box');
                            if (chromatogramBoxEl) {
                                chromatogramBoxEl.style.order = '2';
                                setBadgeNumber(chromatogramBoxEl, 3);
                            }
                            const variantBoxEl = document.getElementById('page5-' + usedGene + '-variant-box');
                            if (variantBoxEl) {
                                variantBoxEl.style.order = '3';
                                setBadgeNumber(variantBoxEl, 4);
                            }

                            pair.filter(g => g !== usedGene).forEach(g => {
                                ['page5-' + g + '-chromatogram-box', 'page3-' + g + '-box', 'page5-' + g + '-variant-box'].forEach(id => {
                                    const el = document.getElementById(id);
                                    if (el) el.style.display = 'none';
                                });
                            });

                            // The "LEARN MORE" section's first topic card is baked into the
                            // template referencing whichever gene comes first in the pair (e.g.
                            // "THE EDAR GENE") - swap it to the gene actually being reported on.
                            const LEARN_MORE_GENE_COPY = {
                                CYP1A2: { title: 'THE CYP1A2 GENE', desc: 'Learn about the CYP1A2 gene and its role in caffeine metabolism.' },
                                ADORA2A: { title: 'THE ADORA2A GENE', desc: 'Learn about the ADORA2A gene and its role in caffeine sensitivity.' },
                                EDAR: { title: 'THE EDAR GENE', desc: 'Learn about the EDAR gene and its role in hair performance.' },
                                FGFR2: { title: 'THE FGFR2 GENE', desc: 'Learn about the FGFR2 gene and its role in hair strand thickness.' },
                                ACTN3: { title: 'THE ACTN3 GENE', desc: 'Learn about the ACTN3 gene and its role in muscle performance.' },
                                ACE: { title: 'THE ACE GENE', desc: 'Learn about the ACE gene and its role in muscle endurance.' },
                            };
                            const learnMoreCopy = LEARN_MORE_GENE_COPY[usedGene];
                            if (learnMoreCopy) {
                                const learnMoreTitleEl = document.getElementById('learn-more-gene-title');
                                const learnMoreDescEl = document.getElementById('learn-more-gene-desc');
                                if (learnMoreTitleEl) learnMoreTitleEl.textContent = learnMoreCopy.title;
                                if (learnMoreDescEl) learnMoreDescEl.textContent = learnMoreCopy.desc;
                            }
                        })();

                        // Must mirror the backend's authoritative_scientific_evidence selection
                        // (mbq_backend/rag/report_guardrails.py): for a combined report that's 2
                        // cards from the first gene then 1 from the second, NOT every reference
                        // from both genes flattened together - otherwise this array misaligns
                        // with page_2.scientific_evidence and the wrong PubMed record (title/
                        // authors) gets stitched onto the right card's description below.
                        let allLinks = [];
                        if (data.per_gene_appendix) {
                            if (genes.length >= 2) {
                                const gene1Refs = (data.per_gene_appendix[genes[0]] && data.per_gene_appendix[genes[0]].scientific_references) || [];
                                const gene2Refs = (data.per_gene_appendix[genes[1]] && data.per_gene_appendix[genes[1]].scientific_references) || [];
                                allLinks = [gene1Refs[0], gene1Refs[1], gene2Refs[0]];
                            } else {
                                genes.forEach(g => {
                                    if (data.per_gene_appendix[g] && data.per_gene_appendix[g].scientific_references) {
                                        allLinks = allLinks.concat(data.per_gene_appendix[g].scientific_references);
                                    }
                                });
                            }
                        }
                        
                        const setText = (id, text) => {
                            const el = document.getElementById(id);
                            if (el && text) {
                                el.textContent = text;
                            }
                        };
                        
                        // Genotype -> plain-language trait, per gene. Genotypes are stored in
                        // whichever allele order the lab reported them in, so both orderings of
                        // each heterozygous pair are included (e.g. AC and CA resolve the same).
                        const genotypeTraitMap = {
                            CYP1A2: { AA: 'Fast caffeine metabolizer', AC: 'Intermediate caffeine metabolizer', CA: 'Intermediate caffeine metabolizer', CC: 'Slow caffeine metabolizer' },
                            ADORA2A: { TT: 'High caffeine sensitivity', TC: 'Intermediate caffeine sensitivity', CT: 'Intermediate caffeine sensitivity', CC: 'Low caffeine sensitivity' },
                            ACTN3: { RR: 'Power & sprint oriented', RX: 'Balanced muscle performance', XR: 'Balanced muscle performance', XX: 'Endurance oriented' },
                            ACE: { DD: 'Strength & power oriented', ID: 'Balanced / mixed performance', DI: 'Balanced / mixed performance', II: 'Endurance oriented' },
                            EDAR: { GG: 'High hair thickness', AG: 'Moderate hair thickness', GA: 'Moderate hair thickness', AA: 'Fine hair' },
                            FGFR2: { TT: 'Thicker hair', GT: 'Intermediate hair thickness', TG: 'Intermediate hair thickness', GG: 'Finer hair' }
                        };
                        const getGenotypeTrait = (gene, gt) => (genotypeTraitMap[gene] && genotypeTraitMap[gene][gt]) || null;

                        // Genotype -> chromatogram filename suffix. The chromotogram-images/ assets
                        // only cover one ordering of each heterozygous pair, so the other reported
                        // ordering (e.g. CA, TC->written as TC vs CT) needs to resolve to that file.
                        const chromatogramGenotypeMap = {
                            CYP1A2: { AA: 'AA', AC: 'AC', CA: 'AC', CC: 'CC' },
                            ADORA2A: { TT: 'TT', TC: 'TC', CT: 'TC', CC: 'CC' },
                            ACTN3: { RR: 'RR', RX: 'RX', XR: 'RX', XX: 'XX' },
                            ACE: { DD: 'DD', ID: 'ID', DI: 'ID', II: 'II' },
                            EDAR: { GG: 'GG', AG: 'AG', GA: 'AG', AA: 'AA' },
                            FGFR2: { TT: 'TT', GT: 'GT', TG: 'GT', GG: 'GG' }
                        };

                        // Combined "GENE (Genotype)" string, one gene per line with its trait,
                        // e.g. "CYP1A2 (AC) - Intermediate caffeine metabolizer"
                        const geneGtStr = genes.map(g => {
                            const gt = genesObj[g] || '';
                            const trait = getGenotypeTrait(g, gt);
                            return g + ' (' + gt + ')' + (trait ? ' - ' + trait : '');
                        }).join('\\n');
                        // Compact single-line version (no trait text) for tight spaces like the
                        // small share-card badge, which can't fit multi-line content.
                        const geneGtStrShort = genes.map(g => g + ' (' + (genesObj[g] || '') + ')').join(', ');

                        // Reduces a gene card down to just "GENE (Genotype)" - hides the separate
                        // rsID/marker and genotype/method columns since geneGtStr already carries
                        // that info, and shrinks the card to fit the shorter content.
                        const simplifyGeneCard = (geneId, markerId, genotypeId, cardMaxWidth, fontSize) => {
                            const geneEl = document.getElementById(geneId);
                            if (geneEl) {
                                geneEl.textContent = geneGtStr;
                                geneEl.style.whiteSpace = 'pre-line';
                                geneEl.style.lineHeight = '1.6';
                                // html2canvas measures text with its own layout engine, which can come
                                // out slightly wider than the real browser's - shrink the font a touch
                                // vs. the live-preview size so a line that fits on-screen doesn't wrap
                                // (and get clipped by the card's frozen zoom footprint) only in the PDF.
                                if (fontSize) geneEl.style.fontSize = fontSize + 'px';
                                if (geneEl.previousElementSibling) {
                                    geneEl.previousElementSibling.textContent = 'GENE (Genotype)';
                                }
                                const card = geneEl.parentElement?.parentElement?.parentElement?.parentElement;
                                if (card) {
                                    // A fixed width (vs. max-content) keeps the card the same size
                                    // across report types regardless of how long each gene's trait
                                    // text happens to be.
                                    card.style.width = cardMaxWidth ? cardMaxWidth + 'px' : 'max-content';
                                    card.style.minWidth = '280px';
                                    card.style.maxWidth = (cardMaxWidth || 420) + 'px';
                                    card.style.paddingRight = '32px';
                                }
                            }
                            const markerEl = document.getElementById(markerId);
                            if (markerEl) {
                                const col = markerEl.parentElement?.parentElement;
                                if (col) {
                                    col.style.display = 'none';
                                    const prev = col.previousElementSibling;
                                    if (prev && prev.style && prev.style.width === '1px') {
                                        prev.style.display = 'none';
                                    }
                                }
                            }
                            const gtEl = document.getElementById(genotypeId);
                            if (gtEl) {
                                const row = gtEl.parentElement?.parentElement?.parentElement;
                                if (row) {
                                    if (row.style.display === 'flex') {
                                        row.style.display = 'none';
                                        const prev = row.previousElementSibling;
                                        if (prev && prev.style && prev.style.height === '1px') {
                                            prev.style.display = 'none';
                                        }
                                    } else if (row.style.display === 'grid') {
                                        const gridItem = gtEl.parentElement.parentElement;
                                        if (gridItem) gridItem.style.display = 'none';
                                        const methodItem = gridItem.nextElementSibling;
                                        if (methodItem) methodItem.style.display = 'none';
                                        row.style.gridTemplateColumns = '1fr';
                                    }
                                }
                            }
                        };

                        // Set top header and appendix dynamic fields
                        simplifyGeneCard('appendix-gene', 'header-marker', 'header-genotype', 450, 13); // Page 1 card
                        setText('header-gene', geneGtStrShort); // Page 5 card: "GENE (Genotype)"
                        
                        // Set combined Page 3 blocks (mostly used in hair template)
                        simplifyGeneCard('page3-combined-gene', 'page3-combined-marker', 'page3-combined-genotype');

                        // Turn the hardcoded "FAST CAFFEINE METABOLIZER..." heading above the combined
                        // gene card into bullet points from the actual key traits
                        const page3Gene = document.getElementById('page3-combined-gene');
                        if (page3Gene && data.page_1 && data.page_1.key_traits) {
                            const gridContainer = page3Gene.parentElement?.parentElement?.parentElement;
                            if (gridContainer && gridContainer.style.display === 'grid') {
                                const titleDiv = gridContainer.previousElementSibling;
                                if (titleDiv) {
                                    const traits = data.page_1.key_traits.split(/[•,]/).map(t => t.trim()).filter(Boolean).map(t => t.charAt(0).toUpperCase() + t.slice(1));
                                    titleDiv.innerHTML = traits.map(t => '&bull; ' + t).join('<br/>');
                                    titleDiv.style.lineHeight = '1.6';
                                    titleDiv.style.textTransform = 'uppercase';
                                }
                            }
                        }

                        // Prefer the short, single-sentence combined narrative the AI generates
                        // specifically for this spot. Older/malformed reports may lack it, so fall
                        // back to biological_narrative, then to a terse one-line-per-gene summary
                        // (never the old multi-paragraph per-gene writeup).
                        let combinedNarrative = "";
                        if (data.page_3 && data.page_3.combined_narrative) {
                            combinedNarrative = data.page_3.combined_narrative;
                        } else if (data.biological_narrative) {
                            combinedNarrative = data.biological_narrative
                                .split('\\n')
                                .filter(p => p.trim() !== '')[0] || "";
                        } else {
                            // Last resort: each gene's narrative usually opens with the same
                            // templated lead-in ("Your muscle biology leans toward...", "Your
                            // caffeine processing falls in..."), so joining more than one
                            // reads as repetitive. Just use the first gene's opening sentence.
                            for (const g of genes) {
                                const narrative = data.per_gene_appendix && data.per_gene_appendix[g] && data.per_gene_appendix[g].genotype_narrative;
                                if (narrative) {
                                    combinedNarrative = (narrative.split('.')[0] || "").trim();
                                    if (combinedNarrative) combinedNarrative += '.';
                                    break;
                                }
                            }
                        }
                        const p3NarrativeEl = document.getElementById('page3-combined-narrative');
                        if (p3NarrativeEl && combinedNarrative) {
                            p3NarrativeEl.textContent = combinedNarrative;
                        }
                        
                        // PAGE 1
                        if (data.page_1) {
                            // Long titles (e.g. "Endurance Performance - Balanced Capacity" or
                            // "Low-Density, Medium-Strand Hair") were running past the title column
                            // and overlapping the hero photo. Break onto two lines at " - " if
                            // present (delimiter dropped), else at the first ", " (comma kept on
                            // line 1), then shrink the font size (if needed) until each line fits
                            // the 430px column on a single row — otherwise a long half like
                            // "Endurance Performance" wraps a second, unwanted time on its own.
                            // Mirrors ReportViewerModal.tsx.
                            const titleEl = document.getElementById('page1-report-title');
                            if (titleEl && data.page_1.report_title) {
                                const titleText = data.page_1.report_title;
                                let titleLines;
                                if (titleText.includes(' - ')) {
                                    titleLines = titleText.split(' - ').map(s => s.trim()).filter(Boolean);
                                } else {
                                    const commaIdx = titleText.indexOf(', ');
                                    titleLines = commaIdx !== -1
                                        ? [titleText.slice(0, commaIdx + 1).trim(), titleText.slice(commaIdx + 1).trim()]
                                        : [titleText.trim()];
                                }
                                titleEl.textContent = '';
                                titleEl.style.fontSize = '44px';
                                const lineSpans = titleLines.map((line) => {
                                    const span = document.createElement('span');
                                    span.textContent = line;
                                    span.style.display = 'block';
                                    span.style.whiteSpace = 'nowrap';
                                    titleEl.appendChild(span);
                                    return span;
                                });
                                const maxLineWidth = 430;
                                let fontSize = 44;
                                while (fontSize > 22 && lineSpans.some(s => s.scrollWidth > maxLineWidth)) {
                                    fontSize -= 2;
                                    titleEl.style.fontSize = fontSize + 'px';
                                }
                            }
                            if (data.page_1.report_subtitles) {
                                data.page_1.report_subtitles.forEach((s, i) => setText('page1-report-subtitle-' + (i+1), s));
                            }
                            // Eyebrow ("YOUR ... QODE") text styling
                            const page1Title = document.getElementById('page1-report-title');
                            if (page1Title && page1Title.parentElement) {
                                const eyebrow = page1Title.parentElement.previousElementSibling;
                                if (eyebrow && eyebrow.textContent.includes('QODE')) {
                                    eyebrow.style.fontWeight = '600';
                                    eyebrow.style.fontSize = '18px';
                                }
                            }

                            // Key traits as a bulleted list. Target the inner span if present so the
                            // preceding icon (a sibling of the span, not a child) isn't wiped out.
                            const keyTraitsSpan = document.querySelector('span#page1-key-traits');
                            if (keyTraitsSpan && data.page_1.key_traits) {
                                const traits = data.page_1.key_traits.split(/[•,]/).map(t => t.trim()).filter(Boolean).map(t => t.charAt(0).toUpperCase() + t.slice(1));
                                keyTraitsSpan.innerHTML = traits.map(t => '&bull; ' + t).join('<br/>');
                                keyTraitsSpan.style.fontWeight = '500';
                                keyTraitsSpan.style.fontSize = '17px';
                                keyTraitsSpan.style.lineHeight = '1.5';
                                const flexDiv = keyTraitsSpan.parentElement;
                                if (flexDiv) flexDiv.style.alignItems = 'flex-start';
                            } else {
                                const keyTraitsEl = document.getElementById('page1-key-traits');
                                if (keyTraitsEl && data.page_1.key_traits) {
                                    const traits = data.page_1.key_traits.split(/[•,]/).map(t => t.trim()).filter(Boolean).map(t => t.charAt(0).toUpperCase() + t.slice(1));
                                    keyTraitsEl.innerHTML = traits.map(t => '&bull; ' + t).join('<br/>');
                                    keyTraitsEl.style.fontWeight = '500';
                                    keyTraitsEl.style.fontSize = '17px';
                                }
                            }

                            setText('page1-tendency-description', data.page_1.tendency_description);
                            
                            if (data.page_1.what_this_means_for_you_cards) {
                                data.page_1.what_this_means_for_you_cards.forEach((card, i) => {
                                    setText('page1-wtm-card-title-' + (i+1), card.title);
                                    setText('page1-wtm-card-desc-' + (i+1), card.description);
                                });
                            }
                            if (data.page_1.share_card) {
                                const toSentenceCase = (str) => {
                                    if (!str) return str;
                                    return str.toLowerCase().replace(/(^\\s*\\w|[.!?]\\s*\\w)/g, c => c.toUpperCase());
                                };
                                const toTitleCase = (str) => {
                                    if (!str) return str;
                                    return str.toLowerCase().replace(/(^\\s*\\w|\\s+\\w)/g, c => c.toUpperCase());
                                };
                                const shareTitle = (data.page_1.share_card.title || '').replace(/^my qode\\s+/i, '');
                                setText('page1-share-title', toTitleCase(shareTitle));

                                const highlightEl = document.getElementById('page1-share-highlight');
                                if (highlightEl) {
                                    const highlightText = toSentenceCase(data.page_1.share_card.highlight);
                                    const bullets = highlightText.split('.').map(s => s.trim()).filter(Boolean);
                                    highlightEl.innerHTML = bullets.map(b => '<div>&bull; ' + b + '.</div>').join('');
                                }

                                setText('page1-share-quote', toSentenceCase(data.page_1.share_card.quote));
                                setText('page1-share-genotype', geneGtStrShort);
                            }

                            // "BUILT FOR ..." summary in the share card, derived from key traits
                            const builtForEl = document.getElementById('page1-share-built-for');
                            if (builtForEl && data.page_1.key_traits) {
                                const traits = data.page_1.key_traits.split(/[•,]/).map(t => t.trim().toUpperCase()).filter(Boolean);
                                builtForEl.textContent = traits.join('. ') + '.';
                            }
                        }
                        
                        // PAGE 2
                        if (data.page_2) {
                            if (data.page_2.type_overview) {
                                setText('page2-type-title', data.page_2.type_overview.title);
                                setText('page2-type-description', data.page_2.type_overview.description);
                            }
                            
                            ['what_this_means', 'what_you_may_notice', 'what_this_explains', 'science_behind_it'].forEach(key => {
                                if (data.page_2[key] && Array.isArray(data.page_2[key])) {
                                    let prefix = key === 'science_behind_it' ? 'page2-science-paragraph-' : 'page2-' + key.replace(/_/g, '-') + '-';
                                    data.page_2[key].forEach((text, i) => setText(prefix + (i+1), text));
                                }
                            });
                            
                            setText('page2-key-takeaway', data.page_2.key_takeaway);
                            
                            if (data.page_2.scientific_evidence) {
                                data.page_2.scientific_evidence.forEach((item, i) => {
                                    setText('page2-evidence-title-' + (i+1), item.title);
                                    setText('page2-evidence-authors-' + (i+1), item.authors_year);
                                    setText('page2-evidence-desc-' + (i+1), item.description);

                                    const linkEl = document.getElementById('page2-evidence-link-' + (i+1));
                                    if (linkEl && allLinks[i]) {
                                        linkEl.href = allLinks[i];

                                        // Replace the AI-written placeholder title/authors/journal with the
                                        // real PubMed record, when the link is a PubMed URL
                                        const match = allLinks[i].match(/pubmed\\.ncbi\\.nlm\\.nih\\.gov\\/(\\d+)/);
                                        if (match) {
                                            const pmid = match[1];
                                            fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=' + pmid + '&retmode=json')
                                                .then(res => res.json())
                                                .then(pubmedData => {
                                                    const result = pubmedData.result && pubmedData.result[pmid];
                                                    if (result) {
                                                        const pubdate = result.pubdate ? result.pubdate.split(' ')[0] : '';
                                                        const firstAuthor = result.authors && result.authors.length > 0 ? result.authors[0].name : '';
                                                        const authorStr = result.authors && result.authors.length > 1 ? firstAuthor + ' et al. (' + pubdate + ')' : firstAuthor + ' (' + pubdate + ')';
                                                        const journal = result.source || result.fulljournalname;

                                                        setText('page2-evidence-title-' + (i+1), result.title);
                                                        if (firstAuthor) setText('page2-evidence-authors-' + (i+1), authorStr);

                                                        const descEl = document.getElementById('page2-evidence-desc-' + (i+1));
                                                        if (descEl && descEl.nextElementSibling && journal) {
                                                            descEl.nextElementSibling.textContent = journal;
                                                        }
                                                    }
                                                })
                                                .catch(err => console.error('PubMed fetch failed for evidence ' + (i+1), err));
                                        }
                                    }
                                });
                            }
                        }

                        // PAGE 3
                        if (data.page_3) {
                            if (data.page_3.what_you_told_us) {
                                data.page_3.what_you_told_us.forEach((t, i) => setText('page3-told-us-' + (i+1), t));
                            }
                            if (data.page_3.what_research_observes) {
                                data.page_3.what_research_observes.forEach((item, i) => {
                                    setText('page3-research-title-' + (i+1), item.title);
                                    setText('page3-research-desc-' + (i+1), item.description);
                                });
                            }
                            const researchSubtitleEl = document.getElementById('page3-research-subtitle');
                            if (researchSubtitleEl && genes.length) {
                                researchSubtitleEl.textContent = '(About people with similar ' + genes.join(' and ') + ' variant' + (genes.length > 1 ? 's' : '') + ')';
                            }
                        }

                        // APPENDIX GENE BREAKDOWNS (Page 3/4)
                        genes.forEach(g => {
                            let gData = data.per_gene_appendix && data.per_gene_appendix[g];
                            if (gData) {
                                setText('page3-' + g + '-title', "WHAT DOES YOUR RESULT MEAN? - " + g);
                                
                                let genotype = gData.genotype || (genesObj[g] || "");
                                let a1 = genotype.length > 0 ? genotype[0] : "";
                                let a2 = genotype.length > 1 ? genotype[1] : a1;
                                
                                let gtStr = genotype;
                                
                                const genotypeEl = document.getElementById('page3-' + g + '-genotype');
                                if (genotypeEl) genotypeEl.textContent = gtStr;
                                
                                setText('page3-' + g + '-allele-1', a1);
                                setText('page3-' + g + '-allele-2', a2);
                                
                                const descEl = document.getElementById('page3-' + g + '-desc');
                                if (descEl) {
                                    let descText = "";
                                    if (a1 === a2) {
                                        descText = 'You have two "' + a1 + '" bases at this position in the ' + g + ' gene. This is called the <b style="color:#1b2240;">' + genotype + ' genotype.</b>';
                                    } else {
                                        descText = 'You have the "' + a1 + '" and "' + a2 + '" bases at this position in the ' + g + ' gene. This is called the <b style="color:#1b2240;">' + genotype + ' genotype.</b>';
                                    }
                                    descEl.innerHTML = descText;
                                }
                                
                                setText('page3-' + g + '-effect', gData.genotype_narrative || "");

                                // Page 5 chromatogram image: swap in the genotype-specific chromatogram
                                // for this gene, falling back to the template's default if the gene or
                                // genotype isn't one of the pre-rendered assets.
                                const chromatogramEl = document.getElementById('page5-' + g + '-chromatogram');
                                const chromatogramGt = chromatogramGenotypeMap[g] && chromatogramGenotypeMap[g][genotype];
                                if (chromatogramEl && chromatogramGt) {
                                    chromatogramEl.src = 'assets/chromotogram-images/' + encodeURIComponent(g) + '/' + encodeURIComponent(g + '_' + chromatogramGt) + '.png';
                                }
                            }
                        });

                        // PAGE 4
                        if (data.page_4) {
                            ['train_like_this', 'recover_like_this', 'fuel_like_this'].forEach(key => {
                                if (data.page_4[key]) {
                                    let prefix = 'page4-' + key.split('_')[0] + '-';
                                    data.page_4[key].forEach((item, i) => {
                                        setText(prefix + 'title-' + (i+1), item.title);
                                        setText(prefix + 'desc-' + (i+1), item.description);
                                    });
                                }
                            });
                            
                            // MICRO PLAN
                            if (data.page_4.micro_plan) {
                                data.page_4.micro_plan.forEach((day, i) => {
                                    const dCount = i + 1;
                                    setText('page4-micro-day-' + dCount + '-title', day.day_title);
                                    setText('page4-micro-day-' + dCount + '-focus', "FOCUS: " + day.focus);
                                    
                                    const tipEl = document.getElementById('page4-micro-day-' + dCount + '-tip');
                                    if (tipEl) tipEl.innerHTML = '<b style="color:#37414f;">TIP:</b> ' + day.tip;
                                    
                                    if (day.activities) {
                                        day.activities.forEach((act, j) => {
                                            const aCount = j + 1;
                                            setText('page4-micro-day-' + dCount + '-act-' + aCount + '-name', act.name);
                                            setText('page4-micro-day-' + dCount + '-act-' + aCount + '-sets', act.sets_duration);
                                            setText('page4-micro-day-' + dCount + '-act-' + aCount + '-reps', act.reps_notes);
                                        });
                                    }
                                });
                            }
                            
                            setText('page4-coach-recommendation', data.page_4.coach_recommendation);
                        }

                        console.log("Successfully injected massive AI data into HTML layout.");
                      } catch (err) {
                        console.error("Injection error:", err);
                      }
                    </script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                    <script>
                      // --- SHARE BUTTONS LOGIC ---
                      setTimeout(() => {
                          const downloadBtn = document.getElementById('share-btn-download');
                          const whatsappBtn = document.getElementById('share-btn-whatsapp');
                          const instagramBtn = document.getElementById('share-btn-instagram');

                          const getShareImage = async () => {
                              const card = document.getElementById('share-card-container');
                              if (!card || !window.html2canvas) return null;

                              const btnCol = downloadBtn?.parentElement;
                              const divider = btnCol?.previousElementSibling;
                              if (btnCol) btnCol.style.display = 'none';
                              if (divider) divider.style.display = 'none';

                              const oldWidth = card.style.width;
                              card.style.width = '800px';

                              // html2canvas mismeasures the variable "Google Sans" web font (it reads the
                              // font's default instance, not the specific weight/optical-size axis being
                              // rendered), which collapses the spacing between words in the capture. Swap
                              // in a standard, non-variable font just for the capture to avoid that.
                              const oldFontFamily = card.style.fontFamily;
                              card.style.fontFamily = 'Arial, Helvetica, sans-serif';

                              // The CSS zoom property (non-standard, WebKit-only) rescales layout in a
                              // way html2canvas's manual DOM->canvas renderer can't replicate, which is
                              // what was collapsing the spacing between words. Neutralize it for the capture.
                              const oldZoom = card.style.zoom;
                              card.style.zoom = '1';

                              const canvas = await window.html2canvas(card, { scale: 2, useCORS: true, backgroundColor: null, width: 800 });

                              if (btnCol) btnCol.style.display = 'flex';
                              if (divider) divider.style.display = 'block';
                              card.style.width = oldWidth;
                              card.style.fontFamily = oldFontFamily;
                              card.style.zoom = oldZoom;

                              return canvas;
                          };

                          const downloadCanvas = (canvas, filename) => {
                              const link = document.createElement('a');
                              link.download = filename;
                              link.href = canvas.toDataURL('image/png');
                              link.click();
                          };

                          const shareViaApi = async (platform) => {
                              const canvas = await getShareImage();
                              if (!canvas) return;

                              canvas.toBlob(async (blob) => {
                                  if (!blob) return;
                                  const file = new File([blob], 'my-qode-share.png', { type: 'image/png' });
                                  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                      try {
                                          await navigator.share({
                                              title: 'My Body Qode',
                                              text: "Check out My ${categoryLabel} Qode from MyBodyQode. What's your Qode?",
                                              files: [file]
                                          });
                                      } catch (err) {
                                          console.log('Error sharing:', err);
                                          downloadCanvas(canvas, 'my-qode-share.png');
                                      }
                                  } else {
                                      alert('Image downloaded! You can now share it on ' + platform + '.');
                                      downloadCanvas(canvas, 'my-qode-' + platform.toLowerCase() + '.png');
                                  }
                              }, 'image/png');
                          };

                          if (downloadBtn) {
                              downloadBtn.onclick = async () => {
                                  const canvas = await getShareImage();
                                  if (canvas) downloadCanvas(canvas, 'my-qode-share.png');
                              };
                          }
                          if (whatsappBtn) whatsappBtn.onclick = () => shareViaApi('WhatsApp');
                          if (instagramBtn) instagramBtn.onclick = () => shareViaApi('Instagram');
                      }, 500);
                      // ---------------------------

                      window.downloadPDF = async function(filename) {
                          const container = document.querySelector('body > div');
                          if (!container) return;
                          
                          const originalStyles = {
                              background: container.style.background,
                              padding: container.style.padding,
                              gap: container.style.gap
                          };
                          
                          container.style.background = 'white';
                          container.style.padding = '0';
                          container.style.gap = '0';
                          
                          const pages = document.querySelectorAll('div[data-screen-label]');
                          const originalPageStyles = [];
                          pages.forEach(page => {
                              originalPageStyles.push({
                                  borderRadius: page.style.borderRadius,
                                  boxShadow: page.style.boxShadow,
                                  margin: page.style.margin
                              });
                              page.style.borderRadius = '0';
                              page.style.boxShadow = 'none';
                              page.style.margin = '0';
                          });

                          // html2canvas (used internally by html2pdf) doesn't understand the
                          // non-standard CSS "zoom" property these templates use throughout for
                          // fine layout scaling: it measures elements at their zoomed footprint
                          // but paints their contents at native size, which is what makes text
                          // and images come out mis-sized/overlapping in the PDF.
                          //
                          // Simply setting zoom to 1 "fixes" the painting but changes the
                          // element's footprint too, which reflows everything after it - on the
                          // page that uses zoom<1 to fit extra content, that reflow pushes the
                          // footer off the fixed-height page entirely.
                          //
                          // So instead: freeze the element's current (zoomed) footprint in a
                          // same-sized wrapper, then replace zoom with an equivalent
                          // transform: scale(), which html2canvas paints correctly and which
                          // doesn't affect layout - the wrapper keeps everything after it exactly
                          // where zoom would have put it.
                          const zoomCleanupFns = [];
                          const neutralizeZoom = (scope) => {
                              const zoomedEls = Array.from(scope.querySelectorAll('[style*="zoom"]'));
                              zoomedEls.forEach(el => {
                                  const zoomValue = parseFloat(el.style.zoom);
                                  if (!zoomValue || zoomValue === 1 || isNaN(zoomValue)) return;

                                  const rect = el.getBoundingClientRect();
                                  if (rect.width === 0 && rect.height === 0) return; // not actually visible

                                  const cs = window.getComputedStyle(el);
                                  const wrapper = document.createElement('div');
                                  wrapper.style.width = rect.width + 'px';
                                  wrapper.style.height = rect.height + 'px';
                                  wrapper.style.overflow = 'hidden';
                                  wrapper.style.position = 'relative';
                                  wrapper.style.marginTop = cs.marginTop;
                                  wrapper.style.marginRight = cs.marginRight;
                                  wrapper.style.marginBottom = cs.marginBottom;
                                  wrapper.style.marginLeft = cs.marginLeft;

                                  const originalStyleAttr = el.getAttribute('style');
                                  el.parentNode.insertBefore(wrapper, el);
                                  wrapper.appendChild(el);

                                  el.style.zoom = '1';
                                  el.style.margin = '0';
                                  el.style.position = 'absolute';
                                  el.style.top = '0';
                                  el.style.left = '0';
                                  // Taking el out of flow for the transform also strips whatever
                                  // flex/grid rule (e.g. flex:1) used to size it - pin its natural
                                  // (pre-scale) box explicitly so scale() lands it exactly on the
                                  // wrapper's bounds instead of sizing to its own content and
                                  // overflowing past the wrapper's clipped edge.
                                  el.style.boxSizing = 'border-box';
                                  el.style.width = (rect.width / zoomValue) + 'px';
                                  el.style.height = (rect.height / zoomValue) + 'px';
                                  el.style.transform = 'scale(' + zoomValue + ')';
                                  el.style.transformOrigin = 'top left';

                                  zoomCleanupFns.push(() => {
                                      wrapper.parentNode.insertBefore(el, wrapper);
                                      wrapper.remove();
                                      el.setAttribute('style', originalStyleAttr);
                                  });
                              });
                          };
                          const restoreZoom = () => {
                              while (zoomCleanupFns.length) zoomCleanupFns.pop()();
                          };

                          // html2canvas (used internally by html2pdf) doesn't support CSS
                          // mask-image / -webkit-mask-image at all - it paints the Page 1 hero
                          // photo fully opaque with a hard edge instead of the soft left-to-white
                          // fade the live HTML preview shows via that mask. For capture only, lay
                          // an ordinary white gradient div directly on top of the image (which
                          // html2canvas paints fine) using the mask's own alpha stops inverted
                          // onto opaque white, then remove it afterward via the same cleanup list
                          // neutralizeZoom uses - the live preview's actual mask is never touched.
                          // Mirrors ReportViewerModal.tsx.
                          const addHeroFadeOverlay = (scope) => {
                              const heroImage = scope.querySelector ? scope.querySelector('#page1-hero-image') : null;
                              if (!heroImage) return;
                              const rect = heroImage.getBoundingClientRect();
                              if (rect.width === 0 && rect.height === 0) return; // not actually visible

                              const overlay = document.createElement('div');
                              overlay.style.position = 'absolute';
                              overlay.style.top = '0';
                              overlay.style.right = '0';
                              overlay.style.width = heroImage.style.width || (rect.width + 'px');
                              overlay.style.height = rect.height + 'px';
                              overlay.style.pointerEvents = 'none';
                              overlay.style.background = 'linear-gradient(90deg, #fff 0%, #fff 4%, rgba(255,255,255,.92) 9%, rgba(255,255,255,.78) 14%, rgba(255,255,255,.58) 19%, rgba(255,255,255,.36) 25%, rgba(255,255,255,.16) 31%, rgba(255,255,255,0) 39%)';

                              heroImage.parentNode.insertBefore(overlay, heroImage.nextSibling);
                              zoomCleanupFns.push(() => { overlay.remove(); });
                          };

                          const opt = {
                            margin:       0,
                            filename:     filename || 'report.pdf',
                            image:        { type: 'jpeg', quality: 1.0 },
                            html2canvas:  { scale: 2, useCORS: true, windowWidth: 1024, scrollY: 0 },
                            jsPDF:        { unit: 'px', format: [1024, 1449], orientation: 'portrait' }
                          };

                          // html2pdf's toPdf() always slices a captured canvas into ceil(canvas.height
                          // / onePagePxHeight) PDF pages - it has no option to disable this. Every page
                          // here is restored to its exact designed height (1449px, clipped via
                          // overflow:hidden) right before capture, but a 1px rounding/reflow difference
                          // is enough to push canvas.height one pixel past one page's worth, which
                          // silently appends a second, almost entirely blank page for that slice. Crop
                          // the canvas back down to exactly one page's pixel height right before toPdf()
                          // so this can never happen, regardless of the exact cause of the overflow.
                          const onePagePxHeight = opt.jsPDF.format[1] * opt.html2canvas.scale;
                          // Only clamp a tiny (sub-pixel rounding) overflow back down to exactly one
                          // page. Genuine content overflow (e.g. a long AI-generated narrative that's
                          // actually taller than the designed page) must NOT be cropped here - leave it
                          // alone so html2pdf's own pagination spills it onto additional PDF page(s)
                          // instead of silently cutting content off the bottom of the page.
                          const ROUNDING_OVERFLOW_PX = 8; // canvas px at scale 2 => ~4 real px
                          function clampCanvasHeight() {
                              const canvas = this.prop.canvas;
                              if (canvas && canvas.height > onePagePxHeight && canvas.height - onePagePxHeight <= ROUNDING_OVERFLOW_PX) {
                                  const cropped = document.createElement('canvas');
                                  cropped.width = canvas.width;
                                  cropped.height = onePagePxHeight;
                                  cropped.getContext('2d').drawImage(
                                      canvas, 0, 0, canvas.width, onePagePxHeight,
                                      0, 0, canvas.width, onePagePxHeight
                                  );
                                  this.prop.canvas = cropped;
                              }
                          }

                          try {
                            if (pages.length > 0) {
                              let worker = html2pdf().set(opt);

                              for (let i = 0; i < pages.length; i++) {
                                  worker = worker.then(() => {
                                      pages.forEach((p, idx) => {
                                          p.style.display = (idx === i) ? 'block' : 'none';
                                      });
                                      // Restore each page to the same "auto height with the designed
                                      // page size as a floor" state the interactive viewer's own
                                      // showOnlyPage() uses (rather than forcing back to that exact
                                      // fixed height) - a page whose content fits still renders at
                                      // exactly the designed size via its flex layout, but a page
                                      // whose content genuinely overflows (e.g. a long AI-generated
                                      // narrative) is allowed to grow instead of being clipped, so
                                      // html2pdf's own pagination carries the rest onto additional
                                      // PDF page(s) instead of silently cutting content off.
                                      if (window.__originalPageHeights && window.__originalPageHeights.has(pages[i])) {
                                          pages[i].style.minHeight = window.__originalPageHeights.get(pages[i]) || (window.__originalPageMinHeights && window.__originalPageMinHeights.get(pages[i])) || '';
                                          pages[i].style.height = 'auto';
                                      }
                                      const innerRestore = Array.from(pages[i].children).find((c) => window.__originalPageHeights && window.__originalPageHeights.has(c));
                                      if (innerRestore) {
                                          innerRestore.style.minHeight = window.__originalPageHeights.get(innerRestore) || (window.__originalPageMinHeights && window.__originalPageMinHeights.get(innerRestore)) || '';
                                          innerRestore.style.height = 'auto';
                                      }
                                      // Only the page about to be captured is visible, so its zoomed
                                      // elements (and the hero image's mask, if this is Page 1) can
                                      // only be measured/patched now.
                                      neutralizeZoom(pages[i]);
                                      addHeroFadeOverlay(pages[i]);
                                      return new Promise(r => setTimeout(r, 100)); // allow DOM to settle
                                  });

                                  if (i === 0) {
                                      worker = worker.from(pages[i]).toContainer().toCanvas().then(clampCanvasHeight).toPdf();
                                  } else {
                                      worker = worker.get('pdf').then(pdf => { pdf.addPage(); }).from(pages[i]).toContainer().toCanvas().then(clampCanvasHeight).toPdf();
                                  }

                                  worker = worker.then(() => { restoreZoom(); });
                              }

                              await worker.save();

                              pages.forEach(p => p.style.display = ''); // restore display
                            } else {
                              neutralizeZoom(container);
                              addHeroFadeOverlay(container);
                              await html2pdf().set(opt).from(container).save();
                              restoreZoom();
                            }
                          } catch (e) {
                            console.error("PDF generation failed", e);
                          }

                          restoreZoom(); // safety net in case anything above threw mid-page

                          container.style.background = originalStyles.background;
                          container.style.padding = originalStyles.padding;
                          container.style.gap = originalStyles.gap;

                          pages.forEach((page, i) => {
                              page.style.borderRadius = originalPageStyles[i].borderRadius;
                              page.style.boxShadow = originalPageStyles[i].boxShadow;
                              page.style.margin = originalPageStyles[i].margin;
                          });
                      };
                    </script>
                  `;

                  // Fixed sample values for this QA page (not tied to a real patient/date) -
                  // September 5th, 2026, 10:05 AM.
                  const now = new Date(2026, 8, 5, 10, 5);
                  const formattedDate = now.toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const sampleMbqId = 'MBQ2026000';
                  const sampleName = 'Sample Name';

                  const pageCount = (html.match(/data-screen-label=/g) || []).length;
                  setTotalPages(pageCount > 0 ? pageCount : 1);
                  setCurrentPageIndex(0);

                  const carouselScript = `
                    <script>
                      // Snapshot each page's original (pre-viewer) height/min-height before
                      // showOnlyPage ever touches it - window.downloadPDF restores these so the
                      // exported PDF still matches the designed page size regardless of what the
                      // interactive viewer below did to it. Page 1 additionally nests an inner
                      // wrapper (height:100%) that actually holds its flex column (the footer
                      // and the WHAT-THIS-MEANS/share cards are pinned/pushed down within THAT
                      // element) - pages 2+ don't have this extra layer, their own page div IS
                      // the flex column. A percentage height never resolves against an ancestor
                      // whose own height is 'auto' (even with min-height as a floor), so that
                      // inner wrapper needs the same min-height/height:auto treatment directly,
                      // or its flex children get zero free space and the push-down collapses.
                      window.__originalPageHeights = new Map();
                      window.__originalPageMinHeights = new Map();
                      document.querySelectorAll('div[data-screen-label]').forEach((p) => {
                        window.__originalPageHeights.set(p, p.style.height);
                        window.__originalPageMinHeights.set(p, p.style.minHeight);
                        const inner = Array.from(p.children).find((c) => c.tagName === 'DIV' && c.style.height === '100%');
                        if (inner) {
                          window.__originalPageHeights.set(inner, inner.style.height);
                          window.__originalPageMinHeights.set(inner, inner.style.minHeight);
                        }
                      });

                      const showOnlyPage = (pageIndex) => {
                        const pages = document.querySelectorAll('div[data-screen-label]');
                        pages.forEach((p, idx) => {
                          const isVisible = idx === pageIndex;
                          p.style.display = isVisible ? 'block' : 'none';
                          // Most pages have a hardcoded height (matching the PDF page size),
                          // which clips content that doesn't fit that height exactly. Let the
                          // visible page grow past its designed height if content demands it -
                          // but keep that designed height as a floor (min-height), not just
                          // dropped, so pages whose layout relies on filling their full height
                          // (e.g. page 1's footer/cards pinned to the bottom via margin-top:auto)
                          // still render the same as the un-touched template.
                          if (isVisible) {
                            const original = window.__originalPageHeights.get(p) || '';
                            if (!p.style.minHeight) {
                              p.style.minHeight = original;
                            }
                            p.style.height = 'auto';
                            const inner = Array.from(p.children).find((c) => c.tagName === 'DIV' && window.__originalPageHeights.has(c));
                            if (inner) {
                              if (!inner.style.minHeight) {
                                inner.style.minHeight = original;
                              }
                              inner.style.height = 'auto';
                            }
                          }
                        });
                      };
                      // Pages are stacked in the document by default - hide everything but the
                      // first immediately so there's no flash of every page before the viewer's
                      // first SET_PAGE message arrives.
                      showOnlyPage(0);

                      window.addEventListener('message', (e) => {
                        if (e.data && e.data.type === 'SET_PAGE') {
                          showOnlyPage(e.data.pageIndex);
                        }
                      });

                      // Delegated on document (not the buttons themselves): the template's own
                      // renderer (support.js) rebuilds the DOM on DOMContentLoaded, which would
                      // silently orphan a listener attached directly to these button nodes.
                      document.addEventListener('click', (e) => {
                        const btn = e.target && e.target.closest && e.target.closest('#chat-with-qodai-btn');
                        if (btn) {
                          window.parent.postMessage({ type: 'OPEN_QODAI_CHAT' }, '*');
                        }
                      });
                    </script>
                  `;

                  const reportFont = localStorage.getItem('reportFont') || 'Google Sans';
                  let fontCss = '';
                  if (reportFont === 'Anthropic Serif') {
                    fontCss = `
                      <style>
                        @font-face {
                          font-family: 'Anthropic Serif';
                          src: url('/fonts/AnthropicSerif-Text-Regular-Static.otf') format('opentype');
                        }
                        body, * {
                          font-family: 'Anthropic Serif', serif !important;
                        }
                      </style>
                    `;
                  } else if (reportFont === 'Poppins') {
                    fontCss = `
                      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                      <style>
                        body, * {
                          font-family: 'Poppins', sans-serif !important;
                        }
                      </style>
                    `;
                  } else {
                    fontCss = `
                      <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet">
                      <style>
                        body, * {
                          font-family: 'Google Sans', sans-serif !important;
                        }
                      </style>
                    `;
                  }

                  fontCss += `
                    <style>
                      html, body {
                        /* The viewer's own container is the single scroll region (fit-to-width,
                           scaled via CSS transform) - prevent this document from ever growing
                           its own scrollbar on top of that. */
                        overflow: hidden !important;
                      }
                      img[alt="MBQ Logo"], img[alt="CQ Logo"], img[alt="HQ Logo"] {
                        height: 60px !important;
                        width: auto !important;
                      }
                      #chat-with-qodai-btn {
                        cursor: pointer;
                      }
                    </style>
                  `;

                  let finalHtml = html
                    .replace('<head>', `<head><base href="${window.location.origin}/">\n${fontCss}`)
                    .replace('src="./support.js"', 'src="/templates/support.js"')
                    .replace(/dd mm yyyy/g, formattedDate)
                    .replace('</body>', scriptString + '\n' + carouselScript + '\n</body>');

                  // Catches "CQ ID: CQ-2024...", "MBQ ID: MBQ-2024...", etc. in all templates
                  // (Caffeine, Muscle, Hair) - replaces every page's footer in one pass and
                  // appends the sample name alongside it. Mirrors ReportViewerModal.tsx.
                  finalHtml = finalHtml.replace(
                    /(?:CQ|MBQ|HQ)?\s*ID:\s*(?:CQ|MBQ|HQ)?-?\d{4}-\d{4}-\d{6}/g,
                    `ID: ${sampleMbqId} &bull; ${sampleName}`
                  );

                  setReportHtml(finalHtml);
                } catch (err) {
                  console.error(err);
                  alert("Could not load the HTML template for this test.");
                }
              }}
              className="px-4 py-2 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              View
            </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#1A1A19] p-6 text-[#E8E8E5] font-mono text-sm">
          {generating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-90">
              <span className="text-5xl font-bold text-[#3FC2AC] tabular-nums">{Math.round(genProgress)}%</span>
              <div className="w-64 h-2 rounded-full bg-[#2E2E2B] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3FC2AC] transition-all duration-300 ease-out"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <p className="opacity-70">Analyzing phenotypic data...</p>
            </div>
          ) : reportResult ? (
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(reportResult, null, 2)}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-[#8B8B86]">
              <ArrowRight className="w-12 h-12 opacity-20" />
              <p>Fill out the questionnaire and click Generate</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {reportHtml && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-[1000px] h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-[#E8E8E5] bg-[#F9F9F8]">
                <h3 className="font-bold text-lg text-[#1A1A19]">
                  {showDownloadFlow ? 'Preparing Your Download' : `${selectedTestName} Report`}
                </h3>
                <div className="flex items-center gap-3">
                  {!showDownloadFlow && (
                    <button
                      onClick={() => setShowDownloadFlow(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1A1A19] text-white rounded-lg text-sm font-bold hover:bg-black transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReportHtml(null);
                      setShowDownloadFlow(false);
                    }}
                    className="p-2 hover:bg-[#E8E8E5] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-[#5A5A55]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-white relative overflow-hidden">
                <div
                  ref={viewportRef}
                  className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                  style={{ paddingBottom: totalPages > 1 ? 88 : 0 }}
                >
                  <div
                    style={{
                      width: DESIGN_WIDTH * scale,
                      height: pageHeight * scale,
                      overflow: 'hidden',
                    }}
                  >
                    <iframe
                      id="report-iframe"
                      srcDoc={reportHtml}
                      onLoad={() => setIframeReady(true)}
                      scrolling="no"
                      className="border-0"
                      style={{
                        width: DESIGN_WIDTH,
                        height: pageHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                      }}
                      title="Report Preview"
                    />
                  </div>
                </div>

                {/* Carousel Navigation */}
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => {
                        if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
                      }}
                      disabled={currentPageIndex === 0}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 shadow-lg rounded-full flex items-center justify-center text-[#1A1A19] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    <button
                      onClick={() => {
                        if (currentPageIndex < totalPages - 1) setCurrentPageIndex(currentPageIndex + 1);
                      }}
                      disabled={currentPageIndex === totalPages - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 shadow-lg rounded-full flex items-center justify-center text-[#1A1A19] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Download countdown / "what's next" interest overlay - layered on top
                    of (not replacing) the report+iframe above, so the in-progress PDF
                    generation running inside that iframe is never interrupted. Mirrors
                    ReportViewerModal.tsx so this preview matches the patient-facing flow. */}
                {showDownloadFlow && (
                  <div className="absolute inset-0 z-30 bg-[#F9F9F8] flex flex-col overflow-hidden">
                    <div className="p-6 sm:p-8 text-center border-b border-[#E8E8E5] bg-white shrink-0">
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 transition-colors ${isDownloadDone ? 'bg-emerald-100 text-emerald-600' : 'bg-[#EDEBFB] text-[#6057D7]'}`}>
                        {isDownloadDone ? <CheckCircle2 className="w-8 h-8" /> : <Download className="w-8 h-8" />}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A19]">
                        {isDownloadDone
                          ? 'Downloaded!'
                          : downloadCountdown > 0
                            ? <>Your download starts in <span className="text-[#6057D7]">{downloadCountdown}s</span></>
                            : 'Finishing up your report…'}
                      </h2>
                      <p className="text-sm text-[#8B8B86] mt-1.5 max-w-md mx-auto">
                        {isDownloadDone ? (
                          <>
                            Your {selectedTestName} report has been saved to your device. If the download
                            didn't start, please click{' '}
                            <button
                              onClick={triggerDownload}
                              className="text-[#6057D7] font-semibold underline hover:text-[#4F46B8] cursor-pointer"
                            >
                              here
                            </button>.
                          </>
                        ) : (
                          "While we prepare your PDF, tell us which upcoming MyBodyQode tests interest you."
                        )}
                      </p>
                      {!isDownloadDone && (
                        <div className="w-full max-w-xs mx-auto h-1.5 bg-[#E8E8E5] rounded-full mt-4 overflow-hidden">
                          <div
                            className="h-full bg-[#6057D7] transition-all duration-1000 ease-linear"
                            style={{ width: `${((DOWNLOAD_COUNTDOWN_SECONDS - downloadCountdown) / DOWNLOAD_COUNTDOWN_SECONDS) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <div className="sticky top-0 z-10 bg-[#F9F9F8] px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
                        <div className="max-w-xl mx-auto">
                          <h3 className="text-sm font-bold text-[#1A1A19]">Upcoming MyBodyQode Tests</h3>
                          <p className="text-xs text-[#8B8B86] mt-0.5">Let us know which ones you'd be interested in.</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-6 max-w-xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6">
                        {UPCOMING_TEST_CATEGORIES.map((category) => (
                          <div key={category.name}>
                            <h4 className="text-xs font-bold text-[#6057D7] uppercase tracking-wider">{category.name}</h4>
                            <p className="text-xs text-[#8B8B86] mt-1 mb-3">{category.description}</p>
                            <div className="flex flex-col gap-2.5">
                              {category.tests.map(({ name, image, description }) => (
                                <div
                                  key={name}
                                  className="flex flex-col gap-3 bg-white border border-[#E8E8E5] rounded-2xl px-4 py-4"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <img
                                      src={image}
                                      alt=""
                                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-[#1A1A19]">{name}</p>
                                      <p className="text-xs text-[#8B8B86] mt-0.5">{description}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => setTestInterests(prev => ({ ...prev, [name]: true }))}
                                      aria-label={`Interested in ${name}`}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${testInterests[name] === true ? 'bg-[#EDEBFB] border-[#6057D7] text-[#6057D7]' : 'border-[#E8E8E5] text-[#5A5A55] hover:bg-[#F7F7F5]'}`}
                                    >
                                      <LikeIcon className="w-4 h-4 shrink-0" />
                                      I'm interested
                                    </button>
                                    <button
                                      onClick={() => setTestInterests(prev => ({ ...prev, [name]: false }))}
                                      aria-label={`Not interested in ${name}`}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${testInterests[name] === false ? 'bg-[#EDEBFB] border-[#6057D7] text-[#6057D7]' : 'border-[#E8E8E5] text-[#5A5A55] hover:bg-[#F7F7F5]'}`}
                                    >
                                      <DislikeIcon className="w-4 h-4 shrink-0" />
                                      Not interested
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {isDownloadDone && (
                      <div className="p-4 border-t border-[#E8E8E5] bg-white shrink-0 flex justify-center">
                        <button
                          onClick={() => {
                            setReportHtml(null);
                            setShowDownloadFlow(false);
                          }}
                          className="px-8 py-3 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-full font-semibold transition-colors cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <FloatingChatbot userName="Admin" contextData={reportResult} />
    </div>
  );
}
