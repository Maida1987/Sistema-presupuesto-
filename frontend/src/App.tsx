import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { SuppliersPage } from './features/suppliers/SuppliersPage';
import { ProductsPage } from './features/products/ProductsPage';
import { ImportListPage } from './features/price-lists/ImportListPage';
import { PricingRulesPage } from './features/pricing-rules/PricingRulesPage';
import { DeliveryNotesListPage } from './features/delivery-notes/DeliveryNotesListPage';
import { NewDeliveryNotePage } from './features/delivery-notes/NewDeliveryNotePage';
import { DeliveryNoteDetailPage } from './features/delivery-notes/DeliveryNoteDetailPage';
import { CustomerAccountPage } from './features/accounts/CustomerAccountPage';
import { NewSettlementPage } from './features/accounts/NewSettlementPage';
import { SettlementDetailPage } from './features/accounts/SettlementDetailPage';
import { PaymentDetailPage } from './features/payments/PaymentDetailPage';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <AppShell>
                <CustomersPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proveedores"
          element={
            <ProtectedRoute>
              <AppShell>
                <SuppliersPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/productos"
          element={
            <ProtectedRoute>
              <AppShell>
                <ProductsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remitos"
          element={
            <ProtectedRoute>
              <AppShell>
                <DeliveryNotesListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remitos/nuevo"
          element={
            <ProtectedRoute>
              <AppShell>
                <NewDeliveryNotePage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/remitos/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <DeliveryNoteDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/importar-lista"
          element={
            <ProtectedRoute>
              <AppShell>
                <ImportListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reglas-de-precios"
          element={
            <ProtectedRoute>
              <AppShell>
                <PricingRulesPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/:id/cuenta"
          element={
            <ProtectedRoute>
              <AppShell>
                <CustomerAccountPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/:id/liquidar"
          element={
            <ProtectedRoute>
              <AppShell>
                <NewSettlementPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/liquidaciones/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <SettlementDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <PaymentDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
