from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Patient",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255, verbose_name="Nome completo")),
                (
                    "birth_date",
                    models.DateField(verbose_name="Data de nascimento"),
                ),
                ("guardian_name", models.CharField(max_length=255, verbose_name="Responsável")),
                ("contact", models.CharField(blank=True, max_length=255, verbose_name="Contato")),
                ("cpf", models.CharField(max_length=14, unique=True, verbose_name="CPF")),
                ("address", models.TextField(blank=True, verbose_name="Endereço")),
                ("summary_history", models.TextField(blank=True, verbose_name="Histórico resumido")),
                (
                    "clinical_attachment",
                    models.FileField(
                        blank=True,
                        null=True,
                        upload_to="uploads/patient_reports/",
                        verbose_name="Relatório clínico (PDF/Imagem)",
                    ),
                ),
                ("archived", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "professional",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="patients",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Profissional responsável",
                    ),
                ),
            ],
            options={
                "verbose_name": "Paciente",
                "verbose_name_plural": "Pacientes",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EvaluationMChat",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("responses", models.JSONField(default=dict)),
                ("observations", models.TextField(blank=True)),
                (
                    "total_score",
                    models.PositiveSmallIntegerField(
                        validators=[django.core.validators.MinValueValidator(0)]
                    ),
                ),
                (
                    "risk_level",
                    models.CharField(
                        choices=[
                            ("baixo", "Baixo risco"),
                            ("moderado", "Risco moderado"),
                            ("alto", "Risco elevado"),
                        ],
                        default="baixo",
                        max_length=12,
                    ),
                ),
                ("clinical_interpretation", models.TextField(blank=True)),
                ("follow_up_recommendations", models.TextField(blank=True)),
                ("is_follow_up", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="evaluations",
                        to="clinical.patient",
                    ),
                ),
                (
                    "professional",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="evaluations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Avaliação M-CHAT",
                "verbose_name_plural": "Avaliações M-CHAT",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ClinicalReport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("content", models.TextField()),
                (
                    "pdf_file",
                    models.FileField(
                        blank=True,
                        null=True,
                        upload_to="uploads/generated_reports/",
                    ),
                ),
                ("health_equipment_notes", models.TextField(blank=True)),
                ("periodic_review_notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "evaluation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reports",
                        to="clinical.evaluationmchat",
                    ),
                ),
            ],
            options={
                "verbose_name": "Relatório Clínico",
                "verbose_name_plural": "Relatórios Clínicos",
                "ordering": ["-created_at"],
            },
        ),
    ]
