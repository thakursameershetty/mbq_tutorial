import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../theme';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [needsSurvey, setNeedsSurvey] = useState(false);

  // State to hold the form data
  const [formData, setFormData] = useState({
    username: '', fullName: '', email: '', phone: '', age: '', gender: '', geneType: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.requiresSurvey) {
        // User not found in the Google Sheet — show the survey prompt
        setNeedsSurvey(true);
      } else if (data.success) {
        alert('Profile created and Tally.so data linked successfully.');
        navigate('/login');
      } else {
        alert('Registration failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Network Error', error);
      alert('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
    >
      <div className={theme.card}>
        <h2 className={theme.heading}>Create Profile</h2>
        <p className={theme.subheading}>Link your phenotype data with your lab results.</p>

        <form onSubmit={handleSubmit}>
          <input type="text" name="username" onChange={handleChange} placeholder="Unique Username" className={theme.input} required />
          <input type="text" name="fullName" onChange={handleChange} placeholder="Full Legal Name" className={theme.input} required />
          <input type="email" name="email" onChange={handleChange} placeholder="Email Address (Matches Survey)" className={theme.input} required />

          <div className="flex gap-4">
            <input type="tel" name="phone" onChange={handleChange} placeholder="Phone Number" className={theme.input} required />
            <input type="number" name="age" onChange={handleChange} placeholder="Age" className={`${theme.input} w-1/2`} required />
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
  );
}
