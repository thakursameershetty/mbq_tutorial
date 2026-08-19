import re

with open('src/pages/TestReportPage.tsx', 'r') as f:
    content = f.read()

# We want to create ReportViewerModal.tsx
modal_code = """import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  geneVariants: any;
  testName: string;
}

export default function ReportViewerModal({ isOpen, onClose, reportData, geneVariants, testName }: ReportViewerModalProps) {
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Feedback states
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageFeedbacks, setPageFeedbacks] = useState<Record<number, string>>({});
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [currentFeedbackInput, setCurrentFeedbackInput] = useState('');
  const [pendingNextIndex, setPendingNextIndex] = useState<number | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (isOpen && reportData) {
      generateHtml();
    } else {
      setReportHtml(null);
    }
  }, [isOpen, reportData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAGES_COUNT') {
        setTotalPages(event.data.count);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const generateHtml = async () => {
    setLoading(true);
    try {
      let testId = 1;
      if (testName.toLowerCase().includes('muscle')) testId = 2;
      else if (testName.toLowerCase().includes('hair')) testId = 3;
      
      const htmlUrl = `/templates/${testId}-sample.html`;
      const resHtml = await fetch(htmlUrl);
      const html = await resHtml.text();

      const reportResult = reportData;
      // EXTRACTED SCRIPT LOGIC WILL GO HERE
"""

# Extract the scriptString logic from TestReportPage
script_match = re.search(r'(const scriptString = `.*?</style>\s*`;)', content, re.DOTALL)
if script_match:
    modal_code += script_match.group(1).replace('window.REPORT_DATA = ${JSON.stringify(reportResult)}', 'window.REPORT_DATA = ${JSON.stringify(reportData)}') + '\n\n'

carousel_match = re.search(r'(const carouselScript = `.*?</script>\s*`;)', content, re.DOTALL)
if carousel_match:
    modal_code += carousel_match.group(1) + '\n\n'

html_replace_match = re.search(r'(const finalHtml = html[\s\S]*?setReportHtml\(finalHtml\);)', content)
if html_replace_match:
    modal_code += html_replace_match.group(1) + '\n'
    
modal_code += """
    } catch (err) {
      console.error(err);
      alert("Could not load the HTML template for this test.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
"""

modal_render_match = re.search(r'(<AnimatePresence>\s*\{reportHtml && \(\s*<motion\.div[\s\S]*?</AnimatePresence>)', content)
if modal_render_match:
    modal_code += "    " + modal_render_match.group(1).replace('selectedTestName', 'testName').replace("onClick={() => setReportHtml(null)}", "onClick={onClose}") + '\n'

modal_code += """  );
}
"""

with open('src/components/ReportViewerModal.tsx', 'w') as f:
    f.write(modal_code)

print("Generated ReportViewerModal.tsx")
