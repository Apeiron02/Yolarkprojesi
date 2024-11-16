from django.shortcuts import render
from django.http import JsonResponse
from .models import ChargingStation
import json
import requests
from django.conf import settings


def harita_view(request):

    charging_stations = ChargingStation.objects.all().values('place_id', 'name', 'latitude', 'longitude')
    charging_stations_json = json.dumps(list(charging_stations))
    return render(request, 'harita/harita.html', {'charging_stations': charging_stations_json})


def get_nearby_charging_stations(request):
    lat = float(request.GET.get('lat'))
    lng = float(request.GET.get('lng'))
    nearby_stations = []

    queries = [
        f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=5000&type=charging_station&key={settings.GOOGLE_PLACES_API_KEY}",


        f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=5000&keyword=charger&key={settings.GOOGLE_PLACES_API_KEY}",

    ]

    for url in queries:
        response = requests.get(url)
        data = response.json()

        for place in data.get('results', []):
            # Yalnızca 'charging_station' veya alternatif aramalarda istenen sonuçları topluyoruz
            if 'charging_station' in place.get('types', []) or any(
                    keyword in place.get('name', '').lower() for keyword in ["charge", "charging", "Electric"]):
                station_info = {
                    'place_id': place.get('place_id'),
                    'name': place.get('name'),
                    'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                    'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                }
                nearby_stations.append(station_info)


        if nearby_stations:
            break

    return JsonResponse({'stations': nearby_stations})


def get_restaurants(request):
    place_id = request.GET.get('station_id')
    if place_id:
        # İstasyonları alıyoruz
        url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&key={settings.GOOGLE_PLACES_API_KEY}"

        response = requests.get(url)
        station_details = response.json()

        if 'result' in station_details:
            latitude = station_details['result']['geometry']['location']['lat']
            longitude = station_details['result']['geometry']['location']['lng']

            # Restoranları alıyoruz
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={latitude},{longitude}&radius=2000&type=restaurant&key={settings.GOOGLE_PLACES_API_KEY}"

            response = requests.get(url)
            results = response.json().get('results', [])

            nearby_restaurants = []
            for result in results:
                restaurant = {
                    'place_id': result.get('place_id'),  # Restoranın place_id'si
                    'name': result.get('name'),
                    'latitude': result['geometry']['location']['lat'],
                    'longitude': result['geometry']['location']['lng'],
                    'vicinity': result.get('vicinity'),  # Restoranın konumu

                }
                nearby_restaurants.append(restaurant)

            return JsonResponse({'restaurants': nearby_restaurants})

    return JsonResponse({'restaurants': []})




