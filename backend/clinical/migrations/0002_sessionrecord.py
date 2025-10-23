from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clinical", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SessionRecord",
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
                ("session_date", models.DateField()),
                (
                    "session_type",
                    models.CharField(
                        choices=[
                            ("avaliacao_inicial", "Avaliação inicial"),
                            ("orientacao_familiar", "Orientação familiar"),
                            ("intervencao_clinica", "Intervenção clínica"),
                            ("acompanhamento_escolar", "Acompanhamento escolar"),
                            ("reuniao_rede", "Reunião com a rede SUS"),
                        ],
                        default="orientacao_familiar",
                        max_length=40,
                    ),
                ),
                ("objectives", models.TextField(blank=True)),
                ("interventions", models.TextField(blank=True)),
                ("family_guidance", models.TextField(blank=True)),
                ("next_steps", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="clinical.patient",
                    ),
                ),
                (
                    "professional",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-session_date", "-created_at"],
                "verbose_name": "Registro de sessão",
                "verbose_name_plural": "Registros de sessões",
            },
        ),
    ]
