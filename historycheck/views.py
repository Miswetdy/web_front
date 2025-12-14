# views.py
from rest_framework import status, permissions as drf_permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .permissions import IsModerator, ReadOnlyIfAnonymous
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.conf import settings
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
import boto3, uuid
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from .models import HistoryPerson, HistoryCheckOrder, HistoryCheckOrderItem
from .serializers import (
    HistoryPersonSerializer,
    HistoryCheckOrderSerializer,
    HistoryCheckOrderItemSerializer,
    UserRegisterSerializer,
    UserSerializer,
    UserLoginSerializer
)
import math
import re
import math
import string
import pymorphy2
from django.contrib.auth import get_user_model
import requests
import json
import threading

User = get_user_model()

morph = pymorphy2.MorphAnalyzer()

def normalize_text(text):
    """Разбивает текст на слова и приводит каждое к нормальной форме"""
    text = text.lower()
    text = re.sub(f"[{re.escape(string.punctuation)}]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    words = text.split()
    return [morph.parse(w)[0].normal_form for w in words]

def generate_keyforms(person_name):
    """Создаёт ключевые формы имени: полные, имя+номер, имя+прозвище, имя"""
    words = person_name.split()
    words_norm = [morph.parse(w.lower())[0].normal_form for w in words]

    keyforms = {"full": set(), "strong": set(), "weak": set()}

    # Полное имя (все слова сразу)
    if len(words_norm) > 1:
        keyforms["full"].add(" ".join(words_norm))

    # Имя + что-то (номер или прозвище)
    if len(words_norm) > 1:
        first = words_norm[0]
        last = words_norm[-1]
        # Имя + последний элемент (номер или прозвище)
        keyforms["strong"].add(f"{first} {last}")

    # Только имя (слабое совпадение, но полезное)
    keyforms["weak"].add(words_norm[0])

    return keyforms

def is_person_mentioned(person_name, text, percent_of_trust):
    normalized_words = normalize_text(text)
    text_proc = " ".join(normalized_words)

    keyforms = generate_keyforms(person_name)

    points = 0
    text_remaining = text_proc.split()

    for lvl, weight in [("full", 3), ("strong", 2), ("weak", 1)]:
        for form in keyforms[lvl]:
            form_words = form.split()
            if len(form_words) == 1 and len(form_words[0]) <= 2:
                continue
            for i in range(len(text_remaining) - len(form_words) + 1):
                if text_remaining[i:i+len(form_words)] == form_words:
                    points += weight
                    text_remaining[i:i+len(form_words)] = ["_"] * len(form_words)

    required_points = 1 + math.ceil((1 - percent_of_trust) * 4)

    return points >= required_points


s3_client = boto3.client(
    's3',
    endpoint_url=f"http://{settings.AWS_S3_ENDPOINT_URL}",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name='us-east-1',
)


class HistoryPersonList(APIView):
    permission_classes = [ReadOnlyIfAnonymous]

    def get(self, request):
        queryset = HistoryPerson.objects.all()
        search = request.GET.get('person_name')
        if search:
            queryset = queryset.filter(person_name__icontains=search)
        serializer = HistoryPersonSerializer(queryset, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(request_body=HistoryPersonSerializer)
    def post(self, request):
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({"error": "Только модератор может добавлять исторических личностей"}, status=status.HTTP_403_FORBIDDEN)
        serializer = HistoryPersonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class HistoryPersonDetail(APIView):
    permission_classes = [ReadOnlyIfAnonymous]

    def get(self, request, pk):
        person = get_object_or_404(HistoryPerson, id=pk, is_active=True)
        serializer = HistoryPersonSerializer(person)
        return Response(serializer.data)

    def put(self, request, pk):
        person = get_object_or_404(HistoryPerson, id=pk, is_active=True)
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({"error": "Только модератор может редактировать"}, status=status.HTTP_403_FORBIDDEN)
        serializer = HistoryPersonSerializer(person, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        person = get_object_or_404(HistoryPerson, id=pk, is_active=True)
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({"error": "Только модератор может удалять"}, status=status.HTTP_403_FORBIDDEN)
        if person.image:
            try:
                s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=person.image)
            except Exception as e:
                print(f"[views] Ошибка при удалении файла из MinIO: {e}")
        person.image = None
        person.is_active = False
        person.save(update_fields=['image', 'is_active'])
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class AddToHistoryCheckOrder(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def post(self, request, pk):
        person = get_object_or_404(HistoryPerson, id=pk, is_active=True)
        creator = request.user
        historycheck_order, _ = HistoryCheckOrder.objects.get_or_create(
            creator=creator,
            status=HistoryCheckOrder.Status.DRAFT,
        )
        item, created = HistoryCheckOrderItem.objects.get_or_create(order=historycheck_order, person=person)
        serializer = HistoryCheckOrderItemSerializer(item)
        return Response({"order_id": historycheck_order.id, "item": serializer.data},
                        status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class UploadHistoryPersonImage(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [ReadOnlyIfAnonymous]

    def post(self, request, pk):
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({"error": "Только модератор может загружать изображения"}, status=status.HTTP_403_FORBIDDEN)
        person = get_object_or_404(HistoryPerson, id=pk, is_active=True)
        file_obj = request.data.get('image')
        if not file_obj:
            return Response({"error": "Нет файла"}, status=status.HTTP_400_BAD_REQUEST)

        ext = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'bin'
        filename = f"{uuid.uuid4().hex}.{ext}"

        import mimetypes
        content_type, _ = mimetypes.guess_type(file_obj.name)
        if not content_type:
            content_type = 'application/octet-stream'

        if person.image:
            try:
                old_key = person.image.split('/')[-1]
                s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=old_key)
            except Exception as e:
                print(f"[views] Ошибка при удалении старого файла: {e}")

        try:
            s3_client.upload_fileobj(
                file_obj,
                settings.AWS_STORAGE_BUCKET_NAME,
                filename,
                ExtraArgs={'ContentType': content_type}
            )
        except Exception as e:
            return Response({"error": f"Не удалось загрузить файл: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        protocol = "https" if getattr(settings, "MINIO_USE_SSL", False) else "http"
        person.image = f"{protocol}://{settings.AWS_S3_ENDPOINT_URL}/{settings.AWS_STORAGE_BUCKET_NAME}/{filename}"
        person.save(update_fields=['image'])

        return Response({"image": person.image}, status=status.HTTP_200_OK)

class HistoryCheckOrderBasketIcon(APIView):
    permission_classes = [drf_permissions.AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            order = HistoryCheckOrder.objects.filter(creator=request.user,
                                                     status=HistoryCheckOrder.Status.DRAFT).first()
            count = order.items.count() if order else 0
            return Response({"order_id": order.id if order else None, "count": count})
        else:
            return Response({"order_id": None, "count": 0})


class HistoryCheckOrderList(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def get(self, request):
        if request.user.is_staff:
            qs = HistoryCheckOrder.objects.exclude(status__in=[
                # HistoryCheckOrder.Status.DELETED,
                # HistoryCheckOrder.Status.DRAFT
            ])
        else:
            qs = HistoryCheckOrder.objects.filter(
                creator=request.user
            ).exclude(status__in=[
                HistoryCheckOrder.Status.DELETED,
                HistoryCheckOrder.Status.DRAFT
            ])

        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        status_q = request.GET.get('status')
        if date_from:
            qs = qs.filter(formed_at__gte=date_from)
        if date_to:
            qs = qs.filter(formed_at__lte=date_to)
        if status_q:
            qs = qs.filter(status=status_q)
        serializer = HistoryCheckOrderSerializer(qs, many=True)
        return Response(serializer.data)


class HistoryCheckOrderDetailView(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def get(self, request, pk):
        order = get_object_or_404(HistoryCheckOrder, id=pk)
        if order.status == HistoryCheckOrder.Status.DELETED:
            return Response({"error": "Заявка не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_authenticated or (not request.user.is_staff and order.creator != request.user):
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)
        serializer = HistoryCheckOrderSerializer(order)
        return Response(serializer.data)

class HistoryCheckOrderUpdate(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    @swagger_auto_schema(request_body=HistoryCheckOrderSerializer)
    def put(self, request, pk):
        order = get_object_or_404(HistoryCheckOrder, id=pk)
        if order.creator != request.user and not request.user.is_staff:
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)

        serializer = HistoryCheckOrderSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HistoryCheckOrderForm(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def put(self, request, pk):
        historyOrder = get_object_or_404(HistoryCheckOrder, id=pk)
        if historyOrder.creator != request.user:
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)
        if historyOrder.status != HistoryCheckOrder.Status.DRAFT:
            return Response({"error": "Можно формировать только черновик"}, status=status.HTTP_400_BAD_REQUEST)
        historyOrder.status = HistoryCheckOrder.Status.FORMED
        historyOrder.formed_at = timezone.now()
        historyOrder.save()
        return Response({"status": "ok", "formed_at": historyOrder.formed_at}, status=status.HTTP_200_OK)


class HistoryCheckOrderComplete(APIView):
    permission_classes = [IsModerator]

    def put(self, request, pk):
        historyOrder = get_object_or_404(HistoryCheckOrder, id=pk)

        if historyOrder.status != HistoryCheckOrder.Status.FORMED:
            return Response({"error": "Можно обрабатывать только сформированную заявку"},
                            status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')
        if action not in ['complete', 'reject']:
            return Response({"error": "Неверное действие"}, status=status.HTTP_400_BAD_REQUEST)

        moderator = request.user

        if action == 'complete':
            for item in historyOrder.items.all():
                key = f"confidence_{item.person.id}"
                if key in request.POST:
                    try:
                        value = float(request.POST[key])
                        item.percent_of_trust = value
                        item.save()
                    except ValueError:
                        pass

            def call_go_service():
                try:
                    response = requests.post(
                        f"{settings.GO_SERVICE_URL}/calculate",
                        json={"order_id": historyOrder.id},
                        headers={"Authorization": settings.GO_SERVICE_AUTH_TOKEN},
                        timeout=15
                    )
                    if response.status_code != 200:
                        print(f"Go service returned status {response.status_code}")
                except Exception as e:
                    print(f"Error calling Go service: {e}")

            thread = threading.Thread(target=call_go_service)
            thread.daemon = True
            thread.start()

            delivery_date = timezone.now() + timedelta(days=30)

            historyOrder.moderator = moderator
            historyOrder.save()

            return Response({
                "status": "ok",
                "order_status": "PROCESSING",
                "delivery_date": delivery_date,
                "message": "Расчет года запущен асинхронно"
            }, status=status.HTTP_200_OK)

        elif action == 'reject':
            historyOrder.status = HistoryCheckOrder.Status.REJECTED
            historyOrder.moderator = moderator
            historyOrder.completed_at = timezone.now()
            historyOrder.save()
            return Response({"status": "ok", "order_status": historyOrder.status}, status=status.HTTP_200_OK)


class HistoryCheckOrderDelete(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def delete(self, request, pk):
        order = get_object_or_404(HistoryCheckOrder, id=pk)
        if order.creator != request.user and not request.user.is_staff:
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)
        order.status = HistoryCheckOrder.Status.DELETED
        order.save()
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class HistoryCheckOrderItemUpdate(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def put(self, request, pk):
        item = get_object_or_404(HistoryCheckOrderItem, id=pk)
        if item.drone_order.creator != request.user and not request.user.is_staff:
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)
        serializer = HistoryCheckOrderItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class HistoryCheckOrderItemDelete(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def delete(self, request, pk):
        item = get_object_or_404(HistoryCheckOrderItem, id=pk)
        if item.drone_order.creator != request.user and not request.user.is_staff:
            return Response({"error": "Нет прав"}, status=status.HTTP_403_FORBIDDEN)
        item.delete()
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class UserForHistoryCheckRegister(APIView):
    permission_classes = [drf_permissions.AllowAny]

    @swagger_auto_schema(request_body=UserRegisterSerializer)
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"status": "ok", "username": user.username},
            status=status.HTTP_201_CREATED
        )

class UserForHistoryCheckLogin(ObtainAuthToken):
    permission_classes = [drf_permissions.AllowAny]

    @swagger_auto_schema(request_body=UserLoginSerializer)
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user:
            return Response({"error": "Неверные учетные данные"}, status=status.HTTP_400_BAD_REQUEST)
        django_login(request, user)
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"status": "ok", "username": user.username, "token": token.key},
            status=status.HTTP_200_OK
        )


class UserForHistoryCheckDetail(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    @swagger_auto_schema(responses={200: UserSerializer()})
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @swagger_auto_schema(
        request_body=UserSerializer,
        responses={200: UserSerializer()}
    )
    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserForHistoryCheckLogout(APIView):
    permission_classes = [drf_permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        django_logout(request)
        response = Response({"status": "ok"})
        response.delete_cookie("csrftoken")
        return response


class HistoryCheckOrderForCalculation(APIView):
    permission_classes = [drf_permissions.AllowAny]

    def get(self, request, pk):
        token = request.headers.get('Authorization')
        if token != settings.GO_SERVICE_AUTH_TOKEN:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            order = HistoryCheckOrder.objects.get(id=pk)
            items_data = []
            for item in order.items.all():
                items_data.append({
                    "person_id": item.person.id,
                    "person_name": item.person.person_name,
                    "year_from": item.person.year_from,
                    "year_to": item.person.year_to,
                    "percent_of_trust": item.percent_of_trust
                })

            return Response({
                "order_id": order.id,
                "history_text": order.history_text,
                "items": items_data
            }, status=status.HTTP_200_OK)
        except HistoryCheckOrder.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)


class HistoryCheckOrderResultCallback(APIView):
    permission_classes = [drf_permissions.AllowAny]

    def post(self, request):
        token = request.headers.get('Authorization')
        if token != settings.GO_SERVICE_AUTH_TOKEN:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        order_id = request.data.get('order_id')
        year_from = request.data.get('year_from')
        year_to = request.data.get('year_to')

        print(f"Callback received for order {order_id}: year_from={year_from}, year_to={year_to}")

        if not order_id:
            return Response({"error": "order_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = HistoryCheckOrder.objects.get(id=order_id)
            print(f"Updating order {order_id}: year_from_result={year_from}, year_to_result={year_to}")
            order.year_from_result = year_from
            order.year_to_result = year_to
            order.status = HistoryCheckOrder.Status.COMPLETED
            order.completed_at = timezone.now()
            order.save(update_fields=['year_from_result', 'year_to_result', 'status', 'completed_at'])
            print(f"Order {order_id} updated successfully: year_from_result={order.year_from_result}, year_to_result={order.year_to_result}")
            return Response({"status": "ok"}, status=status.HTTP_200_OK)
        except HistoryCheckOrder.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)