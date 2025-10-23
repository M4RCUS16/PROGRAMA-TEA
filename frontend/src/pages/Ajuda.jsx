import { useEffect, useState } from "react";
import { fetchHelpContent } from "@/api/clinical";

export default function Ajuda() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchHelpContent();
        setContent(data);
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, []);

  if (!content) {
    return <p>Carregando orientações...</p>;
  }

  return (
    <article className="card">
      <h1>{content.titulo}</h1>
      <p>{content.introducao}</p>
      <h2>Aplicação do M-CHAT</h2>
      <ul>
        {content.passo_a_passo.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <h2>Interpretação dos resultados</h2>
      <p>{content.interpretacao}</p>
      <h2>Orientações de encaminhamento</h2>
      <p>{content.orientacoes_sus}</p>
      <p><em>{content.creditos}</em></p>
    </article>
  );
}
