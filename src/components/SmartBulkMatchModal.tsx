import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2, Loader2, FileSpreadsheet, CheckCircle2, User, Search } from 'lucide-react';

interface SmartBulkMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatch: (matchedIds: string) => void;
}

interface MatchedUser {
  id: number;
  full_name: string;
  username: string;
  sample_received: boolean;
}

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  return `MBQ-${isNaN(num) ? '000' : num.toString().padStart(3, '0')}`;
};

export default function SmartBulkMatchModal({ isOpen, onClose, onMatch }: SmartBulkMatchModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[] | null>(null);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Reset state when modal is closed
  const handleClose = () => {
    setPastedText('');
    setMatchedUsers(null);
    setUnmatchedNames([]);
    setError('');
    onClose();
  };

  const handleMatch = async () => {
    if (!pastedText.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/smart-bulk-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to match data');
      }

      if (data.matched_users && data.matched_users.length > 0) {
        setMatchedUsers(data.matched_users);
        setUnmatchedNames(data.unmatched_names || []);
      } else {
        if (data.unmatched_names && data.unmatched_names.length > 0) {
          setUnmatchedNames(data.unmatched_names);
          setMatchedUsers([]);
        } else {
          setError('No confident matches found. Please try refining your input.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during matching');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkReceived = async (userId: number) => {
    setProcessingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/sample-received`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleReceived: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update local state
      setMatchedUsers(prev =>
        prev ? prev.map(u => u.id === userId ? { ...u, sample_received: true } : u) : null
      );
    } catch (err) {
      console.error(err);
      // Optional: show a toast or local error here
    } finally {
      setProcessingId(null);
    }
  };

  const handleApplyFilter = () => {
    if (matchedUsers) {
      const formattedIds = matchedUsers.map(u => formatUserId(u.id)).join(', ');
      onMatch(formattedIds);
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-[#1A1A19]/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E8E8E5]"
          >
            {/* Header */}
            <div className="flex-none p-6 sm:p-8 border-b border-[#E8E8E5] bg-gradient-to-r from-[#F9F9F8] to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <Wand2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#1A1A19]">AI Smart Match</h2>
                    <p className="text-sm text-[#8B8B86] mt-1">
                      {matchedUsers ? `Found ${matchedUsers.length} matching profiles` : 'Paste lab data to auto-match with your database'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 text-[#8B8B86] hover:text-[#1A1A19] hover:bg-[#F9F9F8] rounded-full transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#F9F9F8]">
              {!matchedUsers ? (
                // STAGE 1: Paste Text
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-purple-50 text-purple-900 rounded-2xl border border-purple-100">
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed">
                      <strong>How it works:</strong> Paste rough data from emails or spreadsheets (even if names have typos or formatting differs). Our AI will analyze the list and select the exact matching profiles from your database.
                    </p>
                  </div>

                  <div className="relative">
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="e.g. Dr.V.V Ramachandra Rao, test@example.com..."
                      className="w-full h-48 p-4 bg-white border border-[#E8E8E5] rounded-2xl focus:ring-4 focus:ring-purple-500/15 focus:border-purple-500/30 transition-all outline-none resize-none text-[#1A1A19] placeholder:text-[#A0A09D]"
                      disabled={isLoading}
                    />
                    {!pastedText && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#A0A09D] gap-2 opacity-60">
                        <FileSpreadsheet size={32} />
                        <span className="text-sm font-medium">Paste names or identities here</span>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                // STAGE 2: Matched Users List & Unmatched Names
                <div className="space-y-6">
                  {matchedUsers && matchedUsers.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-[#1A1A19]">Matched ({matchedUsers.length})</h3>
                      {matchedUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#E8E8E5] shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <User size={18} />
                            </div>
                            <div>
                              <h4 className="font-bold text-[#1A1A19]">{user.full_name || 'Unknown Name'}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-[#8B8B86] bg-[#F9F9F8] px-2 py-0.5 rounded-md border border-[#E8E8E5]">
                                  {formatUserId(user.id)}
                                </span>
                                {user.username && (
                                  <span className="text-xs text-[#8B8B86] truncate max-w-[150px]">@{user.username}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 ml-4">
                            {user.sample_received ? (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                                <CheckCircle2 size={16} />
                                <span>Received</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleMarkReceived(user.id)}
                                disabled={processingId === user.id}
                                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px] cursor-pointer"
                              >
                                {processingId === user.id ? <Loader2 size={16} className="animate-spin" /> : 'Mark Received'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {unmatchedNames && unmatchedNames.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-red-600">Not Found ({unmatchedNames.length})</h3>
                      <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4">
                        <ul className="list-disc list-inside space-y-1">
                          {unmatchedNames.map((name, idx) => (
                            <li key={idx} className="text-sm text-red-800">{name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-none p-6 border-t border-[#E8E8E5] bg-white flex justify-end gap-3">
              {!matchedUsers ? (
                <>
                  <button
                    onClick={handleClose}
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-full font-semibold text-[#1A1A19] bg-[#F9F9F8] hover:bg-[#E8E8E5] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMatch}
                    disabled={!pastedText.trim() || isLoading}
                    className="px-6 py-2.5 rounded-full font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Analyze & Match
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMatchedUsers(null);
                      setUnmatchedNames([]);
                    }}
                    className="px-6 py-2.5 rounded-full font-semibold text-[#1A1A19] bg-[#F9F9F8] hover:bg-[#E8E8E5] transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleApplyFilter}
                    className="px-6 py-2.5 rounded-full font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-purple-200"
                  >
                    <Search size={16} />
                    Filter Dashboard
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
