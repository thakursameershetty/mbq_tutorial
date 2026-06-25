import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, CheckCircle2, Clock, User, Loader2, ShieldAlert, Sparkles, FileText, Trash2, X, AlertTriangle, Check, Download, RefreshCw, AlertCircle, Edit, Plus } from 'lucide-react';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const safeRender = (val: any) => {
  if (val === null || val === undefined || val === '') return 'N/A';
  if (typeof val === 'object') {
    return Object.values(val).filter(Boolean).join(' - ');
  }
  return String(val);
};

const getGeneColor = (geneName: string) => {
  const name = geneName.toLowerCase();
  if (name.includes('actn3')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (name.includes('edar')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (name.includes('cyp1a2') || name.includes('caffeine') || name.includes('caffine')) return 'bg-amber-50 text-amber-700 border-amber-200';

  return 'bg-[#F4F4F2] text-[#5A5A55] border-[#D4D4CE]';
};

export default function AdminVerifyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all');
  const [selectedSampleFilter, setSelectedSampleFilter] = useState<string>('all');
  const [selectedDataFilter, setSelectedDataFilter] = useState<string>('all');
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>('all');
  const [selectedGeneFilter, setSelectedGeneFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [editingGenePatient, setEditingGenePatient] = useState<any>(null);
  const [editedGeneType, setEditedGeneType] = useState<string>('');
  const [isUpdatingGene, setIsUpdatingGene] = useState(false);

  const handleUpdateGene = async () => {
    if (!editingGenePatient) return;
    setIsUpdatingGene(true);
    try {
      const response = await fetch(`/api/users/${editingGenePatient.id}/gene`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene_type: editedGeneType }),
      });
      const data = await response.json();
      if (data.success) {
        setPatients(prev => prev.map(p => p.id === editingGenePatient.id ? { ...p, gene_type: editedGeneType } : p));
        setEditingGenePatient(null);
      } else {
        alert(data.error || 'Failed to update gene panel');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setIsUpdatingGene(false);
    }
  };

  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [verifyAction, setVerifyAction] = useState<any>(null);
  const [deleteReportAction, setDeleteReportAction] = useState<{ id: number, name: string } | null>(null);

  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkFetching, setIsBulkFetching] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [fetchDataLoading, setFetchDataLoading] = useState<number | null>(null);
  const [fetchDataStatus, setFetchDataStatus] = useState<{ id: number; type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const toggleSelectUser = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const confirmDeleteReport = async () => {
    if (!deleteReportAction) return;
    const { id: userId } = deleteReportAction;
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}/delete-report`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        fetchPatients(true);
      } else {
        alert(data.error || 'Failed to delete report');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
      setDeleteReportAction(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setPatients((prev) => prev.filter((p) => p.id !== userToDelete.id));
        setUserToDelete(null);
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleViewGeneratedReport = (patient: any) => {
    localStorage.setItem('userProfile', JSON.stringify(patient));
    window.open('/report', '_blank');
  };

  const confirmVerifyReport = async () => {
    if (!verifyAction) return;
    const { id, report_verified: currentStatus } = verifyAction;
    const targetStatus = !currentStatus;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/users/${id}/verify-report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportVerified: targetStatus }),
      });
      const data = await response.json();
      if (data.success) {
        setPatients((prev) =>
          prev.map((p) => (p.id === id ? { ...p, report_verified: targetStatus, status_timestamps: data.user.status_timestamps } : p))
        );
      } else {
        alert(data.error || 'Failed to verify report');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
      setVerifyAction(null);
    }
  };

  const handleFetchPhenotypicData = async (patientId: number, force = false) => {
    setFetchDataLoading(patientId);
    setFetchDataStatus(null);
    try {
      const res = await fetch(`/api/users/${patientId}/fetch-phenotypic-data?force=${force}`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 429) {
        setFetchDataStatus({ id: patientId, type: 'warning', message: data.message || 'Gemini API rate-limited. Try again in a minute.' });
      } else if (data.success && data.user) {
        setPatients(prev => prev.map(p => p.id === patientId ? { ...p, phenotypic_analysis: data.user.phenotypic_analysis } : p));
        setFetchDataStatus({ id: patientId, type: 'success', message: 'Phenotypic data fetched successfully!' });
        setTimeout(() => setFetchDataStatus(null), 4000);
      } else {
        setFetchDataStatus({ id: patientId, type: 'error', message: data.message || 'Could not fetch data. Please try again.' });
      }
    } catch (err) {
      setFetchDataStatus({ id: patientId, type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setFetchDataLoading(null);
    }
  };

  const fetchPatients = (silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/admin/patients')
      .then((res) => res.json())
      .then((data) => {
        setPatients(data);
      })
      .catch((err) => console.error('Error fetching patients:', err))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(() => fetchPatients(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedPatientId(expandedPatientId === id ? null : id);
  };

  const filteredPatients = patients.filter((p) => {
    if (!p) return false;
    const nameMatch = (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = (p.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const usernameMatch = (p.username || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (p.phone || '').includes(searchQuery);

    const matchesSearch = nameMatch || emailMatch || usernameMatch || phoneMatch;

    const matchesGender = selectedGenderFilter === 'all' || p.gender === selectedGenderFilter;

    const isCollected = p.sample_collected === true;
    const isReceived = p.sample_received === true;
    const isUploaded = p.report_uploaded === true;
    const isGenerated = p.report_generated === true;
    const isVerified = p.report_verified === true;

    let currentStatus = 'registered';
    if (isVerified) currentStatus = 'verified';
    else if (isGenerated) currentStatus = 'generated';
    else if (isUploaded) currentStatus = 'uploaded';
    else if (isReceived) currentStatus = 'received';
    else if (isCollected) currentStatus = 'collected';

    const matchesWorkflow = selectedWorkflowFilter === 'all' || currentStatus === selectedWorkflowFilter;

    const matchesGene = selectedGeneFilter === 'all' ||
      (p.gene_type && p.gene_type.toLowerCase().includes(selectedGeneFilter));

    const matchesSample =
      selectedSampleFilter === 'all' ||
      (selectedSampleFilter === 'collected' && isCollected) ||
      (selectedSampleFilter === 'pending' && !isCollected);

    const matchesData =
      selectedDataFilter === 'all' ||
      (selectedDataFilter === 'null_data' && !p.phenotypic_analysis) ||
      (selectedDataFilter === 'has_data' && !!p.phenotypic_analysis);

    return matchesSearch && matchesGender && matchesSample && matchesData && matchesWorkflow && matchesGene;
  });

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredPatients.length && filteredPatients.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/users/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
      });
      const data = await response.json();
      if (data.success) {
        setPatients(prev => prev.filter(p => !selectedUsers.has(p.id)));
        setSelectedUsers(new Set());
        setShowBulkDeleteModal(false);
      } else {
        alert(data.error || 'Failed to delete users');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkFetch = async (force: boolean) => {
    setIsBulkFetching(true);
    const userIds = Array.from(selectedUsers);

    for (const id of userIds) {
      setFetchDataLoading(id);
      try {
        await fetch(`/api/users/${id}/fetch-phenotypic-data?force=${force}`, { method: 'POST' });
      } catch (err) {
        console.error(`Failed to fetch for user ${id}`, err);
      }
    }

    setIsBulkFetching(false);
    setFetchDataLoading(null);
    fetchPatients(true);
  };

  const handleDownloadCSV = () => {
    if (patients.length === 0) return;

    const headers = [
      "ID",
      "Username",
      "Full Name",
      "Email",
      "Phone",
      "Age",
      "Gender",
      "Gene Panel",
      "Sample Collected",
      "Sample Received",
      "Report Uploaded",
      "Report Generated",
      "Report Verified",
      "Created At"
    ];

    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const csvRows = patients.map(p => [
      formatUserId(p.id),
      p.username || '',
      p.full_name ? escapeCSV(p.full_name) : '',
      p.email || '',
      p.phone ? escapeCSV(p.phone) : '',
      p.age || '',
      p.gender || '',
      p.gene_type ? escapeCSV(p.gene_type) : '',
      p.sample_collected ? 'Yes' : 'No',
      p.sample_received ? 'Yes' : 'No',
      p.report_uploaded ? 'Yes' : 'No',
      p.report_generated ? 'Yes' : 'No',
      p.report_verified ? 'Yes' : 'No',
      p.created_at ? escapeCSV(new Date(p.created_at).toLocaleString()) : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mbq_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mx-auto"
    >
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
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

          {/* Core Actions (Search + Global Buttons) */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D]" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-sm rounded-xl pl-10 pr-4 py-2 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 transition-all shadow-sm placeholder:text-[#A0A09D] font-medium"
              />
            </div>

            <button
              onClick={handleDownloadCSV}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] rounded-xl text-sm font-semibold text-white transition-all shadow-sm shrink-0 hover:opacity-90 h-[42px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Secondary Actions & Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/40 backdrop-blur-md border border-[#E8E8E5] p-2 rounded-2xl shadow-sm">
          <button
            onClick={toggleSelectAll}
            className="flex items-center justify-center gap-2 px-4 py-2 w-full sm:w-auto bg-white border border-[#E8E8E5] rounded-xl text-xs font-bold text-[#5A5A55] hover:bg-[#F8F8F7] transition-all shadow-sm shrink-0 h-[42px]"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedUsers.size === filteredPatients.length && filteredPatients.length > 0 ? 'bg-[#6057D7] border-[#6057D7] text-white' : 'border-[#D4D4CE] bg-white'}`}>
              {selectedUsers.size === filteredPatients.length && filteredPatients.length > 0 && <Check className="w-3 h-3" />}
            </div>
            Select All
          </button>

          <div className="h-6 w-[1px] bg-[#E8E8E5] hidden sm:block mx-1"></div>

          <div className="flex overflow-x-auto gap-2 w-full pb-1 sm:pb-0 scrollbar-hide">
            <select
              value={selectedWorkflowFilter}
              onChange={(e) => setSelectedWorkflowFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer hover:bg-[#F8F8F7] h-[42px]"
            >
              <option value="all">All Stages</option>
              <option value="registered">Registered</option>
              <option value="collected">Sample Collected</option>
              <option value="received">Sample Received</option>
              <option value="uploaded">Report Uploaded</option>
              <option value="generated">Report Generated</option>
              <option value="verified">Report Verified</option>
            </select>

            <select
              value={selectedGeneFilter}
              onChange={(e) => setSelectedGeneFilter(e.target.value)}
              className="flex-1 min-w-[140px] bg-white border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer hover:bg-[#F8F8F7] h-[42px]"
            >
              <option value="all">All Gene Panels</option>
              <option value="actn3">ACTN3 (Muscle)</option>
              <option value="edar">EDAR (Hair)</option>
              <option value="cyp1a2">CYP1A2 (Caffeine)</option>
            </select>

            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="flex-1 min-w-[120px] bg-white border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer hover:bg-[#F8F8F7] h-[42px]"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={selectedSampleFilter}
              onChange={(e) => setSelectedSampleFilter(e.target.value)}
              className="flex-1 min-w-[120px] bg-white border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer hover:bg-[#F8F8F7] h-[42px]"
            >
              <option value="all">All Samples</option>
              <option value="collected">Collected</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={selectedDataFilter}
              onChange={(e) => setSelectedDataFilter(e.target.value)}
              className="flex-1 min-w-[130px] bg-white border border-[#E8E8E5] text-xs font-semibold text-[#5A5A55] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6057D7]/20 cursor-pointer hover:bg-[#F8F8F7] h-[42px]"
            >
              <option value="all">All AI Data</option>
              <option value="has_data">Has Data</option>
              <option value="null_data">Missing Data</option>
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
                  className={`bg-white/70 backdrop-blur-2xl border ${isExpanded ? 'border-[#6057D7]/30 shadow-md ring-4 ring-[#6057D7]/5' : 'border-white/80 shadow-sm'
                    } rounded-[20px] overflow-hidden transition-all duration-300 hover:shadow-md hover:bg-white/90`}
                >
                  {/* Summary Header bar */}
                  <div
                    onClick={() => toggleExpand(patient.id)}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between cursor-pointer gap-4 relative z-10"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <button
                        onClick={(e) => toggleSelectUser(patient.id, e)}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${selectedUsers.has(patient.id) ? 'bg-[#6057D7] border-[#6057D7] text-white' : 'border-[#D4D4CE] bg-white hover:border-[#6057D7]'}`}
                      >
                        {selectedUsers.has(patient.id) && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-base font-bold text-[#1A1A19] shadow-inner shrink-0">
                        {patient.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1A1A19] text-base truncate flex items-center gap-2">
                          {patient.full_name?.toUpperCase()}
                        </div>
                        <div className="text-xs font-mono font-medium text-[#8B8B86] mt-0.5 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          ID: {formatUserId(patient.id)} ({patient.username})
                        </div>
                      </div>
                    </div>

                    {/* Meta Info Indicators */}
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-4 lg:gap-6 mt-3 lg:mt-0">
                      {/* Genotypes badges */}
                      <div className="flex flex-col w-[260px] xl:w-[320px] shrink-0">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1 block">Gene Panel</span>
                        <div className="flex flex-row flex-wrap items-center gap-1.5">
                          {genesList.map((g: string, idx: number) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded-md text-[9.5px] font-bold border leading-none ${getGeneColor(g)}`}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Contact metadata */}
                      <div className="flex flex-col text-xs text-[#5A5A55] w-[180px] xl:w-[200px] shrink-0">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#A0A09D] mb-1">Contact</span>
                        <span className="font-semibold">{patient.email}</span>
                      </div>

                      {/* Sample Collected status badge */}
                      <div className="flex flex-col w-[90px] shrink-0">
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGenePatient(patient);
                            setEditedGeneType(patient.gene_type || '');
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-500 rounded-full transition-colors border border-indigo-100"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToDelete(patient);
                          }}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-full transition-colors border border-red-100"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                              <span className="font-semibold text-sm text-[#1A1A19]">{patient.full_name?.toUpperCase()}</span>
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
                                        {safeRender(analysis.personal_profile.dailyActivity)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Sleep Timing:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.personal_profile.sleepTiming)}
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
                                        {safeRender(analysis.caffeine_response.sleepImpact)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Duration of Effect:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.caffeine_response.durationOfEffect)}
                                      </span>
                                    </div>
                                    {typeof analysis.caffeine_response.sensitivity === 'object' && analysis.caffeine_response.sensitivity !== null ? (
                                      <>
                                        <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                          <span className="text-[#8B8B86]">Physical Sensitivity:</span>
                                          <span className="font-semibold text-[#1A1A19]">
                                            {safeRender(analysis.caffeine_response.sensitivity.physicalSensitivity || analysis.caffeine_response.sensitivity.physical)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                          <span className="text-[#8B8B86]">Small Dose Sensitivity:</span>
                                          <span className="font-semibold text-[#1A1A19]">
                                            {safeRender(analysis.caffeine_response.sensitivity.smallDoseSensitivity || analysis.caffeine_response.sensitivity.smallDose)}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                        <span className="text-[#8B8B86]">Sensitivity:</span>
                                        <span className="font-semibold text-[#1A1A19]">
                                          {safeRender(analysis.caffeine_response.sensitivity)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Tolerance:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.caffeine_response.tolerance)}
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
                                        {safeRender(analysis.hair_scalp_characteristics.thickness)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Texture:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.hair_scalp_characteristics.texture)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Scalp Type:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.hair_scalp_characteristics.scalpType)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Sweating:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.hair_scalp_characteristics.sweating)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Stability:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.hair_scalp_characteristics.stability)}
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
                                      <span className="text-[#8B8B86]">Power/Explosiveness:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.physical_performance.power)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Endurance:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.physical_performance.endurance)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Muscle Adaptation:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.physical_performance.muscleAdaptation)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-b border-[#F0F0ED] pb-1.5">
                                      <span className="text-[#8B8B86]">Recovery:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.physical_performance.recovery)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#8B8B86]">Training Preference:</span>
                                      <span className="font-semibold text-[#1A1A19]">
                                        {safeRender(analysis.physical_performance.trainingPreference)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-5 bg-white border border-amber-200 rounded-2xl">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-1">
                                <div className="flex items-start gap-3">
                                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-semibold text-amber-800">No phenotypic data</p>
                                    <p className="text-[11px] text-amber-600 mt-0.5">
                                      Gemini may have been rate-limited during registration. Click "Fetch Data" to retry.
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleFetchPhenotypicData(patient.id, false)}
                                  disabled={fetchDataLoading === patient.id}
                                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shrink-0 cursor-pointer"
                                >
                                  <RefreshCw size={13} className={fetchDataLoading === patient.id ? 'animate-spin' : ''} />
                                  {fetchDataLoading === patient.id ? 'Fetching...' : 'Fetch Data'}
                                </button>
                              </div>
                              {/* Inline status for this card */}
                              {fetchDataStatus?.id === patient.id && (
                                <div className={`mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${fetchDataStatus.type === 'success'
                                  ? 'bg-[#ECFDF3] text-[#027A48] border-[#027A48]/20'
                                  : fetchDataStatus.type === 'warning'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-red-50 text-red-600 border-red-100'
                                  }`}>
                                  <AlertCircle size={13} className="shrink-0" />
                                  {fetchDataStatus.message}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions Panel */}
                          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#F0F0ED]">
                            {patient.report_uploaded && patient.report_url ? (
                              <>
                                <button
                                  onClick={() => setPreviewPdfUrl(patient.report_url)}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/85 hover:bg-white border border-[#E8E8E5] text-[#1A1A19] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                  <FileText size={14} className="text-[#6057D7]" />
                                  View Uploaded Report
                                </button>
                                {patient.status_timestamps?.uploaded && (new Date().getTime() - new Date(patient.status_timestamps.uploaded).getTime() <= 10 * 60 * 1000) && (
                                  <button
                                    onClick={() => setDeleteReportAction({ id: patient.id, name: patient.full_name || patient.username })}
                                    disabled={actionLoading === patient.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                  >
                                    {actionLoading === patient.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    Delete Report
                                  </button>
                                )}
                              </>
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
                              onClick={() => setVerifyAction(patient)}
                              disabled={actionLoading === patient.id}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${patient.report_verified
                                ? 'bg-[#027A48] hover:bg-[#026c3f] text-white font-bold'
                                : 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white'
                                }`}
                            >
                              {actionLoading === patient.id ? (
                                <Loader2 className="animate-spin w-3.5 h-3.5" />
                              ) : patient.report_verified ? (
                                '\u2713 Report Verified'
                              ) : (
                                'Verify Report'
                              )}
                            </button>

                            {/* Resync Data button — always visible to pull latest from sheets */}
                            <button
                              onClick={() => handleFetchPhenotypicData(patient.id, true)}
                              disabled={fetchDataLoading === patient.id}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-60 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <RefreshCw size={13} className={fetchDataLoading === patient.id ? 'animate-spin' : ''} />
                              {fetchDataLoading === patient.id ? 'Syncing...' : 'Resync'}
                            </button>

                            {/* Fetch Data button — always visible if phenotypic_analysis is null */}
                            {!patient.phenotypic_analysis && (
                              <button
                                onClick={() => handleFetchPhenotypicData(patient.id, false)}
                                disabled={fetchDataLoading === patient.id}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                <RefreshCw size={13} className={fetchDataLoading === patient.id ? 'animate-spin' : ''} />
                                {fetchDataLoading === patient.id ? 'Fetching...' : 'Fetch Data'}
                              </button>
                            )}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !isDeletingUser && setUserToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E8E5] overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => !isDeletingUser && setUserToDelete(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] transition-colors rounded-full hover:bg-[#F4F4F2]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Delete User Profile</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to completely delete the profile for <span className="font-bold text-[#1A1A19]">{userToDelete.full_name}</span>? This action is permanent and cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setUserToDelete(null)}
                    disabled={isDeletingUser}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={isDeletingUser}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isDeletingUser ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isDeletingUser ? 'Deleting...' : 'Delete Profile'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Verify Confirmation Modal */}
      <AnimatePresence>
        {verifyAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !actionLoading && setVerifyAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E8E5] overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${verifyAction.report_verified ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => !actionLoading && setVerifyAction(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] transition-colors rounded-full hover:bg-[#F4F4F2]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">{verifyAction.report_verified ? 'Unverify' : 'Verify'} Report</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to {verifyAction.report_verified ? 'unverify' : 'verify'} the report for <span className="font-bold text-[#1A1A19]">{verifyAction.full_name}</span>?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setVerifyAction(null)}
                    disabled={actionLoading === verifyAction.id}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmVerifyReport}
                    disabled={actionLoading === verifyAction.id}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm ${verifyAction.report_verified ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {actionLoading === verifyAction.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {actionLoading === verifyAction.id ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Modal */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !isBulkDeleting && setShowBulkDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E8E5] overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <button
                    onClick={() => !isBulkDeleting && setShowBulkDeleteModal(false)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] transition-colors rounded-full hover:bg-[#F4F4F2]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Delete {selectedUsers.size} Users</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to permanently delete the {selectedUsers.size} selected user profiles? This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBulkDeleteModal(false)}
                    disabled={isBulkDeleting}
                    className="flex-1 px-4 py-2.5 bg-white border border-[#E8E8E5] text-[#1A1A19] font-bold text-sm rounded-xl hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isBulkDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isBulkDeleting ? 'Deleting...' : 'Delete All'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Bar for Bulk Selection */}
      <AnimatePresence>
        {selectedUsers.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#1A1A19] text-white px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.2)] border border-white/10 flex items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-[#333331] text-[#A0A09D] font-mono text-sm font-bold rounded-lg h-7 min-w-[28px] px-2">
                {selectedUsers.size}
              </div>
              <span className="text-white text-sm font-medium">profiles selected</span>
            </div>
            <div className="w-px h-6 bg-white/15" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkFetch(false)}
                disabled={isBulkFetching}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
              >
                {isBulkFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Fetch Missing
              </button>
              <button
                onClick={() => handleBulkFetch(true)}
                disabled={isBulkFetching}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
              >
                {isBulkFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Resync Selected
              </button>
              <div className="w-px h-6 bg-white/15 mx-1" />
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={isBulkFetching}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedUsers(new Set())}
                disabled={isBulkFetching}
                className="p-2 hover:bg-[#333331] rounded-xl transition-colors ml-2 border border-transparent hover:border-white/10 disabled:opacity-60"
              >
                <X className="w-4 h-4 text-[#A0A09D]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {previewPdfUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setPreviewPdfUrl(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-[#E8E8E5] bg-[#F9F9F8]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6057D7]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#6057D7]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A19]">Document Preview</h3>
                    <p className="text-xs text-[#8B8B86]">Uploaded Genomic Report</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E8E8E5] text-[#1A1A19] rounded-lg text-xs font-bold hover:bg-[#F4F4F2] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                  <button
                    onClick={() => setPreviewPdfUrl(null)}
                    className="p-2 text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#E8E8E5] rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-[#F4F4F2] relative">
                {/* Fallback link if iframe fails or is blocked */}
                <div className="absolute inset-0 flex items-center justify-center -z-10 text-[#8B8B86] text-sm">
                  Loading preview...
                </div>
                <iframe
                  src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="PDF Preview"
                  className="w-full h-full border-none relative z-10"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Patient Modal */}
      <AnimatePresence>
        {editingGenePatient && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingGenePatient(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                      {editingGenePatient.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A1A19]">{editingGenePatient.full_name}</h3>
                      <div className="text-xs text-[#8B8B86]">{formatUserId(editingGenePatient.id)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingGenePatient(null)}
                    className="p-2 text-[#8B8B86] hover:bg-[#F4F4F2] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-[#F4F4F2] p-3 rounded-xl mb-6">
                  <div className="text-xs text-[#5A5A55]">
                    <span className="font-semibold text-[#1A1A19]">Email:</span> {editingGenePatient.email || 'N/A'}
                  </div>
                  <div className="text-xs text-[#5A5A55] mt-1">
                    <span className="font-semibold text-[#1A1A19]">Phone:</span> {editingGenePatient.phone || 'N/A'}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-xs font-bold text-[#8B8B86] uppercase tracking-wider mb-2 block">Gene Panel Configuration</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-row flex-wrap gap-2">
                      {/* Selected Genes */}
                      {editedGeneType.split(',').map(g => g.trim()).filter(Boolean).map((g, idx) => (
                        <span
                          key={idx}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border leading-none cursor-pointer hover:opacity-80 transition-opacity ${getGeneColor(g)}`}
                          onClick={() => {
                            const genes = editedGeneType.split(',').map(x => x.trim()).filter(Boolean);
                            setEditedGeneType(genes.filter(x => x !== g).join(', '));
                          }}
                        >
                          {g}
                          <X size={12} className="opacity-70 hover:opacity-100" />
                        </span>
                      ))}

                      {/* Unselected Genes */}
                      {[
                        { short: 'ACTN3', full: 'Muscle Power vs Endurance (ACTN3)' },
                        { short: 'EDAR', full: 'Hair Thickness & Root Structure (EDAR)' },
                        { short: 'CYP1A2', full: 'Caffine Response (CYP1A2)' }
                      ].filter(ag => !(editedGeneType || '').toUpperCase().includes(ag.short)).map((ag, idx) => (
                        <span
                          key={`add-${idx}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-[#D4D4CE] text-[#8B8B86] leading-none cursor-pointer hover:bg-[#F4F4F2] hover:text-[#5A5A55] transition-all"
                          onClick={() => {
                            const genes = editedGeneType ? editedGeneType.split(',').map(x => x.trim()).filter(Boolean) : [];
                            setEditedGeneType([...genes, ag.full].join(', '));
                          }}
                        >
                          {ag.full}
                          <Plus size={12} className="opacity-70" />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingGenePatient(null)}
                    disabled={isUpdatingGene}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-[#D4D4CE] text-[#5A5A55] font-semibold text-sm hover:bg-[#F4F4F2] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateGene}
                    disabled={isUpdatingGene}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#6057D7] text-white font-semibold text-sm hover:bg-[#4F46BA] transition-colors disabled:opacity-50"
                  >
                    {isUpdatingGene ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Report Confirmation Modal */}
      <AnimatePresence>
        {deleteReportAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteReportAction(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => setDeleteReportAction(null)}
                    className="p-2 text-[#8B8B86] hover:bg-[#F4F4F2] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Delete Genomic Report</h3>
                <p className="text-[#5A5A55] text-sm mb-6">
                  Are you sure you want to delete the uploaded report for <span className="font-bold text-[#1A1A19]">{deleteReportAction.name}</span>? <br /><br />
                  This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteReportAction(null)}
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
                    {actionLoading === deleteReportAction.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {actionLoading === deleteReportAction.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div >
  );
}
