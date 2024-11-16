# harita/models.py
from django.db import models



class ChargingStation(models.Model):
    osm_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    location = models.CharField(max_length=255, null=True, blank=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    place_id = models.CharField(max_length=100, unique=True)  # place_id alanını ekledik

    def __str__(self):
        return self.name



class Restaurant(models.Model):
    name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.name
