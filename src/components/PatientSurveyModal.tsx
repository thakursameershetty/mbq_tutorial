import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, ChevronLeft, Lightbulb, ImageIcon } from 'lucide-react';

// Every question's illustration lives at
// src/assets/questionare-images/<subgene>/<category>-<subgene>-q<n>.png (n is
// 1-based). Loading them all via import.meta.glob means a new image just has
// to be dropped in the right folder - no import to add here by hand.
const questionImageModules = import.meta.glob('../assets/questionare-images/*/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

// Maps "SUBGENE-<0-based question index>" (e.g. "ACTN3-0") to its image, built
// from the filename rather than the folder so a mismatched folder can't
// silently misfile an image under the wrong subgene.
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
  /** Optional per-question illustration. Not yet populated by any data source;
   * the layout renders an empty placeholder until images are wired up. */
  image?: string;
  options: { text: string; score: number }[];
  weightage: number;
  isSelected?: boolean;
}

interface SelectedQuestion extends Question {
  test_name: string;
  subgene_name: string;
  uniqueId: string;
}

interface PatientSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | number;
  testName: string;
  /** Genes the patient actually purchased for this panel — e.g. ['CYP1A2'] for a
   * Lite option, or ['CYP1A2', 'ADORA2A'] for Pro. Narrows the question set to
   * that gene's questions (Lite) or both genes' questions (Pro). When omitted,
   * falls back to showing every question for the matched test. */
  genes?: string[];
  onComplete: () => void;
}

