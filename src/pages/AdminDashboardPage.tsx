import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, CheckCircle2, User, FileText, Activity, Loader2, Clock, X, Trash2, AlertTriangle } from 'lucide-react';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const getRequiredGenes = (patientGeneString: string) => {
  if (!patientGeneString) return [];
  const panels = patientGeneString.split(',').map(s => s.trim().toLowerCase());
  const requiredGenes: { panel: string, name: string, variants: string[] }[] = [];

  panels.forEach(panel => {
    if (panel.includes('caffine') || panel.includes('caffeine')) {
      requiredGenes.push({ panel: "Caffeine Sensitivity", name: "CYP1A2", variants: ["AA", "AC", "CC"] });
      requiredGenes.push({ panel: "Caffeine Sensitivity", name: "ADORA2A", variants: ["TT", "TC", "CC"] });
    } else if (panel.includes('muscle') || panel.includes('actn3')) {
      requiredGenes.push({ panel: "Muscle Performance", name: "ACTN3", variants: ["RR", "RX", "XX"] });
      requiredGenes.push({ panel: "Muscle Performance", name: "ACE", variants: ["II", "ID", "DD"] });
    } else if (panel.includes('hair') || panel.includes('edar')) {
      requiredGenes.push({ panel: "Hair", name: "EDAR", variants: ["GG", "AG", "AA"] });
      requiredGenes.push({ panel: "Hair", name: "FGFR2", variants: ["TT", "GT", "GG"] });
    }
  });
  return requiredGenes;
};

