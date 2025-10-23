import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Avaliacao from "@/pages/Avaliacao";
import PacienteForm from "@/pages/PacienteForm";
import Relatorio from "@/pages/Relatorio";
import Sessoes from "@/pages/Sessoes";
import Ajuda from "@/pages/Ajuda";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

function RequireAuth({ children }) {
  const access = localStorage.getItem("accessToken");
  if (!access) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pacientes" element={<PacienteForm />} />
        <Route path="avaliacao" element={<Avaliacao />} />
        <Route path="relatorios" element={<Relatorio />} />
        <Route path="sessoes" element={<Sessoes />} />
        <Route path="ajuda" element={<Ajuda />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
