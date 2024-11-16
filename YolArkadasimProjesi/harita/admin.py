from django.contrib import admin
from .models import ChargingStation

@admin.register(ChargingStation)
class ChargingStationAdmin(admin.ModelAdmin):
    list_display = ('osm_id', 'name', 'latitude', 'longitude')