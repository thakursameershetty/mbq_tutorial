import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { theme } from './theme';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PatientDashboardPage from './pages/PatientDashboardPage';

function Navigation() {
  return (
    <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 mt-4 px-4 mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/">
          <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo" className="h-9 object-contain" />
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
