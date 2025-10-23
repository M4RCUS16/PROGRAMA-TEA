import apiClient from "./client";

export const fetchDashboard = async () => {
  const { data } = await apiClient.get("/dashboard/summary/");
  return data;
};

export const fetchHelpContent = async () => {
  const { data } = await apiClient.get("/help/");
  return data;
};

export const listPatients = async (params = {}) => {
  const query = { ...params };
  if (typeof query.archived === "boolean") {
    query.archived = query.archived ? "true" : "false";
  }
  const { data } = await apiClient.get("/patients/", { params: query });
  return data;
};

export const createPatient = async (payload) => {
  const config =
    payload instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
  const { data } = await apiClient.post("/patients/", payload, config);
  return data;
};

export const updatePatient = async (id, payload) => {
  const config =
    payload instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
  const { data } = await apiClient.patch(`/patients/${id}/`, payload, config);
  return data;
};

export const archivePatient = async (id) => {
  const { data } = await apiClient.post(`/patients/${id}/archive/`);
  return data;
};

export const restorePatient = async (id) => {
  const { data } = await apiClient.post(`/patients/${id}/restore/`);
  return data;
};

export const fetchQuestions = async () => {
  const { data } = await apiClient.get("/evaluations/questions/");
  return data;
};

export const createEvaluation = async (payload) => {
  const { data } = await apiClient.post("/evaluations/", payload);
  return data;
};

export const listEvaluations = async (params = {}) => {
  const { data } = await apiClient.get("/evaluations/", { params });
  return data;
};

export const createReport = async (payload) => {
  const { data } = await apiClient.post("/reports/", payload);
  return data;
};

export const generateReportPdf = async (id) => {
  const { data } = await apiClient.post(`/reports/${id}/generate_pdf/`);
  return data;
};

export const downloadEvaluationPdf = async (id) => {
  const response = await apiClient.get(`/evaluations/${id}/export_pdf/`, {
    responseType: "blob",
  });
  return response;
};

export const listSessions = async (params = {}) => {
  const { data } = await apiClient.get("/sessions/", { params });
  return data;
};

export const createSession = async (payload) => {
  const { data } = await apiClient.post("/sessions/", payload);
  return data;
};

export const fetchGeneralReport = async (patientId) => {
  const { data } = await apiClient.get("/reports/general/", {
    params: { patient: patientId },
  });
  return data;
};

export const downloadGeneralReportPdf = async (patientId) => {
  const response = await apiClient.post(
    "/reports/general/",
    { patient_id: patientId },
    { responseType: "blob" }
  );
  return response;
};
