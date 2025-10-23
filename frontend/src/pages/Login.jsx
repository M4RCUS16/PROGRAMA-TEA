import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/api/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Credenciais inválidas. Confirme e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-side">
        <h1>Plataforma Diagnostica TEA</h1>
        <p>
          Acompanhe a aplicação do M-CHAT e o histórico clínico de crianças com
          risco para TEA, seguindo o Protocolo do Estado de São Paulo.
        </p>
        <ul>
          <li>Painéis com indicadores de risco e reavaliações.</li>
          <li>Fluxo completo de cadastros, laudos e relatórios em PDF.</li>
          <li>Conteúdo de apoio para profissionais e responsáveis.</li>
        </ul>
        <Link to="/register" className="ghost-link">
          Não possui acesso? Solicitar cadastro
        </Link>
      </div>
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h2>Entrar na plataforma</h2>
        <label>
          E-mail cadastrado
          <input
            type="email"
            placeholder="nome@instituicao.gov.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <div className="status-message status-error">{error}</div> : null}
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <small>
          Esqueceu o acesso? Contate o administrador regional para redefinir sua senha.
        </small>
      </form>
    </div>
  );
}
