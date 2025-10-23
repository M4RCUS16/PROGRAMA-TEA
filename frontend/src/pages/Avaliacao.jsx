import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";
import {
  fetchQuestions,
  listPatients,
  createEvaluation,
  listEvaluations,
  downloadEvaluationPdf,
} from "@/api/clinical";

const followUpGuidelines = [
  "Repetir o M-CHAT entre 1 e 3 meses observando itens criticos alterados.",
  "Registrar sinais complementares e discutir encaminhamentos com a familia.",
  "Acionar a rede multiprofissional do SUS para avaliacao integrada.",
];

export default function Avaliacao() {
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      patient_id: "",
      is_follow_up: "nao",
      observations: "",
    },
  });

  const [questions, setQuestions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedPatientId = watch("patient_id");
  const followUpMode = watch("is_follow_up");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [questionData, patientData] = await Promise.all([
          fetchQuestions(),
          listPatients({ archived: false }),
        ]);
        setQuestions(questionData);
        setPatients(patientData);
        if (patientData.length > 0) {
          setValue("patient_id", String(patientData[0].id));
        }
        setLoadError("");
      } catch (error) {
        console.error(error);
        setLoadError("Nao foi possivel carregar o questionario ou os pacientes.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [setValue]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedPatientId) {
        setHistory([]);
        return;
      }
      try {
        const data = await listEvaluations({ patient: selectedPatientId });
        setHistory(data);
      } catch (error) {
        console.error(error);
      }
    };
    loadHistory();
  }, [selectedPatientId]);

  const onSubmit = async (values) => {
    setSubmitError("");
    try {
      const responses = {};
      questions.forEach((question) => {
        responses[question.code] = values[question.code];
      });
      const payload = {
        patient_id: values.patient_id,
        responses,
        observations: values.observations,
        is_follow_up: values.is_follow_up === "sim",
      };
      const evaluation = await createEvaluation(payload);
      setResult(evaluation);
      setHistory((prev) => [evaluation, ...prev]);
      reset({ patient_id: values.patient_id, is_follow_up: "nao", observations: "" });
    } catch (error) {
      console.error(error);
      const detail =
        error?.response?.data || "Erro ao registrar a avaliacao. Revise os campos obrigatorios.";
      const message =
        typeof detail === "string"
          ? detail
          : Object.entries(detail)
              .map(([field, errors]) => `${field}: ${[].concat(errors).join(", ")}`)
              .join(" | ");
      setSubmitError(message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result?.id) return;
    setIsDownloading(true);
    try {
      const response = await downloadEvaluationPdf(result.id);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (result.patient?.name || "paciente").replace(/\s+/g, "-").toLowerCase();
      link.href = url;
      link.download = `avaliacao-${safeName}-${result.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setSubmitError("Nao foi possivel gerar o PDF. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  const questionBlocks = useMemo(
    () =>
      questions.map((question) => (
        <div key={question.code} className="question">
          <p>
            <strong>{question.id}.</strong> {question.text}
          </p>
          <div className="chips">
            <label className="chip">
              <input type="radio" value="sim" {...register(question.code, { required: true })} />
              Sim
            </label>
            <label className="chip">
              <input type="radio" value="nao" {...register(question.code, { required: true })} />
              Nao
            </label>
          </div>
        </div>
      )),
    [questions, register]
  );

  if (isLoading) {
    return <p>Carregando formulario de avaliacao...</p>;
  }

  if (loadError) {
    return (
      <div className="card">
        <h2>Nao foi possivel iniciar a avaliacao</h2>
        <p className="status-message status-error">{loadError}</p>
        <p>
          Volte ao <Link to="/dashboard">dashboard</Link> e tente novamente em alguns instantes.
        </p>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="card">
        <h2>Nenhum paciente cadastrado</h2>
        <p>
          Cadastre um paciente antes de aplicar o M-CHAT. Acesse <Link to="/pacientes">a tela de pacientes</Link>
          para registrar os dados.
        </p>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Avaliacao diagnostica (M-CHAT)</h2>
        <p>
          Responda com o responsavel pelas criancas cada pergunta oficial. A pontuacao e calculada automaticamente
          conforme a validacao brasileira do protocolo.
        </p>
        <form className="form" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Paciente
            <select {...register("patient_id", { required: true })}>
              <option value="">Selecione</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de aplicacao
            <select {...register("is_follow_up", { required: true })}>
              <option value="nao">Primeira aplicacao</option>
              <option value="sim">Reavaliacao</option>
            </select>
          </label>
          {followUpMode === "sim" ? (
            <div className="status-message status-success">
              <strong>Guia de reavaliacao:</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
                {followUpGuidelines.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="question-grid">{questionBlocks}</div>
          <label>
            Observacoes clinicas
            <textarea
              rows={4}
              placeholder="Anote observacoes relevantes do comportamento ou do contexto clinico."
              {...register("observations")}
            />
          </label>
          {submitError ? <div className="status-message status-error">{submitError}</div> : null}
          <button type="submit" className="button">
            Calcular pontuacao
          </button>
        </form>
      </section>
      {result ? (
        <section className="card">
          <h2>Resultado da avaliacao</h2>
          <p>
            Pontuacao total: <strong>{result.total_score}</strong>
          </p>
          <p>
            Classificacao: <strong>{result.risk_label}</strong>
          </p>
          <p>Interpretacao clinica:</p>
          <p>{result.clinical_interpretation}</p>
          {result.follow_up_recommendations ? (
            <>
              <p>Recomendacoes:</p>
              <p>{result.follow_up_recommendations}</p>
            </>
          ) : null}
          <button
            type="button"
            className="button secondary"
            style={{ marginTop: "1rem" }}
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            {isDownloading ? "Gerando PDF..." : "Baixar PDF do resultado"}
          </button>
        </section>
      ) : null}
      <section className="card">
        <h2>Historico de avaliacoes</h2>
        {history.length === 0 ? (
          <p>Nenhuma avaliacao registrada para este paciente.</p>
        ) : (
          <ul className="eval-history">
            {history.map((item) => (
              <li key={item.id} className="eval-history-item">
                <div className="eval-history-header">
                  <span className="eval-history-date">
                    {dayjs(item.created_at).format("DD/MM/YYYY HH:mm")}
                  </span>
                  <span className="eval-history-score">
                    Pontuacao {item.total_score}
                  </span>
                </div>
                <div className="eval-history-meta">
                  <span className="eval-history-risk">
                    Risco: {item.risk_label}
                  </span>
                </div>
                <p className="eval-history-text">{item.clinical_interpretation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
