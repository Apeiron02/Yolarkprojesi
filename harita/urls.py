from django.urls import path
from . import views

app_name = 'harita'

urlpatterns = [
    path('', views.harita_view, name='harita_view'),
    path('get-nearby-charging-stations/', views.get_nearby_charging_stations, name='get_nearby_charging_stations'),
    path('get-restaurants/', views.get_restaurants, name='get_restaurants'),
    path('save-route-history/', views.save_route_history, name='save_route_history'),
]
