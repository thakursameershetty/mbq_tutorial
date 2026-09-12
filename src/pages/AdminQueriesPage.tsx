import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Phone, Mail, MessageCircleQuestion, Loader2, Trash2, Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ id: number, name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchQueries = (silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/queries')
      .then((res) => res.json())
      .then((data) => setQueries(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error fetching queries:', err))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchQueries();
    const interval = setInterval(() => fetchQueries(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setActionLoading(deleteDialog.id);
    try {
      const response = await fetch(`/api/queries/${deleteDialog.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setQueries((prev) => prev.filter((q) => q.id !== deleteDialog.id));
      } else {
        alert(data.error || 'Failed to delete query');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed');
    } finally {
      setActionLoading(null);
      setDeleteDialog(null);
    }
  };

  const formatDate = (dateInput?: string | null) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '') + ' IST';
  };

  const filteredQueries = queries.filter((q) => {
    const searchTerms = searchQuery
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (searchTerms.length === 0) return true;

    return searchTerms.some((term) => {
      const nameMatch = q.name?.toLowerCase().includes(term);
      const emailMatch = q.email?.toLowerCase().includes(term);
      const phoneMatch = q.phone?.includes(term);
      const mbqMatch = q.mbq_id?.toLowerCase().includes(term);
      const messageMatch = q.message?.toLowerCase().includes(term);
      return nameMatch || emailMatch || phoneMatch || mbqMatch || messageMatch;
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mx-auto"
    >
      <Link
        to="/admin-verify"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5A55] hover:text-[#1A1A19] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Verify Profiles
      </Link>

      {/* Header Section */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-2">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-[#E8E8E5] text-xs font-semibold text-[#6057D7] tracking-widest uppercase mb-2 shadow-sm backdrop-blur-md"
          >
            <MessageCircleQuestion className="w-3.5 h-3.5" />
            Admin Portal
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1A1A19]">Patient Queries</h2>
          <p className="text-[#8B8B86] text-base font-medium max-w-xl leading-relaxed">
            Help and feedback messages submitted by patients from their dashboard.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A09D] z-10 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, id, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/60 backdrop-blur-xl border border-[#E8E8E5] text-sm rounded-2xl pl-4 pr-10 py-2.5 outline-none focus:ring-4 focus:ring-[#6057D7]/15 focus:border-[#6057D7]/30 transition-all shadow-sm placeholder:text-[#A0A09D] font-medium"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#6057D7]/5 to-[#3FC2AC]/5 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-multiply" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#6057D7] mb-4" size={40} />
            <p className="text-[#8B8B86] text-sm font-medium">Fetching queries...</p>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="text-center py-20 bg-white/40 backdrop-blur-md border border-[#E8E8E5] rounded-3xl p-8">
            <MessageCircleQuestion className="w-12 h-12 text-[#A0A09D] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#1A1A19]">No queries yet</h3>
            <p className="text-sm text-[#8B8B86] mt-1">Help/feedback messages submitted by patients will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {filteredQueries.map((q, i) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  key={q.id}
                  className="bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgb(0,0,0,0.03)] rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:shadow-md hover:bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                        <h3 className="font-bold text-[#1A1A19] text-base">{q.name || 'Unknown'}</h3>
                        {q.mbq_id && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#6057D7] bg-[#EDEBFB] px-2 py-0.5 rounded-full">
                            <User size={11} /> {q.mbq_id}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#A0A09D]">
                          <Calendar size={11} /> {formatDate(q.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-3 text-xs text-[#5A5A55]">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-[#8B8B86]" />
                          <span>{q.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-[#8B8B86]" />
                          <span>{q.phone || 'N/A'}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[#1A1A19] bg-[#F7F7F5] border border-[#E8E8E5] rounded-xl p-3.5 whitespace-pre-wrap">
                        {q.message}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteDialog({ id: q.id, name: q.name || 'this user' })}
                      disabled={actionLoading === q.id}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-full transition-colors border border-red-100 shrink-0 disabled:opacity-50"
                      title="Delete Query"
                    >
                      {actionLoading === q.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteDialog && (
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4 mx-auto">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#1A1A19] mb-2">Delete Query?</h3>
              <p className="text-center text-sm text-[#8B8B86] mb-8">
                Are you sure you want to delete this query from {deleteDialog.name}? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteDialog(null)}
                  disabled={actionLoading === deleteDialog.id}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-[#5A5A55] bg-[#F4F4F2] hover:bg-[#E8E8E5] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === deleteDialog.id}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {actionLoading === deleteDialog.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