const getGeneColor = (geneName: string) => {
  const name = geneName.toLowerCase();
  if (name.includes('actn3')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (name.includes('edar')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (name.includes('cyp1a2') || name.includes('caffeine') || name.includes('caffine')) return 'bg-amber-50 text-amber-700 border-amber-200';

  return 'bg-[#F4F4F2] text-[#5A5A55] border-[#D4D4CE]';
};

export default function LabDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode] = useState<'list' | 'grid'>('grid');
  const [patients, setPatients] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [selectedGeneFilter, setSelectedGeneFilter] = useState<string>('all');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all');

  const fetchPatients = () => {
    fetch('/api/admin/patients')
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((u: any) => ({
          id: String(u.id),
          name: u.full_name?.toUpperCase(),
          email: u.email,
          phone: u.phone,
          gene: u.gene_type,
          gender: u.gender,
          sample_collected: u.sample_collected,
          sample_received: u.sample_received,
          report_uploaded: u.report_uploaded,
          report_url: u.report_url,
          status_timestamps: u.status_timestamps,
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
    const interval = setInterval(fetchPatients, 5000);
    return () => clearInterval(interval);
  }, []);

  const [sampleAction, setSampleAction] = useState<any>(null);
  const [uploadAction, setUploadAction] = useState<{ patientId: string, file: File, patientName: string } | null>(null);
  const [deleteAction, setDeleteAction] = useState<{ patientId: string, patientName: string } | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, Record<string, string>>>({});

  const handleVariantChange = (patientId: string, geneName: string, variant: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [patientId]: {
        ...(prev[patientId] || {}),
        [geneName]: variant
      }
    }));
  };

  const confirmToggleSampleReceived = async () => {
    if (!sampleAction) return;
    const { id: patientId, sample_received: currentStatus } = sampleAction;
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
      setSampleAction(null);
    }
  };

  const confirmUploadReport = async () => {
    if (!uploadAction) return;
    const { patientId, file } = uploadAction;
    setActionLoading(patientId + '-upload');
    const formData = new FormData();
    formData.append('report', file);
    const genotypes = selectedVariants[patientId] || {};
    formData.append('genotypes', JSON.stringify(genotypes));

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
      setUploadAction(null);
    }
  };

  const confirmDeleteReport = async () => {
    if (!deleteAction) return;
    const { patientId } = deleteAction;
    setActionLoading(patientId + '-delete');
    try {
      const response = await fetch(`/api/users/${patientId}/delete-report`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        fetchPatients();
      } else {
        alert(data.error || 'Failed to delete report');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
      setDeleteAction(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedUser(expandedUser === id ? null : id);
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGene = selectedGeneFilter === 'all' ||
      (p.gene && p.gene.toLowerCase().includes(selectedGeneFilter));

    const matchesGender = selectedGenderFilter === 'all' || p.gender === selectedGenderFilter;

    return p.sample_collected === true && matchesSearch && matchesGene && matchesGender;
  });

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
            <select
              value={selectedGeneFilter}
              onChange={(e) => setSelectedGeneFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 cursor-pointer hover:bg-white transition-all shadow-sm h-[44px]"
            >
              <option value="all">All Gene Panels</option>
              <option value="actn3">ACTN3 (Muscle)</option>
              <option value="edar">EDAR (Hair)</option>
              <option value="cyp1a2">CYP1A2 (Caffeine)</option>
            </select>

            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="flex-1 min-w-[120px] bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 cursor-pointer hover:bg-white transition-all shadow-sm h-[44px]"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
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
                        <div className="flex flex-row flex-wrap items-center gap-1.5">
                          {(patient.gene ? patient.gene.split(', ') : []).map((g: string, idx: number) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded-md text-[9.5px] font-bold border leading-none ${getGeneColor(g)}`}
                            >
                              {g}
                            </span>
                          ))}
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
                            setSampleAction(patient);
                          }}
                          disabled={actionLoading === patient.id + '-received'}
                          className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${patient.sample_received
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
                          <div className="flex gap-2 items-end">
                            {(() => {
                              const requiredGenes = getRequiredGenes(patient.gene);
                              if (requiredGenes.length === 0) return null;
                              return (
                                <div className="flex gap-2">
                                  {requiredGenes.map((rg, idx) => (
                                    <div key={idx} className="flex flex-col gap-1 w-[110px]">
                                      <span className="text-[9px] font-bold text-[#A0A09D] uppercase tracking-wider pl-1">{rg.name}</span>
                                      <select
                                        disabled={!patient.sample_received}
                                        className={`bg-white border border-[#E8E8E5] text-[10px] font-semibold text-[#5A5A55] rounded-xl px-2 py-2 pr-5 outline-none focus:ring-2 focus:ring-[#6057D7]/20 w-full appearance-none shadow-sm transition-all ${!patient.sample_received ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F9F9F8] cursor-pointer'}`}
                                        onClick={(e) => e.stopPropagation()}
                                        value={selectedVariants[patient.id]?.[rg.name] || ""}
                                        onChange={(e) => handleVariantChange(patient.id, rg.name, e.target.value)}
                                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23A0A09D\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.25rem center', backgroundSize: '0.8em' }}
                                      >
                                        <option value="" disabled>Sel {rg.name}</option>
                                        {rg.variants.map((v, i) => (
                                          <option key={i} value={v} className="truncate">{v}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            <motion.label
                              whileHover={patient.sample_received ? { scale: 1.02 } : {}}
                              whileTap={patient.sample_received ? { scale: 0.98 } : {}}
                              onClick={(e) => e.stopPropagation()}
                              className={`bg-gradient-to-b from-[#6057D7] to-[#5149C0] text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-[0_4px_12px_rgb(96,87,215,0.25)] transition-all sm:w-auto text-center flex items-center justify-center gap-2 shrink-0 h-[34px] mb-[2px] ${!patient.sample_received ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:shadow-[0_6px_16px_rgb(96,87,215,0.35)] cursor-pointer'}`}
                            >
                              {actionLoading === patient.id + '-upload' ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              Upload
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf"
                                disabled={!patient.sample_received}
                                onClick={(e) => {
                                  const requiredGenes = getRequiredGenes(patient.gene);
                                  const patientVariants = selectedVariants[patient.id] || {};
                                  const allSelected = requiredGenes.every(rg => patientVariants[rg.name]);
                                  if (!allSelected) {
                                    e.preventDefault();
                                    alert("Please select all required genotypes before uploading the report.");
                                  }
                                }}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setUploadAction({ patientId: patient.id, file: e.target.files[0], patientName: patient.name });
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </motion.label>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPdfUrl(patient.report_url);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-white/85 hover:bg-white border border-[#E8E8E5] text-[#1A1A19] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <FileText size={14} className="text-[#6057D7]" />
                              View
                            </button>
                            {patient.status_timestamps?.uploaded && (new Date().getTime() - new Date(patient.status_timestamps.uploaded).getTime() <= 10 * 60 * 1000) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAction({ patientId: patient.id, patientName: patient.name });
                                }}
                                disabled={actionLoading === patient.id + '-delete'}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                {actionLoading === patient.id + '-delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete
                              </button>
                            )}
                          </div>
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
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {(patient.gene ? patient.gene.split(', ') : []).map((g: string, idx: number) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded-md text-[9.5px] font-bold border leading-none ${getGeneColor(g)}`}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
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
                        setSampleAction(patient);
                      }}
                      disabled={actionLoading === patient.id + '-received'}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${patient.sample_received
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
                      <div className="space-y-3">
                        {(() => {
                          const requiredGenes = getRequiredGenes(patient.gene);
                          if (requiredGenes.length === 0) return null;
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              {requiredGenes.map((rg, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-bold text-[#A0A09D] uppercase tracking-wider">{rg.name}</span>
                                  <select
                                    disabled={!patient.sample_received}
                                    className={`w-full bg-white/80 border border-[#E8E8E5] text-[11px] font-semibold text-[#5A5A55] rounded-xl px-2 py-2 pr-6 outline-none focus:ring-2 focus:ring-[#6057D7]/20 appearance-none shadow-sm transition-all ${!patient.sample_received ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}`}
                                    value={selectedVariants[patient.id]?.[rg.name] || ""}
                                    onChange={(e) => handleVariantChange(patient.id, rg.name, e.target.value)}
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23A0A09D\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em' }}
                                  >
                                    <option value="" disabled>Select {rg.name}</option>
                                    {rg.variants.map((v, i) => <option key={i} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        <motion.label
                          whileHover={patient.sample_received ? { scale: 1.02 } : {}}
                          whileTap={patient.sample_received ? { scale: 0.98 } : {}}
                          className={`w-full bg-[#1A1A19] text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 ${!patient.sample_received ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:shadow-lg cursor-pointer'}`}
                        >
                          {actionLoading === patient.id + '-upload' ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          Upload Report
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            disabled={!patient.sample_received}
                            onClick={(e) => {
                              const requiredGenes = getRequiredGenes(patient.gene);
                              const patientVariants = selectedVariants[patient.id] || {};
                              const allSelected = requiredGenes.every(rg => patientVariants[rg.name]);
                              if (!allSelected) {
                                e.preventDefault();
                                alert("Please select all required genotypes before uploading the report.");
                              }
                            }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setUploadAction({ patientId: patient.id, file: e.target.files[0], patientName: patient.name });
                                e.target.value = '';
                              }
                            }}
                          />
                        </motion.label>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPdfUrl(patient.report_url);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#F4F4F2] hover:bg-[#E8E8E5] text-[#1A1A19] rounded-2xl text-sm font-bold transition-all"
                        >
                          <FileText size={16} className="text-[#6057D7]" />
                          View
                        </button>
                        {patient.status_timestamps?.uploaded && (new Date().getTime() - new Date(patient.status_timestamps.uploaded).getTime() <= 10 * 60 * 1000) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteAction({ patientId: patient.id, patientName: patient.name });
                            }}
                            disabled={actionLoading === patient.id + '-delete'}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
                          >
                            {actionLoading === patient.id + '-delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sample Status Confirmation Modal */}
      <AnimatePresence>
        {sampleAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !actionLoading && setSampleAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E8E5] overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sampleAction.sample_received ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => !actionLoading && setSampleAction(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] transition-colors rounded-full hover:bg-[#F4F4F2]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">{sampleAction.sample_received ? 'Unmark Received' : 'Mark as Received'}</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to change the sample status for <span className="font-bold text-[#1A1A19]">{sampleAction.name}</span> to {sampleAction.sample_received ? 'Pending' : 'Received'}?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSampleAction(null)}
                    disabled={!!actionLoading}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmToggleSampleReceived}
                    disabled={!!actionLoading}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm ${sampleAction.sample_received ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#027A48] hover:bg-[#026c3f]'}`}
                  >
                    {actionLoading === sampleAction.id + '-received' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {actionLoading === sampleAction.id + '-received' ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Report Confirmation Modal */}
      <AnimatePresence>
        {uploadAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !actionLoading && setUploadAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E8E5] overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => !actionLoading && setUploadAction(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] transition-colors rounded-full hover:bg-[#F4F4F2]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Upload Genomic Report</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to upload this report for <span className="font-bold text-[#1A1A19]">{uploadAction.patientName}</span>? <br /><br />
                  <span className="font-semibold text-xs bg-[#F4F4F2] px-2 py-1 rounded-md">{uploadAction.file.name}</span>
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setUploadAction(null)}
                    disabled={!!actionLoading}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmUploadReport}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6057D7] hover:bg-[#5149C0] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading === uploadAction.patientId + '-upload' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    {actionLoading === uploadAction.patientId + '-upload' ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {previewPdfUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPdfUrl(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#E8E8E5] bg-[#F9F9F8]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#6057D7]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A19]">Document Preview</h3>
                    <p className="text-xs text-[#8B8B86]">Review the uploaded report</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewPdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E8E5] text-[#1A1A19] text-xs font-bold rounded-xl hover:bg-[#F4F4F2] transition-colors"
                  >
                    <FileText className="w-4 h-4" /> Download PDF
                  </a>
                  <button
                    onClick={() => setPreviewPdfUrl(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5] rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 bg-[#F4F4F2] w-full h-full relative">
                {previewPdfUrl.endsWith('.pdf') || previewPdfUrl.includes('cloudinary') ? (
                  <iframe
                    src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#8B8B86]">
                    <AlertTriangle className="w-12 h-12 mb-4 text-[#A0A09D]" />
                    <p className="font-semibold">Cannot preview this file type directly.</p>
                    <a href={previewPdfUrl} target="_blank" rel="noopener noreferrer" className="text-[#6057D7] underline mt-2 text-sm">
                      Open in new tab
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Report Confirmation Modal */}
      <AnimatePresence>
        {deleteAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDeleteAction(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => setDeleteAction(null)}
                    className="p-2 text-[#8B8B86] hover:bg-[#F4F4F2] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Delete Genomic Report</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to delete the uploaded report for <span className="font-bold text-[#1A1A19]">{deleteAction.patientName}</span>? <br /><br />
                  This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteAction(null)}
                    disabled={!!actionLoading}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteReport}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading === deleteAction.patientId + '-delete' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {actionLoading === deleteAction.patientId + '-delete' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

