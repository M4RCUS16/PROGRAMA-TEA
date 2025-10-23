from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

from .constants import MCHAT_QUESTIONS
from .models import EvaluationMChat, Patient


class EvaluationScoreTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="tester", email="tester@example.com", password="123456"
        )
        self.client.force_authenticate(self.user)
        self.patient = Patient.objects.create(
            name="Paciente Teste",
            birth_date="2018-01-01",
            guardian_name="Responsável",
            contact="(11) 99999-9999",
            cpf="000.000.000-00",
        )

    def test_create_evaluation_scores_correctly(self):
        responses = {q["code"]: q["risk_answer"] for q in MCHAT_QUESTIONS}
        payload = {
            "patient_id": self.patient.id,
            "responses": responses,
            "observations": "Observações clínicas.",
        }
        url = reverse("evaluation-list")
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        evaluation = EvaluationMChat.objects.get()
        self.assertEqual(evaluation.total_score, 23)
        self.assertEqual(evaluation.risk_level, EvaluationMChat.RISK_HIGH)
