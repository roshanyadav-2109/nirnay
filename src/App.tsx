import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import CriteriaPage from './pages/CriteriaPage';
import EvaluationPage from './pages/EvaluationPage';
import ReportPage from './pages/ReportPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/criteria" element={<CriteriaPage />} />
        <Route path="/evaluation" element={<EvaluationPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
