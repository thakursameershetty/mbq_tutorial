import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { theme } from './theme';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PatientDashboardPage from './pages/PatientDashboardPage';

function Navigation() {
  const location = useLocation();

  return (
    <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 mt-4 px-4 mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/">
          <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo" className="h-9 object-contain" />
        </Link>
      </div>
      <div className="flex gap-6">
        <Link
          to="/login"
          className={`text-sm font-medium transition-colors ${location.pathname === '/login' || location.pathname === '/' || location.pathname === '/dashboard' ? 'text-[#1A1A19]' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
        >
          Patient Portal
        </Link>
        <Link
          to="/admin"
          className={`text-sm font-medium transition-colors ${location.pathname === '/admin' ? 'text-[#1A1A19]' : 'text-[#8B8B86] hover:text-[#1A1A19]'}`}
        >
          Lab Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className={theme.background}>
        <Navigation />
        <Routes>
          <Route path="/" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PatientDashboardPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
