let markers = []; // Tüm marker'ları takip etmek için global dizi
let currentInfoWindow = null; // Açık olan info window'u takip etmek için
let map;
let directionsRenderer;
let searchBox1;
let searchBox2;
const elazigCenter = { lat: 38.6748, lng: 39.2225 }; // Elazığ merkez koordinatları
let clickedLocationMarker = null; // Tıklanan konumu takip etmek için

function initMap() {
    try {
        // Google Maps nesnesinin varlığını kontrol et
        if (typeof google === 'undefined' || !google.maps) {
            console.error('Google Maps API yüklenemedi');
            return;
        }

        // Harita seçeneklerini ayarla
        const mapOptions = {
            center: elazigCenter,
            zoom: 14,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            fullscreenControl: true
        };

        // Haritayı oluştur
        map = new google.maps.Map(document.getElementById('map'), mapOptions);

        // Arama kutularını başlat
        searchBox1 = new google.maps.places.Autocomplete(
            document.getElementById('searchBox1'),
            { componentRestrictions: { country: 'tr' } }
        );

        searchBox2 = new google.maps.places.Autocomplete(
            document.getElementById('searchBox2'),
            { componentRestrictions: { country: 'tr' } }
        );

        // DirectionsRenderer'ı başlat
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            panel: document.getElementById('directionsPanel')
        });

        // Event listener'ları ekle
        const routeButton = document.getElementById('routeButton');
        const clearButton = document.getElementById('clearButton');

        if (routeButton) {
            routeButton.addEventListener('click', calculateRoute);
        }

        if (clearButton) {
            clearButton.addEventListener('click', clearMap);
        }

        // Harita tıklama olayını güncelle
        map.addListener('click', function(event) {
            const clickedLocation = event.latLng;
            
            // Önceki tıklanan konum marker'ını temizle
            if (clickedLocationMarker) {
                clickedLocationMarker.setMap(null);
            }
            
            // Yeni tıklanan konumu işaretle
            clickedLocationMarker = new google.maps.Marker({
                position: clickedLocation,
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }
            });

            // Başlangıç noktası olarak searchBox1'e ekle
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: clickedLocation }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    document.getElementById('searchBox1').value = results[0].formatted_address;
                }
            });

            // Yakındaki şarj istasyonlarını ara
            searchNearbyChargingStations({
                lat: () => clickedLocation.lat(),
                lng: () => clickedLocation.lng()
            });
        });

    } catch (error) {
        console.error('Harita başlatma hatası:', error);
    }
}

function searchNearbyChargingStations(location) {
    clearMarkers();
    
    fetch(`/harita/get-nearby-charging-stations/?lat=${location.lat()}&lng=${location.lng()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.stations && Array.isArray(data.stations)) {
                data.stations.forEach(station => {
                    const marker = new google.maps.Marker({
                        position: { 
                            lat: parseFloat(station.latitude), 
                            lng: parseFloat(station.longitude) 
                        },
                        map: map,
                        title: station.name,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                        }
                    });

                    marker.addListener('click', () => {
                        clearRestaurantMarkers();
                        selectChargingStation(marker, station);
                    });

                    markers.push(marker);
                });
            }
        })
        .catch(error => {
            console.error('Şarj istasyonları yüklenirken hata:', error);
        });
}

function selectChargingStation(marker, station) {
    // Şarj istasyonu konumunu varış noktası olarak ayarla
    document.getElementById('searchBox2').value = station.name + ', ' + station.vicinity;

    // Seçilen şarj istasyonunun yakınındaki restoranları getir
    fetch(`/harita/get-restaurants/?station_id=${station.place_id}`)
        .then(response => response.json())
        .then(data => {
            data.restaurants.forEach(restaurant => {
                const restaurantMarker = new google.maps.Marker({
                    position: { 
                        lat: restaurant.latitude, 
                        lng: restaurant.longitude 
                    },
                    map: map,
                    title: restaurant.name,
                    icon: {
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });

                // Restoran için bilgi penceresi oluştur
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div>
                            <h3>${restaurant.name}</h3>
                            <p>${restaurant.vicinity || ''}</p>
                            <button onclick="selectRestaurantAsDestination('${station.name}, ${station.vicinity}', '${restaurant.name}, ${restaurant.vicinity}')">
                                Rota Oluştur
                            </button>
                        </div>
                    `
                });

                restaurantMarker.addListener('click', () => {
                    // Eğer başka bir info window açıksa onu kapat
                    if (currentInfoWindow) {
                        currentInfoWindow.close();
                    }
                    // Yeni info window'u aç
                    infoWindow.open(map, restaurantMarker);
                    currentInfoWindow = infoWindow;
                });

                markers.push(restaurantMarker);
            });
        });
}

