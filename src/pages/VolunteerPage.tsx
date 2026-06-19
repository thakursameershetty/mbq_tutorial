import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Clock, User, Phone, Mail, Calendar, Activity, Loader2 } from 'lucide-react';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

export default function VolunteerPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'collected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    const nameMatch = patient.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = patient.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const usernameMatch = patient.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = patient.phone?.includes(searchQuery);
    
    const matchesSearch = nameMatch || emailMatch || usernameMatch || phoneMatch;
    
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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D]" />
            <input
              type="text"
              placeholder="Search by name, email, id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-sm rounded-2xl pl-10 pr-4 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 transition-all shadow-sm placeholder:text-[#A0A09D] font-medium"
            />
          </div>

          <div className="flex bg-white/60 backdrop-blur-xl p-1 rounded-2xl border border-[#E8E8E5] shadow-sm w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-[#1A1A19] text-white shadow-sm' : 'text-[#8B8B86] hover:text-[#1A1A19]'
              }`}
            >
              All ({patients.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-[#B87A00] text-white shadow-sm'
                  : 'text-[#8B8B86] hover:text-[#B87A00]'
              }`}
            >
              Pending ({patients.filter((p) => !p.sample_collected).length})
            </button>
            <button
              onClick={() => setStatusFilter('collected')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === 'collected'
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
                const genesList = patient.gene_type ? patient.gene_type.split(', ') : [];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.05, 0.5) }}
                    key={patient.id}
                    className={`bg-white/70 backdrop-blur-2xl border ${
                      isCollected ? 'border-[#027A48]/20 bg-white/80' : 'border-white/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)]'
                    } rounded-3xl p-6 transition-all duration-300 hover:shadow-md hover:bg-white flex flex-col justify-between min-h-[320px]`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4F4F2] to-[#E8E8E5] border border-[#D4D4CE] flex items-center justify-center text-sm font-bold text-[#1A1A19] shadow-inner shrink-0">
                          {patient.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
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
                                className="inline-block px-2.5 py-1 bg-[#6057D7]/8 text-[#6057D7] rounded-lg text-[10px] font-bold border border-[#6057D7]/10"
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
                      onClick={() => handleToggleSampleCollected(patient.id, isCollected)}
                      disabled={isActionLoading}
                      className={`w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
                        isCollected
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
    </motion.div>
  );
}
