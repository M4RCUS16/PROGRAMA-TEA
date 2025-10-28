import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/dashboard" className="brand">
          Plataforma Diagnostica TEA
        </Link>
        <div className="header-actions">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Alternar menu de navegação"
            aria-expanded={isNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsNavOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
          <button type="button" onClick={handleLogout} className="logout">
            Sair
          </button>
        </div>
      </header>
      <nav className={`app-nav${isNavOpen ? " open" : ""}`} id="primary-navigation">
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
