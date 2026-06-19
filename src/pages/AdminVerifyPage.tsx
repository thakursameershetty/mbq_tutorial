import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, CheckCircle2, Clock, User, Loader2, ShieldAlert, Sparkles, FileText } from 'lucide-react';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

export default function AdminVerifyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all');
  const [selectedSampleFilter, setSelectedSampleFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleViewGeneratedReport = (patient: any) => {
    localStorage.setItem('userProfile', JSON.stringify(patient));
    window.open('/report', '_blank');
  };

  const handleToggleVerifyReport = async (patientId: number, currentStatus: boolean) => {
    const targetStatus = !currentStatus;
    setActionLoading(patientId);
    try {
      const response = await fetch(`/api/users/${patientId}/verify-report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportVerified: targetStatus }),
      });
      const data = await response.json();
      if (data.success) {
        setPatients((prev) =>
          prev.map((p) => (p.id === patientId ? { ...p, report_verified: targetStatus, status_timestamps: data.user.status_timestamps } : p))
        );
      } else {
        alert(data.error || 'Failed to verify report');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchPatients = () => {
    setLoading(true);
    fetch('/api/admin/patients')
      .then((res) => res.json())
      .then((data) => {
        setPatients(data);
      })
      .catch((err) => console.error('Error fetching patients:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  const filteredPatients = patients.filter((p) => {
    const nameMatch = p.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = p.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const usernameMatch = p.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = p.phone?.includes(searchQuery);
    
    const matchesSearch = nameMatch || emailMatch || usernameMatch || phoneMatch;
    
    const matchesGender = selectedGenderFilter === 'all' || p.gender === selectedGenderFilter;
    
    const isCollected = p.sample_collected === true;
    const matchesSample =
      selectedSampleFilter === 'all' ||
      (selectedSampleFilter === 'collected' && isCollected) ||
      (selectedSampleFilter === 'pending' && !isCollected);
      
    return matchesSearch && matchesGender && matchesSample;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mx-auto"
    >
      {/* Header Section */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#6057D7] tracking-widest uppercase mb-2 shadow-sm backdrop-blur-md"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Admin Portal
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1A19]">Profile Verification</h2>
          <p className="text-[#8B8B86] text-base font-medium max-w-xl leading-relaxed">
            Verify comprehensive user registrations, survey records, sample collection statuses, and AI-generated phenotypic data.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D]" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-sm rounded-2xl pl-10 pr-4 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 transition-all shadow-sm placeholder:text-[#A0A09D] font-medium"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Gender Filter */}
            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="flex-1 sm:flex-none bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer shadow-sm hover:bg-white"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            {/* Sample Status Filter */}
            <select
              value={selectedSampleFilter}
              onChange={(e) => setSelectedSampleFilter(e.target.value)}
              className="flex-1 sm:flex-none bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer shadow-sm hover:bg-white"
            >
              <option value="all">All Samples</option>
              <option value="collected">Collected</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#6057D7]/5 to-[#3FC2AC]/5 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-multiply" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#6057D7] mb-4" size={40} />
            <p className="text-[#8B8B86] text-sm font-medium">Loading verify records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-20 bg-white/40 backdrop-blur-md border border-[#E8E8E5] rounded-3xl p-8">
            <User className="w-12 h-12 text-[#A0A09D] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#1A1A19]">No profiles found</h3>
            <p className="text-sm text-[#8B8B86] mt-1">Try modifying your filters or search terms.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredPatients.map((patient, i) => {
              const isExpanded = expandedPatientId === patient.id;
              const isCollected = patient.sample_collected === true;
              const genesList = patient.gene_type ? patient.gene_type.split(', ') : [];
              const analysis = patient.phenotypic_analysis;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  key={patient.id}
                  className={`bg-white/70 backdrop-blur-2xl border ${
                    isExpanded ? 'border-[#6057D7]/30 shadow-md ring-4 ring-[#6057D7]/5' : 'border-white/80 shadow-sm'
                  } rounded-[24px] overflow-hidden transition-all duration-300 hover:shadow-md hover:bg-white/90`}
                >
                  {/* Summary Header bar */}
                  <div
                    onClick={() => toggleExpand(patient.id)}
                    className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between cursor-pointer gap-4 relative z-10"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-base font-bold text-[#1A1A19] shadow-inner shrink-0">
                        {patient.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1A1A19] text-base truncate flex items-center gap-2">
                          {patient.full_name}
                        </div>
                        <div className="text-xs font-mono font-medium text-[#8B8B86] mt-0.5 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          ID: {formatUserId(patient.id)} ({patient.username})
                        </div>
                      </div>
                    </div>

                    {/* Meta Info Indicators */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:justify-end">
                      {/* Genotypes badges */}
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Gene Panel</span>
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {genesList.map((g: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-[#6057D7]/6 text-[#6057D7] rounded-md text-[9px] font-bold border border-[#6057D7]/10"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Contact metadata */}
                      <div className="flex flex-col text-xs text-[#5A5A55]">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Contact</span>
                        <span className="font-semibold">{patient.email}</span>
                      </div>

                      {/* Sample Collected status badge */}
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Sample Status</span>
                        <div>
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF3] text-[#027A48] text-[9px] font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" /> Collected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF5E5] text-[#B87A00] text-[9px] font-bold uppercase tracking-wider">
                              <Clock className="w-3 h-3 animate-pulse" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron indicator */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="p-1.5 bg-[#F4F4F2] rounded-full text-[#5A5A55]"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Expandable Details Pane */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-[#E8E8E5] bg-gradient-to-b from-[#F9F9F8] to-white"
                      >
                        <div className="p-6 space-y-6">
                          {/* Top Row: User Summary Metadata */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-[#E8E8E5] shadow-inner">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8B8B86] block">Full Legal Name</span>
                              <span className="font-semibold text-sm text-[#1A1A19]">{patient.full_name}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8B8B86] block">Email</span>
                              <span className="font-semibold text-sm text-[#1A1A19]">{patient.email}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8B8B86] block">Phone</span>
                              <span className="font-semibold text-sm text-[#1A1A19]">{patient.phone || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8B8B86] block">Age & Gender</span>
                              <span className="font-semibold text-sm text-[#1A1A19]">
                                {patient.age ? `${patient.age} yrs` : 'N/A'} • {patient.gender || 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Phenotypic Data Header */}
                          <div className="flex items-center gap-2 border-b border-[#F0F0ED] pb-2">
                            <Sparkles className="w-4 h-4 text-[#6057D7]" />
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1A1A19]">
                              AI Phenotypic Profile Insights
                            </h4>
                          </div>

                          {analysis ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Personal Profile Section */}
                              {analysis.personal_profile && (
                                <div className="bg-white p-5 rounded-2xl border border-[#E8E8E5] shadow-sm">
                                  <h5 className="text-xs font-bold text-[#6057D7] uppercase tracking-wider mb-3">
                                    Personal Profile
                                  </h5>
                                  <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Daily Activity:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.personal_profile.dailyActivity || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Sleep Timing:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.personal_profile.sleepTiming || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Caffeine Response Section */}
                              {analysis.caffeine_response && (
                                <div className="bg-white p-5 rounded-2xl border border-[#E8E8E5] shadow-sm">
                                  <h5 className="text-xs font-bold text-[#6057D7] uppercase tracking-wider mb-3">
                                    Caffeine & Stimulant Response
                                  </h5>
                                  <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Sleep Impact:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.caffeine_response.sleepImpact || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Duration of Effect:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.caffeine_response.durationOfEffect || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Sensitivity:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.caffeine_response.sensitivity || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Tolerance:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.caffeine_response.tolerance || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Hair & Scalp Section */}
                              {analysis.hair_scalp_characteristics && (
                                <div className="bg-white p-5 rounded-2xl border border-[#E8E8E5] shadow-sm">
                                  <h5 className="text-xs font-bold text-[#6057D7] uppercase tracking-wider mb-3">
                                    Hair & Scalp Characteristics
                                  </h5>
                                  <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Thickness:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.hair_scalp_characteristics.thickness || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Texture:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.hair_scalp_characteristics.texture || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Scalp Type:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.hair_scalp_characteristics.scalpType || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Sweating:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.hair_scalp_characteristics.sweating || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Stability:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.hair_scalp_characteristics.stability || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Physical Performance Section */}
                              {analysis.physical_performance && (
                                <div className="bg-white p-5 rounded-2xl border border-[#E8E8E5] shadow-sm">
                                  <h5 className="text-xs font-bold text-[#6057D7] uppercase tracking-wider mb-3">
                                    Physical Performance & Recovery
                                  </h5>
                                  <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Power:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.physical_performance.power || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Endurance:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.physical_performance.endurance || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Recovery:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.physical_performance.recovery || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Training Preference:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {analysis.physical_performance.trainingPreference || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-4 text-center text-xs text-[#8B8B86] bg-white border border-[#E8E8E5] rounded-2xl">
                              No phenotypic analysis data generated for this user.
                            </div>
                          )}

                          {/* Actions Panel */}
                          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#F0F0ED]">
                            {patient.report_uploaded && patient.report_url ? (
                              <a
                                href={patient.report_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-white/85 hover:bg-white border border-[#E8E8E5] text-[#1A1A19] rounded-xl text-xs font-bold transition-all shadow-sm no-underline"
                              >
                                <FileText size={14} className="text-[#6057D7]" />
                                View Uploaded Report
                              </a>
                            ) : (
                              <button
                                disabled
                                className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F5] border border-[#E8E8E5] text-[#8B8B86] rounded-xl text-xs font-bold cursor-not-allowed"
                              >
                                <FileText size={14} />
                                No Uploaded Report
                              </button>
                            )}

                            {patient.report_generated ? (
                              <button
                                onClick={() => handleViewGeneratedReport(patient)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#6057D7]/10 hover:bg-[#6057D7]/15 border border-[#6057D7]/20 text-[#6057D7] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                <Sparkles size={14} />
                                View Generated Report
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex items-center gap-2 px-4 py-2 bg-[#F7F7F5] border border-[#E8E8E5] text-[#8B8B86] rounded-xl text-xs font-bold cursor-not-allowed"
                              >
                                <Sparkles size={14} />
                                No Generated Report
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleVerifyReport(patient.id, patient.report_verified)}
                              disabled={actionLoading === patient.id}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                                patient.report_verified
                                  ? 'bg-[#027A48] hover:bg-[#026c3f] text-white font-bold'
                                  : 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white'
                              }`}
                            >
                              {actionLoading === patient.id ? (
                                <Loader2 className="animate-spin w-3.5 h-3.5" />
                              ) : patient.report_verified ? (
                                '✓ Report Verified'
                              ) : (
                                'Verify Report'
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
