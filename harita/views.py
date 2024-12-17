from django.shortcuts import render
from django.http import JsonResponse
from .models import RouteHistory
import json
import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


def harita_view(request):
    context = {
        'google_api_key': settings.GOOGLE_PLACES_API_KEY,
    }
    return render(request, 'harita/harita.html', context)


def get_nearby_charging_stations(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({
            'error': 'Geçersiz koordinat değerleri'
        }, status=400)

    # Şarj istasyonları için Places API sorgusu
    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=5000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        nearby_stations = []
        for place in data.get('results', []):
            # Şarj istasyonu olma olasılığı olan yerleri filtrele
            if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "şarj istasyonu", "charging station"]):
                station_info = {
                    'place_id': place.get('place_id'),
                    'name': place.get('name'),
                    'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                    'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                    'vicinity': place.get('vicinity', ''),
                    'rating': place.get('rating', 0),
                }
                nearby_stations.append(station_info)

        if not nearby_stations:
            # Eğer şarj istasyonu bulunamazsa daha geniş bir arama yap
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=10000&keyword=charging_station&type=establishment&key={settings.GOOGLE_PLACES_API_KEY}"
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            for place in data.get('results', []):
                if any(keyword in place.get('name', '').lower() for keyword in ["şarj", "charge", "charging", "electric", "elektrik"]):
                    station_info = {
                        'place_id': place.get('place_id'),
                        'name': place.get('name'),
                        'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
                        'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
                        'vicinity': place.get('vicinity', ''),
                        'rating': place.get('rating', 0),
                    }
                    nearby_stations.append(station_info)
        
        return JsonResponse({'stations': nearby_stations})
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': f'API isteği başarısız oldu: {str(e)}'}, status=500)


def get_restaurants(request):
    place_id = request.GET.get('station_id')
    if not place_id:
        return JsonResponse({'error': 'Şarj istasyonu ID\'si gerekli'}, status=400)

    try:
        # Şarj istasyonu detaylarını al
        details_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&key={settings.GOOGLE_PLACES_API_KEY}"
        details_response = requests.get(details_url)
        details_response.raise_for_status()
        station_details = details_response.json()

        if 'result' not in station_details:
            return JsonResponse({'error': 'Şarj istasyonu bulunamadı'}, status=404)

        # Yakındaki restoranları al
        lat = station_details['result']['geometry']['location']['lat']
        lng = station_details['result']['geometry']['location']['lng']
        restaurants_url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius=2000&type=restaurant&key={settings.GOOGLE_PLACES_API_KEY}"
        
        restaurants_response = requests.get(restaurants_url)
        restaurants_response.raise_for_status()
        results = restaurants_response.json().get('results', [])

        nearby_restaurants = [{
            'place_id': result.get('place_id'),
            'name': result.get('name'),
            'latitude': result['geometry']['location']['lat'],
            'longitude': result['geometry']['location']['lng'],
            'vicinity': result.get('vicinity'),
        } for result in results]

        return JsonResponse({'restaurants': nearby_restaurants})
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': 'API isteği başarısız oldu'}, status=500)


def get_directions(request):
    required_params = ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng']
    if not all(request.GET.get(param) for param in required_params):
        return JsonResponse({'error': 'Eksik parametreler'}, status=400)

    try:
        url = (
            f"https://maps.googleapis.com/maps/api/directions/json?"
            f"origin={request.GET['origin_lat']},{request.GET['origin_lng']}&"
            f"destination={request.GET['destination_lat']},{request.GET['destination_lng']}&"
            f"mode=driving&key={settings.GOOGLE_PLACES_API_KEY}"
        )
        
        response = requests.get(url)
        response.raise_for_status()
        return JsonResponse(response.json())
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': 'Rota bilgisi alınamadı'}, status=500)


@csrf_exempt
def save_route_history(request):
    if request.method == 'POST' and request.user.is_authenticated:
        try:
            data = json.loads(request.body)
            print("Gelen veri:", data)  # Hata ayıklama için

            route_history = RouteHistory(
                user=request.user,
                start_address=data.get('start_address', ''),
                end_address=data.get('end_address', ''),
                start_latitude=float(data['start_lat']),
                start_longitude=float(data['start_lng']),
                end_latitude=float(data['end_lat']),
                end_longitude=float(data['end_lng']),
                total_distance=float(data['distance']),
                total_duration=float(data['duration'])
            )
            
            try:
                route_history.full_clean()
                route_history.save()
                print("Rota başarıyla kaydedildi")  # Hata ayıklama için
                return JsonResponse({'status': 'success'})
            except ValidationError as e:
                print("Doğrulama hatası:", str(e))  # Hata ayıklama için
                return JsonResponse({'error': str(e)}, status=400)
            
        except json.JSONDecodeError as e:
            print("JSON çözümleme hatası:", str(e))  # Hata ayıklama için
            return JsonResponse({'error': 'Geçersiz JSON verisi'}, status=400)
        except Exception as e:
            print("Beklenmeyen hata:", str(e))  # Hata ayıklama için
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Geçersiz istek veya kullanıcı girişi yapılmamış'}, status=405)
