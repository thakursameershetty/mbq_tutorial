import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, Activity, Sparkles, FileText, ArrowRight } from 'lucide-react';

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

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoadingQs(true);
    try {
      const res = await fetch('/api/admin/questions');
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
                        
                        // Set top header and appendix dynamic fields
                        setText('header-marker', markersStr);
                        setText('header-genotype', genotypeStr);
                        setText('header-gene', genesStr);
                        setText('appendix-gene', genesStr);
                        setText('appendix-marker', markersStr);
                        setText('appendix-genotype', genotypeStr);
                        
                        // Set combined Page 3 blocks (mostly used in hair template)
                        setText('page3-combined-gene', genesStr);
                        setText('page3-combined-marker', markersStr);
                        setText('page3-combined-genotype', genotypeStr);
                        
                        let combinedNarrative = "";
                        genes.forEach(g => {
                            if (data.per_gene_appendix && data.per_gene_appendix[g] && data.per_gene_appendix[g].genotype_narrative) {
                                combinedNarrative += '<p><b>' + g + ':</b> ' + data.per_gene_appendix[g].genotype_narrative + '</p>';
                            }
                        });
                        const p3NarrativeEl = document.getElementById('page3-combined-narrative');
                        if (p3NarrativeEl && combinedNarrative) {
                            p3NarrativeEl.innerHTML = combinedNarrative;
                        }
                        
                        // PAGE 1
                        if (data.page_1) {
                            setText('page1-report-title', data.page_1.report_title);
                            if (data.page_1.report_subtitles) {
                                data.page_1.report_subtitles.forEach((s, i) => setText('page1-report-subtitle-' + (i+1), s));
                            }
                            setText('page1-key-traits', data.page_1.key_traits);
                            setText('page1-tendency-description', data.page_1.tendency_description);
                            
                            if (data.page_1.what_this_means_for_you_cards) {
                                data.page_1.what_this_means_for_you_cards.forEach((card, i) => {
                                    setText('page1-wtm-card-title-' + (i+1), card.title);
                                    setText('page1-wtm-card-desc-' + (i+1), card.description);
                                });
                            }
                            if (data.page_1.share_card) {
                                setText('page1-share-title', data.page_1.share_card.title);
                                setText('page1-share-highlight', data.page_1.share_card.highlight);
                                setText('page1-share-quote', data.page_1.share_card.quote);
                                setText('page1-share-genotype', genesStr + ' Genotypes: ' + genotypeStr);
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
                                    descEl.innerHTML = 'Your genetic testing identified the <b style="color:#1b2240;">' + genotype + ' genotype.</b>';
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
                  `;

                  const finalHtml = html
                    .replace('<head>', `<head><base href="${window.location.origin}/">`)
                    .replace('src="./support.js"', 'src="/templates/support.js"')
                    .replace('</body>', scriptString + '\n</body>');

                  const newWin = window.open();
                  if (newWin) {
                    newWin.document.write(finalHtml);
                    newWin.document.close();
                  }
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
    </div>
  );
}
