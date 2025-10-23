import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  createReport,
  generateReportPdf,
  listEvaluations,
  listPatients,
  fetchGeneralReport,
  downloadGeneralReportPdf,
} from "@/api/clinical";

const defaults = {
  evaluation_id: "",
  title: "",
  content: "",
  periodic_review_notes: "",
  health_equipment_notes: "",
};

export default function Relatorio() {
  const [evaluations, setEvaluations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [generalPatient, setGeneralPatient] = useState("");
  const [generalData, setGeneralData] = useState(null);
  const [generalStatus, setGeneralStatus] = useState(null);
  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [downloadingGeneral, setDownloadingGeneral] = useState(false);
  const [form, setForm] = useState(defaults);
  const [feedback, setFeedback] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [evaluationData, patientData] = await Promise.all([
          listEvaluations(),
          listPatients({ archived: false }),
        ]);
        setEvaluations(evaluationData);
        setPatients(patientData);
        if (patientData.length) {
          setGeneralPatient((prev) => prev || String(patientData[0].id));
        }
      } catch (error) {
        console.error(error);
        setGeneralStatus({ kind: "error", message: "Nao foi possivel carregar os dados." });
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadGeneral = async () => {
      if (!generalPatient) {
        setGeneralData(null);
        return;
      }
      setLoadingGeneral(true);
      try {
        const data = await fetchGeneralReport(generalPatient);
        setGeneralData(data);
        setGeneralStatus(null);
      } catch (error) {
        console.error(error);
        setGeneralStatus({ kind: "error", message: "Nao foi possivel carregar o relatorio geral." });
      } finally {
        setLoadingGeneral(false);
      }
    };
    loadGeneral();
  }, [generalPatient]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const report = await createReport(form);
      setReports((prev) => [report, ...prev]);
      setForm(defaults);
      setFeedback({ message: "Relatorio registrado com sucesso.", kind: "success" });
    } catch (error) {
      console.error(error);
      setFeedback({ message: "Erro ao registrar relatorio.", kind: "error" });
    }
  };

  const handleGeneratePdf = async (id) => {
    try {
      const response = await generateReportPdf(id);
      if (response?.detail) {
        setFeedback({ message: response.detail, kind: "success" });
        return;
      }
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "relatorio-clinico-" + id + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({ message: "PDF gerado com sucesso.", kind: "success" });
    } catch (error) {
      console.error(error);
      setFeedback({ message: "Nao foi possivel gerar o PDF.", kind: "error" });
    }
  };

  const handleDownloadGeneral = async () => {
    if (!generalPatient) {
      setGeneralStatus({ kind: "error", message: "Selecione um paciente." });
      return;
    }
    setGeneralStatus(null);
    setDownloadingGeneral(true);
    try {
      const response = await downloadGeneralReportPdf(generalPatient);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const patientName = generalData?.patient?.name || "paciente";
      link.href = url;
      link.download = `relatorio-geral-${patientName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setGeneralStatus({ kind: "success", message: "Relatorio geral exportado com sucesso." });
    } catch (error) {
      console.error(error);
      setGeneralStatus({ kind: "error", message: "Nao foi possivel gerar o PDF geral." });
    } finally {
      setDownloadingGeneral(false);
    }
  };

  const evaluationSummary = useMemo(() => {
    if (!generalData) {
      return { total: 0, followups: 0, last: null, lastRisk: null };
    }
    return {
      total: generalData.metrics.total_evaluations,
      followups: generalData.metrics.followups,
      last: generalData.metrics.last_evaluation,
      lastRisk: generalData.metrics.last_risk_label,
    };
  }, [generalData]);

  const sessionSummary = useMemo(() => {
    if (!generalData) {
      return { total: 0 };
    }
    return { total: generalData.metrics.total_sessions };
  }, [generalData]);

  return (
    <div className="grid">
      <section className="card general-report">
        <div className="general-header">
          <div>
            <h2>Relatorio geral do paciente</h2>
            <p>Sintese diagnostica e registros de acompanhamento conforme Protocolo TEA-SP.</p>
            {generalData ? (
              <div className="general-patient">
                <span>Responsavel: {generalData.patient.guardian_name}</span>
                <span>Contato: {generalData.patient.contact || "Nao informado"}</span>
              </div>
            ) : null}
          </div>
          <div className="general-actions">
            <select value={generalPatient} onChange={(event) => setGeneralPatient(event.target.value)}>
              <option value="">Selecione o paciente</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button secondary"
              onClick={handleDownloadGeneral}
              disabled={!generalPatient || downloadingGeneral || loadingGeneral}
            >
              {downloadingGeneral ? "Gerando PDF..." : "Exportar relatorio"}
            </button>
          </div>
        </div>
        {generalStatus ? (
          <div className={`status-message ${generalStatus.kind === "error" ? "status-error" : "status-success"}`}>
            {generalStatus.message}
          </div>
        ) : null}
        {loadingGeneral ? (
          <p>Carregando relatorio geral...</p>
        ) : generalData ? (
          <div className="general-content">
            <div className="summary-grid general-summary">
              <div className="summary-card">
                <span>Avaliacoes (total)</span>
                <strong>{evaluationSummary.total}</strong>
              </div>
              <div className="summary-card">
                <span>Reavaliacoes</span>
                <strong>{evaluationSummary.followups}</strong>
              </div>
              <div className="summary-card">
                <span>Ultima avaliacao</span>
                <strong>{evaluationSummary.last ? dayjs(evaluationSummary.last).format("DD/MM/YYYY") : "--"}</strong>
              </div>
              <div className="summary-card">
                <span>Risco atual</span>
                <strong>{evaluationSummary.lastRisk || "--"}</strong>
              </div>
              <div className="summary-card">
                <span>Sessoes registradas</span>
                <strong>{sessionSummary.total}</strong>
              </div>
            </div>

            <div className="general-panels">
              <div className="panel">
                <h3>Avaliacoes M-CHAT</h3>
                {generalData.evaluations.length === 0 ? (
                  <p>Nenhuma avaliacao registrada.</p>
                ) : (
                  <div className="panel-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Pontuacao</th>
                          <th>Risco</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generalData.evaluations.map((item) => (
                          <tr key={item.id}>
                            <td>{dayjs(item.created_at).format("DD/MM/YYYY HH:mm")}</td>
                            <td>{item.total_score}</td>
                            <td>{item.risk_label}</td>
                            <td>{item.is_follow_up ? "Reavaliacao" : "Inicial"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {generalData.evaluations.map((item) => (
                      <div key={`${item.id}-note`} className="panel-note">
                        <strong>Interpretacao:</strong> {item.clinical_interpretation}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="panel">
                <h3>Sessoes clinicas</h3>
                {generalData.sessions.length === 0 ? (
                  <p>Nenhuma sessao registrada.</p>
                ) : (
                  <div className="panel-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Objetivos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generalData.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>{dayjs(session.session_date).format("DD/MM/YYYY")}</td>
                            <td>{session.session_type_label}</td>
                            <td>{session.objectives || "Nao informado"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {generalData.sessions.map((session) => (
                      <div key={`${session.id}-details`} className="panel-note">
                        <p>
                          <strong>Intervencoes:</strong> {session.interventions || "Nao informado"}
                        </p>
                        <p>
                          <strong>Orientacao familiar:</strong> {session.family_guidance || "Nao informado"}
                        </p>
                        <p>
                          <strong>Proximos passos:</strong> {session.next_steps || "Nao informado"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p>Escolha um paciente para visualizar o relatorio geral.</p>
        )}
      </section>

      <section className="grid two report-section">
        <div className="card">
          <h2>Relatorio clinico personalizado</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Avaliacao
              <select name="evaluation_id" value={form.evaluation_id} onChange={handleChange} required>
                <option value="">Selecione</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>
                    {evaluation.patient?.name} - {evaluation.risk_label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titulo
              <input name="title" value={form.title} onChange={handleChange} required />
            </label>
            <label>
              Contexto clinico
              <textarea
                name="content"
                rows={3}
                value={form.content}
                onChange={handleChange}
                placeholder="Resumo das observacoes e intervencoes propostas."
                required
              />
            </label>
            <label>
              Reavaliacoes periodicas (secao 9)
              <textarea
                name="periodic_review_notes"
                rows={2}
                value={form.periodic_review_notes}
                onChange={handleChange}
              />
            </label>
            <label>
              Equipamentos de saude (secao 10)
              <textarea
                name="health_equipment_notes"
                rows={2}
                value={form.health_equipment_notes}
                onChange={handleChange}
              />
            </label>
            {feedback ? (
              <div className={`status-message ${feedback.kind === "error" ? "status-error" : "status-success"}`}>
                {feedback.message}
              </div>
            ) : null}
            <button type="submit" className="button">
              Salvar relatorio
            </button>
          </form>
        </div>
        <div className="card">
          <h2>Relatorios gerados</h2>
          {reports.length === 0 ? (
            <p>Os relatorios criados aparecerao aqui para download.</p>
          ) : (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <div>
                    <strong>{report.title}</strong>
                    <p>{report.evaluation?.patient?.name}</p>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => handleGeneratePdf(report.id)}
                  >
                    Gerar PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
