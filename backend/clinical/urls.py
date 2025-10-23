from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ClinicalReportViewSet,
    DashboardSummaryView,
    EvaluationViewSet,
    HelpContentView,
    PatientViewSet,
    SessionRecordViewSet,
    GeneralReportView,
)

router = DefaultRouter()
router.register(r"patients", PatientViewSet, basename="patient")
router.register(r"evaluations", EvaluationViewSet, basename="evaluation")
router.register(r"reports", ClinicalReportViewSet, basename="report")
router.register(r"sessions", SessionRecordViewSet, basename="session")

urlpatterns = [
    path("reports/general/", GeneralReportView.as_view(), name="general-report"),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("help/", HelpContentView.as_view(), name="help-content"),
    path("", include(router.urls)),
]
