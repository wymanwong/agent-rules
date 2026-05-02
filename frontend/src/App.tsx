import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PortalHome } from './pages/PortalHome';
import { ReportIncidentPage } from './pages/ReportIncidentPage';
import { CatalogPage } from './pages/CatalogPage';
import { CatalogItemPage } from './pages/CatalogItemPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { KnowledgeListPage } from './pages/KnowledgeListPage';
import { KnowledgeDetailPage } from './pages/KnowledgeDetailPage';
import { ITQueuePage } from './pages/ITQueuePage';
import { AdminPage } from './pages/AdminPage';
import { AdminCatalogListPage } from './pages/admin/AdminCatalogListPage';
import { AdminCatalogConfigurePage } from './pages/admin/AdminCatalogConfigurePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="knowledge" element={<KnowledgeListPage />} />
            <Route path="knowledge/:id" element={<KnowledgeDetailPage />} />
            <Route
              path="incidents/new"
              element={
                <ProtectedRoute>
                  <ReportIncidentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="catalog"
              element={
                <ProtectedRoute>
                  <CatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="catalog/:id"
              element={
                <ProtectedRoute>
                  <CatalogItemPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-requests"
              element={
                <ProtectedRoute>
                  <MyRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="tickets/:id"
              element={
                <ProtectedRoute>
                  <TicketDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="it/queue"
              element={
                <ProtectedRoute roles={['IT', 'Admin']}>
                  <ITQueuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="it/tickets/:id"
              element={
                <ProtectedRoute roles={['IT', 'Admin']}>
                  <TicketDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={['Admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/catalog"
              element={
                <ProtectedRoute roles={['Admin']}>
                  <AdminCatalogListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/catalog/new"
              element={
                <ProtectedRoute roles={['Admin']}>
                  <AdminCatalogConfigurePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/catalog/:catalogId"
              element={
                <ProtectedRoute roles={['Admin']}>
                  <AdminCatalogConfigurePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
