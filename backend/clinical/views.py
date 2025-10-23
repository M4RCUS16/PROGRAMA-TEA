from io import BytesIO
from datetime import date, datetime, time

from django.core.files.base import ContentFile
from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .constants import MCHAT_QUESTIONS, RISK_LABELS
from .models import ClinicalReport, EvaluationMChat, Patient, SessionRecord
from .serializers import (
    ClinicalReportSerializer,
    EvaluationMChatSerializer,
    PatientSerializer,
    SessionRecordSerializer,
)


def to_ascii(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    try:
        return value.encode("latin-1", "ignore").decode("latin-1")
    except Exception:
        return value


def draw_wrapped_text(pdf, text, x, y, width, line_height, font="Helvetica", size=11):
    pdf.setFont(font, size)
    text = to_ascii(text)
    lines = []
    for paragraph in text.split("\n"):
        current_line = ""
        for word in paragraph.split():
            test_line = f"{current_line} {word}".strip()
            if pdf.stringWidth(test_line, font, size) <= width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        lines.append(current_line)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= line_height
    return y


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        professional = serializer.validated_data.get("professional") or self.request.user
        serializer.save(professional=professional)

    def perform_update(self, serializer):
        professional = serializer.validated_data.get("professional") or self.request.user
        serializer.save(professional=professional)

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(professional=user)

        action = getattr(self, "action", None)
        if action == "list":
            archived = self.request.query_params.get("archived")
            if archived is not None:
                return queryset.filter(archived=archived.lower() == "true")
            return queryset.filter(archived=False)

        return queryset

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        patient = self.get_object()
        patient.archived = True
        patient.save(update_fields=["archived"])
        return Response({"detail": "Paciente arquivado com sucesso."})

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        patient = self.get_object()
        patient.archived = False
        patient.save(update_fields=["archived"])
        return Response({"detail": "Paciente reativado com sucesso."})


class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = EvaluationMChat.objects.select_related("patient", "professional")
    serializer_class = EvaluationMChatSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(
                Q(professional=user) | Q(patient__professional=user)
            )
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        return queryset

    def perform_create(self, serializer):
        professional = serializer.validated_data.get("professional") or self.request.user
        serializer.save(professional=professional)

    @action(detail=False, methods=["get"])
    def questions(self, request):
        return Response(MCHAT_QUESTIONS)

    @action(detail=True, methods=["get"], url_path="export_pdf")
    def export_pdf(self, request, pk=None):
        evaluation = self.get_object()
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        margin = 25 * mm
        header_height = 28 * mm
        y = height - margin

        pdf.setFillColor(HexColor("#1d4ed8"))
        pdf.roundRect(
            margin - 4 * mm,
            height - header_height - margin / 2,
            width - 2 * (margin - 4 * mm),
            header_height,
            6 * mm,
            fill=True,
            stroke=False,
        )

        pdf.setFillColor("#ffffff")
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawString(margin, height - margin, "Plataforma Diagnóstica TEA – M-CHAT")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(
            margin,
            height - margin - 14,
            "Resultado da avaliação M-CHAT conforme Protocolo TEA-SP (2013)",
        )

        pdf.setFillColor("#000000")
        y = height - margin - header_height - 15
        block_width = width - 2 * margin
        patient = evaluation.patient

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Dados da avaliação")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            (
                f"Paciente: {patient.name}\n"
                f"Profissional responsável: {evaluation.professional or 'Não atribuído'}\n"
                f"Data da avaliação: {evaluation.created_at:%d/%m/%Y}\n"
                f"Pontuação total: {evaluation.total_score}\n"
                f"Classificação de risco: {RISK_LABELS.get(evaluation.risk_level)}"
            ),
            margin,
            y,
            block_width,
            15,
        ) - 10

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Interpretação clínica")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            evaluation.clinical_interpretation,
            margin,
            y,
            block_width,
            14,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Observações clínicas")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            evaluation.observations or "Sem observações registradas.",
            margin,
            y,
            block_width,
            14,
        ) - 8

        if evaluation.follow_up_recommendations:
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(margin, y, "Recomendações")
            y -= 16
            pdf.setFont("Helvetica", 11)
            y = draw_wrapped_text(
                pdf,
                evaluation.follow_up_recommendations,
                margin,
                y,
                block_width,
                14,
            ) - 8

        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(HexColor("#6b7280"))
        pdf.drawString(
            margin,
            margin / 2,
            "Documento gerado automaticamente. Utilize este relatório para apoio à tomada de decisão clínica.",
        )

        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        filename = f"avaliacao_{patient.id}_{evaluation.created_at:%Y%m%d%H%M}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ClinicalReportViewSet(viewsets.ModelViewSet):
    queryset = ClinicalReport.objects.select_related("evaluation", "evaluation__patient")
    serializer_class = ClinicalReportSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(
                Q(evaluation__professional=user)
                | Q(evaluation__patient__professional=user)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def generate_pdf(self, request, pk=None):
        report = self.get_object()
        pdf_buffer = BytesIO()
        pdf = canvas.Canvas(pdf_buffer, pagesize=A4)
        width, height = A4
        margin = 25 * mm
        header_height = 28 * mm
        y = height - margin

        pdf.setFillColor(HexColor("#1d4ed8"))
        pdf.roundRect(
            margin - 4 * mm,
            height - header_height - margin / 2,
            width - 2 * (margin - 4 * mm),
            header_height,
            6 * mm,
            fill=True,
            stroke=False,
        )

        pdf.setFillColor("#ffffff")
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawString(margin, height - margin, "Plataforma Diagnóstica TEA – M-CHAT")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(
            margin,
            height - margin - 14,
            "Relatório clínico com base no Protocolo TEA-SP (Estado de São Paulo, 2013)",
        )

        y = height - margin - header_height - 15
        pdf.setFillColor("#000000")

        eval_obj = report.evaluation
        patient = eval_obj.patient
        block_width = width - 2 * margin

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Dados do paciente")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            (
                f"Nome: {patient.name}\n"
                f"Data de nascimento: {patient.birth_date:%d/%m/%Y}\n"
                f"Responsável: {patient.guardian_name}\n"
                f"Contato: {patient.contact or 'Não informado'}\n"
                f"Profissional responsável: {eval_obj.professional or 'Não atribuído'}"
            ),
            margin,
            y,
            block_width,
            15,
        ) - 10

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Avaliação M-CHAT")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            (
                f"Data da avaliação: {eval_obj.created_at:%d/%m/%Y}\n"
                f"Pontuação total: {eval_obj.total_score}\n"
                f"Classificação de risco: {RISK_LABELS.get(eval_obj.risk_level)}"
            ),
            margin,
            y,
            block_width,
            15,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Interpretação clínica")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            eval_obj.clinical_interpretation,
            margin,
            y,
            block_width,
            14,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Observações")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            eval_obj.observations or "Sem observações adicionais.",
            margin,
            y,
            block_width,
            14,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Recomendações")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            eval_obj.follow_up_recommendations
            or "Acompanhar em consultas regulares.",
            margin,
            y,
            block_width,
            14,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Contexto clínico adicional")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            report.content,
            margin,
            y,
            block_width,
            14,
        ) - 8

        if report.periodic_review_notes:
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(margin, y, "Reavaliações periódicas (Protocolo TEA-SP, seção 9)")
            y -= 16
            pdf.setFont("Helvetica", 11)
            y = draw_wrapped_text(
                pdf,
                report.periodic_review_notes,
                margin,
                y,
                block_width,
                14,
            ) - 8

        if report.health_equipment_notes:
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(
                margin,
                y,
                "Equipamentos de saúde de referência (Protocolo TEA-SP, seção 10)",
            )
            y -= 16
            pdf.setFont("Helvetica", 11)
            y = draw_wrapped_text(
                pdf,
                report.health_equipment_notes,
                margin,
                y,
                block_width,
                14,
            ) - 8

        footer_y = margin / 2
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(HexColor("#6b7280"))
        pdf.drawString(
            margin,
            footer_y,
            "Gerado automaticamente pela Plataforma Diagnóstica TEA – M-CHAT. Uso restrito a profissionais autorizados.",
        )

        pdf.showPage()
        pdf.save()
        pdf_buffer.seek(0)

        filename = f"relatorio_{patient.id}_{timezone.now():%Y%m%d%H%M}.pdf"
        report.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))
        report.save(update_fields=["pdf_file"])
        return Response({"detail": "PDF gerado com sucesso.", "pdf_file": report.pdf_file.url})


