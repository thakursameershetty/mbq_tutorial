import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { theme } from '../theme';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('userProfile', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error', error);
      alert('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-lg mx-auto mt-8 sm:mt-12 px-4"
    >
      <div className={theme.card}>
        <h2 className={theme.heading}>Patient Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username (e.g. MBQ-1234)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={theme.input}
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={theme.input}
            required
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className={theme.buttonPrimary}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </motion.button>
        </form>
        <div className="mt-6 text-center">
          <span className="text-sm text-[#8B8B86]">New to MyBodyQode? </span>
          <Link to="/" className="text-[#1A1A19] text-sm font-medium transition-colors underline-offset-4 hover:underline">Create your profile</Link>
        </div>
      </div>
    </motion.div>
  );
}
