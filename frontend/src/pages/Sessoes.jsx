import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";
import { createSession, listPatients, listSessions } from "@/api/clinical";

const defaultValues = {
  patient_id: "",
  session_date: "",
  session_type: "orientacao_familiar",
  objectives: "",
  interventions: "",
  family_guidance: "",
  next_steps: "",
};

const sessionGuidance = {
  avaliacao_inicial: "Mapeie sinais do TEA e registre encaminhamentos iniciais conforme o Protocolo TEA-SP.",
  orientacao_familiar: "Documente orientacoes entregues aos responsaveis e combinacoes com a rede SUS.",
  intervencao_clinica: "Descreva tecnicas aplicadas e respostas da crianca para monitoramento futuro.",
  acompanhamento_escolar: "Integre informacoes com equipe escolar e registre ajustes pedagogicos propostos.",
  reuniao_rede: "Liste participantes, decisoes e compromissos assumidos na rede de cuidado.",
};

export default function Sessoes() {
  const { register, handleSubmit, reset } = useForm({ defaultValues });
  const [patients, setPatients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [status, setStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPatients = async () => {
    try {
      const data = await listPatients({ archived: false });
      setPatients(data);
      if (data.length && !selectedPatient) {
        setSelectedPatient(String(data[0].id));
      }
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", message: "Nao foi possivel carregar pacientes." });
    }
  };

  const loadSessions = async (patientId) => {
    setLoading(true);
    try {
      const params = patientId ? { patient: patientId } : {};
      const data = await listSessions(params);
      setSessions(data);
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", message: "Nao foi possivel carregar sessoes." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadSessions(selectedPatient);
    } else {
      loadSessions();
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (showForm) {
      reset({ ...defaultValues, patient_id: selectedPatient });
    }
  }, [showForm, selectedPatient, reset]);

  const toggleForm = () => {
    setStatus(null);
    setShowForm((prev) => {
      const next = !prev;
      if (!prev) {
        reset({ ...defaultValues, patient_id: selectedPatient });
      }
      return next;
    });
  };

  const handleSubmitSession = async (values) => {
    setStatus(null);
    const payload = { ...values, patient_id: values.patient_id || selectedPatient };
    if (!payload.patient_id) {
      setStatus({ kind: "error", message: "Selecione um paciente para registrar a sessao." });
      return;
    }
    try {
      await createSession(payload);
      setStatus({ kind: "success", message: "Sessao registrada com sucesso." });
      reset({ ...defaultValues, patient_id: selectedPatient });
      setShowForm(false);
      loadSessions(selectedPatient);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data || "Nao foi possivel registrar a sessao.";
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      setStatus({ kind: "error", message });
    }
  };

  const summary = useMemo(() => {
    const total = sessions.length;
    const lastMeeting = sessions[0]?.session_date
      ? dayjs(sessions[0].session_date).format("DD/MM/YYYY")
      : "--";
    const familyMeetings = sessions.filter((item) => item.session_type === "orientacao_familiar").length;
    return { total, lastMeeting, familyMeetings };
  }, [sessions]);

  return (
    <div className="patients-page">
      <section className="summary-grid">
        <div className="summary-card">
          <span>Sessoes registradas</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-card">
          <span>Ultima sessao</span>
          <strong>{summary.lastMeeting}</strong>
        </div>
        <div className="summary-card">
          <span>Interacao com familias</span>
          <strong>{summary.familyMeetings}</strong>
        </div>
        <div className="summary-card">
          <span>Paciente</span>
          <select value={selectedPatient} onChange={(event) => setSelectedPatient(event.target.value)}>
            <option value="">Todos</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <h2>Planejamento de sessoes</h2>
            <p>Registre intervencoes, orientacoes e proximos passos.</p>
          </div>
          <button type="button" className="button secondary" onClick={toggleForm}>
            {showForm ? "Fechar formulario" : "Nova sessao"}
          </button>
        </header>
        {status ? (
          <div className={`status-message ${status.kind === "error" ? "status-error" : "status-success"}`}>
            {status.message}
          </div>
        ) : null}
        {showForm ? (
          <form className="form" onSubmit={handleSubmit(handleSubmitSession)}>
            <div className="form-inline">
              <label>
                Paciente
                <select {...register("patient_id", { required: true })} defaultValue={selectedPatient}>
                  <option value="">Selecione</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input type="date" {...register("session_date", { required: true })} />
              </label>
            </div>
            <label>
              Tipo de sessao
              <select {...register("session_type", { required: true })}>
                <option value="avaliacao_inicial">Avaliacao inicial</option>
                <option value="orientacao_familiar">Orientacao familiar</option>
                <option value="intervencao_clinica">Intervencao clinica</option>
                <option value="acompanhamento_escolar">Acompanhamento escolar</option>
                <option value="reuniao_rede">Reuniao com a rede SUS</option>
              </select>
            </label>
            <label>
              Objetivos da sessao
              <textarea
                rows={2}
                {...register("objectives")}
                placeholder="Defina metas observaveis e alinhadas ao protocolo."
              />
            </label>
            <label>
              Intervencoes aplicadas
              <textarea
                rows={2}
                {...register("interventions")}
                placeholder="Descreva tecnicas, instrumentos e respostas do paciente."
              />
            </label>
            <label>
              Orientacao familiar
              <textarea
                rows={2}
                {...register("family_guidance")}
                placeholder="Registre encaminhamentos e combinacoes com os responsaveis."
              />
            </label>
            <label>
              Proximos passos
              <textarea
                rows={2}
                {...register("next_steps")}
                placeholder="Planeje reavaliacoes, encaminhamentos e tarefas para a familia."
              />
            </label>
            <button type="submit" className="button">
              Salvar sessao
            </button>
          </form>
        ) : (
          <div style={{ lineHeight: 1.6, color: "#475569" }}>
            <p>Documente cada encontro para manter coerencia com o Protocolo TEA-SP:</p>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>Registre orientacoes familiares e combinacoes de cuidado compartilhado.</li>
              <li>Conecte a rede de saude ao progresso da crianca com notas objetivas.</li>
              <li>Defina proximos passos para a equipe multiprofissional.</li>
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <h2>Historico de sessoes</h2>
            <p>Visualize os registros ordenados da sessao mais recente para a mais antiga.</p>
          </div>
        </header>
        {loading ? (
          <p>Carregando registros...</p>
        ) : sessions.length === 0 ? (
          <p>Nenhuma sessao registrada para este filtro.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
            {sessions.map((session) => (
              <li key={session.id} className="summary-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{dayjs(session.session_date).format("DD/MM/YYYY")}</strong>
                  <span>{sessionGuidance[session.session_type]}</span>
                </div>
                <p style={{ margin: "0.35rem 0" }}>
                  <strong>Objetivos:</strong> {session.objectives || "--"}
                </p>
                <p style={{ margin: "0.35rem 0" }}>
                  <strong>Intervencoes:</strong> {session.interventions || "--"}
                </p>
                <p style={{ margin: "0.35rem 0" }}>
                  <strong>Orientacao familiar:</strong> {session.family_guidance || "--"}
                </p>
                <p style={{ margin: "0.35rem 0" }}>
                  <strong>Proximos passos:</strong> {session.next_steps || "--"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
