import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Activity, LogOut, RefreshCw, AlertCircle, Sparkles, Users, ArrowLeft } from 'lucide-react';
import { OrderTracking } from '@/components/ui/order-tracking';
import { useNavigate, Link } from 'react-router-dom';
import { triggerHaptic } from '@/lib/utils';
import PatientSurveyModal from '@/components/PatientSurveyModal';
import AIReportModal from '@/components/AIReportModal';

const formatUserId = (id: any) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

export default function PatientDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [selectedAIReport, setSelectedAIReport] = useState<{ geneName: string, content: string } | null>(null);
  const [fetchDataLoading, setFetchDataLoading] = useState(false);
  const [fetchDataStatus, setFetchDataStatus] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
  const [hasMultipleProfiles, setHasMultipleProfiles] = useState(false);

  // Switch Accounts state
  const [showSwitchAccountsModal, setShowSwitchAccountsModal] = useState(false);
  const [switchAccountsProfiles, setSwitchAccountsProfiles] = useState<any[]>([]);
  const [switchingAccountsLoading, setSwitchingAccountsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem('userProfile');
    if (data) {
      const parsed = JSON.parse(data);
      setUser(parsed);

      if (parsed.email) {
        fetch(`/api/users/by-email/${encodeURIComponent(parsed.email)}`)
          .then(res => res.json())
          .then(profiles => {
            if (Array.isArray(profiles) && profiles.length > 1) {
              setHasMultipleProfiles(true);
            }
          })
          .catch(err => console.error("Error fetching profiles count:", err));
      }

      // Fetch latest profile to keep tracking updated
      const fetchLatestProfile = () => {
        fetch(`/api/users/${parsed.id}`)
          .then(res => res.json())
          .then(latestData => {
            if (!latestData.error) {
              setUser(latestData);
              localStorage.setItem('userProfile', JSON.stringify(latestData));
            } else if (latestData.error === 'User not found.') {
              localStorage.removeItem('userProfile');
              setUser(null);
              navigate('/login');
            }
          })
          .catch(err => console.error("Error fetching latest profile:", err));
      };

      fetchLatestProfile();
      const interval = setInterval(fetchLatestProfile, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleFetchData = async (force = false) => {
    if (!user?.id) return;
    setFetchDataLoading(true);
    setFetchDataStatus(null);
    try {
      const res = await fetch(`/api/users/${user.id}/fetch-phenotypic-data?force=${force}`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 429) {
        setFetchDataStatus({ type: 'warning', message: data.message || 'Gemini API rate-limited. Try again in a minute.' });
      } else if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('userProfile', JSON.stringify(data.user));
        setFetchDataStatus({ type: 'success', message: 'Phenotypic data fetched successfully!' });
        setTimeout(() => setFetchDataStatus(null), 4000);
      } else {
        setFetchDataStatus({ type: 'error', message: data.message || 'Could not fetch data. Please try again.' });
      }
    } catch (err) {
      setFetchDataStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setFetchDataLoading(false);
    }
  };

  const handleSwitchAccounts = async () => {
    if (!user?.email) return;
    setSwitchingAccountsLoading(true);
    try {
      const response = await fetch(`/api/users/by-email/${encodeURIComponent(user.email)}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data) && data.length > 1) {
        setSwitchAccountsProfiles(data);
        setShowSwitchAccountsModal(true);
      } else {
        setFetchDataStatus({ type: 'warning', message: 'No other profiles found for this email.' });
        setTimeout(() => setFetchDataStatus(null), 4000);
      }
    } catch (err) {
      console.error('Error fetching profiles', err);
      setFetchDataStatus({ type: 'error', message: 'Failed to fetch profiles.' });
      setTimeout(() => setFetchDataStatus(null), 4000);
    } finally {
      setSwitchingAccountsLoading(false);
    }
  };

  const renderField = (label: string, path: string[], block = false) => {
    const getVal = (obj: any, p: string[]) => p.reduce((acc, k) => (acc ? acc[k] : ''), obj);
    let val = getVal(user, path);

    if (typeof val === 'object' && val !== null) {
      const values = Object.values(val).filter(Boolean);
      if (label === 'Age' && values.length >= 2) {
        val = `${values[0]}yrs (${values[1]})`;
      } else {
        val = values.join(' - ');
      }
    }

    if (block) {
      return (
        <div className="text-sm">
          <span className="text-[#8B8B86] block mb-0.5">{label}</span>
          <span className="font-medium text-[#1A1A19]">{val || 'N/A'}</span>
        </div>
      );
    }

    return (
      <div className="text-sm flex flex-row items-start sm:items-center justify-between sm:justify-start gap-4">
        <span className="text-[#8B8B86] w-auto sm:w-20 flex-shrink-0 pt-0.5 sm:pt-0">{label}:</span>
        <span className="font-medium text-[#1A1A19] text-right sm:text-left break-all sm:break-normal">{val || 'N/A'}</span>
      </div>
    );
  };

  const getGenePills = (geneString: string) => {
    if (!geneString) return null;
    const genes = geneString.split(', ');
    return (
      <div className="flex flex-col gap-2">
        {genes.map((gene, idx) => {
          let styleClass = "border-[#E8E8E5] text-[#1A1A19] bg-white";
          if (gene.includes("Caffeine")) {
            styleClass = "border-[#FDE08B] text-[#B45309] bg-[#FFFBEB]";
          } else if (gene.includes("Muscle Power")) {
            styleClass = "border-[#BFDBFE] text-[#1D4ED8] bg-[#EFF6FF]";
          } else if (gene.includes("Hair Thickness")) {
            styleClass = "border-[#E9D5FF] text-[#7E22CE] bg-[#FAF5FF]";
          }
          return (
            <div key={idx} className={`px-4 py-1.5 rounded-full border font-medium text-sm tracking-wide w-fit shadow-sm ${styleClass}`}>
              {gene}
            </div>
          );
        })}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="w-full flex justify-center mt-20">
        <p className="text-[#8B8B86]">Please <Link to="/login" className="text-[#6057D7] hover:underline">log in</Link> to view your dashboard.</p>
      </div>
    );
  }

  const dashboardActions = user ? (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-6">
      <button
        onClick={() => setShowTracking(true)}
        className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#6057D7] text-white rounded-full text-xs sm:text-sm font-medium hover:bg-[#4B44B3] transition-colors shadow-sm cursor-pointer"
      >
        <Activity size={16} />
        Track Updates
      </button>
      <button
        onClick={() => handleFetchData(true)}
        disabled={fetchDataLoading}
        className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-60 rounded-full text-xs sm:text-sm font-medium transition-colors shadow-sm cursor-pointer"
      >
        <RefreshCw size={16} className={fetchDataLoading ? 'animate-spin' : ''} />
        Resync
      </button>
      {!user.phenotypic_analysis && (
        <button
          onClick={() => handleFetchData(false)}
          disabled={fetchDataLoading}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-full text-xs sm:text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw size={16} className={fetchDataLoading ? 'animate-spin' : ''} />
          {fetchDataLoading ? 'Fetching...' : 'Fetch Data'}
        </button>
      )}
      {user.report_verified && user.reports && Object.keys(user.reports).length > 0 ? (
        Object.entries(user.reports).map(([geneName, reportData]: [string, any]) => (
          <div key={geneName} className="flex gap-2">
            <a
              href={reportData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#027A48] text-white rounded-full text-xs sm:text-sm font-medium hover:bg-[#026c3f] transition-colors shadow-sm"
            >
              <FileText size={16} />
              View {geneName} PDF
            </a>
            {reportData.ai_report && (
              <button
                onClick={() => setSelectedAIReport({ geneName, content: reportData.ai_report })}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-100 text-amber-700 rounded-full text-xs sm:text-sm font-medium hover:bg-amber-200 transition-colors shadow-sm cursor-pointer"
              >
                <Sparkles size={16} />
                AI Insights
              </button>
            )}
          </div>
        ))
      ) : user.report_verified && user.report_url ? (
        <a
          href={user.report_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#027A48] text-white rounded-full text-xs sm:text-sm font-medium hover:bg-[#026c3f] transition-colors shadow-sm"
        >
          <FileText size={16} />
          View Legacy Report
        </a>
      ) : null}
      {hasMultipleProfiles && (
        <button
          onClick={handleSwitchAccounts}
          disabled={switchingAccountsLoading}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#F0F0ED] text-[#1A1A19] rounded-full text-xs sm:text-sm font-medium hover:bg-[#E8E8E5] transition-colors shadow-sm cursor-pointer"
        >
          <Users size={16} className={switchingAccountsLoading ? 'animate-pulse' : ''} />
          Switch
        </button>
      )}
      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-red-50 text-red-600 border border-red-100 rounded-full text-xs sm:text-sm font-medium hover:bg-red-100 transition-colors shadow-sm cursor-pointer"
      >
        <LogOut size={16} />
        Logout
      </button>
    </div>
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-4xl mx-auto mt-8 sm:mt-12 px-4 pb-12"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 sm:p-10 border border-white/60 shadow-[0_8px_32px_rgb(0,0,0,0.04)] mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-4">
        <div className="flex-1 w-full min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A19] tracking-tight mb-2 break-words">Hello, {user.full_name?.toUpperCase()}</h1>
          <p className="text-[#8B8B86] text-sm">User ID: {formatUserId(user.id)}</p>
          {dashboardActions}
        </div>
      </div>

      {/* Fetch Data status toast */}
      <AnimatePresence>
        {fetchDataStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium border ${fetchDataStatus.type === 'success'
              ? 'bg-[#ECFDF3] text-[#027A48] border-[#027A48]/20'
              : fetchDataStatus.type === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-600 border-red-100'
              }`}
          >
            <AlertCircle size={16} className="shrink-0" />
            {fetchDataStatus.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questionnaire Retake Banner */}
      {user.survey_requested && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-amber-500 rounded-2xl p-6 sm:px-6 sm:py-4 w-full shadow-md"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-4 w-full text-left">
            <span className="bg-amber-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full whitespace-nowrap shadow-sm mb-1 sm:mb-0">
              Action Required
            </span>
            <p className="text-sm font-medium text-white flex-1 mb-2 sm:mb-0">
              Please submit your answers again so that you can get your report
            </p>
            <button
              onClick={() => setShowSurveyModal(true)}
              className="inline-flex items-center gap-1 font-bold text-amber-700 bg-white pl-5 pr-4 py-2.5 sm:py-2 rounded-full hover:bg-white/90 transition-colors shadow-sm whitespace-nowrap shrink-0 self-end sm:self-auto"
            >
              Answer Now <span className="material-symbols-rounded text-[20px]" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Null phenotypic data banner */}
      {!user.phenotypic_analysis && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Phenotypic data is missing</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your profile data couldn't be fetched during registration (likely due to AI API limits). Click "Fetch Data" to retry now.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleFetchData(false)}
            disabled={fetchDataLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={13} className={fetchDataLoading ? 'animate-spin' : ''} />
            {fetchDataLoading ? 'Fetching...' : 'Fetch Data'}
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gene Profile (Existing - Read Only) */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-6 rounded-[20px] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <h3 className="text-[#8B8B86] text-xs font-semibold tracking-wider uppercase mb-6">Genomic Profile</h3>
          {getGenePills(user.gene_type)}
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
                {typeof user.phenotypic_analysis.caffeine_response.sensitivity === 'object' && user.phenotypic_analysis.caffeine_response.sensitivity !== null ? (
                  <>
                    {renderField('Physical Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity', 'physicalSensitivity'], true) ||
                      renderField('Physical Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity', 'physical'], true)}
                    {renderField('Small Dose Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity', 'smallDoseSensitivity'], true) ||
                      renderField('Small Dose Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity', 'smallDose'], true)}
                  </>
                ) : (
                  renderField('Sensitivity', ['phenotypic_analysis', 'caffeine_response', 'sensitivity'], true)
                )}
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

              {user.report_verified && user.reports && Object.keys(user.reports).length > 0 ? (
                <div className="mt-6 pt-4 border-t border-[#E8E8E5] flex flex-col gap-3">
                  {Object.entries(user.reports).map(([geneName, reportData]: [string, any]) => (
                    <div key={geneName} className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={reportData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3.5 bg-[#027A48] hover:bg-[#026c3f] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 text-center no-underline"
                      >
                        <FileText size={18} />
                        View {geneName} PDF
                      </a>
                      {reportData.ai_report && (
                        <button
                          onClick={() => setSelectedAIReport({ geneName, content: reportData.ai_report })}
                          className="flex-1 py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          <Sparkles size={18} />
                          AI Insights
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : user.report_verified && user.report_url ? (
                <div className="mt-6 pt-4 border-t border-[#E8E8E5]">
                  <a
                    href={user.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#027A48] hover:bg-[#026c3f] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 text-center no-underline"
                  >
                    <FileText size={18} />
                    View Legacy Report
                  </a>
                </div>
              ) : null}
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

      {/* Modals */}
      {user && (
        <PatientSurveyModal
          isOpen={showSurveyModal}
          onClose={() => setShowSurveyModal(false)}
          userId={user.id}
          geneType={user.gene_type}
          onComplete={() => {
            // Optimistically update the UI to remove the banner
            setUser((prev: any) => ({ ...prev, survey_requested: false }));
          }}
        />
      )}

      {/* Switch Accounts Modal */}
      <AnimatePresence>
        {showSwitchAccountsModal && switchAccountsProfiles.length > 1 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSwitchAccountsModal(false)}
              className="absolute inset-0 bg-[#1A1A19]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[#1A1A19]">Switch Accounts</h3>
                  <p className="text-[#8B8B86] text-sm mt-1">Select a profile to continue.</p>
                </div>
                <button
                  onClick={() => setShowSwitchAccountsModal(false)}
                  className="p-2 text-[#8B8B86] hover:bg-[#F0F0ED] rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {switchAccountsProfiles.map((profile, idx) => {
                  const isCurrentProfile = profile.id === user.id;
                  return (
                    <button
                      key={profile.id || idx}
                      onClick={() => {
                        if (!isCurrentProfile) {
                          localStorage.setItem('userProfile', JSON.stringify(profile));
                          setUser(profile);
                          setShowSwitchAccountsModal(false);
                          window.scrollTo(0, 0);
                        }
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group ${isCurrentProfile
                        ? 'border-[#6057D7] bg-[#F9F9F8]'
                        : 'border-[#E8E8E5] hover:border-[#6057D7] hover:bg-[#F9F9F8]'
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0 ${isCurrentProfile
                        ? 'bg-[#EBE9FC] text-[#6057D7]'
                        : 'bg-[#F0F0ED] text-[#8B8B86] group-hover:bg-[#EBE9FC] group-hover:text-[#6057D7]'
                        }`}>
                        <span className="font-semibold text-lg">{profile.full_name?.charAt(0) || 'U'}</span>
                      </div>
                      <div className="overflow-hidden flex-1">
                        <h4 className="font-bold text-[#1A1A19] truncate">{profile.full_name}</h4>
                        <p className="text-sm text-[#8B8B86] truncate">@{profile.username}</p>
                      </div>
                      {isCurrentProfile && (
                        <div className="text-xs font-semibold text-[#6057D7] bg-[#EBE9FC] px-2 py-1 rounded-md">
                          Active
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AIReportModal
        isOpen={!!selectedAIReport}
        onClose={() => setSelectedAIReport(null)}
        markdownContent={selectedAIReport?.content || ''}
        geneName={selectedAIReport?.geneName || ''}
      />
    </motion.div>
  );
}

