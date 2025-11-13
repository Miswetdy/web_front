# urls.py
from django.urls import path, re_path, include
from historycheck import views
from django.contrib import admin
from rest_framework import permissions as drf_permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from django.views.generic import TemplateView

schema_view = get_schema_view(
   openapi.Info(
      title="Drone Battery Predictor API",
      default_version='v1',
      description="API для заявок на расчёт времени полёта дрона",
   ),
   public=True,
   permission_classes=(drf_permissions.AllowAny,),
)

urlpatterns = [
    path("admin/", admin.site.urls),

    path('', TemplateView.as_view(template_name='index.html'), name='start-page'),
    #path('api/main/', views.HistoryPersonList.as_view(), name='main-page'),
    path('api/persons/', views.HistoryPersonList.as_view(), name='persons-list'),                     # GET список + фильтрация, POST создать
    path('api/persons/<int:pk>/', views.HistoryPersonDetail.as_view(), name='person-detail'),         # GET одна, PUT обновление, DELETE удаление
    path('api/persons/<int:pk>/add_to_order/', views.AddToHistoryCheckOrder.as_view(), name='person-add-to-order'),  # POST добавление в заявку-черновик
    path('api/persons/<int:pk>/upload_image/', views.UploadHistoryPersonImage.as_view(), name='person-upload-image'), # POST добавить/заменить изображение

    path('api/orders/basket/', views.HistoryCheckOrderBasketIcon.as_view(), name='order-basket-icon'),       # GET корзина
    path('api/orders/', views.HistoryCheckOrderList.as_view(), name='orders-list'),                        # GET список заявок
    path('api/orders/<int:pk>/', views.HistoryCheckOrderDetailView.as_view(), name='order-detail'),               # GET одна заявка
    path('api/orders/<int:pk>/update/', views.HistoryCheckOrderUpdate.as_view(), name='order-update'),            # PUT изменить поля заявки
    path('api/orders/<int:pk>/form/', views.HistoryCheckOrderForm.as_view(), name='order-form'),                  # PUT сформировать создателем
    path('api/orders/<int:pk>/complete/', views.HistoryCheckOrderComplete.as_view(), name='order-complete'),      # PUT завершить/отклонить модератором
    path('api/orders/<int:pk>/delete/', views.HistoryCheckOrderDelete.as_view(), name='order-delete'),            # DELETE удалить

    path('api/order_items/<int:pk>/update/', views.HistoryCheckOrderItemUpdate.as_view(), name='order-item-update'), # PUT изменить item
    path('api/order_items/<int:pk>/delete/', views.HistoryCheckOrderItemDelete.as_view(), name='order-item-delete'), # DELETE удалить item

    path('api/history_users/register/', views.UserForHistoryCheckRegister.as_view(), name='user-register'),   # POST регистрация
    path('api/history_users/login/', views.UserForHistoryCheckLogin.as_view(), name='user-me'),                 # POST аутентификация
    path('api/history_users/me/', views.UserForHistoryCheckDetail.as_view(), name='user-login'),            # GET/PUT профиль
    path('api/history_users/logout/', views.UserForHistoryCheckLogout.as_view(), name='user-logout'),         # POST деавторизация

    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]
