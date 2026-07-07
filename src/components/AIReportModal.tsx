import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geneName: string;
  markdownContent: any; // Accept object or string
}

export default function AIReportModal({ isOpen, onClose, geneName, markdownContent }: AIReportModalProps) {
  // Extract markdown string safely
  let contentString = '';
  if (typeof markdownContent === 'string') {
    contentString = markdownContent;
  } else if (markdownContent && typeof markdownContent === 'object') {
    // Try to find the markdown string inside the object payload
    if (markdownContent.result?.coaching_plan?._raw_response) {
      contentString = markdownContent.result.coaching_plan._raw_response;
    } else {
      // Fallback: pretty print the JSON
      contentString = '```json\n' + JSON.stringify(markdownContent, null, 2) + '\n```';
    }
  }

  // If the string starts with "```markdown", clean it up
  const cleanMarkdown = contentString
    .replace(/^```markdown\n/, '')
    .replace(/^```\n/, '')
    .replace(/\n```$/, '');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A1A19]/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E8E8E5]"
          >
            {/* Header */}
            <div className="flex-none p-6 sm:p-8 border-b border-[#E8E8E5] bg-gradient-to-r from-[#F9F9F8] to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#1A1A19]">AI Insights: {geneName}</h2>
                    <p className="text-sm text-[#8B8B86] mt-1">Personalized analysis based on your unique biology</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#F9F9F8] rounded-full transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-[#F9F9F8]">
              <div className="prose prose-lg prose-slate max-w-none 
                prose-headings:font-bold prose-headings:text-[#1A1A19] prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                prose-p:text-[#1A1A19] prose-p:leading-relaxed
                prose-li:text-[#1A1A19] prose-ul:my-6 prose-li:my-2
                prose-strong:text-[#1A1A19] prose-strong:font-bold
                prose-a:text-[#6057D7] hover:prose-a:text-[#4A43A8]
                prose-blockquote:border-l-amber-500 prose-blockquote:bg-amber-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:text-amber-900 prose-blockquote:not-italic
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              >
                <ReactMarkdown>{cleanMarkdown}</ReactMarkdown>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-none p-6 border-t border-[#E8E8E5] bg-white flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full font-semibold text-[#1A1A19] bg-[#F9F9F8] hover:bg-[#E8E8E5] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full font-semibold text-white bg-[#1A1A19] hover:bg-black transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                Go to Dashboard <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
