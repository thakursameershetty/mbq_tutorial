import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, List as ListIcon } from 'lucide-react';

export default function LabDashboard() {
  // State for search and expanding user profiles
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // State for fetched patients
  const [patients, setPatients] = useState<any[]>([]);

  // Fetch real data from the backend on load
  useEffect(() => {
    fetch('/api/admin/patients')
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((u: any) => ({
          id: String(u.id),
          name: u.full_name,
          email: u.email,
          phone: u.phone,
          gene: u.gene_type,
          status: 'pending', // Assuming all are pending for now
          surveyData: { 
            diet: u.phenotypic_analysis?.lifestyle_data?.dietType || 'N/A', 
            sleep: u.phenotypic_analysis?.lifestyle_data?.sleepHours || 'N/A', 
            activity: u.phenotypic_analysis?.physical_data?.sweat || 'N/A', 
            traits: u.phenotypic_analysis?.caffeine_data?.anxietyResponse || 'N/A' 
          }
        }));
        setPatients(formatted);
      })
      .catch(err => console.error("Error fetching patients:", err));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedUser(expandedUser === id ? null : id);
  };

  const theme = {
    background: "min-h-screen bg-[#F7F7F5] bg-[radial-gradient(#E5E5E5_1px,transparent_1px)] [background-size:20px_20px] text-[#2C2C2A] font-sans p-4 sm:p-6 flex justify-center w-full",
    container: "w-full max-w-5xl mt-8 sm:mt-12",
    headerCard: "bg-white/80 backdrop-blur-xl rounded-t-[24px] p-6 sm:p-8 border border-white/60 border-b-0 flex flex-col md:flex-row justify-between items-start md:items-end relative overflow-hidden gap-6",
    searchBox: "bg-white/50 border border-[#E8E8E5] text-sm rounded-xl px-10 py-2.5 outline-none focus:ring-2 focus:ring-[#6057D7]/10 transition-all w-full md:w-64",
    listItem: "bg-white/70 backdrop-blur-xl border border-white/60 p-4 sm:p-6 transition-all duration-300 hover:bg-white/90",
    gridItem: "bg-white/70 backdrop-blur-xl border border-white/60 p-5 rounded-[20px] transition-all duration-300 hover:bg-white/90 shadow-[0_4px_20px_rgb(0,0,0,0.02)] h-fit",
    pillPending: "px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#E8E8E3] text-[#5A5A55] whitespace-nowrap",
    pillUploaded: "px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#D6EADF] text-[#2D5A43] whitespace-nowrap",
    expandedPanel: "bg-[#F4F4F2]/50 border-t border-[#E8E8E5]/50 overflow-hidden",
    actionBtn: "bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white text-sm font-medium rounded-xl px-5 py-2.5 shadow-[0_4px_15px_rgb(96,87,215,0.25)] cursor-pointer inline-block text-center w-full sm:w-auto"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={theme.background}
    >
      <div className={theme.container}>

        {/* --- Header & Controls --- */}
        <div className={theme.headerCard}>
          {/* Subtle gradient orb for aesthetic depth */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-gradient-to-br from-[#D4D4CE]/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-full md:w-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1A19]" style={{ textAlign: 'left', marginBottom: '0.25rem' }}>Lab Dashboard</h2>
            <p className="text-sm text-[#8B8B86] mt-1">Verify phenotypic profiles and upload genomic reports.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 relative w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-auto">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search users..."
                className={theme.searchBox}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white/50 border border-[#E8E8E5] px-4 py-2.5 rounded-xl text-sm font-medium text-[#2C2C2A] hover:bg-white transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filter
              </motion.button>

              {/* View Toggle */}
              <div className="flex bg-white/50 p-1 rounded-xl border border-[#E8E8E5] shrink-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1A1A19]' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
                >
                  <ListIcon size={18} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#1A1A19]' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Patient List / Grid --- */}
        {viewMode === 'list' ? (
          <div className="rounded-b-[24px] overflow-hidden shadow-[0_8px_32px_rgb(0,0,0,0.04)] border-t border-[#F0F0ED] bg-white/40">
            {patients.map((patient, index) => {
              const isExpanded = expandedUser === patient.id;

              return (
                <div key={patient.id} className={`${theme.listItem} ${index !== patients.length - 1 ? 'border-b border-[#F0F0ED]' : ''}`}>

                  {/* Main Row */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between cursor-pointer gap-4 lg:gap-0" onClick={() => toggleExpand(patient.id)}>

                    <div className="flex justify-between items-start w-full lg:w-auto">
                      {/* Avatar & Name */}
                      <div className="flex items-center gap-4 lg:w-48">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-[#E8E8E5] to-white border border-[#D4D4CE] flex items-center justify-center text-sm font-bold text-[#5A5A55]">
                          {patient.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1A1A19] text-left truncate">{patient.name}</div>
                          <div className="text-xs font-mono text-[#8B8B86] mt-0.5 text-left">{patient.id}</div>
                        </div>
                      </div>

                      {/* Mobile Chevron */}
                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-5 h-5 text-[#A0A09D] lg:hidden mt-2 shrink-0"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </div>

                    {/* Gene & Contact */}
                    <div className="lg:w-48">
                      <div className="text-sm font-medium text-[#2C2C2A] text-left">Gene: <span className="text-[#1A1A19] font-bold">{patient.gene}</span></div>
                      <div className="text-xs text-[#8B8B86] mt-0.5 text-left truncate">{patient.email}</div>
                    </div>

                    {/* Status */}
                    <div className="lg:w-32 text-left">
                      <span className={patient.status === 'pending' ? theme.pillPending : theme.pillUploaded}>
                        {patient.status === 'pending' ? 'Pending Upload' : 'Uploaded'}
                      </span>
                    </div>

                    {/* Actions & Desktop Chevron */}
                    <div className="lg:w-64 flex justify-between lg:justify-end items-center gap-4 mt-2 lg:mt-0 pt-4 lg:pt-0 border-t border-[#E8E8E5] lg:border-0">
                      {patient.status === 'pending' ? (
                        <motion.label
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={theme.actionBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Upload Report
                          <input type="file" className="hidden" accept=".pdf" />
                        </motion.label>
                      ) : (
                        <span className="text-sm font-medium text-[#8B8B86] px-4 py-2 w-full lg:w-auto text-center lg:text-left">Completed</span>
                      )}

                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-5 h-5 text-[#A0A09D] hidden lg:block shrink-0"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </div>
                  </div>

                  {/* Expanded Phenotype Profile Panel using Framer Motion */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className={theme.expandedPanel}
                      >
                        <div className="p-4 sm:p-5 rounded-xl bg-[#F4F4F2]/30">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] mb-3 text-left">Lab Result / Description</h4>
                          <textarea 
                            className="w-full bg-white/60 border border-[#E8E8E5] rounded-lg p-3 text-sm text-[#2C2C2A] outline-none focus:border-[#6057D7]/30 focus:ring-2 focus:ring-[#6057D7]/10 transition-all min-h-[100px] resize-y"
                            placeholder="Enter the lab result description or report summary here..."
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 bg-white/40 rounded-b-[24px] shadow-[0_8px_32px_rgb(0,0,0,0.04)] border-t border-[#F0F0ED]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {patients.map((patient) => {
                const isExpanded = expandedUser === patient.id;

                return (
                  <div key={patient.id} className={theme.gridItem}>

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E8E8E5] to-white border border-[#D4D4CE] flex items-center justify-center text-base font-bold text-[#5A5A55]">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#1A1A19] text-left text-lg leading-tight">{patient.name}</h3>
                          <p className="text-xs font-mono text-[#8B8B86] text-left">{patient.id}</p>
                        </div>
                      </div>
                      <span className={patient.status === 'pending' ? theme.pillPending : theme.pillUploaded}>
                        {patient.status === 'pending' ? 'Pending' : 'Uploaded'}
                      </span>
                    </div>

                    <div className="space-y-2 mb-6 text-sm text-[#3A3A3A] bg-white/40 p-4 rounded-xl border border-[#E8E8E5]/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8B8B86] text-xs uppercase font-semibold">Gene Panel</span>
                        <span className="font-bold text-[#1A1A19]">{patient.gene}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8B8B86] text-xs uppercase font-semibold">Contact</span>
                        <span className="text-right truncate max-w-[150px]">{patient.email}</span>
                      </div>
                    </div>

                    {/* Grid Expand Button */}
                    <button
                      onClick={() => toggleExpand(patient.id)}
                      className="w-full flex items-center justify-between p-3 mb-4 rounded-xl bg-white/50 hover:bg-white text-sm font-medium text-[#2C2C2A] border border-[#E8E8E5] transition-colors"
                    >
                      Enter Lab Result
                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-4 h-4 text-[#A0A09D]"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                          animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-xl bg-[#F4F4F2]/50 border border-[#E8E8E5]/50">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] mb-2 text-left">Lab Result</h4>
                            <textarea 
                              className="w-full bg-white/60 border border-[#E8E8E5] rounded-lg p-3 text-sm text-[#2C2C2A] outline-none focus:border-[#6057D7]/30 focus:ring-2 focus:ring-[#6057D7]/10 transition-all min-h-[80px] resize-y"
                              placeholder="Enter result summary..."
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="pt-4 border-t border-[#E8E8E5]">
                      {patient.status === 'pending' ? (
                        <motion.label
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`${theme.actionBtn} w-full flex justify-center`}
                        >
                          Upload Report
                          <input type="file" className="hidden" accept=".pdf" />
                        </motion.label>
                      ) : (
                        <div className="w-full text-center py-2.5 text-sm font-medium text-[#8B8B86] bg-white/50 rounded-xl border border-transparent">
                          Report Completed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
