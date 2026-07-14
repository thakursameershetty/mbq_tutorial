import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { theme } from './theme';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import ReportPage from './pages/ReportPage';
import VolunteerPage from './pages/VolunteerPage';
import AdminVerifyPage from './pages/AdminVerifyPage';
import { GeminiStatusWidget } from './components/ui/gemini-status-widget';

function Navigation() {
  return (
    <div className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 mt-6 px-4 sm:px-6 lg:px-8 mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/">
          <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo" className="h-9 object-contain" />
        </Link>
      </div>
    </div>
  );
}

// Renders the Gemini status widget only on admin pages
const ADMIN_ROUTES = ['/admin', '/admin-verify'];
function AdminGeminiStatus() {
  const { pathname } = useLocation();
  if (!ADMIN_ROUTES.includes(pathname)) return null;
  return <GeminiStatusWidget />;
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
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/volunteer" element={<VolunteerPage />} />
          <Route path="/admin-verify" element={<AdminVerifyPage />} />
        </Routes>
        <AdminGeminiStatus />
      </div>
    </BrowserRouter>
  );
}