function selectRestaurantAsDestination(stationAddress, restaurantAddress) {
    // Şarj istasyonunu başlangıç noktası yap
    document.getElementById('searchBox1').value = stationAddress;
    // Restoranı varış noktası yap
    document.getElementById('searchBox2').value = restaurantAddress;
    
    // Info window'u kapat
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
    
    // Otomatik olarak rotayı hesapla
    calculateRoute();
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
    }
}

function clearRestaurantMarkers() {
    markers = markers.filter(marker => {
        if (marker.icon.url.includes('blue-dot.png')) {
            marker.setMap(null);
            return false;
        }
        return true;
    });
}

function clearMap() {
    if (directionsRenderer) {
        const directions = directionsRenderer.getDirections();
        if (directions) {
            const route = directions.routes[0];
            const leg = route.legs[0];
            
            const routeData = {
                start_address: leg.start_address,
                end_address: leg.end_address,
                start_lat: leg.start_location.lat(),
                start_lng: leg.start_location.lng(),
                end_lat: leg.end_location.lat(),
                end_lng: leg.end_location.lng(),
                distance: leg.distance.value / 1000,
                duration: leg.duration.value / 60
            };

            fetch('/harita/save-route-history/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(routeData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Rota başarıyla kaydedildi:', data);
                // Başarılı kayıt sonrası temizleme işlemleri
                directionsRenderer.setMap(null);
                directionsRenderer = null;
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('searchBox1').value = '';
                document.getElementById('searchBox2').value = '';
            })
            .catch(error => {
                console.error('Rota kaydetme hatası:', error);
                alert('Rota kaydedilirken bir hata oluştu');
            });
        }
    }

    // Tıklanan konum marker'ını temizle
    if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
        clickedLocationMarker = null;
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function calculateRoute() {
    const startLocation = document.getElementById('searchBox1').value;
    const endLocation = document.getElementById('searchBox2').value;

    if (!startLocation || !endLocation) {
        alert('Lütfen başlangıç ve hedef konumlarını seçin');
        return;
    }

    // DirectionsService'i başlat
    const directionsService = new google.maps.DirectionsService();

    // DirectionsRenderer'ı yeniden başlat
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
    }
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById('directionsPanel')
    });

    // Rota isteği oluştur
    const request = {
        origin: startLocation,
        destination: endLocation,
        travelMode: google.maps.TravelMode.DRIVING
    };

    // Rotayı hesapla
    directionsService.route(request, function(result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            // Rotayı göster
            directionsRenderer.setDirections(result);
            
            // Rota verilerini kaydet
            const route = result.routes[0];
            const leg = route.legs[0];
            
            const routeData = {
                start_address: leg.start_address,
                end_address: leg.end_address,
                start_lat: leg.start_location.lat(),
                start_lng: leg.start_location.lng(),
                end_lat: leg.end_location.lat(),
                end_lng: leg.end_location.lng(),
                distance: leg.distance.value / 1000,
                duration: leg.duration.value / 60
            };

            fetch('/harita/save-route-history/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(routeData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => console.log('Rota başarıyla kaydedildi:', data))
            .catch(error => console.error('Rota kaydetme hatası:', error));
        } else {
            alert('Rota hesaplanamadı: ' + status);
        }
    });
}
google.maps.event.addDomListener(window, 'load', initMap);