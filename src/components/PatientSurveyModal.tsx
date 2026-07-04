import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';

interface Question {
  question: string;
  example: string;
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
  onComplete: () => void;
}

export default function PatientSurveyModal({ isOpen, onClose, userId, onComplete }: PatientSurveyModalProps) {
  const [questions, setQuestions] = useState<SelectedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [expandedQs, setExpandedQs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
    }
  }, [isOpen]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/questions');
      const data = await res.json();

      const selectedQs: SelectedQuestion[] = [];
      data.forEach((test: any) => {
        const parseQ = (qs: any) => (typeof qs === 'string' ? JSON.parse(qs) : qs);
        const sub1 = parseQ(test.subgene1_questions);
        const sub2 = parseQ(test.subgene2_questions);

        sub1.forEach((q: Question, idx: number) => {
          if (q.isSelected) {
            selectedQs.push({ ...q, test_name: test.test_name, subgene_name: test.subgene1_name, uniqueId: `${test.id}-1-${idx}` });
          }
        });
        sub2.forEach((q: Question, idx: number) => {
          if (q.isSelected) {
            selectedQs.push({ ...q, test_name: test.test_name, subgene_name: test.subgene2_name, uniqueId: `${test.id}-2-${idx}` });
          }
        });
      });

      setQuestions(selectedQs);
    } catch (err) {
      console.error("Failed to load questions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/request-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested: false }),
      });

      if (res.ok) {
        onComplete();
        onClose();
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

  const allAnswered = Object.keys(answers).length === questions.length && questions.length > 0;

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
          <div className="flex items-center justify-between p-6 border-b border-[#E8E8E5] bg-[#F9F9F8]">
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
              <div className="space-y-10 max-w-2xl mx-auto pb-10">
                {questions.map((q, index) => (
                  <div key={q.uniqueId} className="bg-[#F9F9F8] rounded-2xl border border-[#E8E8E5] overflow-hidden">
                    <div 
                      className="p-6 cursor-pointer hover:bg-[#F2F2F0] transition-colors"
                      onClick={() => setExpandedQs(prev => ({ ...prev, [q.uniqueId]: prev[q.uniqueId] === false ? true : false }))}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="text-xs font-bold text-[#6057D7] bg-indigo-50 px-2.5 py-1 rounded-md mb-3 inline-block">
                            {q.test_name} - {q.subgene_name}
                          </span>
                          <h3 className="text-[#1A1A19] font-bold text-lg mb-1">
                            {index + 1}. {q.question}
                          </h3>
                          {q.example && (
                            <p className="text-[#8B8B86] text-sm italic">Example: {q.example}</p>
                          )}
                        </div>
                        <div className="mt-2 shrink-0 text-[#8B8B86]">
                          <ChevronDown 
                            size={20} 
                            className={`transition-transform duration-300 ${expandedQs[q.uniqueId] !== false ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedQs[q.uniqueId] !== false && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="px-6 pb-6"
                        >
                          <div className="space-y-2 mt-2 pt-4 border-t border-[#E8E8E5]">
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.uniqueId]: optIdx }))}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3
                            ${answers[q.uniqueId] === optIdx
                              ? 'border-[#6057D7] bg-indigo-50/50 text-[#1A1A19] shadow-sm'
                              : 'border-[#E8E8E5] bg-white hover:border-[#D4D4CE] text-[#5A5A55]'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                            ${answers[q.uniqueId] === optIdx ? 'border-[#6057D7]' : 'border-[#D4D4CE]'}`}
                          >
                            {answers[q.uniqueId] === optIdx && <div className="w-2.5 h-2.5 bg-[#6057D7] rounded-full" />}
                          </div>
                            <span className="text-sm font-semibold">{opt.text}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
                ))}
              </div>
            )}
          </div>

          {!loading && questions.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-[#E8E8E5] bg-[#F9F9F8] flex justify-between items-center shrink-0">
              <span className="text-sm font-medium text-[#8B8B86]">
                Answered: <span className="font-bold text-[#1A1A19]">{Object.keys(answers).length}</span> of {questions.length}
              </span>
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
                {submitting ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
