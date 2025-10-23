from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Aceita e-mail ou username para autenticação."""

    def validate(self, attrs):
        email = attrs.get("username") or attrs.get("email")
        if email and "username" not in attrs:
            attrs["username"] = email
        if email:
            try:
                user = User.objects.get(email__iexact=email)
                attrs["username"] = user.get_username()
            except User.DoesNotExist:
                # mantém valor para que falhe com erro de credenciais
                attrs["username"] = email
        return super().validate(attrs)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "confirm_password"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "As senhas não conferem."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        email = validated_data["email"]
        user = User.objects.create_user(
            username=email,
            email=email,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            password=validated_data["password"],
        )
        return user


class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Cadastro realizado com sucesso."}, status=status.HTTP_201_CREATED)