class SessionRecordViewSet(viewsets.ModelViewSet):
    queryset = SessionRecord.objects.select_related("patient", "professional")
    serializer_class = SessionRecordSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_staff:
            queryset = queryset.filter(
                Q(professional=user) | Q(patient__professional=user)
            )
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        return queryset

    def perform_create(self, serializer):
        professional = serializer.validated_data.get("professional") or self.request.user
        serializer.save(professional=professional)


class GeneralReportView(APIView):
    def _get_patient(self, request, patient_id):
        patient = get_object_or_404(Patient, pk=patient_id)
        if not request.user.is_staff and patient.professional_id != request.user.id:
            raise PermissionDenied("Paciente nao encontrado.")
        return patient

    def get(self, request):
        patient_id = request.query_params.get("patient")
        if not patient_id:
            return Response({"detail": "Informe o parametro patient."}, status=status.HTTP_400_BAD_REQUEST)

        patient = self._get_patient(request, patient_id)
        evaluations = patient.evaluations.order_by("-created_at")
        sessions = patient.sessions.order_by("-session_date", "-created_at")

        evaluation_data = [
            {
                "id": item.id,
                "created_at": item.created_at,
                "total_score": item.total_score,
                "risk_level": item.risk_level,
                "risk_label": to_ascii(RISK_LABELS.get(item.risk_level, item.risk_level)),
                "is_follow_up": item.is_follow_up,
                "observations": item.observations,
                "clinical_interpretation": item.clinical_interpretation,
            }
            for item in evaluations
        ]

        session_type_map = dict(SessionRecord.SESSION_TYPES)
        session_data = [
            {
                "id": session.id,
                "session_date": session.session_date,
                "session_type": session.session_type,
                "session_type_label": to_ascii(session_type_map.get(session.session_type, session.session_type)),
                "objectives": session.objectives,
                "interventions": session.interventions,
                "family_guidance": session.family_guidance,
                "next_steps": session.next_steps,
            }
            for session in sessions
        ]

        metrics = {
            "total_evaluations": evaluations.count(),
            "total_sessions": sessions.count(),
            "followups": evaluations.filter(is_follow_up=True).count(),
            "last_evaluation": evaluations[0].created_at if evaluations else None,
            "last_risk_label": to_ascii(RISK_LABELS.get(evaluations[0].risk_level, evaluations[0].risk_level))
            if evaluations
            else None,
        }

        return Response(
            {
                "patient": {
                    "id": patient.id,
                    "name": patient.name,
                    "birth_date": patient.birth_date,
                    "guardian_name": patient.guardian_name,
                    "contact": patient.contact,
                },
                "evaluations": evaluation_data,
                "sessions": session_data,
                "metrics": metrics,
            }
        )

    def post(self, request):
        patient_id = request.data.get("patient_id")
        if not patient_id:
            return Response({"detail": "Informe patient_id."}, status=status.HTTP_400_BAD_REQUEST)

        patient = self._get_patient(request, patient_id)
        evaluations = list(patient.evaluations.order_by("-created_at"))
        sessions = list(patient.sessions.order_by("-session_date", "-created_at"))

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        margin = 25 * mm
        header_height = 28 * mm
        y = height - margin

        pdf.setFillColor(HexColor("#1d4ed8"))
        pdf.roundRect(
            margin - 4 * mm,
            height - header_height - margin / 2,
            width - 2 * (margin - 4 * mm),
            header_height,
            6 * mm,
            fill=True,
            stroke=False,
        )

        pdf.setFillColor("#ffffff")
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawString(margin, height - margin, "Relatorio geral do paciente")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(
            margin,
            height - margin - 14,
            "Sintese diagnostica e registros de acompanhamento (Protocolo TEA-SP)",
        )

        y = height - margin - header_height - 15
        pdf.setFillColor("#000000")
        block_width = width - 2 * margin

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Dados do paciente")
        y -= 16
        pdf.setFont("Helvetica", 11)
        y = draw_wrapped_text(
            pdf,
            (
                f"Nome: {patient.name}\n"
                f"Data de nascimento: {patient.birth_date:%d/%m/%Y}\n"
                f"Responsavel: {patient.guardian_name}\n"
                f"Contato: {patient.contact or 'Nao informado'}"
            ),
            margin,
            y,
            block_width,
            15,
        ) - 8

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y, "Resumo das avaliacoes M-CHAT")
        y -= 16
        pdf.setFont("Helvetica", 11)
        if evaluations:
            for evaluation in evaluations:
                lines = (
                    f"Data: {evaluation.created_at:%d/%m/%Y %H:%M}\n"
                    f"Pontuacao: {evaluation.total_score} | Risco: {to_ascii(RISK_LABELS.get(evaluation.risk_level, evaluation.risk_level))}\n"
                    f"Reavaliacao: {'Sim' if evaluation.is_follow_up else 'Nao'}\n"
                    f"Interpretacao: {evaluation.clinical_interpretation}"
                )
                y = draw_wrapped_text(pdf, lines, margin, y, block_width, 14) - 10
                if y < margin + 80:
                    pdf.showPage()
                    pdf.setFont("Helvetica", 11)
                    y = height - margin
        else:
            y = draw_wrapped_text(pdf, "Nenhuma avaliacao registrada.", margin, y, block_width, 14) - 8

        if y < margin + 80:
            pdf.showPage()
            pdf.setFont("Helvetica-Bold", 12)
            pdf.setFillColor("#000000")
            y = height - margin

        pdf.drawString(margin, y, "Resumo das sessoes clinicas")
        y -= 16
        pdf.setFont("Helvetica", 11)
        if sessions:
            type_map = dict(SessionRecord.SESSION_TYPES)
            for session in sessions:
                lines = (
                    f"Data: {session.session_date:%d/%m/%Y} | Tipo: {to_ascii(type_map.get(session.session_type, session.session_type))}\n"
                    f"Objetivos: {session.objectives or 'Nao informado'}\n"
                    f"Intervencoes: {session.interventions or 'Nao informado'}\n"
                    f"Orientacao familiar: {session.family_guidance or 'Nao informado'}\n"
                    f"Proximos passos: {session.next_steps or 'Nao informado'}"
                )
                y = draw_wrapped_text(pdf, lines, margin, y, block_width, 14) - 10
                if y < margin + 100:
                    pdf.showPage()
                    pdf.setFont("Helvetica", 11)
                    y = height - margin
        else:
            y = draw_wrapped_text(pdf, "Nenhuma sessao registrada.", margin, y, block_width, 14) - 8

        footer_y = margin / 2
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(HexColor("#6b7280"))
        pdf.drawString(
            margin,
            footer_y,
            "Documento automatizado. Utilize este relatorio para apoiar reunioes multiprofissionais.",
        )

        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        filename = f"relatorio-geral_{patient.id}_{timezone.now():%Y%m%d%H%M}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class DashboardSummaryView(APIView):
    def get(self, request):
        user = request.user
        if user.is_staff:
            patient_qs = Patient.objects.all()
            evaluation_qs = EvaluationMChat.objects.all()
        else:
            patient_qs = Patient.objects.filter(professional=user)
            evaluation_qs = EvaluationMChat.objects.filter(
                Q(professional=user) | Q(patient__professional=user)
            )

        total_patients = patient_qs.filter(archived=False).count()
        archived_patients = patient_qs.filter(archived=True).count()
        total_evaluations = evaluation_qs.count()
        distribution = (
            evaluation_qs.values("risk_level")
            .annotate(total=Count("risk_level"))
            .order_by()
        )
        risk_distribution = {
            RISK_LABELS.get(item["risk_level"], item["risk_level"]): item["total"]
            for item in distribution
        }

        three_months_ago = timezone.now() - timezone.timedelta(days=90)
        reevaluations = evaluation_qs.filter(
            is_follow_up=True, created_at__gte=three_months_ago
        ).count()

        follow_up_count = evaluation_qs.filter(is_follow_up=True).count()
        initial_count = evaluation_qs.filter(is_follow_up=False).count()
        average_score = (
            evaluation_qs.aggregate(avg=Avg("total_score")).get("avg") or 0
        )

        base_month = timezone.now().date().replace(day=1)

        def subtract_months(base, months):
            year = base.year
            month = base.month - months
            while month <= 0:
                month += 12
                year -= 1
            return date(year, month, 1)

        def next_month(start):
            if start.month == 12:
                return date(start.year + 1, 1, 1)
            return date(start.year, start.month + 1, 1)

        labels = []
        follow_series = []
        initial_series = []
        tz = timezone.get_current_timezone()

        for offset in range(5, -1, -1):
            month_start = subtract_months(base_month, offset)
            month_end = next_month(month_start)
            start_dt = timezone.make_aware(datetime.combine(month_start, time.min), tz)
            end_dt = timezone.make_aware(datetime.combine(month_end, time.min), tz)
            labels.append(month_start.strftime("%b/%Y"))
            follow_series.append(
                evaluation_qs.filter(
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    is_follow_up=True,
                ).count()
            )
            initial_series.append(
                evaluation_qs.filter(
                    created_at__gte=start_dt,
                    created_at__lt=end_dt,
                    is_follow_up=False,
                ).count()
            )

        return Response(
            {
                "total_patients": total_patients,
                "archived_patients": archived_patients,
                "total_records": total_patients + archived_patients,
                "total_evaluations": total_evaluations,
                "risk_distribution": risk_distribution,
                "recent_reevaluations": reevaluations,
                "follow_up_count": follow_up_count,
                "initial_evaluations": initial_count,
                "average_score": round(average_score, 2),
                "monthly_followups": {
                    "labels": labels,
                    "follow": follow_series,
                    "initial": initial_series,
                },
            }
        )