export default function PatientSurveyModal({ isOpen, onClose, userId, testName, genes, onComplete }: PatientSurveyModalProps) {
  const [questions, setQuestions] = useState<SelectedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnswers({});
      setCustomAnswers({});
      setCurrentIndex(0);
      setLoading(true);
      setIsSubmitted(false);
      fetchQuestions();
    }
  }, [isOpen, testName]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/questions');
      const data = await res.json();

      const selectedQs: SelectedQuestion[] = [];
      data.forEach((test: any) => {
        if (!testName || !testName.toLowerCase().includes(test.test_name.toLowerCase())) {
          return; // Skip tests that don't match the requested testName
        }

        const parseQ = (qs: any) => (typeof qs === 'string' ? JSON.parse(qs) : qs);
        const sub1 = parseQ(test.subgene1_questions);
        const sub2 = parseQ(test.subgene2_questions);

        // Lite purchases only cover one of the two subgenes — skip the other
        // subgene's questions entirely rather than asking about an untested gene.
        const geneSet = new Set((genes || []).map((g) => g.toUpperCase()));
        const includeSubgene = (subgeneName: string) => geneSet.size === 0 || geneSet.has((subgeneName || '').toUpperCase());

        if (includeSubgene(test.subgene1_name)) {
          sub1.forEach((q: Question, idx: number) => {
            const image = QUESTION_IMAGES[`${test.subgene1_name}-${idx}`];
            selectedQs.push({ ...q, image, test_name: test.test_name, subgene_name: test.subgene1_name, uniqueId: `${test.id}-1-${idx}` });
          });
        }
        if (includeSubgene(test.subgene2_name)) {
          sub2.forEach((q: Question, idx: number) => {
            const image = QUESTION_IMAGES[`${test.subgene2_name}-${idx}`];
            selectedQs.push({ ...q, image, test_name: test.test_name, subgene_name: test.subgene2_name, uniqueId: `${test.id}-2-${idx}` });
          });
        }
      });

      setQuestions(selectedQs);
    } catch (err) {
      console.error("Failed to load questions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const answeredQuestionIds = new Set([
      ...Object.keys(answers),
      ...Object.keys(customAnswers).filter(id => customAnswers[id].trim() !== '')
    ]);
    if (answeredQuestionIds.size < questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

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

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/report-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, rawAnswers, testName }),
      });

      if (res.ok) {
        // Update user state if the backend returns it
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('userProfile', JSON.stringify(data.user));
        }
        setIsSubmitted(true);
        onComplete();
      } else {
        alert("Failed to submit survey. Please try again.");
      }
    } catch (err) {
      console.error("Submit error", err);
      alert("Failed to submit survey.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const answeredQuestionIds = new Set([
    ...Object.keys(answers),
    ...Object.keys(customAnswers).filter(id => customAnswers[id].trim() !== '')
  ]);
  const allAnswered = answeredQuestionIds.size === questions.length && questions.length > 0;
  const currentQuestion = questions[currentIndex];
  const isCurrentAnswered = currentQuestion ? answeredQuestionIds.has(currentQuestion.uniqueId) : false;
  const isLastQuestion = currentIndex === questions.length - 1;
  const progressPct = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden border border-[#E8E8E5]"
        >
          {isSubmitted ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F9F9F8]">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-[#1A1A19] mb-4">Submitted!</h2>
              <p className="text-[#5A5A55] text-lg max-w-md mx-auto mb-8">
                Your phenotypic survey has been submitted successfully. The data is securely stored, and your report will be ready soon.
              </p>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-[#6057D7] hover:bg-[#4F46B8] text-white rounded-full font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-[#E8E8E5] bg-[#F9F9F8] shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1A19]">Phenotypic Survey</h2>
                    <p className="text-sm text-[#8B8B86] mt-1">Please answer the following questions to help us generate your report.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-[#E8E8E5] rounded-full transition-colors text-[#5A5A55]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {!loading && questions.length > 0 && (
                  <div className="mt-5 h-1.5 w-full bg-[#E8E8E5] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#6057D7] rounded-full"
                      initial={false}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#6057D7]" />
                    <p className="text-[#8B8B86] mt-4 font-medium">Loading questions...</p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-[#F7F7F5] rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-[#A0A09D]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1A1A19] mb-2">No Questions Available</h3>
                    <p className="text-[#8B8B86]">Your test configuration currently has no selected questions.</p>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto pb-4">
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
                        <div className="w-full h-48 sm:h-60 rounded-2xl bg-[#F2F2F0] border border-[#E8E8E5] flex items-center justify-center mb-6 overflow-hidden">
                          {currentQuestion.image ? (
                            <img src={currentQuestion.image} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="w-10 h-10 text-[#C7C7C2]" />
                          )}
                        </div>

                        <h3 className="text-[#1A1A19] font-bold text-xl sm:text-2xl mb-4">
                          {currentIndex + 1}. {currentQuestion.question}
                        </h3>

                        {currentQuestion.example && (
                          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
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
                              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3
                        ${answers[currentQuestion.uniqueId] === optIdx
                                  ? 'border-[#6057D7] bg-indigo-50/50 text-[#1A1A19] shadow-sm'
                                  : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE] text-[#5A5A55]'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                        ${answers[currentQuestion.uniqueId] === optIdx ? 'border-[#6057D7]' : 'border-[#D4D4CE]'}`}
                              >
                                {answers[currentQuestion.uniqueId] === optIdx && <div className="w-2.5 h-2.5 bg-[#6057D7] rounded-full" />}
                              </div>
                              <span className="text-sm font-semibold">{opt.text}</span>
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

              {!loading && questions.length > 0 && (
                <div className="p-4 sm:p-6 border-t border-[#E8E8E5] bg-[#F9F9F8] flex justify-between items-center shrink-0 gap-4">
                  <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className={`flex items-center gap-1 px-5 py-2.5 rounded-full font-bold text-sm transition-all
                    ${currentIndex === 0
                        ? 'text-[#C7C7C2] cursor-not-allowed'
                        : 'text-[#5A5A55] hover:bg-[#E8E8E5]'
                      }`}
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>

                  <span className="text-sm font-medium text-[#8B8B86] shrink-0">
                    Question <span className="font-bold text-[#1A1A19]">{currentIndex + 1}</span> of {questions.length}
                  </span>

                  {isLastQuestion ? (
                    <button
                      onClick={handleSubmit}
                      disabled={!allAnswered || submitting}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm
                    ${allAnswered
                          ? 'bg-[#6057D7] text-white hover:bg-indigo-700 hover:shadow-md'
                          : 'bg-[#E8E8E5] text-[#A0A09D] cursor-not-allowed'
                        }`}
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {submitting ? 'Generating AI Report...' : 'Submit Answers'}
                    </button>
                  ) : (
                    <button
                      onClick={goNext}
                      disabled={!isCurrentAnswered}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm
                    ${isCurrentAnswered
                          ? 'bg-[#6057D7] text-white hover:bg-indigo-700 hover:shadow-md'
                          : 'bg-[#E8E8E5] text-[#A0A09D] cursor-not-allowed'
                        }`}
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
