// ui/src/App.tsx
// Router + guards (admin/manager/lead) + Layout

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./layout";
import { isAuthed, hasRole } from "./auth";

// pages
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CarsPage } from "./pages/CarsPage";
import { CarFormPage } from "./pages/CarFormPage";
import { CarDetailPage } from "./pages/CarDetailPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ClientFormPage } from "./pages/ClientFormPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { DealsPage } from "./pages/DealsPage";
import { DealFormPage } from "./pages/DealFormPage";
import { DealDetailPage } from "./pages/DealDetailPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AiPage } from "./pages/AiPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminRolesPage } from "./pages/AdminRolesPage";
import { AdminAuditPage } from "./pages/AdminAuditPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: "admin" | "manager" | "lead"; children: React.ReactNode }) {
  // admin имеет доступ везде
  if (hasRole("admin")) return <>{children}</>;
  if (!hasRole(role)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* protected */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />

                  {/* cars */}
                  <Route path="/cars" element={<CarsPage />} />
                  <Route path="/cars/new" element={<CarFormPage mode="create" />} />
                  <Route path="/cars/:id" element={<CarDetailPage />} />
                  <Route path="/cars/:id/edit" element={<CarFormPage mode="edit" />} />

                  {/* clients */}
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/new" element={<ClientFormPage mode="create" />} />
                  <Route path="/clients/:id" element={<ClientDetailPage />} />
                  <Route path="/clients/:id/edit" element={<ClientFormPage mode="edit" />} />

                  {/* deals */}
                  <Route path="/deals" element={<DealsPage />} />
                  <Route path="/deals/new" element={<DealFormPage />} />
                  <Route path="/deals/:id" element={<DealDetailPage />} />

                  {/* payments */}
                  <Route path="/payments" element={<PaymentsPage />} />

                  {/* reports (lead/admin) */}
                  <Route
                    path="/reports"
                    element={
                      <RequireRole role="lead">
                        <ReportsPage />
                      </RequireRole>
                    }
                  />

                  {/* ai (manager/lead/admin) */}
                  <Route
                    path="/ai"
                    element={
                      <RequireRole role="manager">
                        <AiPage />
                      </RequireRole>
                    }
                  />

                  {/* admin */}
                  <Route
                    path="/admin/users"
                    element={
                      <RequireRole role="admin">
                        <AdminUsersPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/roles"
                    element={
                      <RequireRole role="admin">
                        <AdminRolesPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/audit"
                    element={
                      <RequireRole role="admin">
                        <AdminAuditPage />
                      </RequireRole>
                    }
                  />

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}