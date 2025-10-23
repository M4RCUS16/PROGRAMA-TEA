import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "@/api/auth";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pacientes", label: "Pacientes" },
  { to: "/avaliacao", label: "Nova avaliacao" },
  { to: "/sessoes", label: "Sessoes" },
  { to: "/relatorios", label: "Relatorios" },
  { to: "/ajuda", label: "Ajuda" }
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/dashboard" className="brand">
          Plataforma Diagnostica TEA
        </Link>
        <button type="button" onClick={handleLogout} className="logout">
          Sair
        </button>
      </header>
      <nav className="app-nav">
        {navLinks.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "active" : "")}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