class HelpContentView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "titulo": "Plataforma Diagnóstica TEA – Protocolo M-CHAT / São Paulo (2013)",
                "introducao": (
                    "O Transtorno do Espectro Autista (TEA) é definido pela CID-10 como um "
                    "transtorno global do desenvolvimento caracterizado por prejuízos na interação "
                    "social, comunicação e comportamento. O Protocolo TEA-SP orienta a identificação, "
                    "a intervenção precoce e o encaminhamento dentro da rede SUS."
                ),
                "passo_a_passo": [
                    "1. Cadastre o paciente com dados completos e histórico clínico.",
                    "2. Inicie uma nova avaliação M-CHAT e preencha as 23 perguntas com a família.",
                    "3. Revise a pontuação automática e registre observações clínicas relevantes.",
                    "4. Gere relatórios em PDF com interpretação e recomendações personalizadas.",
                    "5. Utilize a aba de reavaliações periódicas para acompanhamento contínuo."
                ],
                "interpretacao": (
                    "0 a 2 pontos: Baixo risco (orientar e acompanhar). "
                    "3 a 7 pontos: Risco moderado (reaplicar M-CHAT e observar sinais adicionais). "
                    "8 pontos ou mais: Risco elevado (encaminhar para equipe multiprofissional)."
                ),
                "orientacoes_sus": (
                    "Encaminhar os casos de risco moderado ou elevado para serviços especializados "
                    "de saúde mental infantil, conforme a rede de atenção psicossocial do SUS."
                ),
                "creditos": "Baseado no Protocolo do Estado de São Paulo, 2013.",
            }
        )
