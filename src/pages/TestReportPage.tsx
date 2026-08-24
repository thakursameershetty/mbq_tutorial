import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, Activity, Sparkles, FileText, ArrowRight, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import FloatingChatbot from '../components/FloatingChatbot';

interface Question {
  question: string;
  example: string;
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

interface SelectedQuestion extends Question {
  test_name: string;
  subgene_name: string;
  uniqueId: string;
}

export default function TestReportPage() {
  const [allQuestions, setAllQuestions] = useState<SelectedQuestion[]>([]);
  const [tests, setTests] = useState<TestData[]>([]);
  const [selectedTestName, setSelectedTestName] = useState<string>('');
  const [geneVariants, setGeneVariants] = useState<Record<string, string>>({});

  const [loadingQs, setLoadingQs] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [customAnswers, setCustomAnswers] = useState<{ [uniqueId: string]: string }>({});
  const [expandedQs, setExpandedQs] = useState<Record<string, boolean>>({});

  const [generating, setGenerating] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageFeedbacks, setPageFeedbacks] = useState<Record<number, string>>({});
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [currentFeedbackInput, setCurrentFeedbackInput] = useState('');
  const [pendingNextIndex, setPendingNextIndex] = useState<number | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    const iframe = document.getElementById('report-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow && reportHtml) {
      iframe.contentWindow.postMessage({ type: 'SET_PAGE', pageIndex: currentPageIndex }, '*');
    }
  }, [currentPageIndex, reportHtml]);

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
          selectedQs.push({ ...q, test_name: test.test_name, subgene_name: test.subgene1_name, uniqueId: `${test.id}-1-${idx}` });
        });
        sub2.forEach((q: Question, idx: number) => {
          selectedQs.push({ ...q, test_name: test.test_name, subgene_name: test.subgene2_name, uniqueId: `${test.id}-2-${idx}` });
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
      if (!geneVariants[selectedTest.subgene1_name] || !geneVariants[selectedTest.subgene2_name]) {
        alert("Please select variants for both genes.");
        return;
      }
    }

    setGenerating(true);
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
          geneVariants
        }),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setReportResult(data.report);
      } else {
        alert("Generation failed: " + data.error);
      }
    } catch (err) {
      console.error("Failed to generate", err);
      alert("Error calling generate endpoint");
    } finally {
      setGenerating(false);
    }
  };

  const questions = allQuestions.filter(q => q.test_name === selectedTestName);
  const answeredQuestionIds = new Set([
    ...Object.keys(answers),
    ...Object.keys(customAnswers).filter(id => customAnswers[id].trim() !== '')
  ]);
  const allAnswered = questions.length > 0 && answeredQuestionIds.size === questions.length;
  const currentTest = tests.find(t => t.test_name === selectedTestName);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] w-full max-w-7xl mx-auto px-4 gap-4 pb-6">
      {/* LEFT PANE - Questionnaire */}
      <div className="flex-1 bg-white rounded-3xl border border-[#E8E8E5] shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-[#E8E8E5] flex items-center gap-3 bg-[#F9F9F8]">
          <Activity className="text-[#6057D7]" />
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A19]">Questionnaire Test</h2>
              <p className="text-sm text-[#8B8B86]">Select test and variants to generate report</p>
            </div>

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
          </div>
        </div>

        {currentTest && (
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
            <div className="space-y-6">
              {questions.map((q, index) => (
                <div key={q.uniqueId} className="bg-white rounded-2xl border border-[#E8E8E5] shadow-sm overflow-hidden">
                  <div
                    className="p-5 cursor-pointer hover:bg-[#F9F9F8] transition-colors"
                    onClick={() => setExpandedQs(prev => ({ ...prev, [q.uniqueId]: prev[q.uniqueId] === false ? true : false }))}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-[#6057D7] bg-indigo-50 px-2.5 py-1 rounded-md mb-2 inline-block">
                          {q.test_name} - {q.subgene_name}
                        </span>
                        <h3 className="text-[#1A1A19] font-semibold text-[15px]">
                          {index + 1}. {q.question}
                        </h3>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-[#8B8B86] shrink-0 mt-1 transition-transform duration-300 ${expandedQs[q.uniqueId] !== false ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedQs[q.uniqueId] !== false && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5"
                      >
                        <div className="space-y-2 mt-1 pt-3 border-t border-[#E8E8E5]">
                          {q.options.map((opt, optIdx) => (
                            <button
                              key={optIdx}
                              onClick={() => setAnswers(prev => ({ ...prev, [q.uniqueId]: optIdx }))}
                              className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3
                                ${answers[q.uniqueId] === optIdx
                                  ? 'border-[#6057D7] bg-indigo-50/40 text-[#1A1A19]'
                                  : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE] text-[#5A5A55]'
                                }`}
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                                ${answers[q.uniqueId] === optIdx ? 'border-[#6057D7]' : 'border-[#D4D4CE]'}`}
                              >
                                {answers[q.uniqueId] === optIdx && <div className="w-2 h-2 bg-[#6057D7] rounded-full" />}
                              </div>
                              <span className="text-sm font-medium">{opt.text}</span>
                            </button>
                          ))}
                          <div className="pt-2">
                            <input
                              type="text"
                              value={customAnswers[q.uniqueId] || ''}
                              onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.uniqueId]: e.target.value }))}
                              placeholder="Any specific remarks or custom input..."
                              className="w-full p-3 text-sm border border-[#E8E8E5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6057D7]/20 focus:border-[#6057D7] transition-all bg-white placeholder-[#B0B0AE] text-[#1A1A19]"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E8E8E5] bg-white flex justify-between items-center">
          <span className="text-sm text-[#8B8B86]">
            Answered: <span className="font-bold text-[#1A1A19]">{answeredQuestionIds.size}</span> / {questions.length}
          </span>
          <button
            onClick={handleGenerate}
            disabled={!allAnswered || generating}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all
              ${allAnswered
                ? 'bg-[#1A1A19] text-white hover:bg-black'
                : 'bg-[#F0F0ED] text-[#A0A09D] cursor-not-allowed'
              }`}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate AI Report'}
          </button>
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
          {reportResult && (
            <button
              onClick={async () => {
                try {
                  const testId = selectedTestName.split(' ')[0].toLowerCase();
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

                    const getDynamicTitleFromAI = (id: string, data: any): string | null => {
                      if (!data || !id) return null;
                      try {
                        const idx = () => parseInt(id.split('-').pop() as string) - 1;
                        if (id.startsWith('page1-wtm-card-title-')) return data.page_1?.what_this_means_for_you_cards?.[idx()]?.title;
                        if (id.startsWith('page3-research-title-')) return data.page_3?.what_research_observes?.[idx()]?.title;
                        if (id.startsWith('page3-told-us-')) return data.page_3?.what_you_told_us?.[idx()];
                        if (id.startsWith('page2-what-this-means-')) return data.page_2?.what_this_means?.[idx()];
                        if (id.startsWith('page2-what-you-may-notice-')) return data.page_2?.what_you_may_notice?.[idx()];
                        if (id.startsWith('page2-what-this-explains-')) return data.page_2?.what_this_explains?.[idx()];
                        if (id.startsWith('page4-train-title-')) {
                          return data.page_4?.train_like_this?.[idx()]?.title ||
                            data.page_4?.consume_like_this?.[idx()]?.title ||
                            data.page_4?.wash_like_this?.[idx()]?.title;
                        }
                        if (id.startsWith('page4-recover-title-')) {
                          return data.page_4?.recover_like_this?.[idx()]?.title ||
                            data.page_4?.treat_like_this?.[idx()]?.title;
                        }
                        if (id.startsWith('page4-fuel-title-')) {
                          return data.page_4?.fuel_like_this?.[idx()]?.title ||
                            data.page_4?.nourish_like_this?.[idx()]?.title ||
                            data.page_4?.protect_like_this?.[idx()]?.title;
                        }
                      } catch (e) { /* ignore malformed id */ }
                      return null;
                    };

                    const getDynamicIcon = (title: string | null, defaultIcon: string | null): string | null => {
                      const t = (title || '').toLowerCase();
                      if (!t) return defaultIcon;
                      const has = (...words: string[]) => words.some(w => new RegExp(`\\b${w}\\b`, 'i').test(t));

                      if (has('sleep', 'rest', 'evening', 'late', 'night', 'rested')) return 'bedtime';
                      if (has('time', 'hour', 'hours', 'duration', 'schedule', 'timing', 'fast', 'rapid', 'quick')) return 'schedule';
                      if (has('anxiety', 'jitter', 'jittery', 'mindful', 'relax', 'calm')) return 'spa';
                      if (has('lot', 'amount', 'much', 'high', 'heavy', 'volume')) return 'battery_charging_full';
                      if (has('focus', 'clearance', 'alert', 'brain', 'mental')) return 'neurology';
                      if (has('hydrate', 'water', 'drink', 'fluid')) return 'water_drop';
                      if (has('snack', 'diet', 'nourish', 'meal', 'food')) return 'restaurant';
                      if (has('strength', 'weight', 'weights')) return 'exercise';
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
                      if (has('issue', 'issues', 'side effect', 'side effects')) return 'report_problem';
                      if (has('quality', 'good', 'well')) return 'verified';
                      if (has('taper', 'tapers', 'wear off', 'wears off', 'decrease', 'drop')) return 'trending_down';
                      if (has('energy', 'boost', 'coffee', 'caffeine', 'cup', 'cups', 'dose')) return 'local_cafe';
                      if (has('gene', 'dna', 'variant', 'variants')) return 'biotech';
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
                      window.GENE_VARIANTS = ${JSON.stringify(geneVariants)};
                      console.log("Report Data loaded:", window.REPORT_DATA);
                      
                      try {
                        let data = window.REPORT_DATA;
                        let genesObj = window.GENE_VARIANTS || {};
                        let genes = Object.keys(genesObj);
                        
                        const rsidMap = {
                            "ACTN3": "rs1815739",
                            "ACE": "rs4646994",
                            "CYP1A2": "rs762551",
                            "ADORA2A": "rs5751876",
                            "EDAR": "rs3827760",
                            "FGFR2": "rs4752566"
                        };
                        
                        const markersStr = genes.map(g => rsidMap[g] || "").join(', ');
                        const genotypeStr = Object.values(genesObj).join(', ');
                        const genesStr = genes.join(', ');
                        
                        let allLinks = [];
                        if (data.per_gene_appendix) {
                            genes.forEach(g => {
                                if (data.per_gene_appendix[g] && data.per_gene_appendix[g].scientific_references) {
                                    allLinks = allLinks.concat(data.per_gene_appendix[g].scientific_references);
                                }
                            });
                        }
                        
                        const setText = (id, text) => {
                            const el = document.getElementById(id);
                            if (el && text) {
                                el.textContent = text;
                            }
                        };
                        
                        // Combined "GENE (Genotype)" string, e.g. "ACTN3 (RR), ACE (II)"
                        const geneGtStr = genes.map(g => g + ' (' + (genesObj[g] || '') + ')').join(', ');

                        // Reduces a gene card down to just "GENE (Genotype)" - hides the separate
                        // rsID/marker and genotype/method columns since geneGtStr already carries
                        // that info, and shrinks the card to fit the shorter content.
                        const simplifyGeneCard = (geneId, markerId, genotypeId) => {
                            const geneEl = document.getElementById(geneId);
                            if (geneEl) {
                                geneEl.textContent = geneGtStr;
                                if (geneEl.previousElementSibling) {
                                    geneEl.previousElementSibling.textContent = 'GENE (Genotype)';
                                }
                                const card = geneEl.parentElement?.parentElement?.parentElement?.parentElement;
                                if (card) {
                                    card.style.width = 'max-content';
                                    card.style.minWidth = '280px';
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
                        simplifyGeneCard('appendix-gene', 'header-marker', 'header-genotype'); // Page 1 card
                        setText('header-gene', genesStr);
                        setText('appendix-marker', markersStr);
                        setText('appendix-genotype', genotypeStr);
                        
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
                                    const traits = data.page_1.key_traits.split('•').map(t => t.trim()).filter(Boolean);
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
                            setText('page1-report-title', data.page_1.report_title);
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
                                const traits = data.page_1.key_traits.split('•').map(t => t.trim()).filter(Boolean);
                                keyTraitsSpan.innerHTML = traits.map(t => '&bull; ' + t).join('<br/>');
                                keyTraitsSpan.style.fontWeight = '500';
                                keyTraitsSpan.style.fontSize = '17px';
                                keyTraitsSpan.style.lineHeight = '1.5';
                                const flexDiv = keyTraitsSpan.parentElement;
                                if (flexDiv) flexDiv.style.alignItems = 'flex-start';
                            } else {
                                const keyTraitsEl = document.getElementById('page1-key-traits');
                                if (keyTraitsEl && data.page_1.key_traits) {
                                    const traits = data.page_1.key_traits.split('•').map(t => t.trim()).filter(Boolean);
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
                                setText('page1-share-title', toTitleCase(data.page_1.share_card.title));

                                const highlightEl = document.getElementById('page1-share-highlight');
                                if (highlightEl) {
                                    const highlightText = toSentenceCase(data.page_1.share_card.highlight);
                                    const bullets = highlightText.split('.').map(s => s.trim()).filter(Boolean);
                                    highlightEl.innerHTML = bullets.map(b => '<div>&bull; ' + b + '.</div>').join('');
                                }

                                setText('page1-share-quote', toSentenceCase(data.page_1.share_card.quote));
                                setText('page1-share-genotype', geneGtStr);
                            }

                            // "BUILT FOR ..." summary in the share card, derived from key traits
                            const builtForEl = document.getElementById('page1-share-built-for');
                            if (builtForEl && data.page_1.key_traits) {
                                const traits = data.page_1.key_traits.split('•').map(t => t.trim().toUpperCase()).filter(Boolean);
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
                        }

                        // APPENDIX GENE BREAKDOWNS (Page 3/4)
                        genes.forEach(g => {
                            let gData = data.per_gene_appendix && data.per_gene_appendix[g];
                            if (gData) {
                                setText('page3-' + g + '-title', "WHAT DOES YOUR RESULT MEAN? - " + g);
                                
                                let genotype = gData.genotype || (genesObj[g] || "");
                                let a1 = genotype.length > 0 ? genotype[0] : "";
                                let a2 = genotype.length > 1 ? genotype[1] : a1;
                                
                                let gtStr = genotype + " (" + a1 + " / " + a2 + ")";
                                
                                const genotypeEl = document.getElementById('page3-' + g + '-genotype');
                                if (genotypeEl) genotypeEl.textContent = gtStr;
                                
                                setText('page3-' + g + '-allele-1', a1);
                                setText('page3-' + g + '-allele-2', a2);
                                
                                const descEl = document.getElementById('page3-' + g + '-desc');
                                if (descEl) {
                                    const rsid = rsidMap[g] || "";
                                    let descText = "";
                                    if (a1 === a2) {
                                        descText = 'You have two "' + a1 + '" bases at the ' + rsid + ' position. This is called the <b style="color:#1b2240;">' + genotype + ' genotype.</b>';
                                    } else {
                                        descText = 'You have the "' + a1 + '" and "' + a2 + '" bases at the ' + rsid + ' position. This is called the <b style="color:#1b2240;">' + genotype + ' genotype.</b>';
                                    }
                                    descEl.innerHTML = descText;
                                }
                                
                                setText('page3-' + g + '-effect', gData.genotype_narrative || "");
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
                                              text: 'Check out my personalized Body Qode report!',
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

                          const opt = {
                            margin:       0,
                            filename:     filename || 'report.pdf',
                            image:        { type: 'jpeg', quality: 1.0 },
                            html2canvas:  { scale: 2, useCORS: true, windowWidth: 1024, scrollY: 0 },
                            jsPDF:        { unit: 'px', format: [1024, 1449], orientation: 'portrait' }
                          };
                          
                          try {
                            if (pages.length > 0) {
                              let worker = html2pdf().set(opt);
                              
                              for (let i = 0; i < pages.length; i++) {
                                  worker = worker.then(() => {
                                      pages.forEach((p, idx) => {
                                          p.style.display = (idx === i) ? 'block' : 'none';
                                      });
                                      return new Promise(r => setTimeout(r, 100)); // allow DOM to settle
                                  });
                                  
                                  if (i === 0) {
                                      worker = worker.from(pages[i]).toPdf();
                                  } else {
                                      worker = worker.get('pdf').then(pdf => { pdf.addPage(); }).from(pages[i]).toContainer().toCanvas().toPdf();
                                  }
                              }
                              
                              await worker.save();
                              
                              pages.forEach(p => p.style.display = ''); // restore display
                            } else {
                              await html2pdf().set(opt).from(container).save();
                            }
                          } catch (e) {
                            console.error("PDF generation failed", e);
                          }
                          
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

                  const now = new Date();
                  const formattedDate = now.toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });

                  const pageCount = (html.match(/data-screen-label=/g) || []).length;
                  setTotalPages(pageCount > 0 ? pageCount : 1);
                  setCurrentPageIndex(0);

                  const carouselScript = `
                    <script>
                      window.addEventListener('message', (e) => {
                        if (e.data && e.data.type === 'SET_PAGE') {
                          const pages = document.querySelectorAll('div[data-screen-label]');
                          pages.forEach((p, idx) => {
                            p.style.display = (idx === e.data.pageIndex) ? 'block' : 'none';
                          });
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
                      img[alt="MBQ Logo"], img[alt="CQ Logo"], img[alt="HQ Logo"] {
                        height: 60px !important;
                        width: auto !important;
                      }
                    </style>
                  `;

                  const finalHtml = html
                    .replace('<head>', `<head><base href="${window.location.origin}/">\n${fontCss}`)
                    .replace('src="./support.js"', 'src="/templates/support.js"')
                    .replace(/dd mm yyyy/g, formattedDate)
                    .replace('</body>', scriptString + '\n' + carouselScript + '\n</body>');

                  setReportHtml(finalHtml);
                } catch (err) {
                  console.error(err);
                  alert("Could not load the HTML template for this test.");
                }
              }}
              className="px-4 py-2 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              View Beautiful Report
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#1A1A19] p-6 text-[#E8E8E5] font-mono text-sm">
          {generating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70">
              <Loader2 className="w-8 h-8 animate-spin text-[#3FC2AC]" />
              <p>Analyzing phenotypic data...</p>
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
                <h3 className="font-bold text-lg text-[#1A1A19]">Beautiful Report</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const iframe = document.getElementById('report-iframe') as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow && (iframe.contentWindow as any).downloadPDF) {
                        (iframe.contentWindow as any).downloadPDF(`${selectedTestName.toLowerCase().replace(/\s+/g, '-')}-report.pdf`);
                      } else {
                        alert("PDF generation is still loading, please try again in a few seconds.");
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1A19] text-white rounded-lg text-sm font-bold hover:bg-black transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => setReportHtml(null)}
                    className="p-2 hover:bg-[#E8E8E5] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-[#5A5A55]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-white relative">
                <iframe
                  id="report-iframe"
                  srcDoc={reportHtml}
                  className="absolute inset-0 w-full h-full border-0"
                  title="Report Preview"
                />

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
                        if (currentPageIndex < totalPages - 1) {
                          if (!pageFeedbacks[currentPageIndex]) {
                            setPendingNextIndex(currentPageIndex + 1);
                            setShowFeedbackPrompt(true);
                          } else {
                            setCurrentPageIndex(currentPageIndex + 1);
                          }
                        }
                      }}
                      disabled={currentPageIndex === totalPages - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 shadow-lg rounded-full flex items-center justify-center text-[#1A1A19] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Feedback Prompt Overlay */}
                <AnimatePresence>
                  {showFeedbackPrompt && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                      <motion.div
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-[400px]"
                      >
                        <h4 className="text-lg font-bold text-[#1A1A19] mb-2">Before you continue...</h4>
                        <p className="text-sm text-[#5c6473] mb-4">Please provide your feedback for Page {currentPageIndex + 1}.</p>
                        <textarea
                          value={currentFeedbackInput}
                          onChange={(e) => setCurrentFeedbackInput(e.target.value)}
                          placeholder="Your thoughts on this page..."
                          className="w-full h-32 p-3 border border-[#E8E8E5] rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#6057D7] resize-none"
                        />
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => setShowFeedbackPrompt(false)}
                            className="px-4 py-2 text-sm font-semibold text-[#5c6473] hover:text-[#1A1A19]"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={!currentFeedbackInput.trim() || submittingFeedback}
                            onClick={async () => {
                              if (!currentFeedbackInput.trim()) return;
                              setSubmittingFeedback(true);
                              try {
                                await fetch('/api/test/feedback', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    test_name: selectedTestName,
                                    page_index: currentPageIndex,
                                    feedback: currentFeedbackInput
                                  })
                                });
                              } catch (e) {
                                console.error('Feedback save error', e);
                              }
                              setPageFeedbacks(prev => ({ ...prev, [currentPageIndex]: currentFeedbackInput }));
                              setSubmittingFeedback(false);
                              setShowFeedbackPrompt(false);
                              setCurrentFeedbackInput('');
                              if (pendingNextIndex !== null) {
                                setCurrentPageIndex(pendingNextIndex);
                                setPendingNextIndex(null);
                              }
                            }}
                            className="px-6 py-2 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                          >
                            {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit & Continue'}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <FloatingChatbot userName="Admin" contextData={reportResult} />
    </div>
  );
}
