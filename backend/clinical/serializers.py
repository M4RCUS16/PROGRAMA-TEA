from django.contrib.auth import get_user_model
from rest_framework import serializers

from .constants import CRITICAL_ITEMS, MCHAT_QUESTIONS, RISK_LABELS
from .models import ClinicalReport, EvaluationMChat, Patient, SessionRecord

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email"]


class PatientSerializer(serializers.ModelSerializer):
    professional = UserSerializer(read_only=True)
    professional_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="professional",
        write_only=True,
        allow_null=True,
        required=False,
    )
    clinical_attachment = serializers.FileField(
        required=False, allow_null=True, use_url=True
    )

    class Meta:
        model = Patient
        fields = [
            "id",
            "name",
            "birth_date",
            "guardian_name",
            "contact",
            "cpf",
            "address",
            "summary_history",
            "professional",
            "professional_id",
            "clinical_attachment",
            "archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MChatQuestionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    text = serializers.CharField()
    risk_answer = serializers.CharField()


class EvaluationMChatSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(),
        source="patient",
        write_only=True,
    )
    professional = UserSerializer(read_only=True)
    professional_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="professional",
        write_only=True,
        allow_null=True,
        required=False,
    )
    risk_label = serializers.SerializerMethodField()
    questions = MChatQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = EvaluationMChat
        fields = [
            "id",
            "patient",
            "patient_id",
            "professional",
            "professional_id",
            "responses",
            "observations",
            "total_score",
            "risk_level",
            "risk_label",
            "clinical_interpretation",
            "follow_up_recommendations",
            "is_follow_up",
            "questions",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "total_score",
            "risk_level",
            "risk_label",
            "clinical_interpretation",
            "created_at",
        ]

    def get_questions(self, obj):
        return MCHAT_QUESTIONS

    def get_risk_label(self, obj):
        return RISK_LABELS.get(obj.risk_level, obj.risk_level)

    def validate_responses(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("As respostas devem ser um objeto JSON.")
        missing = {
            question["code"]
            for question in MCHAT_QUESTIONS
            if question["code"] not in value
        }
        if missing:
            raise serializers.ValidationError(
                f"Faltam respostas para: {', '.join(sorted(missing))}"
            )
        normalized = {}
        for question in MCHAT_QUESTIONS:
            code = question["code"]
            answer = value.get(code)
            if isinstance(answer, bool):
                normalized_answer = "sim" if answer else "nao"
            elif isinstance(answer, str):
                normalized_answer = answer.lower()
            else:
                raise serializers.ValidationError(
                    f"Resposta inválida para {code}. Utilize 'sim' ou 'nao'."
                )
            if normalized_answer not in {"sim", "nao"}:
                raise serializers.ValidationError(
                    f"Resposta inválida para {code}. Utilize 'sim' ou 'nao'."
                )
            normalized[code] = normalized_answer
        return normalized

    def _score_responses(self, responses):
        risk_count = 0
        critical_count = 0
        for question in MCHAT_QUESTIONS:
            code = question["code"]
            if responses.get(code) == question["risk_answer"]:
                risk_count += 1
                if code in CRITICAL_ITEMS:
                    critical_count += 1
        if risk_count <= 2 and critical_count == 0:
            risk_level = EvaluationMChat.RISK_LOW
        elif risk_count <= 7 and critical_count < 2:
            risk_level = EvaluationMChat.RISK_MODERATE
        else:
            risk_level = EvaluationMChat.RISK_HIGH
        return risk_count, risk_level, critical_count

    @staticmethod
    def _build_interpretation(risk_level, critical_count):
        if risk_level == EvaluationMChat.RISK_LOW:
            return (
                "Baixo risco para TEA. Reforçar orientações aos responsáveis e "
                "monitorar o desenvolvimento nas consultas de rotina."
            )
        if risk_level == EvaluationMChat.RISK_MODERATE:
            return (
                "Risco moderado identificado. Recomenda-se repetir o M-CHAT "
                "em 1 a 2 meses e observar sinais adicionais previstos no Protocolo TEA-SP."
            )
        return (
            "Risco elevado para TEA. Encaminhar para avaliação multiprofissional "
            "conforme orientações da CID-10 e do Protocolo TEA-SP. "
            f"Itens críticos alterados: {critical_count}."
        )

    def create(self, validated_data):
        responses = validated_data["responses"]
        risk_count, risk_level, critical_count = self._score_responses(responses)
        validated_data["total_score"] = risk_count
        validated_data["risk_level"] = risk_level
        validated_data["clinical_interpretation"] = self._build_interpretation(
            risk_level, critical_count
        )
        if risk_level == EvaluationMChat.RISK_HIGH:
            validated_data.setdefault(
                "follow_up_recommendations",
                "Encaminhar imediatamente para equipe multiprofissional e registrar ações no SUS.",
            )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        responses = validated_data.get("responses", instance.responses)
        risk_count, risk_level, critical_count = self._score_responses(responses)
        validated_data["total_score"] = risk_count
        validated_data["risk_level"] = risk_level
        validated_data["clinical_interpretation"] = self._build_interpretation(
            risk_level, critical_count
        )
        return super().update(instance, validated_data)


class ClinicalReportSerializer(serializers.ModelSerializer):
    evaluation = EvaluationMChatSerializer(read_only=True)
    evaluation_id = serializers.PrimaryKeyRelatedField(
        queryset=EvaluationMChat.objects.all(),
        source="evaluation",
        write_only=True,
    )

    class Meta:
        model = ClinicalReport
        fields = [
            "id",
            "evaluation",
            "evaluation_id",
            "title",
            "content",
            "pdf_file",
            "health_equipment_notes",
            "periodic_review_notes",
            "created_at",
        ]
        read_only_fields = ["id", "pdf_file", "created_at"]


class SessionRecordSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(),
        source="patient",
        write_only=True,
    )
    professional = UserSerializer(read_only=True)
    professional_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="professional",
        write_only=True,
        allow_null=True,
        required=False,
    )

    class Meta:
        model = SessionRecord
        fields = [
            "id",
            "patient",
            "patient_id",
            "professional",
            "professional_id",
            "session_date",
            "session_type",
            "objectives",
            "interventions",
            "family_guidance",
            "next_steps",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "patient", "professional"]
