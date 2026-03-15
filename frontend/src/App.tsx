import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TicketQueue from './pages/TicketQueue';
import TicketDetail from './pages/TicketDetail';
import TicketReview from './pages/TicketReview';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import KnowledgeBase from './pages/KnowledgeBase';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tickets" element={<TicketQueue />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="review" element={<TicketReview />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
      </Route>
    </Routes>
  );
}
