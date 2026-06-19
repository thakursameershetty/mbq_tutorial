import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle, ScrollText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../theme';

import img1 from '../assets/illustations/1.png';
import img2 from '../assets/illustations/2.png';
import img3 from '../assets/illustations/3.png';
import img4 from '../assets/illustations/4.png';
import img5 from '../assets/illustations/5.png';
import img6 from '../assets/illustations/6.png';
import img7 from '../assets/illustations/7.png';
import img8 from '../assets/illustations/8.png';

const TUTORIAL_IMAGES = [
  img1,
  img2,
  img3,
  img4,
  img5,
  img6,
  img7,
  img8,
];

// ── Terms & Conditions Modal ────────────────────────────────────────────────
function TermsModal({
  onAgree,
  onDecline,
}: {
  onAgree: (platformConsent: boolean) => void;
  onDecline: () => void;
}) {
  const [platformConsent, setPlatformConsent] = useState<boolean | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Consider "scrolled enough" when within 100px of bottom
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setHasScrolled(true);
    }
  };

  const canAgree = hasScrolled && platformConsent !== null;

  const sections = [
    {
      num: '1', title: 'Nature of Participation',
      items: [
        'My participation is completely voluntary.',
        'I may withdraw from the program at any time by contacting MyBodyQode.',
        'Participation involves providing personal information, lifestyle-related questionnaire responses, and a saliva sample for genetic testing.',
        'My participation does not establish a doctor-patient relationship with MyBodyQode.',
      ],
    },
    {
      num: '2', title: 'Wellness and Educational Purpose',
      items: [
        'MyBodyQode is not a diagnostic, treatment, or disease-screening service.',
        'Reports are intended for educational, wellness, and lifestyle awareness purposes only.',
        'Results should not be used to diagnose, treat, cure, or prevent any medical condition.',
        'I should consult a qualified healthcare professional regarding any medical concerns.',
      ],
    },
    {
      num: '3', title: 'DNA Sample Collection and Testing',
      intro: 'I voluntarily consent to:',
      items: [
        'Providing a non-invasive buccal (cheek) swab sample for DNA analysis.',
        'Genetic testing by an accredited partner laboratory.',
        'Generation of genotype results for selected lifestyle-related genetic markers.',
        'Secure sharing of those genotype results with MyBodyQode for report generation.',
      ],
      note: 'The laboratory performs the genetic analysis. MyBodyQode interprets the results and generates educational wellness reports.',
    },
    {
      num: '4', title: 'Phenotype Questionnaire Participation',
      intro: 'I voluntarily consent to provide:',
      items: [
        'Lifestyle information.',
        'Habit-related information.',
        'Wellness-related questionnaire responses.',
        'Feedback regarding my experiences and observations.',
      ],
      note: 'These responses may be used together with my genotype information to generate more personalized reports.',
    },
    {
      num: '5', title: 'AI-Assisted Personalization',
      items: [
        'MyBodyQode may use automated systems and AI-assisted analysis.',
        'My genotype data and questionnaire responses may be combined to generate personalized wellness insights.',
        'AI-generated outputs are educational in nature and are not medical advice.',
      ],
    },
    {
      num: '6', title: 'Data Privacy and Security',
      intro: 'MyBodyQode may collect: Name, contact details, demographic information, questionnaire responses, genetic testing results, and platform interaction data.',
      items: [
        'My information will be protected using reasonable security safeguards.',
        'Access is restricted to authorized personnel and approved systems.',
        'MyBodyQode does not sell my personal genetic information.',
      ],
    },
    {
      num: '7', title: 'Data Ownership',
      items: [
        'I remain the owner of my personal and genetic information.',
        'MyBodyQode acts as a custodian of this information for the purpose of delivering services.',
        'I may request access, correction, or deletion of my information subject to applicable legal and operational requirements.',
      ],
    },
    {
      num: '9', title: 'Sample Retention and Disposal',
      items: [
        'My biological sample may be retained temporarily by the partner laboratory for quality assurance purposes.',
        'Samples may be securely destroyed according to laboratory retention policies unless additional consent is provided.',
        'Retention periods may vary according to laboratory requirements and applicable regulations.',
      ],
    },
    {
      num: '10', title: 'Risks and Limitations',
      items: [
        'Genetic information provides tendencies and predispositions, not certainties.',
        'Results may not fully explain my health, fitness, behavior, or lifestyle outcomes.',
        'Environmental, lifestyle, and personal factors also influence outcomes.',
      ],
    },
    {
      num: '11', title: 'Withdrawal',
      items: [
        'Participation is voluntary.',
        'I may request withdrawal from the program.',
        'Certain data already used in aggregated or anonymized analyses may not be removable after processing.',
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full sm:max-w-2xl bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* ── Sticky Header ── */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[#F0F0EE] flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6057D7] to-[#4B44B3] flex items-center justify-center flex-shrink-0">
            <ScrollText size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[#1A1A19] leading-tight">Consent & Participation Agreement</h2>
            <p className="text-xs text-[#8B8B86] mt-0.5">MyBodyQode Early Access Program</p>
          </div>
          <button
            onClick={onDecline}
            className="p-2 rounded-full hover:bg-[#F7F7F5] text-[#8B8B86] transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scroll hint pill */}
        {!hasScrolled && (
          <div className="flex justify-center pt-2 flex-shrink-0">
            <span className="text-[11px] text-[#6057D7] bg-[#6057D7]/8 border border-[#6057D7]/20 rounded-full px-3 py-1 font-medium">
              📜 Please scroll down to read the full agreement
            </span>
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Intro */}
          <div className="bg-gradient-to-br from-[#6057D7]/6 to-[#3FC2AC]/6 border border-[#6057D7]/15 rounded-2xl p-4">
            <p className="text-sm text-[#3a3a38] leading-relaxed">
              Thank you for volunteering to participate in the <strong>MyBodyQode (MBQ) Early Access Program</strong>.
              MBQ is a wellness and lifestyle personalization platform that combines genetic information, questionnaire
              responses, and AI-assisted analysis to provide educational insights about certain lifestyle-related traits.
            </p>
            <p className="text-sm text-[#3a3a38] leading-relaxed mt-2 font-medium">
              Please carefully read and acknowledge the following information before participating.
            </p>
          </div>

          {/* Sections */}
          {sections.map((sec) => (
            <div key={sec.num} className="border border-[#EBEBEA] rounded-2xl p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-7 h-7 rounded-lg bg-[#6057D7]/10 text-[#6057D7] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {sec.num}
                </span>
                <h3 className="text-sm font-bold text-[#1A1A19]">{sec.title}</h3>
              </div>
              {sec.intro && (
                <p className="text-xs text-[#6b6b68] mb-2 leading-relaxed">{sec.intro}</p>
              )}
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-[#3a3a38] leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-[#3FC2AC] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              {sec.note && (
                <p className="text-xs text-[#6b6b68] mt-2 pt-2 border-t border-[#F0F0EE] leading-relaxed italic">{sec.note}</p>
              )}
            </div>
          ))}

          {/* Section 8 — Optional Platform Consent */}
          <div className="border border-[#3FC2AC]/30 bg-[#3FC2AC]/5 rounded-2xl p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-7 h-7 rounded-lg bg-[#3FC2AC]/20 text-[#138a6a] text-xs font-bold flex items-center justify-center flex-shrink-0">8</span>
              <h3 className="text-sm font-bold text-[#1A1A19]">Optional Platform Improvement Consent</h3>
            </div>
            <p className="text-xs text-[#6b6b68] leading-relaxed mb-3">
              MyBodyQode continuously improves its reports and algorithms. You may choose whether anonymized and
              de-identified information can be used for platform improvement, algorithm enhancement, user experience
              optimization, and internal scientific evaluation. <strong>This consent is optional and does not affect your participation.</strong>
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setPlatformConsent(true)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${platformConsent === true ? 'bg-[#3FC2AC] border-[#3FC2AC]' : 'border-[#D0D0CE] group-hover:border-[#3FC2AC]'}`}
                >
                  {platformConsent === true && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-[#3a3a38] leading-relaxed">I consent to the use of anonymized data for platform improvement.</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setPlatformConsent(false)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${platformConsent === false ? 'bg-[#6057D7] border-[#6057D7]' : 'border-[#D0D0CE] group-hover:border-[#6057D7]'}`}
                >
                  {platformConsent === false && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-[#3a3a38] leading-relaxed">I do not consent.</span>
              </label>
            </div>
          </div>

          {/* Participant Declaration */}
          <div className="bg-[#1A1A19] rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-white">Participant Declaration</h3>
            <p className="text-xs text-white/70 leading-relaxed">By selecting "I Agree" below, I confirm that:</p>
            <ul className="space-y-1.5">
              {[
                'I am at least 18 years of age.',
                'I have read and understood this consent document.',
                'I voluntarily agree to participate in the MyBodyQode Early Access Program.',
                'I consent to genetic testing, questionnaire participation, and AI-assisted report generation as described above.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-white/80 leading-relaxed">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#3FC2AC] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom spacer so content clears the sticky footer */}
          <div className="h-2" />
        </div>

        {/* ── Sticky Footer ── */}
        <div className="px-6 py-4 border-t border-[#F0F0EE] flex-shrink-0 space-y-2.5">
          {!canAgree && (
            <p className="text-center text-[11px] text-[#8B8B86]">
              {!hasScrolled
                ? 'Scroll to the bottom to enable the agreement buttons.'
                : 'Please select your platform improvement preference above.'}
            </p>
          )}
          <motion.button
            whileHover={canAgree ? { scale: 1.01 } : {}}
            whileTap={canAgree ? { scale: 0.99 } : {}}
            onClick={() => canAgree && onAgree(platformConsent!)}
            disabled={!canAgree}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${canAgree
              ? 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] text-white shadow-md hover:shadow-lg'
              : 'bg-[#F0F0EE] text-[#B0B0AE] cursor-not-allowed'
              }`}
          >
            ✓ I Agree and Wish to Participate
          </motion.button>
          <button
            onClick={onDecline}
            className="w-full py-3 rounded-xl text-sm font-medium text-[#8B8B86] hover:bg-[#F7F7F5] transition-colors"
          >
            I Do Not Agree
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

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

const GENE_OPTIONS = [
  "Caffine Response (CYP1A2)",
  "Muscle Power vs Endurance (ACTN3)",
  "Hair Thickness & Root Structure (EDAR)"
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [backendFinished, setBackendFinished] = useState(false);
  const [waitingForBackend, setWaitingForBackend] = useState(false);
  const [needsSurvey, setNeedsSurvey] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [postTutorialAction, setPostTutorialAction] = useState<'login' | 'survey' | 'stay'>('stay');
  const [showThankYou, setShowThankYou] = useState(false);

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
      if (postTutorialAction === 'stay') {
        setLoading(false);
      } else {
        setShowThankYou(true);
      }
    }
  }, [waitingForBackend, backendFinished, postTutorialAction]);

  const handleFinishTutorial = () => {
    if (backendFinished) {
      if (postTutorialAction === 'stay') {
        setLoading(false);
      } else {
        setShowThankYou(true);
      }
    } else {
      setWaitingForBackend(true);
    }
  };

  const handleDispatchConfirmed = () => {
    setLoading(false);
    setShowThankYou(false);
    if (postTutorialAction === 'login') navigate('/login');
    else if (postTutorialAction === 'survey') setNeedsSurvey(true);
  };

  // State to hold the form data
  const [formData, setFormData] = useState({
    username: '', fullName: '', email: '', countryCode: '+91', phone: '', dobDay: '', dobMonth: '', dobYear: '', gender: ''
  });

  const [selectedGenes, setSelectedGenes] = useState<string[]>(['']);

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

  // Called when the form's submit button is clicked — shows T&C first
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTerms(true);
  };

  // Called after user agrees to T&C — this is where the actual backend call happens
  const handleSubmit = async (_platformConsent: boolean) => {
    setShowTerms(false);
    setLoading(true);

    try {
      const payload = {
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email,
        phone: `${formData.countryCode} ${formData.phone}`,
        age: calculateAge(formData.dobDay, formData.dobMonth, formData.dobYear),
        gender: formData.gender,
        geneType: selectedGenes.filter(Boolean).join(', ')
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

              {showThankYou ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#6057D7] to-[#3FC2AC] rounded-full flex items-center justify-center mb-6 shadow-lg">
                    <CheckCircle2 size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#1A1A19] mb-3">Thank You!</h3>
                  <p className="text-sm text-[#8B8B86] mb-8 leading-relaxed max-w-sm mx-auto">
                    Your phenotypic profile has been successfully linked. Please confirm that you have securely packed and dispatched your DNA sample as per the instructions.
                  </p>
                  <button
                    onClick={handleDispatchConfirmed}
                    className="w-full bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] text-white px-8 py-3.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> I have dispatched the sample
                  </button>
                </div>
              ) : waitingForBackend ? (
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

                  <div className="w-56 h-56 md:w-64 md:h-64 mx-auto mb-6 flex items-center justify-center overflow-hidden">
                    <img
                      src={TUTORIAL_IMAGES[Math.min(tutorialStep, TUTORIAL_IMAGES.length - 1)]}
                      alt={`Step ${tutorialStep}`}
                      className="w-full h-full object-contain"
                    />
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

                  <div className="flex flex-wrap sm:flex-nowrap justify-center sm:justify-between items-center mt-6 pt-6 border-t border-[#E8E8E5] gap-4">
                    <button
                      disabled={tutorialStep === 0}
                      onClick={() => { setTutorialStep(prev => prev - 1); setTimeLeft(null); }}
                      className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-colors w-full sm:w-auto text-center order-2 sm:order-1 ${tutorialStep === 0 ? 'text-transparent cursor-default' : 'text-[#8B8B86] hover:bg-[#F7F7F5] active:scale-95'}`}
                    >
                      Previous
                    </button>

                    <div className="flex gap-1.5 order-1 sm:order-2 w-full sm:w-auto justify-center mb-2 sm:mb-0">
                      {TUTORIAL_STEPS.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === tutorialStep ? 'bg-[#6057D7]' : 'bg-[#E8E8E5]'}`} />
                      ))}
                    </div>

                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                      <button
                        onClick={() => { setTutorialStep(prev => prev + 1); setTimeLeft(null); }}
                        className="px-6 py-2.5 bg-[#F7F7F5] rounded-xl font-semibold text-[#1A1A19] hover:bg-[#E8E8E5] text-sm transition-colors active:scale-95 w-full sm:w-auto order-3"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        onClick={handleFinishTutorial}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] text-white rounded-xl font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all w-full sm:w-auto order-3"
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

      {/* Terms & Conditions Modal — rendered at root level so it overlays everything */}
      <AnimatePresence>
        {showTerms && (
          <TermsModal
            onAgree={(platformConsent) => handleSubmit(platformConsent)}
            onDecline={() => setShowTerms(false)}
          />
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

          <form onSubmit={handleFormSubmit}>
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#8B8B86] mb-1.5 text-left pl-1">Date of Birth</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="dobDay"
                  value={formData.dobDay}
                  onChange={handleChange}
                  placeholder="Day"
                  min="1" max="31"
                  className={`${theme.input} !mb-0 !w-1/4 sm:!w-[100px] flex-shrink-0 px-2 sm:px-4 text-center sm:text-left`}
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
                  className={`${theme.input} !mb-0 !w-1/3 sm:!w-[110px] flex-shrink-0 px-2 sm:px-4 text-center sm:text-left`}
                  required
                />
              </div>
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
            
            <div className="mb-4 text-left">
              <label className="block text-sm font-medium text-[#8B8B86] mb-1.5 pl-1">Gene Selection</label>
              {selectedGenes.map((gene, index) => (
                <div key={index} className="flex gap-2 items-center mb-3">
                  <div className="relative flex-1">
                    <select
                      value={gene}
                      onChange={(e) => {
                        const newGenes = [...selectedGenes];
                        newGenes[index] = e.target.value;
                        setSelectedGenes(newGenes);
                      }}
                      className={`${theme.input} !mb-0 appearance-none cursor-pointer w-full`}
                      required
                    >
                      <option value="" disabled>Select Gene Type</option>
                      {GENE_OPTIONS.map((opt) => (
                        <option 
                          key={opt} 
                          value={opt} 
                          disabled={selectedGenes.some((val, idx) => idx !== index && val === opt)}
                        >
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-[18px] pointer-events-none text-[#8B8B86]">
                      <ChevronDown size={16} strokeWidth={2.5} />
                    </div>
                  </div>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newGenes = selectedGenes.filter((_, idx) => idx !== index);
                        setSelectedGenes(newGenes);
                      }}
                      className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-colors flex items-center justify-center shrink-0"
                      title="Remove selection"
                      style={{ height: '54px', width: '54px' }}
                    >
                      <X size={18} />
                    </button>
                  )}
                  {index === selectedGenes.length - 1 && selectedGenes.length < GENE_OPTIONS.length && gene !== '' && (
                    <button
                      type="button"
                      onClick={() => setSelectedGenes([...selectedGenes, ''])}
                      className="p-3 bg-[#3FC2AC]/10 hover:bg-[#3FC2AC]/15 text-[#138a6a] rounded-xl border border-[#3FC2AC]/20 transition-all flex items-center justify-center shrink-0 font-bold"
                      title="Add another genotype selection"
                      style={{ height: '54px', width: '54px' }}
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="submit" disabled={loading}
              className={theme.buttonPrimary}
            >
              {loading ? 'Mapping Profile...' : 'Review & Agree to Terms'}
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
