import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Clock, User, Phone, Mail, Calendar, Activity, Loader2, Edit, X, Plus, Check, Wand2 } from 'lucide-react';
import SmartBulkMatchModal from '../components/SmartBulkMatchModal';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const getGeneColor = (geneName: string) => {
  const name = geneName.toLowerCase();
  if (name.includes('actn3')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (name.includes('edar')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (name.includes('cyp1a2') || name.includes('caffeine') || name.includes('caffine')) return 'bg-amber-50 text-amber-700 border-amber-200';

  return 'bg-[#F4F4F2] text-[#5A5A55] border-[#D4D4CE]';
};

export default function VolunteerPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'collected'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, patientId: number | null, currentStatus: boolean, patientName: string }>({
    isOpen: false,
    patientId: null,
    currentStatus: false,
    patientName: ''
  });

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

  const handleToggleSampleCollected = async (patientId: number, currentStatus: boolean) => {
    const targetStatus = !currentStatus;
    setActionLoading(String(patientId));

    try {
      const response = await fetch(`/api/users/${patientId}/sample-collected`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleCollected: targetStatus }),
      });

      const data = await response.json();
      if (data.success) {
        setPatients((prev) =>
          prev.map((p) => (p.id === patientId ? { ...p, sample_collected: targetStatus } : p))
        );
      } else {
        alert(data.error || 'Failed to update sample status');
      }
    } catch (err) {
      console.error('Error updating sample status:', err);
      alert('Failed to connect to the server');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPatients = patients.filter((patient) => {
    const searchTerms = searchQuery
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const matchesSearch = searchTerms.length === 0 || searchTerms.some(term => {
      const nameMatch = patient.full_name?.toLowerCase().includes(term);
      const emailMatch = patient.email?.toLowerCase().includes(term);
      const usernameMatch = patient.username?.toLowerCase().includes(term);
      const phoneMatch = patient.phone?.includes(term);
      const idMatch = formatUserId(patient.id).toLowerCase().includes(term) || patient.id.toString().includes(term);
      return nameMatch || emailMatch || usernameMatch || phoneMatch || idMatch;
    });

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'collected') return matchesSearch && patient.sample_collected === true;
    if (statusFilter === 'pending') return matchesSearch && !patient.sample_collected;

    return matchesSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mx-auto"
    >
      <SmartBulkMatchModal
        isOpen={isSmartMatchOpen}
        onClose={() => setIsSmartMatchOpen(false)}
        onMatch={(ids) => setSearchQuery(ids)}
      />

      {/* Header Section */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#6057D7] tracking-widest uppercase mb-2 shadow-sm backdrop-blur-md"
          >
            <Activity className="w-3.5 h-3.5" />
            Volunteer Portal
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1A19]">Saliva Sample Tracking</h2>
          <p className="text-[#8B8B86] text-base font-medium max-w-xl leading-relaxed">
            Manage cheek swab / saliva sample collections for early access participants. Verify details and update statuses.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D] z-10 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, id (comma separated for bulk)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText.includes('\n') || pastedText.includes('\t')) {
                    e.preventDefault();
                    const formatted = pastedText.split(/[\n\t]+/).map(s => s.trim()).filter(Boolean).join(', ');
                    const input = e.target as HTMLInputElement;
                    const start = input.selectionStart || 0;
                    const end = input.selectionEnd || 0;
                    const newValue = searchQuery.substring(0, start) + formatted + searchQuery.substring(end);
                    setSearchQuery(newValue);
                  }
                }}
                className="w-full bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-sm rounded-2xl pl-4 pr-10 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 transition-all shadow-sm placeholder:text-[#A0A09D] font-medium"
              />
            </div>
            <button
              onClick={() => setIsSmartMatchOpen(true)}
              className="flex items-center justify-center p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-2xl border border-purple-200 transition-colors shadow-sm shrink-0"
              title="Smart Match with AI"
            >
              <Wand2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex bg-white/60 backdrop-blur-xl p-1 rounded-2xl border border-[#E8E8E5] shadow-sm w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === 'all' ? 'bg-[#1A1A19] text-white shadow-sm' : 'text-[#8B8B86] hover:text-[#1A1A19]'
                }`}
            >
              All ({patients.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === 'pending'
                ? 'bg-[#B87A00] text-white shadow-sm'
                : 'text-[#8B8B86] hover:text-[#B87A00]'
                }`}
            >
              Pending ({patients.filter((p) => !p.sample_collected).length})
            </button>
            <button
              onClick={() => setStatusFilter('collected')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === 'collected'
                ? 'bg-[#027A48] text-white shadow-sm'
                : 'text-[#8B8B86] hover:text-[#027A48]'
                }`}
            >
              Collected ({patients.filter((p) => p.sample_collected).length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#6057D7]/5 to-[#3FC2AC]/5 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-multiply" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#6057D7] mb-4" size={40} />
            <p className="text-[#8B8B86] text-sm font-medium">Fetching patient records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-20 bg-white/40 backdrop-blur-md border border-[#E8E8E5] rounded-3xl p-8">
            <User className="w-12 h-12 text-[#A0A09D] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#1A1A19]">No profiles found</h3>
            <p className="text-sm text-[#8B8B86] mt-1">Try modifying your search or filter settings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredPatients.map((patient, i) => {
                const isCollected = patient.sample_collected === true;
                const isActionLoading = actionLoading === String(patient.id);

                // Parse multiple genotypes if stored as comma separated string
                const genesList = patient.gene_type ? patient.gene_type.split(/,\s*(?![^(]*\))/) : [];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.05, 0.5) }}
                    key={patient.id}
                    className={`bg-white/70 backdrop-blur-2xl border ${isCollected ? 'border-[#027A48]/20 bg-white/80' : 'border-white/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]'
                      } rounded-3xl p-6 transition-all duration-300 hover:shadow-md hover:bg-white flex flex-col justify-between min-h-[320px]`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-sm font-bold text-[#1A1A19] shadow-inner shrink-0">
                          {patient.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingGenePatient(patient);
                              setEditedGeneType(patient.gene_type || '');
                            }}
                            className="p-1.5 bg-[#F4F4F2] hover:bg-[#E8E8E5] text-[#5A5A55] rounded-full transition-colors border border-[#D4D4CE]"
                            title="Edit Gene Panel"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ECFDF3] text-[#027A48] text-[10px] font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" /> Collected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFF5E5] text-[#B87A00] text-[10px] font-bold uppercase tracking-wider">
                              <Clock className="w-3 h-3 animate-pulse" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Patient Name & Username */}
                      <div className="mb-4">
                        <h3 className="font-bold text-[#1A1A19] text-lg leading-tight mb-1">{patient.full_name?.toUpperCase()}</h3>
                        <p className="text-xs font-mono font-medium text-[#8B8B86] flex items-center gap-1">
                          <User size={12} /> ID: {formatUserId(patient.id)} ({patient.username})
                        </p>
                      </div>

                      {/* Contact Details */}
                      <div className="space-y-2 mb-4 text-xs text-[#5A5A55]">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-[#8B8B86]" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-[#8B8B86]" />
                          <span>{patient.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-[#8B8B86]" />
                          <span>{patient.age ? `${patient.age} years` : 'N/A'} • {patient.gender || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Selected Genotypes */}
                      {genesList.length > 0 && (
                        <div className="mb-6 pt-3 border-t border-[#F0F0ED]">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#A0A09D] block mb-2">
                            Assigned Panels
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {genesList.map((g: string, idx: number) => (
                              <span
                                key={idx}
                                className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getGeneColor(g)}`}
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          patientId: patient.id,
                          currentStatus: isCollected,
                          patientName: patient.full_name || 'Volunteer'
                        });
                      }}
                      disabled={isActionLoading}
                      className={`w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${isCollected
                        ? 'bg-[#027A48] hover:bg-[#026c3f] text-white'
                        : 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white shadow-[0_4px_12px_rgba(96,87,215,0.15)]'
                        }`}
                    >
                      {isActionLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isCollected ? (
                        <>
                          <CheckCircle2 size={14} /> Collected (Undo)
                        </>
                      ) : (
                        'Mark Sample Collected'
                      )}
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

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
                    <div className="w-10 h-10 rounded-full bg-[#F4F4F2] border border-[#D4D4CE] flex items-center justify-center text-[#1A1A19] font-bold shadow-inner shrink-0">
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
                      {editedGeneType.split(/,\s*(?![^(]*\))/).map(g => g.trim()).filter(Boolean).map((g, idx) => (
                        <span
                          key={idx}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border leading-none cursor-pointer hover:opacity-80 transition-opacity ${getGeneColor(g)}`}
                          onClick={() => {
                            const genes = editedGeneType.split(/,\s*(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
                            setEditedGeneType(genes.filter(x => x !== g).join(', '));
                          }}
                        >
                          {g}
                          <X size={12} className="opacity-70 hover:opacity-100" />
                        </span>
                      ))}

                      {/* Unselected Genes */}
                      {[
                        { short: 'ACTN3', full: 'Muscle Power vs Endurance (ACTN3,ACE)' },
                        { short: 'EDAR', full: 'Hair Thickness & Root Structure (EDAR,FGFR2)' },
                        { short: 'CYP1A2', full: 'Caffeine Response (CYP1A2,ADORA2A)' }
                      ].filter(ag => !(editedGeneType || '').toUpperCase().includes(ag.short)).map((ag, idx) => (
                        <span
                          key={`add-${idx}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-[#D4D4CE] text-[#8B8B86] leading-none cursor-pointer hover:bg-[#F4F4F2] hover:text-[#5A5A55] transition-all"
                          onClick={() => {
                            const genes = editedGeneType ? editedGeneType.split(/,\s*(?![^(]*\))/).map(x => x.trim()).filter(Boolean) : [];
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

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#E8E8E5]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#ECFDF3] mb-4 mx-auto">
                {confirmDialog.currentStatus ? (
                  <Clock className="w-6 h-6 text-[#B87A00]" />
                ) : (
                  <Mail className="w-6 h-6 text-[#027A48]" />
                )}
              </div>
              <h3 className="text-xl font-bold text-center text-[#1A1A19] mb-2">
                {confirmDialog.currentStatus ? 'Undo Collection?' : 'Confirm Collection'}
              </h3>
              <p className="text-center text-sm text-[#8B8B86] mb-8">
                {confirmDialog.currentStatus
                  ? `Are you sure you want to mark ${confirmDialog.patientName}'s sample as pending?`
                  : `Are you sure you want to mark ${confirmDialog.patientName}'s sample as collected? An email will be dispatched automatically.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialog({ isOpen: false, patientId: null, currentStatus: false, patientName: '' })}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-[#5A5A55] bg-[#F4F4F2] hover:bg-[#E8E8E5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmDialog.patientId !== null) {
                      handleToggleSampleCollected(confirmDialog.patientId, confirmDialog.currentStatus);
                    }
                    setConfirmDialog({ isOpen: false, patientId: null, currentStatus: false, patientName: '' });
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white transition-colors shadow-sm ${confirmDialog.currentStatus
                    ? 'bg-[#B87A00] hover:bg-[#996600]'
                    : 'bg-[#027A48] hover:bg-[#026c3f]'
                    }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
