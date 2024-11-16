from django.urls import path
from . import views

urlpatterns = [
    path('get-restaurants/', views.get_restaurants, name='get_restaurants'),
    path('get-nearby-charging-stations/', views.get_nearby_charging_stations, name='get_nearby_charging_stations'),
    path('', views.harita_view, name='harita_view'),  # Ana harita sayfası
    path('get-all-charging-stations/', views.get_all_charging_stations, name='get_all_charging_stations'),
    path('maps/', views.get_directions, name='maps')
]