import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import dayjs from "dayjs";
import {
  archivePatient,
  createPatient,
  listPatients,
  restorePatient,
} from "@/api/clinical";

const defaultValues = {
  name: "",
  birth_date: "",
  guardian_name: "",
  contact: "",
  cpf: "",
  address: "",
  summary_history: "",
  clinical_attachment: null,
};

export default function PacienteForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues });

  const [activePatients, setActivePatients] = useState([]);
  const [archivedPatients, setArchivedPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [status, setStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const detailSectionRef = useRef(null);
  const [shouldScrollDetail, setShouldScrollDetail] = useState(false);

  const loadPatients = async () => {
    try {
      const [active, archived] = await Promise.all([
        listPatients({ archived: false }),
        listPatients({ archived: true }),
      ]);
      setActivePatients(active);
      setArchivedPatients(archived);
      setSelectedPatient((current) => {
        if (current) {
          return (
            [...active, ...archived].find((patient) => patient.id === current.id) ||
            active[0] ||
            archived[0] ||
            null
          );
        }
        return active[0] || archived[0] || null;
      });
    } catch (error) {
      console.error(error);
      setStatus({
        kind: "error",
        message: "Não foi possível carregar a lista de pacientes.",
      });
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleToggleForm = () => {
    setStatus(null);
    setShowForm((prev) => !prev);
    if (!showForm) {
      reset(defaultValues);
    }
  };

  const handleSubmitPatient = async (values) => {
    setStatus(null);
    try {
      const payload = (() => {
        const fileList = values.clinical_attachment;
        if (fileList && fileList.length > 0) {
          const formData = new FormData();
          Object.entries(values).forEach(([key, value]) => {
            if (key === "clinical_attachment") {
              if (value && value.length > 0) {
                formData.append(key, value[0]);
              }
            } else if (value !== null && value !== "") {
              formData.append(key, value);
            }
          });
          return formData;
        }
        // Remove attachment if vazio
        const { clinical_attachment, ...rest } = values;
        return rest;
      })();

      await createPatient(payload);
      reset(defaultValues);
      setStatus({
        kind: "success",
        message: "Paciente cadastrado com sucesso.",
      });
      setShowForm(false);
      await loadPatients();
    } catch (error) {
      console.error(error);
      const detail =
        error?.response?.data ||
        "Erro ao cadastrar paciente. Verifique os dados informados.";
      const message =
        typeof detail === "string"
          ? detail
          : Object.entries(detail)
              .map(([field, errors]) => `${field}: ${[].concat(errors).join(", ")}`)
              .join(" | ");
      setStatus({ message, kind: "error" });
    }
  };

  const handleArchive = async (patient) => {
    setStatus(null);
    try {
      await archivePatient(patient.id);
      await loadPatients();
      setStatus({
        kind: "success",
        message: `Paciente ${patient.name} arquivado.`,
      });
    } catch (error) {
      console.error(error);
      setStatus({
        kind: "error",
        message: "Não foi possível arquivar o paciente.",
      });
    }
  };

  const handleRestore = async (patient) => {
    setStatus(null);
    try {
      await restorePatient(patient.id);
      await loadPatients();
      setStatus({
        kind: "success",
        message: `Paciente ${patient.name} reativado.`,
      });
    } catch (error) {
      console.error(error);
      setStatus({
        kind: "error",
        message: "Não foi possível restaurar o paciente.",
      });
    }
  };

  const handleSelectPatient = (patient) => {
    if (!patient) {
      return;
    }
    setSelectedPatient((current) => {
      if (current?.id === patient.id) {
        return current;
      }
      return patient;
    });
    setShouldScrollDetail(true);
  };

  const summary = useMemo(
    () => ({
      active: activePatients.length,
      archived: archivedPatients.length,
      total: activePatients.length + archivedPatients.length,
    }),
    [activePatients, archivedPatients]
  );

  const normalizeText = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const normalizedSearch = normalizeText(searchTerm.trim());

  const filteredActivePatients = useMemo(
    () =>
      !normalizedSearch
        ? activePatients
        : activePatients.filter((patient) =>
            normalizeText(patient.name).includes(normalizedSearch)
          ),
    [activePatients, normalizedSearch]
  );

  const filteredArchivedPatients = useMemo(
    () =>
      !normalizedSearch
        ? archivedPatients
        : archivedPatients.filter((patient) =>
            normalizeText(patient.name).includes(normalizedSearch)
          ),
    [archivedPatients, normalizedSearch]
  );

  useEffect(() => {
    if (!normalizedSearch) {
      if (!selectedPatient && (activePatients.length || archivedPatients.length)) {
        setSelectedPatient(activePatients[0] || archivedPatients[0] || null);
      }
      return;
    }

    const isSelectedVisible =
      (selectedPatient &&
        (filteredActivePatients.some((patient) => patient.id === selectedPatient.id) ||
          filteredArchivedPatients.some((patient) => patient.id === selectedPatient.id))) ||
      false;

    if (!isSelectedVisible) {
      const fallback = filteredActivePatients[0] || filteredArchivedPatients[0] || null;
      setSelectedPatient(fallback);
    }
  }, [
    normalizedSearch,
    filteredActivePatients,
    filteredArchivedPatients,
    selectedPatient,
    activePatients,
    archivedPatients,
  ]);

  useEffect(() => {
    if (shouldScrollDetail && detailSectionRef.current) {
      detailSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScrollDetail(false);
    }
  }, [shouldScrollDetail, selectedPatient]);

  const formatDate = (value) =>
    value ? dayjs(value).format("DD/MM/YYYY") : "Não informado";

  const activeSelectedIndex =
    selectedPatient && filteredActivePatients
      ? filteredActivePatients.findIndex((patient) => patient.id === selectedPatient.id)
      : -1;
  const archivedSelectedIndex =
    selectedPatient && filteredArchivedPatients
      ? filteredArchivedPatients.findIndex((patient) => patient.id === selectedPatient.id)
      : -1;
  const selectedDisplayNumber =
    activeSelectedIndex >= 0
      ? activeSelectedIndex + 1
      : archivedSelectedIndex >= 0
      ? archivedSelectedIndex + 1
      : null;

  return (
    <div className="patients-page">
      <section className="summary-grid">
        <div className="summary-card">
          <span>Pacientes ativos</span>
          <strong>{summary.active}</strong>
        </div>
        <div className="summary-card">
          <span>Arquivados</span>
          <strong>{summary.archived}</strong>
        </div>
        <div className="summary-card">
          <span>Total cadastrados</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-card">
          <span>Novo cadastro</span>
          <strong>Organize a fila</strong>
          <button type="button" className="button" onClick={handleToggleForm}>
            {showForm ? "Fechar formulario" : "Novo paciente"}
          </button>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <div>
            <h2>Cadastro de pacientes</h2>
            <p>Registre novos atendimentos seguindo o Protocolo TEA-SP.</p>
          </div>
          <button type="button" className="button secondary" onClick={handleToggleForm}>
            {showForm ? "Fechar formulario" : "Novo paciente"}
          </button>
        </header>
        {status ? (
          <div
            className={`status-message ${status.kind === "error" ? "status-error" : "status-success"}`}
          >
            {status.message}
          </div>
        ) : null}
        {showForm ? (
          <form className="form" onSubmit={handleSubmit(handleSubmitPatient)}>
            <div className="form-inline">
              <label>
                Nome completo
                <input {...register("name", { required: true })} placeholder="Nome e sobrenome" />
              </label>
              <label>
                Data de nascimento
                <input type="date" {...register("birth_date", { required: true })} />
              </label>
            </div>
            <div className="form-inline">
              <label>
                Responsável
                <input {...register("guardian_name", { required: true })} placeholder="Nome do responsável" />
              </label>
              <label>
                Contato
                <input {...register("contact")} placeholder="(11) 99999-9999" />
              </label>
            </div>
            <div className="form-inline">
              <label>
                CPF
                <input {...register("cpf", { required: true })} placeholder="00000000000" />
              </label>
              <label>
                Relatório clínico (opcional)
                <input type="file" accept=".pdf,image/*" {...register("clinical_attachment")} />
              </label>
            </div>
            <label>
              Endereço completo
              <textarea
                rows={2}
                {...register("address")}
                placeholder="Rua, número, complemento, bairro, cidade"
              />
            </label>
            <label>
              Histórico resumido
              <textarea
                rows={3}
                {...register("summary_history")}
                placeholder="Inclua resumo clínico, sinais observados e encaminhamentos."
              />
            </label>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar paciente"}
            </button>
          </form>
        ) : (
          <div style={{ lineHeight: 1.6, color: "#475569" }}>
            <p>
              Utilize o botão <strong>Novo paciente</strong> para registrar um atendimento. Siga os passos sugeridos
              no Protocolo TEA-SP:
            </p>
            <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>Confirme dados de contato e responsável para articulação com a rede SUS.</li>
              <li>Documente histórico sintético e orientações entregues à família.</li>
              <li>Anexe exames ou relatórios clínicos relevantes quando disponíveis.</li>
            </ol>
          </div>
        )}
      </section>

      <section className="card search-card">
        <div className="search-panel">
          <div>
            <h2>Buscar pacientes</h2>
            <p>Filtre rapidamente por nome nas listas abaixo.</p>
          </div>
          <label htmlFor="patient-search-input">
            Nome do paciente
            <input
              id="patient-search-input"
              type="search"
              placeholder="Digite para pesquisar"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>
        <small className="search-hint">
          {normalizedSearch
            ? `Mostrando resultados que correspondem a "${searchTerm}".`
            : "A busca considera pacientes ativos e arquivados."}
        </small>
      </section>

      <section className="card list-card">
        <header className="card-header">
          <div>
            <h2>Pacientes ativos</h2>
            <p>Registros em acompanhamento na rede.</p>
          </div>
        </header>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Responsável</th>
                <th>Contato</th>
                <th>Nascimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredActivePatients.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem" }}>
                    {normalizedSearch
                      ? `Nenhum paciente ativo encontrado para "${searchTerm}".`
                      : "Nenhum paciente ativo até o momento."}
                  </td>
                </tr>
              ) : (
                filteredActivePatients.map((patient, index) => (
                  <tr
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className={selectedPatient?.id === patient.id ? "row-active" : ""}
                  >
                    <td>
                      <div className="patient-column">
                        <strong>{patient.name}</strong>
                        <small>Paciente #{index + 1}</small>
                      </div>
                    </td>
                    <td>{patient.guardian_name}</td>
                    <td>{patient.contact || "Não informado"}</td>
                    <td>{formatDate(patient.birth_date)}</td>
                    <td>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleArchive(patient);
                        }}
                      >
                        Arquivar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card list-card">
        <header className="card-header">
          <div>
            <h2>Pacientes arquivados</h2>
            <p>Histórico de acompanhamentos encerrados ou suspensos.</p>
          </div>
        </header>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Responsável</th>
                <th>Contato</th>
                <th>Nascimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredArchivedPatients.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem" }}>
                    {normalizedSearch
                      ? `Nenhum paciente arquivado encontrado para "${searchTerm}".`
                      : "Nenhum paciente arquivado."}
                  </td>
                </tr>
              ) : (
                filteredArchivedPatients.map((patient, index) => (
                  <tr
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className={selectedPatient?.id === patient.id ? "row-active" : ""}
                  >
                    <td>
                      <div className="patient-column">
                        <strong>{patient.name}</strong>
                        <small>Paciente #{index + 1}</small>
                      </div>
                    </td>
                    <td>{patient.guardian_name}</td>
                    <td>{patient.contact || "Não informado"}</td>
                    <td>{formatDate(patient.birth_date)}</td>
                    <td>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRestore(patient);
                        }}
                      >
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPatient ? (
        <section className="card detail-card" ref={detailSectionRef} id="resumo-clinico">
          <header className="card-header">
            <div>
              <h2>Resumo clínico</h2>
              <p>Informações registradas neste cadastro.</p>
            </div>
          </header>
          <div className="patient-detail">
            <div>
              <span className="detail-label">Paciente</span>
              <h3>
                {selectedPatient.name}
                {selectedDisplayNumber
                  ? ` · Paciente #${selectedDisplayNumber}`
                  : ""}
              </h3>
              <p className="detail-subtitle">
                Nascido em {dayjs(selectedPatient.birth_date).format("DD [de] MMMM [de] YYYY")}
              </p>
            </div>
            <div className="detail-grid">
              <div>
                <span className="detail-label">Responsável</span>
                <p>{selectedPatient.guardian_name}</p>
              </div>
              <div>
                <span className="detail-label">Contato</span>
                <p>{selectedPatient.contact || "Não informado"}</p>
              </div>
              <div>
                <span className="detail-label">Endereço</span>
                <p>{selectedPatient.address || "Não informado"}</p>
              </div>
              <div>
                <span className="detail-label">Profissional responsável</span>
                <p>
                  {selectedPatient.professional
                    ? `${selectedPatient.professional.first_name || ""} ${
                        selectedPatient.professional.last_name || ""
                      }`.trim() || selectedPatient.professional.email
                    : "Registrado pelo profissional atual"}
                </p>
              </div>
            </div>
            <div>
              <span className="detail-label">Histórico resumido</span>
              <p className="detail-history">
                {selectedPatient.summary_history ||
                  "Nenhuma síntese clínica foi adicionada até o momento."}
              </p>
            </div>
            {selectedPatient.clinical_attachment ? (
              <a
                className="button secondary"
                href={selectedPatient.clinical_attachment}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver anexo clínico
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
