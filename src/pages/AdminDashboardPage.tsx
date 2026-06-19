import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, List as ListIcon, Search, Filter, ChevronDown, CheckCircle2, User, FileText, Database, Activity, Loader2, Clock } from 'lucide-react';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const GENE_VARIANTS: Record<string, string[]> = {
  "Caffine Response (CYP1A2)": ["Fast Metabolizer (AA)", "Moderate Metabolizer (AC)", "Slow Metabolizer (CC)"],
  "Muscle Power vs Endurance (ACTN3)": ["Power/Sprinter (RR)", "Mixed (RX)", "Endurance (XX)"],
  "Hair Thickness & Root Structure (EDAR)": ["Typical (T/T)", "Intermediate (T/C)", "Thick (C/C)"]
};

export default function LabDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [patients, setPatients] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPatients = () => {
    fetch('/api/admin/patients')
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((u: any) => ({
          id: String(u.id),
          name: u.full_name,
          email: u.email,
          phone: u.phone,
          gene: u.gene_type,
          sample_collected: u.sample_collected,
          sample_received: u.sample_received,
          report_uploaded: u.report_uploaded,
          status: u.report_uploaded ? 'completed' : 'pending',
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
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleToggleSampleReceived = async (patientId: string, currentStatus: boolean) => {
    const targetStatus = !currentStatus;
    setActionLoading(patientId + '-received');
    try {
      const response = await fetch(`/api/users/${patientId}/sample-received`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleReceived: targetStatus }),
      });
      const data = await response.json();
      if (data.success) {
        fetchPatients();
      } else {
        alert(data.error || 'Failed to update sample received status');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadReport = async (patientId: string, file: File) => {
    setActionLoading(patientId + '-upload');
    const formData = new FormData();
    formData.append('report', file);
    try {
      const response = await fetch(`/api/users/${patientId}/upload-report`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        alert('Genomic report uploaded and phenotypic journey generated successfully!');
        fetchPatients();
      } else {
        alert(data.error || 'Failed to upload report');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedUser(expandedUser === id ? null : id);
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mx-auto"
    >
      {/* Header Section */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#6057D7] tracking-widest uppercase mb-2 shadow-sm backdrop-blur-md">
            <Activity className="w-3.5 h-3.5" />
            Lab Operations
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1A19]">Genomic Dashboard</h2>
          <p className="text-[#8B8B86] text-base font-medium max-w-xl leading-relaxed">
            Verify phenotypic profiles and seamlessly upload genomic reports for patient sequencing pipelines.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
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
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/60 backdrop-blur-xl border border-[#E8E8E5] px-5 py-2.5 rounded-2xl text-sm font-semibold text-[#2C2C2A] hover:bg-white transition-all shadow-sm active:scale-95">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <div className="flex bg-white/60 backdrop-blur-xl p-1 rounded-2xl border border-[#E8E8E5] shadow-sm">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition-all duration-200 ${viewMode === 'list' ? 'bg-white shadow-md text-[#1A1A19]' : 'text-[#A0A09D] hover:text-[#1A1A19]'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all duration-200 ${viewMode === 'grid' ? 'bg-white shadow-md text-[#1A1A19]' : 'text-[#A0A09D] hover:text-[#1A1A19]'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        {/* Decorative blur orb */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#6057D7]/5 to-[#3FC2AC]/5 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-multiply" />

        {viewMode === 'list' ? (
          <div className="flex flex-col gap-3">
            {filteredPatients.map((patient, i) => {
              const isExpanded = expandedUser === patient.id;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={patient.id}
                  className={`bg-white/70 backdrop-blur-2xl border ${isExpanded ? 'border-[#6057D7]/30 shadow-md ring-4 ring-[#6057D7]/5' : 'border-white/80 shadow-sm'} rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md hover:bg-white/90`}
                >
                  {/* Row Content */}
                  <div
                    onClick={() => toggleExpand(patient.id)}
                    className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between cursor-pointer gap-5 xl:gap-8 relative z-10"
                  >
                    {/* Patient Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-[250px]">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-lg font-bold text-[#1A1A19] shadow-inner shrink-0">
                        {patient.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1A1A19] text-lg truncate flex items-center gap-2">
                          {patient.name}
                        </div>
                        <div className="text-xs font-mono font-medium text-[#8B8B86] mt-1 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          ID: {formatUserId(patient.id)}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Specs */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 w-full xl:w-auto shrink-0 flex-wrap">
                      <div className="flex flex-col min-w-[200px]">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Gene Panel</span>
                        <div className="text-sm font-semibold text-[#2C2C2A] flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-[#6057D7] shrink-0" />
                          <span className="truncate">{patient.gene}</span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Status</span>
                        <div className="flex items-center">
                          {patient.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5E5] text-[#B87A00] text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#B87A00] animate-pulse" />
                              Awaiting Upload
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ECFDF3] text-[#027A48] text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action & Toggle */}
                    <div className="flex flex-col sm:flex-row items-center justify-between xl:justify-end gap-4 w-full xl:w-auto pt-4 xl:pt-0 border-t border-[#E8E8E5] xl:border-0 shrink-0">
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        {/* Received Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSampleReceived(patient.id, patient.sample_received);
                          }}
                          disabled={actionLoading === patient.id + '-received'}
                          className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            patient.sample_received
                              ? 'bg-[#027A48]/10 text-[#027A48] border border-[#027A48]/20'
                              : 'bg-[#FFF5E5] hover:bg-[#FFEAC2] text-[#B87A00] border border-[#FFE2A3]'
                          }`}
                        >
                          {actionLoading === patient.id + '-received' ? (
                            <Loader2 className="animate-spin w-3 h-3" />
                          ) : patient.sample_received ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Received
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> Mark Received
                            </>
                          )}
                        </button>

                        {patient.status === 'pending' ? (
                          <>
                            <select
                              className="bg-white/80 border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2.5 pr-8 outline-none focus:ring-2 focus:ring-[#6057D7]/20 w-full sm:w-[160px] cursor-pointer appearance-none shadow-sm transition-all hover:bg-white"
                              onClick={(e) => e.stopPropagation()}
                              defaultValue=""
                              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23A0A09D\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                            >
                              <option value="" disabled>Select Variant</option>
                              {(GENE_VARIANTS[patient.gene] || ["Variant 1", "Variant 2", "Variant 3"]).map((v, idx) => (
                                <option key={idx} value={v} className="truncate">{v}</option>
                              ))}
                            </select>
                            
                            <motion.label
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-gradient-to-b from-[#6057D7] to-[#5149C0] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgb(96,87,215,0.25)] hover:shadow-[0_6px_16px_rgb(96,87,215,0.35)] transition-all cursor-pointer w-full sm:w-auto text-center flex items-center justify-center gap-2 shrink-0"
                            >
                              {actionLoading === patient.id + '-upload' ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              Upload
                              <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleUploadReport(patient.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </motion.label>
                          </>
                        ) : (
                          <div className="text-sm font-semibold text-[#A0A09D] px-4">Uploaded</div>
                        )}
                      </div>

                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="p-2 bg-[#F4F4F2] rounded-full text-[#5A5A55] hidden xl:block">
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-[#E8E8E5] bg-gradient-to-b from-[#F9F9F8] to-white"
                      >
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="col-span-2">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-[#A0A09D] mb-3 flex items-center gap-2">
                                Lab Result Synopsis
                              </h4>
                              <textarea
                                className="w-full bg-white border border-[#E8E8E5] rounded-2xl p-4 text-sm text-[#2C2C2A] outline-none focus:ring-4 focus:ring-[#6057D7]/10 focus:border-[#6057D7]/30 transition-all min-h-[120px] resize-y shadow-sm"
                                placeholder="Enter sequencing details, variants identified, or clinical remarks..."
                              />
                            </div>
                            <div className="col-span-1 bg-white border border-[#E8E8E5] rounded-2xl p-4 shadow-sm h-fit">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-[#A0A09D] mb-4">Patient Details</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm border-b border-[#F0F0ED] pb-2">
                                  <span className="text-[#8B8B86]">Email</span>
                                  <span className="font-medium text-[#1A1A19]">{patient.email}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-[#F0F0ED] pb-2">
                                  <span className="text-[#8B8B86]">Phone</span>
                                  <span className="font-medium text-[#1A1A19]">{patient.phone || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end gap-3">
                            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#5A5A55] hover:bg-[#E8E8E5] transition-colors">
                              Cancel
                            </button>
                            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1A1A19] hover:bg-black transition-colors shadow-md">
                              Save Synopsis
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
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPatients.map((patient, i) => {
              const isExpanded = expandedUser === patient.id;
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  key={patient.id}
                  className={`bg-white/70 backdrop-blur-2xl border ${isExpanded ? 'border-[#6057D7]/30 shadow-lg ring-4 ring-[#6057D7]/5' : 'border-white/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]'} rounded-3xl p-6 transition-all duration-300 hover:bg-white flex flex-col`}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-lg font-bold text-[#1A1A19] shadow-inner shrink-0">
                      {patient.name.charAt(0)}
                    </div>
                    {patient.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF5E5] text-[#B87A00] text-[10px] font-bold uppercase tracking-wider">
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ECFDF3] text-[#027A48] text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        Done
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <h3 className="font-bold text-[#1A1A19] text-xl leading-tight mb-1">{patient.name}</h3>
                    <div className="text-xs font-mono font-medium text-[#8B8B86] flex items-center gap-1.5">
                      <User className="w-3 h-3" /> {formatUserId(patient.id)}
                    </div>
                  </div>

                  <div className="bg-[#F9F9F8] rounded-2xl p-4 mb-4 space-y-3 border border-[#E8E8E5]/50 flex-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#8B8B86] font-medium">Gene Panel</span>
                      <span className="font-bold text-[#2C2C2A]">{patient.gene}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm gap-4">
                      <span className="text-[#8B8B86] font-medium shrink-0">Email</span>
                      <span className="font-medium text-[#2C2C2A] truncate text-right">{patient.email}</span>
                    </div>
                    {/* Sample Statuses */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#8B8B86] font-medium">Swab Status</span>
                      <span className={`font-semibold ${patient.sample_collected ? 'text-[#027A48]' : 'text-[#B87A00]'}`}>
                        {patient.sample_collected ? 'Collected' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    {/* Received button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSampleReceived(patient.id, patient.sample_received);
                      }}
                      disabled={actionLoading === patient.id + '-received'}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        patient.sample_received
                          ? 'bg-[#027A48]/10 text-[#027A48] border border-[#027A48]/20'
                          : 'bg-[#FFF5E5] hover:bg-[#FFEAC2] text-[#B87A00] border border-[#FFE2A3]'
                      }`}
                    >
                      {actionLoading === patient.id + '-received' ? (
                        <Loader2 className="animate-spin w-3 h-3" />
                      ) : patient.sample_received ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Received
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-pulse" /> Mark Received
                        </>
                      )}
                    </button>

                    {patient.status === 'pending' ? (
                      <>
                        <select
                          className="w-full bg-white/80 border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-4 py-3 pr-8 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer appearance-none shadow-sm transition-all hover:bg-white"
                          defaultValue=""
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23A0A09D\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                        >
                          <option value="" disabled>Select Variant</option>
                          {(GENE_VARIANTS[patient.gene] || ["Variant 1", "Variant 2", "Variant 3"]).map((v, idx) => (
                            <option key={idx} value={v}>{v}</option>
                          ))}
                        </select>
                        
                        <motion.label
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full bg-[#1A1A19] text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {actionLoading === patient.id + '-upload' ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          Upload Report
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".pdf" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleUploadReport(patient.id, e.target.files[0]);
                              }
                            }}
                          />
                        </motion.label>
                      </>
                    ) : (
                      <div className="w-full text-center py-3 text-sm font-semibold text-[#8B8B86] bg-[#F4F4F2] rounded-2xl border border-transparent">
                        Uploaded
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

