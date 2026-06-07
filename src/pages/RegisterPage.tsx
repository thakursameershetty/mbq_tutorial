import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../theme';

const TUTORIAL_STEPS = [
  { title: "Before You Begin", desc: ["Do not eat, drink, smoke, or chew gum for at least 30 minutes before collecting the sample.", "Wash your hands thoroughly."] },
  { title: "Step 1: Open the Swab", desc: ["Carefully open the sterile swab packet.", "Hold the swab by the handle. Do not touch the soft cotton tip."] },
  { title: "Step 2: Swab the Left Cheek", desc: ["Place the swab inside your mouth.", "Rub the swab firmly against the inside of your left cheek.", "Continue for 15–20 seconds minimum.", "Avoid touching your tongue."], timer: 20 },
  { title: "Step 3: Swab the Right Cheek", desc: ["Using the same swab, rub the inside of your right cheek.", "Continue for 15–20 seconds minimum.", "Again, avoid touching your tongue."], timer: 20 },
  { title: "Step 4: Place Swab in Collection Tube", desc: ["Open the pre-labeled collection tube containing the solution.", "Immediately place the swab tip into the tube."] },
  { title: "Step 5: Mix the Sample", desc: ["Close the tube if required.", "Gently swirl or rotate the swab in the solution for about 10 seconds."], timer: 10 },
  { title: "Step 6: Remove and Discard Swab", desc: ["While pulling the swab out, squeeze the sides of the tube to release liquid from the swab tip.", "Dispose of the used swab in a trash bin."] },
  { title: "Step 7: Seal the Tube", desc: ["Tightly close the collection tube cap.", "Ensure it is securely sealed."] },
  { title: "Step 8: Pack for Return", desc: ["Place the sealed collection tube into the provided zip pouch.", "Seal the pouch.", "Return the sample according to the kit instructions."] },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [backendFinished, setBackendFinished] = useState(false);
  const [waitingForBackend, setWaitingForBackend] = useState(false);
  const [needsSurvey, setNeedsSurvey] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [postTutorialAction, setPostTutorialAction] = useState<'login' | 'survey' | 'stay'>('stay');

  // Countdown timer logic for tutorial steps
  useEffect(() => {
    if (timeLeft === null || timeLeft === 0) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Navigate automatically once the user finishes the tutorial AND the backend finishes
  useEffect(() => {
    if (waitingForBackend && backendFinished) {
      setLoading(false);
      if (postTutorialAction === 'login') navigate('/login');
      else if (postTutorialAction === 'survey') setNeedsSurvey(true);
      // If 'stay', they just return to the form (handled by closing loading)
    }
  }, [waitingForBackend, backendFinished, postTutorialAction, navigate]);

  const handleFinishTutorial = () => {
    if (backendFinished) {
      setLoading(false);
      if (postTutorialAction === 'login') navigate('/login');
      else if (postTutorialAction === 'survey') setNeedsSurvey(true);
    } else {
      setWaitingForBackend(true);
    }
  };

  // State to hold the form data
  const [formData, setFormData] = useState({
    username: '', fullName: '', email: '', countryCode: '+91', phone: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', geneType: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateAge = (dayStr: string, monthStr: string, yearStr: string) => {
    if (!dayStr || !monthStr || !yearStr) return '';
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10); // month is already 0-indexed from the dropdown
    const year = parseInt(yearStr, 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';

    const today = new Date();
    const birthDate = new Date(year, month, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email,
        phone: `${formData.countryCode} ${formData.phone}`,
        age: calculateAge(formData.dobDay, formData.dobMonth, formData.dobYear),
        gender: formData.gender,
        geneType: formData.geneType
      };

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setBackendFinished(true);

      if (response.status === 429) {
        setToastMessage({ type: 'error', text: data.message });
        setPostTutorialAction('stay');
        return;
      }

      if (response.status === 409) {
        setToastMessage({ type: 'error', text: data.message || 'User already exists. Please login.' });
        setPostTutorialAction('login');
        return;
      }

      if (data.requiresSurvey) {
        setToastMessage({ type: 'error', text: data.message || 'Survey required to finalize.' });
        setPostTutorialAction('survey');
      } else if (data.success) {
        setToastMessage({ type: 'success', text: 'Profile mapped and data linked successfully!' });
        setPostTutorialAction('login');
      } else {
        setToastMessage({ type: 'error', text: data.error || data.message || 'Registration failed' });
        setPostTutorialAction('stay');
      }
    } catch (error) {
      console.error('Network Error', error);
      setToastMessage({ type: 'error', text: 'Could not connect to the server.' });
      setBackendFinished(true);
      setPostTutorialAction('stay');
    }
  };

  // ── Survey Required screen ──────────────────────────────────────────────────
  if (needsSurvey) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="survey-prompt"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
        >
          <div className={theme.card}>
            {/* Decorative pulse ring */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center w-16 h-16">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#6057D7]/20 animate-ping" />
                <span className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#6057D7] to-[#3FC2AC]">
                  <ExternalLink size={20} className="text-white" strokeWidth={2} />
                </span>
              </div>
            </div>

            <h2 className={theme.heading}>Survey Required</h2>
            <p className="text-sm text-[#8B8B86] text-center mb-8">
              We couldn't find your data in our Tally.so records. To generate your
              Phenotypic Profile, please complete our intake survey first.
            </p>

            <a
              href="https://tally.so/r/your-survey-link"
              target="_blank"
              rel="noopener noreferrer"
              className={`${theme.buttonPrimary} flex items-center justify-center gap-2 no-underline`}
            >
              <ExternalLink size={16} />
              Take the Tally.so Survey
            </a>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setNeedsSurvey(false)}
              className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-[#8B8B86] hover:text-[#1A1A19] transition-colors duration-300 py-3"
            >
              <RefreshCw size={14} />
              I've completed it — try registering again
            </motion.button>
          </div>

          <div className="mt-8 text-center">
            <Link to="/login" className={theme.buttonSecondary}>
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Normal registration form ────────────────────────────────────────────────
  return (
    <>
      {/* Full Page Interactive Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#F7F7F5]/90 backdrop-blur-md px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-lg w-full border border-[#E8E8E5] relative overflow-hidden"
            >
              {/* Push Notification Toast */}
              <AnimatePresence>
                {toastMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -40 }}
                    className={`absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold z-10 flex items-center gap-2 whitespace-nowrap border ${toastMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                  >
                    {toastMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    {toastMessage.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {waitingForBackend ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-[#6057D7] mb-4" size={48} />
                  <h3 className="text-xl font-bold text-[#1A1A19]">Finishing up...</h3>
                  <p className="text-sm text-[#8B8B86] mt-2 text-center">Your phenotypic profile is almost ready.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg md:text-xl font-bold text-[#1A1A19]">Tutorial: Sample Collection</h3>
                    <button onClick={handleFinishTutorial} className="text-sm text-[#8B8B86] hover:text-[#1A1A19] underline font-medium">
                      Skip Tutorial
                    </button>
                  </div>

                  <div className="w-full bg-[#F7F7F5] h-32 md:h-48 rounded-2xl mb-6 flex items-center justify-center border border-[#E8E8E5]">
                    <span className="text-[#8B8B86] text-sm italic font-medium">Illustration Placeholder</span>
                  </div>

                  <div className="min-h-[140px]">
                    <h4 className="font-bold text-lg mb-3 text-[#6057D7]">{TUTORIAL_STEPS[tutorialStep].title}</h4>
                    <ul className="space-y-3 mb-6">
                      {TUTORIAL_STEPS[tutorialStep].desc.map((descLine, i) => (
                        <li key={i} className="text-sm text-[#1A1A19] flex gap-3">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3FC2AC] flex-shrink-0" />
                          <span className="leading-relaxed">{descLine}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {TUTORIAL_STEPS[tutorialStep].timer && (
                    <div className="mb-6 flex justify-center h-12">
                      {timeLeft === null ? (
                        <button onClick={() => setTimeLeft(TUTORIAL_STEPS[tutorialStep].timer!)} className="bg-gradient-to-r from-[#6057D7] to-[#4B44B3] text-white px-8 py-2 rounded-full text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95">
                          Start {TUTORIAL_STEPS[tutorialStep].timer}s Timer
                        </button>
                      ) : (
                        <div className="text-3xl font-extrabold text-[#1A1A19] flex items-center gap-3">
                          {timeLeft > 0 ? <Loader2 className="animate-spin text-[#3FC2AC]" size={28} /> : <CheckCircle2 className="text-[#3FC2AC]" size={28} />}
                          <span className={timeLeft === 0 ? "text-[#3FC2AC]" : ""}>00:{timeLeft.toString().padStart(2, '0')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!TUTORIAL_STEPS[tutorialStep].timer && <div className="h-12 mb-6" />}

                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-[#E8E8E5]">
                    <button
                      disabled={tutorialStep === 0}
                      onClick={() => { setTutorialStep(prev => prev - 1); setTimeLeft(null); }}
                      className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${tutorialStep === 0 ? 'text-transparent cursor-default' : 'text-[#8B8B86] hover:bg-[#F7F7F5] active:scale-95'}`}
                    >
                      Previous
                    </button>

                    <div className="flex gap-1.5">
                      {TUTORIAL_STEPS.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === tutorialStep ? 'bg-[#6057D7]' : 'bg-[#E8E8E5]'}`} />
                      ))}
                    </div>

                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                      <button
                        onClick={() => { setTutorialStep(prev => prev + 1); setTimeLeft(null); }}
                        className="px-6 py-2.5 bg-[#F7F7F5] rounded-xl font-semibold text-[#1A1A19] hover:bg-[#E8E8E5] text-sm transition-colors active:scale-95"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        onClick={handleFinishTutorial}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] text-white rounded-xl font-semibold text-sm hover:opacity-90 flex items-center gap-2 shadow-md active:scale-95 transition-all"
                      >
                        {(!backendFinished) && <Loader2 className="animate-spin" size={16} />}
                        Complete
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
      >
        <div className={theme.card}>
          <h2 className={theme.heading}>Create Profile</h2>
          <p className={theme.subheading}>Link your phenotype data with your lab results.</p>
          <p className="text-xs text-[#8B8B86] mb-6 font-medium">* Every field is required</p>

          <form onSubmit={handleSubmit}>
            <input type="text" name="username" onChange={handleChange} placeholder="Unique Username" className={theme.input} required />
            <input type="text" name="fullName" onChange={handleChange} placeholder="Full Legal Name" className={theme.input} required />
            <input type="email" name="email" onChange={handleChange} placeholder="Email Address" className={theme.input} required />

            <div className="mb-4">
              {/* Unified Country Code & Phone Input */}
              <div className="flex w-full bg-white/50 text-[#2C2C2A] rounded-xl border border-[#E8E8E5] focus-within:ring-4 focus-within:ring-[#6057D7]/10 focus-within:bg-white focus-within:border-[#6057D7]/30 transition-all duration-300">
                <div className="relative w-[110px] flex-shrink-0 border-r border-[#E8E8E5]">
                  <select name="countryCode" onChange={handleChange} className="w-full h-full appearance-none cursor-pointer pl-4 pr-8 py-3.5 outline-none bg-transparent hover:bg-black/5 transition-colors font-medium text-sm rounded-l-xl" required defaultValue="+91">
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+7">🇷🇺 +7</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+974">🇶🇦 +974</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+998">🇺🇿 +998</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B8B86]">
                    <ChevronDown size={14} strokeWidth={2.5} />
                  </div>
                </div>
                <input
                  type="tel"
                  name="phone"
                  onChange={(e) => {
                    e.target.value = e.target.value.replace(/\D/g, '');
                    handleChange(e);
                  }}
                  maxLength={formData.countryCode === '+91' ? 10 : 15}
                  placeholder="Phone Number"
                  className="w-full bg-transparent px-4 py-3.5 outline-none placeholder-[#A0A09D]"
                  required
                />
              </div>
            </div>

            {/* Date of Birth Input (Split) */}
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                name="dobDay"
                value={formData.dobDay}
                onChange={handleChange}
                placeholder="Day"
                min="1" max="31"
                className={`${theme.input} !mb-0 w-[80px] sm:w-[100px] flex-shrink-0 px-2 sm:px-4 text-center sm:text-left`}
                required
              />
              <div className="relative flex-1">
                <select name="dobMonth" onChange={handleChange} className={`${theme.input} !mb-0 appearance-none cursor-pointer w-full`} required defaultValue="">
                  <option value="" disabled>Month</option>
                  <option value="0">January</option>
                  <option value="1">February</option>
                  <option value="2">March</option>
                  <option value="3">April</option>
                  <option value="4">May</option>
                  <option value="5">June</option>
                  <option value="6">July</option>
                  <option value="7">August</option>
                  <option value="8">September</option>
                  <option value="9">October</option>
                  <option value="10">November</option>
                  <option value="11">December</option>
                </select>
                <div className="absolute right-3 sm:right-4 top-[18px] pointer-events-none text-[#8B8B86]">
                  <ChevronDown size={16} strokeWidth={2.5} />
                </div>
              </div>
              <input
                type="number"
                name="dobYear"
                value={formData.dobYear}
                onChange={handleChange}
                placeholder="Year"
                min="1900" max={new Date().getFullYear()}
                className={`${theme.input} !mb-0 w-[90px] sm:w-[110px] flex-shrink-0 px-2 sm:px-4 text-center sm:text-left`}
                required
              />
            </div>
            <div className="relative">
              <select name="gender" onChange={handleChange} className={`${theme.input} appearance-none cursor-pointer`} required defaultValue="">
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <div className="absolute right-4 top-[18px] pointer-events-none text-[#8B8B86]">
                <ChevronDown size={16} strokeWidth={2.5} />
              </div>
            </div>

            <div className="relative">
              <select name="geneType" onChange={handleChange} className={`${theme.input} appearance-none cursor-pointer`} required defaultValue="">
                <option value="" disabled>Select Gene Type</option>
                <option value="Caffine Response (CYP1A2)">Caffine Response (CYP1A2)</option>
                <option value="Muscle Power vs Endurance (ACTN3)">Muscle Power vs Endurance (ACTN3)</option>
                <option value="Hair Thickness & Root Structure (EDAR)">Hair Thickness &amp; Root Structure (EDAR)</option>
              </select>
              <div className="absolute right-4 top-[18px] pointer-events-none text-[#8B8B86]">
                <ChevronDown size={16} strokeWidth={2.5} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="submit" disabled={loading}
              className={theme.buttonPrimary}
            >
              {loading ? 'Mapping Profile...' : 'Complete Registration'}
            </motion.button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <Link to="/login" className={theme.buttonSecondary}>
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>
      </motion.div>
    </>
  );
}
