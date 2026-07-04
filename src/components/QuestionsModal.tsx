import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, ChevronDown } from 'lucide-react';

interface Question {
  question: string;
  example: string;
  options: { text: string; score: number }[];
  weightage: number;
  isSelected?: boolean;
}

interface TestQuestions {
  id: number;
  test_name: string;
  subgene1_name: string;
  subgene2_name: string;
  subgene1_questions: Question[];
  subgene2_questions: Question[];
}

interface QuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuestionsModal({ isOpen, onClose }: QuestionsModalProps) {
  const [questionsData, setQuestionsData] = useState<TestQuestions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [expandAllToggle, setExpandAllToggle] = useState<number>(0);
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  const toggleAll = () => {
    setIsAllExpanded(!isAllExpanded);
    setExpandAllToggle(prev => prev + 1);
  };

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

      const parsedData = data.map((item: any) => {
        const parseQ = (qs: any) => {
          const parsed = typeof qs === 'string' ? JSON.parse(qs) : qs;
          return parsed.map((q: any) => ({ ...q, isSelected: q.isSelected ?? false }));
        };
        return {
          ...item,
          subgene1_questions: parseQ(item.subgene1_questions),
          subgene2_questions: parseQ(item.subgene2_questions),
        };
      });

      setQuestionsData(parsedData);
      if (parsedData.length > 0 && !activeTab) {
        setActiveTab(parsedData[0].test_name);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const test of questionsData) {
        await fetch(`/api/admin/questions/${test.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subgene1_questions: test.subgene1_questions,
            subgene2_questions: test.subgene2_questions
          })
        });
      }
      alert('Questions saved successfully!');
      onClose();
    } catch (err) {
      console.error('Failed to save questions:', err);
      alert('Failed to save questions.');
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (
    testId: number,
    subgeneIdx: 1 | 2,
    qIndex: number,
    field: keyof Question,
    value: any
  ) => {
    setQuestionsData(prev => prev.map(test => {
      if (test.id !== testId) return test;

      const newTest = { ...test };
      const subgeneKey = subgeneIdx === 1 ? 'subgene1_questions' : 'subgene2_questions';

      newTest[subgeneKey] = [...newTest[subgeneKey]];
      newTest[subgeneKey][qIndex] = { ...newTest[subgeneKey][qIndex], [field]: value };

      return newTest;
    }));
  };

  const handleToggleSelect = (testId: number, subgeneIdx: 1 | 2, qIndex: number, currentVal: boolean) => {
    setQuestionsData(prev => prev.map(test => {
      if (test.id !== testId) return test;

      const isSelecting = !currentVal;
      if (isSelecting) {
        const totalSelected = test.subgene1_questions.filter(q => q.isSelected).length +
          test.subgene2_questions.filter(q => q.isSelected).length;
        if (totalSelected >= 5) {
          alert('You can only select up to 5 questions per test.');
          return test;
        }
      }

      const newTest = { ...test };
      const subgeneKey = subgeneIdx === 1 ? 'subgene1_questions' : 'subgene2_questions';

      newTest[subgeneKey] = [...newTest[subgeneKey]];
      newTest[subgeneKey][qIndex] = { ...newTest[subgeneKey][qIndex], isSelected: isSelecting };

      return newTest;
    }));
  };

  const scrollToSubgene = (testId: number, testName: string, subgeneIdx: 1 | 2) => {
    if (activeTab !== testName) {
      setActiveTab(testName);
    }
    setTimeout(() => {
      const element = document.getElementById(`test-${testId}-subgene-${subgeneIdx}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const updateOption = (
    testId: number,
    subgeneIdx: 1 | 2,
    qIndex: number,
    optIndex: number,
    field: 'text' | 'score',
    value: any
  ) => {
    setQuestionsData(prev => prev.map(test => {
      if (test.id !== testId) return test;

      const newTest = { ...test };
      const subgeneKey = subgeneIdx === 1 ? 'subgene1_questions' : 'subgene2_questions';

      newTest[subgeneKey] = [...newTest[subgeneKey]];
      newTest[subgeneKey][qIndex] = { ...newTest[subgeneKey][qIndex] };
      newTest[subgeneKey][qIndex].options = [...newTest[subgeneKey][qIndex].options];
      newTest[subgeneKey][qIndex].options[optIndex] = {
        ...newTest[subgeneKey][qIndex].options[optIndex],
        [field]: field === 'score' ? Number(value) : value
      };

      return newTest;
    }));
  };

  if (!isOpen) return null;

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
          className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-[#E8E8E5]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#E8E8E5] bg-[#F9F9F8]">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A19]">Manage Test Questions</h2>
              <p className="text-sm text-[#8B8B86] mt-1">Configure questions, options, and weightages for each gene.</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleAll}
                className="text-sm font-semibold text-[#6057D7] hover:text-[#4F46E5] bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
              >
                {isAllExpanded ? 'Collapse All' : 'Expand All'}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#E8E8E5] rounded-full transition-colors text-[#5A5A55]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#6057D7]" />
                <p className="text-[#8B8B86] mt-4 font-medium">Loading questions...</p>
              </div>
            ) : (
              <>
                {/* Sidebar Tabs */}
                <div className="w-full md:w-56 bg-[#F9F9F8] border-b md:border-b-0 md:border-r border-[#E8E8E5] p-4 flex flex-row md:flex-col gap-4 md:gap-0 md:space-y-4 overflow-x-auto md:overflow-y-auto shrink-0">
                  {questionsData.map(test => {
                    const subgene1Count = test.subgene1_questions.filter(q => q.isSelected).length;
                    const subgene2Count = test.subgene2_questions.filter(q => q.isSelected).length;
                    const isActive = activeTab === test.test_name;
                    return (
                      <div key={test.id} className="flex flex-col gap-2 shrink-0 w-[180px] md:w-auto">
                        <button
                          onClick={() => setActiveTab(test.test_name)}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-white text-[#6057D7] shadow-sm border border-[#E8E8E5]' : 'text-[#8B8B86] hover:bg-[#E8E8E5]/50'}`}
                        >
                          {test.test_name} Test
                        </button>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <button
                            onClick={() => scrollToSubgene(test.id, test.test_name, 1)}
                            className={`w-full flex items-center justify-between px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isActive ? 'text-[#5A5A55] hover:bg-[#E8E8E5]/80' : 'text-[#A0A09D] hover:bg-[#E8E8E5]/50'}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-[#D4D4CE]'}`} />
                              {test.subgene1_name}
                            </span>
                            <span>({subgene1Count})</span>
                          </button>
                          <button
                            onClick={() => scrollToSubgene(test.id, test.test_name, 2)}
                            className={`w-full flex items-center justify-between px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isActive ? 'text-[#5A5A55] hover:bg-[#E8E8E5]/80' : 'text-[#A0A09D] hover:bg-[#E8E8E5]/50'}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-[#D4D4CE]'}`} />
                              {test.subgene2_name}
                            </span>
                            <span>({subgene2Count})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Main Form Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
                  {questionsData.map(test => (
                    <div key={test.id} className={activeTab === test.test_name ? 'block' : 'hidden'}>
                      {/* Subgene 1 */}
                      <div id={`test-${test.id}-subgene-1`} className="mb-10 scroll-mt-6">
                        <div className="flex items-center gap-3 mb-6 pb-2 border-b border-[#E8E8E5]">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <span className="text-indigo-600 font-bold text-sm">1</span>
                          </div>
                          <h3 className="text-lg font-bold text-[#1A1A19]">{test.subgene1_name} Questions</h3>
                        </div>

                        <div className="space-y-6">
                          {test.subgene1_questions.map((q, idx) => (
                            <QuestionEditor
                              key={idx}
                              q={q}
                              index={idx}
                              expandAllToggle={expandAllToggle}
                              isAllExpanded={isAllExpanded}
                              onChange={(field, val) => updateQuestion(test.id, 1, idx, field, val)}
                              onOptionChange={(optIdx, field, val) => updateOption(test.id, 1, idx, optIdx, field, val)}
                              onToggleSelect={() => handleToggleSelect(test.id, 1, idx, q.isSelected || false)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Subgene 2 */}
                      <div id={`test-${test.id}-subgene-2`} className="scroll-mt-6">
                        <div className="flex items-center gap-3 mb-6 pb-2 border-b border-[#E8E8E5]">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <span className="text-emerald-600 font-bold text-sm">2</span>
                          </div>
                          <h3 className="text-lg font-bold text-[#1A1A19]">{test.subgene2_name} Questions</h3>
                        </div>

                        <div className="space-y-6">
                          {test.subgene2_questions.map((q, idx) => (
                            <QuestionEditor
                              key={idx}
                              q={q}
                              index={idx}
                              expandAllToggle={expandAllToggle}
                              isAllExpanded={isAllExpanded}
                              onChange={(field, val) => updateQuestion(test.id, 2, idx, field, val)}
                              onOptionChange={(optIdx, field, val) => updateOption(test.id, 2, idx, optIdx, field, val)}
                              onToggleSelect={() => handleToggleSelect(test.id, 2, idx, q.isSelected || false)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#E8E8E5] bg-[#F9F9F8] flex justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl text-sm font-bold text-[#5A5A55] bg-white border border-[#E8E8E5] hover:bg-[#F4F4F2] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#6057D7] hover:bg-[#4F46E5] text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence >
  );
}

function QuestionEditor({ q, index, onChange, onOptionChange, onToggleSelect, expandAllToggle, isAllExpanded }: {
  q: Question,
  index: number,
  onChange: (field: keyof Question, value: any) => void,
  onOptionChange: (optIdx: number, field: 'text' | 'score', value: any) => void,
  onToggleSelect: () => void,
  expandAllToggle: number,
  isAllExpanded: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (expandAllToggle > 0) {
      setIsExpanded(isAllExpanded);
    }
  }, [expandAllToggle, isAllExpanded]);

  return (
    <div className={`bg-[#F9F9F8] border ${q.isSelected ? 'border-[#6057D7] shadow-sm' : 'border-[#E8E8E5] opacity-60'} rounded-2xl transition-all overflow-hidden`}>
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#F2F2F0] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={!!q.isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded border-[#D4D4CE] text-[#6057D7] focus:ring-[#6057D7]/20 cursor-pointer"
          />
          <span className={`text-sm font-bold ${q.isSelected ? 'text-[#6057D7]' : 'text-[#A0A09D]'} truncate max-w-[150px] sm:max-w-[250px] md:max-w-[350px] lg:max-w-[450px]`}>
            {q.question || `Question ${index + 1}`}
          </span>
        </div>
        <div
          className="flex items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8B8B86]">Weightage:</span>
            <input
              type="number"
              value={q.weightage}
              onChange={(e) => onChange('weightage', Number(e.target.value))}
              className="w-16 px-2 py-1 text-sm bg-white border border-[#D4D4CE] rounded-lg text-center font-bold"
            />
            <span className="text-xs font-semibold text-[#8B8B86]">%</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-[#8B8B86] hover:text-[#1A1A19] transition-colors"
          >
            <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-5 pt-0 border-t border-[#E8E8E5] space-y-4 mt-2">
              <div>
                <label className="block text-xs font-bold text-[#5A5A55] mb-1.5">Question Text</label>
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => onChange('question', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D4D4CE] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#6057D7]/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5A5A55] mb-1.5">Example / Context (Optional)</label>
                <input
                  type="text"
                  value={q.example}
                  onChange={(e) => onChange('example', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D4D4CE] rounded-xl text-sm text-[#5A5A55] focus:ring-2 focus:ring-[#6057D7]/20 outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#5A5A55] mb-2">Options</label>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex gap-2">
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => onOptionChange(optIdx, 'text', e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-[#D4D4CE] rounded-xl text-sm focus:ring-2 focus:ring-[#6057D7]/20 outline-none"
                        placeholder="Option text..."
                      />
                      <input
                        type="number"
                        value={opt.score}
                        onChange={(e) => onOptionChange(optIdx, 'score', e.target.value)}
                        className="w-20 px-3 py-2 bg-white border border-[#D4D4CE] rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-[#6057D7]/20 outline-none"
                        placeholder="Score"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
