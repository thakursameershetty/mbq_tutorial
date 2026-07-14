import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';
import { theme } from '../theme';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    if (localStorage.getItem('userProfile')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Multiple profiles states
  const [multiProfiles, setMultiProfiles] = useState<any[] | null>(null);
  const [showMultiProfileModal, setShowMultiProfileModal] = useState(false);

  // Dynamic Validation States
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Forgot Credentials States
  const [showForgot, setShowForgot] = useState(false);
  const [recoverIdentifier, setRecoverIdentifier] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoverSuccess, setRecoverSuccess] = useState(false);
  const [recoverError, setRecoverError] = useState('');

  // Toast auto-dismiss timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Countdown timer logic for OTP resend
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // Auto-verify OTP
  useEffect(() => {
    if (otp.length === 6 && !isEmailVerified && !verifyingOtp) {
      const verifyOtp = async () => {
        setVerifyingOtp(true);
        try {
          const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
          });
          const data = await response.json();
          if (data.success) {
            setIsEmailVerified(true);
            setToastMessage({ type: 'success', text: 'Email verified successfully!' });
          } else {
            setToastMessage({ type: 'error', text: data.error || 'Invalid OTP' });
          }
        } catch (error) {
          console.error(error);
          setToastMessage({ type: 'error', text: 'Failed to verify OTP' });
        } finally {
          setVerifyingOtp(false);
        }
      };
      verifyOtp();
    }
  }, [otp, email, isEmailVerified, verifyingOtp]);

  // Check Email existence
  useEffect(() => {
    const checkEmail = async () => {
      const e = email.trim();
      if (!e || !e.includes('@')) {
        setEmailExists(null);
        setCheckingEmail(false);
        return;
      }
      setCheckingEmail(true);
      try {
        const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(e)}`);
        const data = await response.json();
        setEmailExists(data.exists);
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingEmail(false);
      }
    };
    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [email]);

  const isFormPerfectlyFilled =
    email.trim().length > 0 && email.includes('@') && emailExists === true && !checkingEmail &&
    otp.trim().length === 6;

  const handleSendOtp = async () => {
    triggerHaptic('medium');
    if (!email || !email.includes('@') || emailExists === false) {
      setToastMessage({ type: 'error', text: 'Please enter a valid, registered email first.' });
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        setOtpSent(true);
        setOtpTimer(30);
        setToastMessage({ type: 'success', text: 'OTP sent! Please check your email.' });
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Failed to send OTP' });
      }
    } catch (error) {
      console.error(error);
      setToastMessage({ type: 'error', text: 'Failed to connect to the server.' });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');

    // If we already fetched multiProfiles for this email, just show the modal again
    if (multiProfiles && multiProfiles.length > 1 && multiProfiles[0].email.toLowerCase() === email.trim().toLowerCase()) {
      setShowMultiProfileModal(true);
      return;
    }

    if (emailExists === false) {
      setToastMessage({ type: 'error', text: 'This email does not exist.' });
      return;
    }
    if (otp.length !== 6) {
      setToastMessage({ type: 'error', text: 'Please enter a 6-digit OTP.' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();
      if (data.success) {
        if (data.users && data.users.length > 1) {
          setMultiProfiles(data.users);
          setShowMultiProfileModal(true);
        } else {
          localStorage.setItem('userProfile', JSON.stringify(data.user || data.users[0]));
          navigate('/dashboard');
        }
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Login failed' });
      }
    } catch (error) {
      console.error('Login error', error);
      setToastMessage({ type: 'error', text: 'Could not connect to the server' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecovering(true);
    setRecoverError('');
    setRecoverSuccess(false);

    try {
      const response = await fetch('/api/auth/recover-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: recoverIdentifier })
      });

      const data = await response.json();
      if (response.ok) {
        setRecoverSuccess(true);
      } else {
        setRecoverError(data.error || 'Account not found.');
      }
    } catch (error) {
      console.error('Recovery error', error);
      setRecoverError('Could not connect to the server.');
    } finally {
      setRecovering(false);
    }
  };

  if (showForgot) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
      >
        <div className={theme.card}>
          <h2 className={theme.heading}>Recover Credentials</h2>
          <p className="text-sm text-[#8B8B86] text-center mb-6">
            Enter the email address or phone number associated with your account, and we'll send your credentials to you.
          </p>

          {recoverSuccess ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#6057D7] to-[#3FC2AC] rounded-full flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A19] mb-2">Credentials Sent</h3>
              <p className="text-sm text-[#8B8B86] text-center mb-6">
                If an account exists for that identifier, we've sent your credentials. <strong className="text-[#1A1A19]">Please check your spam email folder.</strong>
              </p>
              <button
                onClick={() => setShowForgot(false)}
                className={theme.buttonSecondary}
              >
                <ArrowLeft size={16} /> Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRecover}>
              <input
                type="text"
                placeholder="Email or Phone Number"
                value={recoverIdentifier}
                onChange={(e) => setRecoverIdentifier(e.target.value)}
                className={theme.input}
                required
              />
              <AnimatePresence>
                {recoverError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="text-sm text-red-600 bg-red-50/80 px-3 py-2.5 rounded-xl border border-red-200 flex flex-col gap-1.5 shadow-sm">
                      <span className="flex items-center gap-1.5 font-semibold"><AlertCircle size={14} strokeWidth={2.5} /> {recoverError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.button
                whileHover={recoverIdentifier.trim().length > 0 ? { scale: 1.02 } : {}}
                whileTap={recoverIdentifier.trim().length > 0 ? { scale: 0.98 } : {}}
                type="submit"
                disabled={recovering}
                className={`w-full font-medium tracking-wide rounded-xl px-4 py-4 mt-2 transition-all duration-300 ${recoverIdentifier.trim().length > 0
                    ? 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white shadow-[0_4px_20px_rgb(96,87,215,0.25)] active:scale-[0.98]'
                    : 'bg-[#F0F0ED] text-[#8B8B86] hover:bg-[#E8E8E5]'
                  }`}
              >
                {recovering ? 'Sending...' : 'Send Credentials'}
              </motion.button>
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className={theme.buttonSecondary}
                >
                  <ArrowLeft size={16} /> Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
    >
      <div className={theme.card}>
        <h2 className={theme.heading}>User Login</h2>
        <form onSubmit={handleLogin}>

          <div className="relative mb-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEmailVerified}
              className={`${theme.input} !mb-0 ${emailExists === false ? '!border-red-300 focus:!ring-red-500/10 focus:!border-red-400' : ''} ${isEmailVerified ? 'bg-[#F7F7F5]/50 cursor-not-allowed opacity-80' : ''}`}
              required
            />
            {checkingEmail && (
              <div className="absolute right-4 top-[18px]"><Loader2 className="animate-spin text-[#8B8B86]" size={16} /></div>
            )}
            {isEmailVerified && (
              <div className="absolute right-4 top-[18px]"><CheckCircle2 className="text-green-500" size={16} /></div>
            )}
            <AnimatePresence>
              {emailExists === false && email.includes('@') && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="text-sm text-red-600 bg-red-50/80 px-3 py-2.5 rounded-xl border border-red-200 mt-2 flex flex-col gap-1.5 shadow-sm">
                    <span className="flex items-center gap-1.5 font-semibold"><AlertCircle size={14} strokeWidth={2.5} /> This email does not exist.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isEmailVerified && email.length > 0 && emailExists !== false && email.includes('@') && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="flex flex-col gap-3 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpTimer > 0}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${sendingOtp || otpTimer > 0
                        ? 'bg-[#F0F0ED] text-[#B0B0AE] cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg active:scale-95'
                      }`}
                  >
                    {sendingOtp ? <Loader2 className="animate-spin" size={18} /> : (otpSent ? (otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP') : 'Send OTP')}
                  </button>

                  <AnimatePresence>
                    {otpSent && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative"
                      >
                        <input
                          type="text"
                          name="otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className={`${theme.input} !mb-0 text-center tracking-[0.2em] font-mono`}
                          required
                        />
                        {verifyingOtp ? (
                          <div className="absolute right-4 top-[18px]"><Loader2 className="animate-spin text-[#8B8B86]" size={16} /></div>
                        ) : otp.length === 6 && !isEmailVerified && (
                          <div className="absolute right-4 top-[18px]"><CheckCircle2 className="text-[#8B8B86]" size={16} /></div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-sm text-[#6057D7] font-medium hover:text-[#4B44B3] transition-colors"
            >
              Forgot Username or Email?
            </button>
          </div>

          <motion.button
            whileHover={isFormPerfectlyFilled ? { scale: 1.02 } : {}}
            whileTap={isFormPerfectlyFilled ? { scale: 0.98 } : {}}
            type="submit"
            disabled={loading}
            className={`w-full font-medium tracking-wide rounded-xl px-4 py-4 mt-2 transition-all duration-300 ${isFormPerfectlyFilled
                ? 'bg-gradient-to-r from-[#6057D7] to-[#3FC2AC] hover:opacity-90 text-white shadow-[0_4px_20px_rgb(96,87,215,0.25)] active:scale-[0.98]'
                : 'bg-[#F0F0ED] text-[#8B8B86] hover:bg-[#E8E8E5]'
              }`}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </motion.button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-sm text-[#8B8B86]">New to MyBodyQode? </span>
          <Link to="/" className="text-[#1A1A19] text-sm font-medium transition-colors underline-offset-4 hover:underline">Create your profile</Link>
        </div>
      </div>

      <AnimatePresence>
        {showMultiProfileModal && multiProfiles && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMultiProfileModal(false)}
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
                  <h3 className="text-2xl font-bold text-[#1A1A19]">Select Profile</h3>
                  <p className="text-[#8B8B86] text-sm mt-1">Multiple profiles found for this email.</p>
                </div>
                <button
                  onClick={() => setShowMultiProfileModal(false)}
                  className="p-2 text-[#8B8B86] hover:bg-[#F0F0ED] rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {multiProfiles.map((profile, idx) => (
                  <button
                    key={profile.id || idx}
                    onClick={() => {
                      localStorage.setItem('userProfile', JSON.stringify(profile));
                      navigate('/dashboard');
                    }}
                    className="w-full text-left p-4 rounded-2xl border border-[#E8E8E5] hover:border-[#6057D7] hover:bg-[#F9F9F8] transition-all flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#F0F0ED] group-hover:bg-[#EBE9FC] flex items-center justify-center text-[#8B8B86] group-hover:text-[#6057D7] transition-colors shrink-0">
                      <span className="font-semibold text-lg">{profile.full_name?.charAt(0) || 'U'}</span>
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-[#1A1A19] truncate">{profile.full_name}</h4>
                      <p className="text-sm text-[#8B8B86] truncate">@{profile.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
