import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export default function ReportPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'downloadComplete' || event.data === 'downloadError') {
        setIsDownloading(false);
        if (event.data === 'downloadError') {
          alert("There was an error generating the PDF.");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDownload = () => {
    if (isDownloading) return;
    if (iframeRef.current && iframeRef.current.contentWindow) {
      setIsDownloading(true);
      iframeRef.current.contentWindow.postMessage('downloadPDF', '*');

      // Fallback timeout just in case the iframe fails to respond
      setTimeout(() => setIsDownloading(false), 10000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-[1440px] mx-auto mt-8 sm:mt-12 px-4 pb-12 relative"
    >
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-50 p-3 bg-white/80 hover:bg-white backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.08)] rounded-full text-[#1c2440] transition-all"
        aria-label="Go back"
      >
        <ArrowLeft size={24} />
      </button>

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`fixed top-6 right-6 z-50 p-3 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.08)] rounded-full text-[#1c2440] transition-all flex items-center gap-2 pr-4 font-medium ${isDownloading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}`}
        aria-label="Download Report"
      >
        {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
        <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
      </button>

      <div className="w-full rounded-[24px] overflow-hidden shadow-[0_8px_32px_rgb(0,0,0,0.08)] border border-[#E8E8E5] bg-[#e7e9ef]">
        <iframe
          ref={iframeRef}
          src="/report_data/MyBodyQode Report.dc.html"
          className="w-full min-h-[100vh] border-none"
          title="MyBodyQode Detailed Report"
        />
      </div>
    </motion.div>
  );
}
