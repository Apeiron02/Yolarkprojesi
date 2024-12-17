from django.urls import path
from .views import kullanici_bilgileri

urlpatterns = [
    path('', kullanici_bilgileri, name='kullanici_bilgileri'),
]