from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.db import models

User = get_user_model()


class Patient(models.Model):
    name = models.CharField("Nome completo", max_length=255)
    birth_date = models.DateField("Data de nascimento")
    guardian_name = models.CharField("Responsável", max_length=255)
    contact = models.CharField("Contato", max_length=255, blank=True)
    cpf = models.CharField("CPF", max_length=14, unique=True)
    address = models.TextField("Endereço", blank=True)
    summary_history = models.TextField("Histórico resumido", blank=True)
    professional = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="patients",
        verbose_name="Profissional responsável",
    )
    clinical_attachment = models.FileField(
        "Relatório clínico (PDF/Imagem)",
        upload_to="uploads/patient_reports/",
        blank=True,
        null=True,
    )
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Paciente"
        verbose_name_plural = "Pacientes"

    def __str__(self):
        return self.name


class EvaluationMChat(models.Model):
    RISK_LOW = "baixo"
    RISK_MODERATE = "moderado"
    RISK_HIGH = "alto"

    RISK_CHOICES = [
        (RISK_LOW, "Baixo risco"),
        (RISK_MODERATE, "Risco moderado"),
        (RISK_HIGH, "Risco elevado"),
    ]

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="evaluations"
    )
    professional = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluations",
    )
    responses = models.JSONField(default=dict)
    observations = models.TextField(blank=True)
    total_score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0)]
    )
    risk_level = models.CharField(
        max_length=12, choices=RISK_CHOICES, default=RISK_LOW
    )
    clinical_interpretation = models.TextField(blank=True)
    follow_up_recommendations = models.TextField(blank=True)
    is_follow_up = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Avaliação M-CHAT"
        verbose_name_plural = "Avaliações M-CHAT"

    def __str__(self):
        return f"Avaliação {self.created_at:%d/%m/%Y} - {self.patient.name}"


class ClinicalReport(models.Model):
    evaluation = models.ForeignKey(
        EvaluationMChat,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()
    pdf_file = models.FileField(
        upload_to="uploads/generated_reports/", blank=True, null=True
    )
    health_equipment_notes = models.TextField(blank=True)
    periodic_review_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Relatório Clínico"
        verbose_name_plural = "Relatórios Clínicos"

    def __str__(self):
        return self.title


class SessionRecord(models.Model):
    SESSION_TYPES = [
        ("avaliacao_inicial", "Avaliação inicial"),
        ("orientacao_familiar", "Orientação familiar"),
        ("intervencao_clinica", "Intervenção clínica"),
        ("acompanhamento_escolar", "Acompanhamento escolar"),
        ("reuniao_rede", "Reunião com a rede SUS"),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    professional = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sessions",
    )
    session_date = models.DateField()
    session_type = models.CharField(
        max_length=40,
        choices=SESSION_TYPES,
        default="orientacao_familiar",
    )
    objectives = models.TextField(blank=True)
    interventions = models.TextField(blank=True)
    family_guidance = models.TextField(blank=True)
    next_steps = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-session_date", "-created_at"]
        verbose_name = "Registro de sessão"
        verbose_name_plural = "Registros de sessões"

    def __str__(self):
        return f"Sessão {self.session_date:%d/%m/%Y} - {self.patient.name}"
