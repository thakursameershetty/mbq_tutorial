import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  geneVariants: any;
  testName: string;
  mbqId?: string;
}

export default function ReportViewerModal({ isOpen, onClose, reportData, geneVariants, testName, mbqId }: ReportViewerModalProps) {
  const [reportHtml, setReportHtml] = useState<string | null>(null);


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
    try {
      let templateName = 'caffeine';
      if (testName.toLowerCase().includes('muscle')) templateName = 'muscle';
      else if (testName.toLowerCase().includes('hair')) templateName = 'hair';

      const htmlUrl = `/templates/${templateName}-sample.html`;
      const resHtml = await fetch(htmlUrl);
      const html = await resHtml.text();

      // EXTRACTED SCRIPT LOGIC WILL GO HERE
      const scriptString = `
                    <script>
                      window.REPORT_DATA = ${JSON.stringify(reportData)};
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
                                const toSentenceCase = (str) => {
                                    if (!str) return str;
                                    return str.toLowerCase().replace(/(^\\s*\\w|[.!?]\\s*\\w)/g, c => c.toUpperCase());
                                };
                                const toTitleCase = (str) => {
                                    if (!str) return str;
                                    return str.toLowerCase().replace(/(^\\s*\\w|\\s+\\w)/g, c => c.toUpperCase());
                                };
                                setText('page1-share-title', toTitleCase(data.page_1.share_card.title));
                                setText('page1-share-highlight', toSentenceCase(data.page_1.share_card.highlight));
                                setText('page1-share-quote', toSentenceCase(data.page_1.share_card.quote));
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
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                    <script>
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

      const fontCss = `
        <style>
          body {
            font-family: 'Google Sans', system-ui, sans-serif !important;
          }
        </style>
      `;

      let finalHtml = html
        .replace('<head>', `<head><base href="${window.location.origin}/">\n${fontCss}`)
        .replace('src="./support.js"', 'src="/templates/support.js"')
        .replace(/dd mm yyyy/g, formattedDate)
        .replace('</body>', scriptString + '\n' + carouselScript + '\n</body>');

      if (mbqId) {
        // Catches "CQ ID: CQ-2024...", "MBQ ID: MBQ-2024...", etc. in all templates (Caffeine, Muscle, Hair, etc.)
        finalHtml = finalHtml.replace(/(?:CQ|MBQ|HQ)?\s*ID:\s*(?:CQ|MBQ|HQ)?-?\d{4}-\d{4}-\d{6}/g, `ID: ${mbqId}`);
      }

      setReportHtml(finalHtml);

    } catch (err) {
      console.error(err);
      alert("Could not load the HTML template for this test.");
    }
  };

  if (!isOpen) return null;

  return (
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
                      (iframe.contentWindow as any).downloadPDF(`${testName.toLowerCase().replace(/\s+/g, '-')}-report.pdf`);
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
                  onClick={onClose}
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
                                  test_name: testName,
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
  );
}
