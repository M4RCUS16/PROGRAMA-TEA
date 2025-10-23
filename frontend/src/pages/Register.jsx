import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "@/api/auth";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await registerUser(form);
      setSuccess("Cadastro realizado com sucesso! Você será redirecionado para o login.");
      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (err) {
      const detail =
        err?.response?.data ||
        "Não foi possível concluir o cadastro. Revise as informações informadas.";
      const message =
        typeof detail === "string"
          ? detail
          : Object.entries(detail)
              .map(([field, errors]) => `${field}: ${[].concat(errors).join(", ")}`)
              .join(" | ");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-side">
        <h1>Plataforma Diagnostica TEA</h1>
        <p>
          Cadastre profissionais habilitados para a aplicação do Protocolo M-CHAT
          e acompanhamento conforme a diretriz TEA-SP.
        </p>
        <ul>
          <li>Profissionais da psicologia, psiquiatria ou gestão em saúde.</li>
          <li>Validação de dados e cadastro único por e-mail institucional.</li>
          <li>Reforço na confidencialidade dos dados dos pacientes.</li>
        </ul>
        <Link to="/login" className="ghost-link">
          Já possui cadastro? Entrar
        </Link>
      </div>
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h2>Criar conta profissional</h2>
        <div className="form-inline">
          <label>
            Nome
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Sobrenome
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
            />
          </label>
        </div>
        <label>
          E-mail institucional
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="nome.sobrenome@instituicao.gov.br"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            name="confirm_password"
            value={form.confirm_password}
            onChange={handleChange}
            required
          />
        </label>
        {error ? <div className="status-message status-error">{error}</div> : null}
        {success ? <div className="status-message status-success">{success}</div> : null}
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Enviando..." : "Criar conta"}
        </button>
      </form>
    </div>
  );
}
