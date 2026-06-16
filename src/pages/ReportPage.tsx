import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export default function ReportPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [iframeHeight, setIframeHeight] = useState('100vh');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'downloadComplete' || event.data === 'downloadError') {
        setIsDownloading(false);
        if (event.data === 'downloadError') {
          alert("There was an error generating the PDF.");
        }
      }
      // The report HTML posts its scaled height so we can size the iframe correctly
      if (typeof event.data === 'object' && event.data?.type === 'iframeHeight') {
        setIframeHeight(`${event.data.height}px`);
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
      className="w-full max-w-[1440px] mx-auto mt-6 sm:mt-12 px-2 sm:px-4 pb-12 relative"
    >
      <button
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 p-2.5 sm:p-3 bg-white/80 hover:bg-white backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.08)] rounded-full text-[#1c2440] transition-all"
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 p-2.5 sm:p-3 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.08)] rounded-full text-[#1c2440] transition-all flex items-center gap-1.5 sm:gap-2 pr-3 sm:pr-4 text-sm sm:text-base font-medium ${isDownloading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}`}
        aria-label="Download Report"
      >
        {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'Download PDF'}</span>
        <span className="sm:hidden">{isDownloading ? '...' : 'PDF'}</span>
      </button>

      <div className="w-full rounded-[16px] sm:rounded-[24px] overflow-hidden shadow-[0_8px_32px_rgb(0,0,0,0.08)] border border-[#E8E8E5] bg-[#e7e9ef]">
        <iframe
          ref={iframeRef}
          src="/report_data/MyBodyQode Report.dc.html"
          style={{ height: iframeHeight }}
          className="w-full border-none block"
          title="MyBodyQode Detailed Report"
        />
      </div>
    </motion.div>
  );
}
