import { useEffect, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { fetchDashboard } from "@/api/clinical";

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

const quickLinks = [
  { to: "/pacientes", label: "Novo paciente" },
  { to: "/avaliacao", label: "Aplicar M-CHAT" },
  { to: "/relatorios", label: "Gerar relatório" },
  { to: "/ajuda", label: "Ajuda" },
];

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchDashboard();
        setData(result);
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, []);

  if (!data) {
    return <p>Carregando informações...</p>;
  }

  const doughnutData = {
    labels: Object.keys(data.risk_distribution),
    datasets: [
      {
        data: Object.values(data.risk_distribution),
        backgroundColor: ["#22d3ee", "#34d399", "#f97316"],
        borderColor: ["#0ea5e9", "#22c55e", "#fb923c"],
        borderWidth: 2,
      },
    ],
  };
const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "68%",
  layout: { padding: 12 },
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 16,
        color: "#334155",
        font: { family: "Inter", size: 12 },
      },
    },
  },
};

  const barData = {
    labels: ["Ultimos 3 meses"],
    datasets: [
      {
        label: "Reavaliacoes",
        data: [data.recent_reevaluations],
        backgroundColor: "#6366f1",
        borderRadius: 12,
        maxBarThickness: 64,
      },
    ],
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "#475569", font: { family: "Inter", size: 11 } },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: "#94a3b8", font: { family: "Inter", size: 11 } },
        grid: { color: "rgba(148,163,184,0.25)", drawBorder: false },
      },
    },
  };

  const lineData = {
    labels: data.monthly_followups.labels,
    datasets: [
      {
        label: "Reavaliacoes",
        data: data.monthly_followups.follow,
        fill: true,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.2)",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#1d4ed8",
      },
      {
        label: "Primeiras avaliacoes",
        data: data.monthly_followups.initial,
        fill: true,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.18)",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#16a34a",
      },
    ],
  };
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { boxWidth: 14, color: "#334155", font: { family: "Inter", size: 12 } },
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    interaction: { mode: "nearest", intersect: false },
    scales: {
      x: {
        ticks: { color: "#475569", font: { family: "Inter", size: 11 } },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#94a3b8", font: { family: "Inter" }, stepSize: 1 },
        grid: { color: "rgba(148,163,184,0.2)", drawBorder: false },
      },
    },
  };

  return (
    <div className="grid">
      <section className="grid two">
        <div className="card">
          <h2>Pacientes ativos</h2>
          <p className="big-number">{data.total_patients}</p>
          <small>Atualizado em {dayjs().format("DD/MM/YYYY HH:mm")}</small>
        </div>
        <div className="card">
          <h2>Pacientes arquivados</h2>
          <p className="big-number">{data.archived_patients}</p>
          <small>Histórico de acompanhamentos.</small>
        </div>
      </section>
      <section className="grid two">
        <div className="card">
          <h2>Avaliações realizadas</h2>
          <p className="big-number">{data.total_evaluations}</p>
          <small>Total acumulado na plataforma.</small>
        </div>
        <div className="card">
          <h2>Pacientes cadastrados</h2>
          <p className="big-number">{data.total_records}</p>
          <small>Ativos + arquivados.</small>
        </div>
      </section>
      <section className="grid two">
        <div className="card">
          <h2>Distribuicao de risco</h2>
          <div className="chart-frame chart-frame--donut">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
        <div className="card">
          <h2>Reavaliacoes recentes</h2>
          <div className="chart-frame">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </section>
      <section className="grid two">
        <div className="card">
          <h2>Producao clinica</h2>
          <div className="chart-frame">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>
        <div className="card">
          <h2>Indicadores-chave</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.8rem" }}>
            <li>
              <strong>{data.follow_up_count}</strong> reavaliacoes concluidas
            </li>
            <li>
              <strong>{data.initial_evaluations}</strong> primeiras avaliacoes registradas
            </li>
            <li>
              <strong>{data.average_score}</strong> media de pontos no M-CHAT
            </li>
            <li>
              <strong>{data.recent_reevaluations}</strong> reavaliacoes nos ultimos 90 dias
            </li>
          </ul>
        </div>
      </section>
      <section className="card">
        <h2>Atalhos rápidos</h2>
        <div className="quick-links">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="quick-link">
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
