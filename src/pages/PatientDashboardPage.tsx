import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Activity, LogOut } from 'lucide-react';
import { OrderTracking } from '@/components/ui/order-tracking';
import { useNavigate } from 'react-router-dom';
import { triggerHaptic } from '@/lib/utils';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

export default function PatientDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem('userProfile');
    if (data) {
      const parsed = JSON.parse(data);
      setUser(parsed);

      // Fetch latest profile to keep tracking updated
      const fetchLatestProfile = () => {
        fetch(`/api/users/${parsed.id}`)
          .then(res => res.json())
          .then(latestData => {
            if (!latestData.error) {
              setUser(latestData);
              localStorage.setItem('userProfile', JSON.stringify(latestData));
            }
          })
          .catch(err => console.error("Error fetching latest profile:", err));
      };

      fetchLatestProfile();
      const interval = setInterval(fetchLatestProfile, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const renderField = (label: string, path: string[], block = false) => {
    const getVal = (obj: any, p: string[]) => p.reduce((acc, k) => (acc ? acc[k] : ''), obj);
    const val = getVal(user, path);

    if (block) {
      return (
        <div className="text-sm">
          <span className="text-[#8B8B86] block mb-0.5">{label}</span>
          <span className="font-medium text-[#1A1A19]">{val || 'N/A'}</span>
        </div>
      );
    }

    return (
      <div className="text-sm flex flex-col sm:flex-row sm:items-center">
        <span className="text-[#8B8B86] sm:w-20 flex-shrink-0">{label}:</span>
        <span className="font-medium text-[#1A1A19] mt-1 sm:mt-0">{val || 'N/A'}</span>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="w-full flex justify-center mt-20">
        <p className="text-[#8B8B86]">Please log in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto mt-8 sm:mt-12 px-4 pb-12"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 sm:p-10 border border-white/60 shadow-[0_8px_32px_rgb(0,0,0,0.04)] mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-4">
        <div className="flex-1 w-full min-w-0">
          <h1 className="text-3xl font-bold text-[#1A1A19] tracking-tight mb-2 break-words">Hello, {user.full_name?.toUpperCase()}</h1>
          <p className="text-[#8B8B86] text-sm">User ID: {formatUserId(user.id)}</p>
        </div>
        <div className="w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowTracking(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#6057D7] text-white rounded-full text-sm font-medium hover:bg-[#4B44B3] transition-colors shadow-sm cursor-pointer"
            >
              <Activity size={16} />
              Track Updates
            </button>
            {user.report_verified && user.report_url && (
              <a
                href={user.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#027A48] text-white rounded-full text-sm font-medium hover:bg-[#026c3f] transition-colors shadow-sm"
              >
                <FileText size={16} />
                Download your report
              </a>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-full text-sm font-medium hover:bg-red-100 transition-colors shadow-sm cursor-pointer"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gene Profile (Existing - Read Only) */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Genomic Profile</h3>
          <div className="bg-[#F7F7F5] rounded-xl p-4 border border-[#E8E8E5]">
            <p className="text-[#5A5A55] text-sm mb-1">Tested Gene</p>
            <p className="text-lg font-bold text-[#1A1A19]">{user.gene_type}</p>
          </div>
        </div>

        {/* Dynamic AI Profile Sections */}
        {user.phenotypic_analysis && (
          <>
            {/* Personal Profile */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Personal Profile</h3>
              <div className="space-y-3">
                {renderField('Age', ['phenotypic_analysis', 'personal_profile', 'age'])}
                {renderField('Mobile', ['phenotypic_analysis', 'personal_profile', 'mobile'])}
                {renderField('Email', ['phenotypic_analysis', 'personal_profile', 'email'])}
                {renderField('Activity', ['phenotypic_analysis', 'personal_profile', 'dailyActivity'])}
                {renderField('Sleep', ['phenotypic_analysis', 'personal_profile', 'sleepTiming'])}
              </div>
            </div>

            {/* Caffeine Response */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Caffeine & Stimulant Response</h3>
              <div className="space-y-3">
                {renderField('Sleep Impact', ['phenotypic_analysis', 'caffeine_response', 'sleepImpact'], true)}
                {renderField('Duration', ['phenotypic_analysis', 'caffeine_response', 'durationOfEffect'], true)}
                {renderField('Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity'], true)}
                {renderField('Tolerance', ['phenotypic_analysis', 'caffeine_response', 'tolerance'], true)}
              </div>
            </div>

            {/* Hair & Scalp */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Hair & Scalp Characteristics</h3>
              <div className="space-y-3">
                {renderField('Thickness', ['phenotypic_analysis', 'hair_scalp_characteristics', 'thickness'], true)}
                {renderField('Texture', ['phenotypic_analysis', 'hair_scalp_characteristics', 'texture'], true)}
                {renderField('Scalp Type', ['phenotypic_analysis', 'hair_scalp_characteristics', 'scalpType'], true)}
                {renderField('Sweating', ['phenotypic_analysis', 'hair_scalp_characteristics', 'sweating'], true)}
                {renderField('Stability', ['phenotypic_analysis', 'hair_scalp_characteristics', 'stability'], true)}
              </div>
            </div>

            {/* Physical Performance */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)] md:col-span-2">
              <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-4">Physical Performance & Recovery</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Power', ['phenotypic_analysis', 'physical_performance', 'power'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Endurance', ['phenotypic_analysis', 'physical_performance', 'endurance'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5]">
                  {renderField('Recovery', ['phenotypic_analysis', 'physical_performance', 'recovery'], true)}
                </div>
                <div className="bg-[#F7F7F5] p-3 rounded-lg border border-[#E8E8E5] sm:col-span-2 lg:col-span-1">
                  {renderField('Training Preference', ['phenotypic_analysis', 'physical_performance', 'trainingPreference'], true)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Track Updates Modal */}
      <AnimatePresence>
        {showTracking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full border border-[#E8E8E5] relative"
              onAnimationStart={() => triggerHaptic('medium')}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#1A1A19] flex items-center gap-2">
                  <Activity className="text-[#6057D7] w-5 h-5" />
                  Your Profile Journey
                </h3>
                <button
                  onClick={() => setShowTracking(false)}
                  className="p-1.5 hover:bg-[#F7F7F5] rounded-full text-[#8B8B86] hover:text-[#1A1A19] transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-[#F7F7F5] rounded-2xl p-4 mb-6 text-xs text-[#5A5A55] border border-[#E8E8E5]">
                <div className="flex justify-between items-center mb-1">
                  <span>Participant ID:</span>
                  <span className="font-mono font-bold text-[#1A1A19]">{formatUserId(user.id)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Email Registered:</span>
                  <span className="font-semibold text-[#1A1A19]">{user.email}</span>
                </div>
              </div>

              <div className="pl-2">
                <OrderTracking
                  steps={[
                    {
                      name: "User Registered",
                      timestamp: (() => {
                        const date = new Date(user.created_at || (user.status_timestamps?.registered));
                        return isNaN(date.getTime()) ? 'Completed' : date.toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                        }).replace(',', '');
                      })(),
                      isCompleted: true
                    },
                    {
                      name: "Sample Collected",
                      timestamp: user.status_timestamps?.collected
                        ? new Date(user.status_timestamps.collected).toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                        }).replace(',', '')
                        : "Pending",
                      isCompleted: !!user.sample_collected
                    },
                    {
                      name: "Sample Received",
                      timestamp: user.status_timestamps?.received
                        ? new Date(user.status_timestamps.received).toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                        }).replace(',', '')
                        : "Pending",
                      isCompleted: !!user.sample_received
                    },
                    {
                      name: "Report Generated",
                      timestamp: user.status_timestamps?.generated
                        ? (user.report_verified
                          ? new Date(user.status_timestamps.generated).toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                          }).replace(',', '')
                          : "(Waiting for Admin Approval)")
                        : "Pending",
                      isCompleted: !!user.report_generated
                    }
                  ]}
                />
              </div>

              {user.report_verified && user.report_url && (
                <div className="mt-6 pt-4 border-t border-[#E8E8E5]">
                  <a
                    href={user.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#027A48] hover:bg-[#026c3f] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 text-center no-underline"
                  >
                    <FileText size={18} />
                    Download your report
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-sm w-full border border-[#E8E8E5] text-center"
            >
              <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <LogOut size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Confirm Logout</h3>
              <p className="text-[#8B8B86] text-sm mb-6">Are you sure you want to log out of your account?</p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-[#F7F7F5] hover:bg-[#E8E8E5] text-[#5A5A55] rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('userProfile');
                    navigate('/login');
                  }}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

