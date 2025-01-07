let markers = []; // Tüm marker'ları takip etmek için global dizi
let currentInfoWindow = null; // Açık olan info window'u takip etmek için
let map;
let directionsRenderer;
let searchBox1;
let searchBox2;
const elazigCenter = { lat: 38.6748, lng: 39.2225 }; // Elazığ merkez koordinatları
let clickedLocationMarker = null; // Tıklanan konumu takip etmek için
let chargingStationsVisible = false; // Şarj istasyonlarının görünürlüğünü takip etmek için
let userLocationMarker = null; // Kullanıcı konumu için marker
let trafficVisible = false; // Trafik görünümünü takip etmek için
let trafficLayer = null;
let originalRoute = null;
let trafficPolylines = [];
let chargingStationMarkers = []; // Şarj istasyonu marker'larını takip etmek için

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
        const trafficButton = document.getElementById('trafficButton');
        const toggleChargingStationsButton = document.getElementById('toggleChargingStationsButton');

        if (routeButton) routeButton.addEventListener('click', calculateRoute);
        if (clearButton) clearButton.addEventListener('click', clearMap);
        if (trafficButton) trafficButton.addEventListener('click', toggleTraffic);
        if (toggleChargingStationsButton) toggleChargingStationsButton.addEventListener('click', showChargingStationsOnRoute);

        // Harita tıklama olayını ekle
        google.maps.event.addListener(map, 'click', function(event) {
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
                lat: clickedLocation.lat(),
                lng: clickedLocation.lng()
            });
        });

        // Konumu Al butonu için event listener ekle
        const getLocationButton = document.getElementById('getLocationButton');
        if (getLocationButton) {
            getLocationButton.addEventListener('click', getUserLocation);
        }

        console.log('Harita başarıyla başlatıldı ve event listener\'lar eklendi');

    } catch (error) {
        console.error('Harita başlatma hatası:', error);
    }
}

// searchNearbyChargingStations fonksiyonunda info window içeriğini güncelle
function searchNearbyChargingStations(location) {
    clearMarkers(); // Önceki marker'ları temizle

    fetch(`/harita/get-nearby-charging-stations/?lat=${location.lat}&lng=${location.lng}`)
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

                    // Şarj istasyonu için güncellenmiş info window içeriği
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="station-info-window">
                                <div class="info-header">
                                    <h3>${station.name}</h3>
                                </div>
                                <div class="info-content">
                                    <p class="info-address">${station.vicinity || ''}</p>
                                    <p class="info-coordinates">Konum: ${station.latitude}, ${station.longitude}</p>
                                    ${station.rating ? `<p class="info-rating">⭐ ${station.rating}</p>` : ''}
                                    <div class="info-buttons">
                                        <button onclick="showNearbyRestaurants(${station.latitude}, ${station.longitude}, '${station.place_id}')">
                                            🍽️ Restoranları Göster
                                        </button>
                                        <button onclick="addWaypoint(${station.latitude}, ${station.longitude}, '${station.name}')">
                                            📍 Durak Ekle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `
                    });

                    // Info window stil ayarları
                    google.maps.event.addListener(infoWindow, 'domready', function() {
                        // Info window stil sınıflarını ekle
                        const iwOuter = document.querySelector('.gm-style-iw');
                        if (iwOuter) {
                            iwOuter.parentElement.style.backgroundColor = 'transparent';
                            iwOuter.style.padding = '0';
                            
                            // Kapatma butonunu özelleştir
                            const closeButton = iwOuter.nextElementSibling;
                            if (closeButton) {
                                closeButton.style.opacity = '1';
                                closeButton.style.right = '5px';
                                closeButton.style.top = '5px';
                                closeButton.style.border = 'none';
                            }
                        }
                    });

                    marker.addListener('click', () => {
                        if (currentInfoWindow) {
                            currentInfoWindow.close();
                        }
                        infoWindow.open(map, marker);
                        currentInfoWindow = infoWindow;
                        
                        // Şarj istasyonunun adresini searchBox2'ye ekle
                        document.getElementById('searchBox2').value = station.vicinity || station.name;
                        
                        clearRestaurantMarkers();
                    });

                    markers.push(marker);
                });
            } else {
                console.error('Şarj istasyonları bulunamadı veya geçersiz veri alındı:', data);
            }
        })
        .catch(error => {
            console.error('Şarj istasyonları yüklenirken hata:', error);
        });
}

// showNearbyRestaurants fonksiyonunda info window içeriğini güncelle
function showNearbyRestaurants(lat, lng, stationId) {
    // Önceki restoran marker'larını temizle
    clearRestaurantMarkers();

    // Info window'u kapat
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }

    fetch(`/harita/get-restaurants/?station_id=${stationId}`)
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

                // Restoran için güncellenmiş info window içeriği
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="restaurant-info-window">
                            <div class="info-header">
                                <h3>${restaurant.name}</h3>
                            </div>
                            <div class="info-content">
                                <p class="info-address">${restaurant.vicinity || ''}</p>
                                <div class="info-buttons">
                                    <button onclick="selectRestaurantAsDestination('${lat}, ${lng}', '${restaurant.name}, ${restaurant.vicinity}')">
                                        🚗 Rota Oluştur
                                    </button>
                                </div>
                            </div>
                        </div>
                    `
                });

                // Info window stil ayarları
                google.maps.event.addListener(infoWindow, 'domready', function() {
                    const iwOuter = document.querySelector('.gm-style-iw');
                    if (iwOuter) {
                        iwOuter.parentElement.style.backgroundColor = 'transparent';
                        iwOuter.style.padding = '0';
                    }
                });

                restaurantMarker.addListener('click', () => {
                    if (currentInfoWindow) {
                        currentInfoWindow.close();
                    }
                    infoWindow.open(map, restaurantMarker);
                    currentInfoWindow = infoWindow;
                });

                markers.push(restaurantMarker);
            });
        })
        .catch(error => {
            console.error('Restoranlar yüklenirken hata:', error);
            alert('Restoranlar yüklenirken bir hata oluştu');
        });
}

function selectRestaurantAsDestination(stationAddress, restaurantAddress) {
    // DirectionsPanel'i temizle
    document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
    
    // Şarj istasyonunu başlangıç noktası yap
    document.getElementById('searchBox1').value = stationAddress;
    // Restoranı varış noktası yap
    document.getElementById('searchBox2').value = restaurantAddress;
    
    // Info window'u kapat
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
    
    // DirectionsRenderer'ı sıfırla
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer = null;
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

    // Tüm marker'ları temizle
    clearMarkers(); // Mevcut marker'ları temizle

    // Tıklanan konum marker'ını temizle
    if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
        clickedLocationMarker = null;
    }

    // Kullanıcı konum marker'ını temizle
    if (userLocationMarker) {
        userLocationMarker.setMap(null);
        userLocationMarker = null;
    }

    // Trafik ile ilgili değişkenleri sıfırla
    trafficPolylines.forEach(polyline => polyline.setMap(null));
    trafficPolylines = [];
    originalRoute = null;
    trafficVisible = false;
    document.getElementById('trafficButton').classList.remove('active');
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
    // Başlangıç ve hedef konumlarını al
    const startLocation = document.getElementById('searchBox1').value;
    const endLocation = document.getElementById('searchBox2').value;

    // Eğer başlangıç veya hedef konumları boşsa, uyarı ver ve çık
    if (!startLocation || !endLocation) {
        alert('Lütfen başlangıç ve hedef konumlarını seçin');
        return;
    }

    // Haritadaki tüm marker'ları kaldır
    clearMarkers();
    
    // Eğer tıklanan bir konum marker'ı varsa, onu kaldır
    if (clickedLocationMarker) {
        clickedLocationMarker.setMap(null);
        clickedLocationMarker = null;
    }

    // Eğer daha önce bir DirectionsRenderer varsa, onu kaldır ve yenisiyle değiştir
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
    }
    
    // Yeni bir DirectionsRenderer oluştur ve haritaya ek
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById('directionsPanel'),
        draggable: true
    });

    // Rota hesaplaması için istek oluştur
    const request = {
        origin: startLocation,
        destination: endLocation,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
        }
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, async function(result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            // Menzil kontrolü yap
            const isRouteValid = await checkRouteViability(result);
            
            if (isRouteValid.viable) {
                directionsRenderer.setDirections(result);
                originalRoute = result;
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('toggleChargingStationsButton').style.display = 'block';
                showWeatherDataAlongRoute(result);
            } else {
                // Şarj istasyonu önerisi
                handleChargingStationSuggestion(result, isRouteValid.requiredStops);
            }
        } else {
            alert('Rota hesaplanamadı: ' + status);
        }
    });
}

// Yeni fonksiyonlar ekle
async function checkRouteViability(route) {
    try {
        // URL'i güncelle
        const carInfo = await fetch('/harita/get-user-car-info/').then(res => res.json());
        const batteryLevel = await getBatteryLevel();
        
        const leg = route.routes[0].legs[0];
        const totalDistance = leg.distance.value / 1000;
        
        const trafficImpact = await calculateTrafficImpact(leg);
        const weatherImpact = await calculateWeatherImpact(leg);
        
        const baseRange = carInfo.average_range;
        const actualRange = baseRange * (batteryLevel / 100) * trafficImpact * weatherImpact;
        
        //ota boyunca menzil ve şarj durumu takibi
        //let currentDistance = 0;
        //const requiredStops = [];
        
        if (totalDistance <= actualRange) {
            return { viable: true, remainingRange: actualRange - totalDistance };
        } else {
            const requiredStops = calculateRequiredChargingStops(totalDistance, actualRange);
            return { viable: false, requiredStops };
        }
    } catch (error) {
        console.error('Rota kontrol hatası:', error);
        return { viable: false, error: 'Rota kontrolü yapılamadı' };
    }
}

async function calculateTrafficImpact(routeLeg) {
    let trafficImpact = 1.0;
    
    if (routeLeg.duration_in_traffic && routeLeg.duration) {
        const trafficRatio = routeLeg.duration_in_traffic.value / routeLeg.duration.value;
        
        // Trafik yoğunluğuna göre menzil etkisi:
        if (trafficRatio > 1.8) trafficImpact = 0.7;  // %30 azalma
        else if (trafficRatio > 1.5) trafficImpact = 0.8;  // %20 azalma
        else if (trafficRatio > 1.2) trafficImpact = 0.9;  // %10 azalma
        else if (trafficRatio > 1.0) trafficImpact = 0.95; // %5 azalma
    }
    
    return trafficImpact;
}

async function calculateWeatherImpact(routeLeg) {
    const weatherData = await getWeatherData(routeLeg.start_location);
    let weatherImpact = 1.0;
    
    // Sıcaklık etkisi:
    const temp = weatherData.main?.temp - 273.15; // Kelvin'den Celsius'a
    if (temp < 0) weatherImpact *= 0.8;  // Soğuk havada %20 azalma
    else if (temp > 35) weatherImpact *= 0.9;  // Sıcak havada %10 azalma
    
    // Hava koşulları etkisi:
    const weatherCondition = weatherData.weather?.[0]?.main?.toLowerCase() || 'clear';
    if (weatherCondition.includes('rain')) weatherImpact *= 0.85;  // Yağmurda %15 azalma
    else if (weatherCondition.includes('snow')) weatherImpact *= 0.6;  // Karda %40 azalma
    else if (weatherCondition.includes('wind')) weatherImpact *= 0.80;  // Rüzgarda %20 azalma
    else if (weatherCondition.includes('fog')) weatherImpact *= 0.8;  // Sisli havada %20 azalma
    else if (weatherCondition.includes('storm')) weatherImpact *= 0.4;  // Fırtınada %40 azalma
    
    return weatherImpact;
}

async function handleChargingStationSuggestion(route, requiredStops) {
    const leg = route.routes[0].legs[0];
    const totalDistance = leg.distance.value / 1000;

    // En uygun şarj istasyonlarını bul
    const optimalStations = await findOptimalChargingStations(leg.start_location, leg.end_location, requiredStops);

    if (optimalStations.length > 0) {
        // Mevcut dialog'ları temizle
        const existingDialog = document.querySelector('.custom-dialog-overlay');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Dialog HTML'i oluştur
        const dialogHTML = `
            <div class="custom-dialog-overlay">
                <div class="custom-dialog">
                    <div class="dialog-header">
                        <i class="dialog-icon">⚡</i>
                        <h3>Şarj Durumu Uyarısı</h3>
                    </div>
                    <div class="dialog-content">
                        <p class="dialog-message">Mevcut şarj seviyesi ile hedefe ulaşmanız mümkün değil.</p>
                        <div class="stations-list">
                            <p class="list-title">Önerilen şarj istasyonu durakları:</p>
                            ${optimalStations.map((station, index) => `
                                <div class="station-item">
                                    <span class="station-number">${index + 1}.</span>
                                    <span class="station-name">${station.name}</span>
                                    <span class="station-distance">(${station.distance.toFixed(1)} km)</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="dialog-question">Bu rotayı kullanmak ister misiniz?</p>
                        <div class="dialog-buttons">
                            <button class="dialog-button confirm-btn">Tamam</button>
                            <button class="dialog-button cancel-btn">İptal</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Dialog'u sayfaya ekle
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // Kullanıcının seçimini bekle
        return new Promise((resolve) => {
            const dialog = document.querySelector('.custom-dialog-overlay');
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            confirmBtn.addEventListener('click', () => {
                dialog.remove();
                // Şarj istasyonlarını waypoint olarak ekle
                const waypoints = optimalStations.map(station => ({
                    location: new google.maps.LatLng(station.latitude, station.longitude),
                    stopover: true
                }));
                recalculateRouteWithWaypoints(waypoints);
            });

            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                // İptal edilirse orijinal rotayı göster
                directionsRenderer.setDirections(route);
                showWeatherDataAlongRoute(route);
                document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
                document.getElementById('toggleChargingStationsButton').style.display = 'block';
            });
        });
    } else {
        // Özel hata dialog'u oluştur
        const errorDialogHTML = `
            <div class="custom-dialog-overlay">
                <div class="custom-dialog error">
                    <div class="dialog-header">
                        <i class="dialog-icon">⚠️</i>
                        <h3>Hata</h3>
                    </div>
                    <div class="dialog-content">
                        <p class="dialog-message">Uygun şarj istasyonu bulunamadı. Lütfen farklı bir rota deneyin.</p>
                        <div class="dialog-buttons">
                            <button class="dialog-button error-btn">Tamam</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', errorDialogHTML);
        
        // Hata dialog'unu kapat
        const errorDialog = document.querySelector('.custom-dialog-overlay');
        const errorBtn = errorDialog.querySelector('.error-btn');
        errorBtn.addEventListener('click', () => {
            errorDialog.remove();
        });
    }
}

// Yeni fonksiyon: Rota üzerindeki şarj istasyonlarını göster
function showChargingStationsOnRoute() {
    const directions = directionsRenderer.getDirections();
    if (directions && directions.routes.length > 0) {
        const route = directions.routes[0];
        const waypoints = route.overview_path;
        const searchPoints = [];
        const intervalCount = 5;
        
        for (let i = 0; i < intervalCount; i++) {
            const index = Math.floor(waypoints.length * (i / (intervalCount - 1)));
            const point = waypoints[index];
            searchPoints.push({
                lat: () => point.lat(),
                lng: () => point.lng()
            });
        }
        
        searchPoints.forEach(point => {
            fetch(`/harita/get-nearby-charging-stations/?lat=${point.lat()}&lng=${point.lng()}`)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
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

                            // Şarj istasyonu için info window
                            const infoWindow = new google.maps.InfoWindow({
                                content: `
                                    <div class="station-info-window">
                                        <div class="info-header">
                                            <h3>${station.name}</h3>
                                        </div>
                                        <div class="info-content">
                                            <p class="info-address">${station.vicinity || ''}</p>
                                            <p class="info-coordinates">Konum: ${station.latitude}, ${station.longitude}</p>
                                            ${station.rating ? `<p class="info-rating">⭐ ${station.rating}</p>` : ''}
                                            <div class="info-buttons">
                                                <button onclick="showNearbyRestaurants(${station.latitude}, ${station.longitude}, '${station.place_id}')">
                                                    🍽️ Restoranları Göster
                                                </button>
                                                <button onclick="addWaypoint(${station.latitude}, ${station.longitude}, '${station.name}')">
                                                    📍 Durak Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `
                            });

                            // Info window stil ayarları
                            google.maps.event.addListener(infoWindow, 'domready', function() {
                                const iwOuter = document.querySelector('.gm-style-iw');
                                if (iwOuter) {
                                    iwOuter.parentElement.style.backgroundColor = 'transparent';
                                    iwOuter.style.padding = '0';
                                    
                                    // Kapatma butonunu özelleştir
                                    const closeButton = iwOuter.nextElementSibling;
                                    if (closeButton) {
                                        closeButton.style.opacity = '1';
                                        closeButton.style.right = '5px';
                                        closeButton.style.top = '5px';
                                        closeButton.style.border = 'none';
                                    }
                                }
                            });

                            marker.addListener('click', () => {
                                if (currentInfoWindow) {
                                    currentInfoWindow.close();
                                }
                                infoWindow.open(map, marker);
                                currentInfoWindow = infoWindow;
                                
                                // Önceki restoran marker'larını temizle
                                clearRestaurantMarkers();
                            });

                            markers.push(marker);
                        });
                    }
                })
                .catch(error => {
                    console.error('Şarj istasyonları yüklenirken hata:', error);
                });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleChargingStationsButton');
    toggleButton.addEventListener('click', function() {
        if (chargingStationsVisible) {
            // Tüm şarj istasyonu marker'larını temizle
            markers.forEach(marker => {
                if (marker.icon && marker.icon.url && marker.icon.url.includes('green-dot.png')) {
                    marker.setMap(null);
                }
            });
            // Yeşil marker'ları markers dizisinden kaldır
            markers = markers.filter(marker => 
                !(marker.icon && marker.icon.url && marker.icon.url.includes('green-dot.png'))
            );
            chargingStationsVisible = false;
        } else {
            showChargingStationsOnRoute();
            chargingStationsVisible = true;
        }
    });
});

function addWaypoint(lat, lng, name) {
    const directions = directionsRenderer.getDirections();
    if (!directions) {
        alert('Önce bir rota oluşturmanız gerekmektedir.');
        return;
    }

    // Mevcut rotadaki tüm durakları al
    const route = directions.routes[0];
    const legs = route.legs;
    const waypoints = [];
    const newPoint = new google.maps.LatLng(lat, lng);

    // En yakın durakları bul
    let minDistance = Infinity;
    let insertIndex = 0;

    // Başlangıç noktasını kontrol et
    const startPoint = legs[0].start_location;
    let distance = google.maps.geometry.spherical.computeDistanceBetween(startPoint, newPoint);
    if (distance < minDistance) {
        minDistance = distance;
        insertIndex = 0;
    }

    // Ara durakları kontrol et
    for (let i = 0; i < legs.length; i++) {
        const endPoint = legs[i].end_location;
        distance = google.maps.geometry.spherical.computeDistanceBetween(endPoint, newPoint);
        if (distance < minDistance) {
            minDistance = distance;
            insertIndex = i + 1;
        }
        
        if (i < legs.length - 1) {
            waypoints.push({
                location: endPoint,
                stopover: true
            });
        }
    }

    // Yeni durağı uygun konuma ekle
    waypoints.splice(insertIndex, 0, {
        location: newPoint,
        stopover: true
    });

    // Rotayı yeniden hesapla
    const request = {
        origin: document.getElementById('searchBox1').value,
        destination: document.getElementById('searchBox2').value,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            
            // Info window'u kapat
            if (currentInfoWindow) {
                currentInfoWindow.close();
            }

            // Kullanıcıya bilgi ver
            alert(`${name} durağı rotanıza eklendi.`);
        } else {
            alert('Durak eklenirken bir hata oluştu: ' + status);
        }
    });
}

// Kullanıcı konumunu alma fonksiyonu
function getUserLocation() {
    if (!navigator.geolocation) {
        alert('Tarayıcınız konum servisini desteklemiyor.');
        return;
    }

    // Konum alınırken butonu devre dışı bırak
    const getLocationButton = document.getElementById('getLocationButton');
    if (getLocationButton) {
        getLocationButton.disabled = true;
        getLocationButton.textContent = 'Konum Alınıyor...';
    }

    navigator.geolocation.getCurrentPosition(
        // Başarılı olma durumu
        (position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Önceki kullanıcı konum marker'ını temizle
            if (userLocationMarker) {
                userLocationMarker.setMap(null);
            }

            // Yeni marker oluştur
            userLocationMarker = new google.maps.Marker({
                position: userLocation,
                map: map,
                title: 'Konumunuz',
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }
            });
            // Haritayı kullanıcı konumuna merkezle
            map.setCenter(userLocation);
            map.setZoom(15);

            // Konum bilgisini arama kutusuna ekle
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: userLocation }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    document.getElementById('searchBox1').value = results[0].formatted_address;
                } else {
                    document.getElementById('searchBox1').value = `${userLocation.lat}, ${userLocation.lng}`;
                }
            });

            // Butonu normal haline getir
            if (getLocationButton) {
                getLocationButton.disabled = false;
                getLocationButton.textContent = 'Konumu Al';
            }
        },
        // Hata durumu
        (error) => {
            let errorMessage = 'Konum alınamadı: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Konum izni reddedildi.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Konum bilgisi mevcut değil.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Konum alma isteği zaman aşımına uğradı.';
                    break;
                default:
                    errorMessage += 'Bilinmeyen bir hata oluştu.';
            }
            alert(errorMessage);

            // Butonu normal haline getir
            if (getLocationButton) {
                getLocationButton.disabled = false;
                getLocationButton.textContent = 'Konumu Al';
            }
        },
        // Seçenekler
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// Info window içeriği oluşturma fonksiyonu
function createStationInfoWindow(station) {
    const template = document.getElementById('station-info-template');
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.station-name').textContent = station.name;
    clone.querySelector('.station-vicinity').textContent = station.vicinity || '';
    clone.querySelector('.station-rating').textContent = `Rating: ${station.rating || 'N/A'}`;
    
    const addWaypointBtn = clone.querySelector('.add-waypoint-btn');
    addWaypointBtn.onclick = () => addWaypoint(station.latitude, station.longitude, station.name);
    
    const showRestaurantsBtn = clone.querySelector('.show-restaurants-btn');
    showRestaurantsBtn.onclick = () => showNearbyRestaurants(station.latitude, station.longitude, station.place_id);
    
    return clone;
}

function createRestaurantInfoWindow(restaurant, stationAddress) {
    const template = document.getElementById('restaurant-info-template');
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.restaurant-name').textContent = restaurant.name;
    clone.querySelector('.restaurant-vicinity').textContent = restaurant.vicinity || '';
    
    const createRouteBtn = clone.querySelector('.create-route-btn');
    createRouteBtn.onclick = () => selectRestaurantAsDestination(stationAddress, `${restaurant.name}, ${restaurant.vicinity}`);
    
    return clone;
}

// Buton loading durumu için yardımcı fonksiyon
function setButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('button-disabled');
        button.textContent = 'Yükleniyor...';
    } else {
        button.disabled = false;
        button.classList.remove('button-disabled');
        button.textContent = originalText;
    }
}

function toggleTraffic() {
    if (!map || !directionsRenderer || !directionsRenderer.getDirections()) {
        alert('Önce bir rota oluşturunuz.');
        return;
    }

    try {
        // Eğer durak eklenmiş bir rota varsa, onu kullan
        const currentRoute = directionsRenderer.getDirections();
        if (currentRoute) {
            originalRoute = currentRoute; // Mevcut rotayı orijinal rota olarak ayarla
        }

        const routes = originalRoute.routes[0];
        
        if (trafficVisible) {
            // Trafik görünümünden normal görünüme geç
            trafficPolylines.forEach(polyline => polyline.setMap(null));
            trafficPolylines = [];
            directionsRenderer.setMap(map);
            directionsRenderer.setDirections(originalRoute);
            document.getElementById('trafficButton').classList.remove('active');
            document.getElementById('directionsPanel').innerHTML = '<h4>Rota Bilgileri</h4>';
        } else {
            // Normal görünümden trafik görünümüne geç
            directionsRenderer.setMap(null);
            
            // Tüm rota bacakları için trafik bilgilerini topla
            let totalNormalDuration = 0;
            let totalTrafficDuration = 0;
            let trafficInfoHTML = '<div class="directions-panel-section"><h4>Trafik Bilgileri</h4><div class="panel-content">';
            
            // Her bir rota bacağı için trafik bilgilerini hesapla
            const processLegs = async () => {
                for (let i = 0; i < routes.legs.length; i++) {
                    const leg = routes.legs[i];
                    totalNormalDuration += leg.duration.value;
                    
                    // Her adım için trafik durumunu kontrol et
                    for (const step of leg.steps) {
                        const trafficInfo = await getTrafficInfo(step);
                        const color = getTrafficColor(trafficInfo.congestion);
                        
                        const polyline = new google.maps.Polyline({
                            path: step.path,
                            strokeColor: color,
                            strokeWeight: 6,
                            strokeOpacity: 0.8,
                            map: map,
                            zIndex: 1
                        });
                        
                        trafficPolylines.push(polyline);
                        
                        // Trafik süresini topla
                        totalTrafficDuration += trafficInfo.trafficDuration;
                    }
                    
                    // Bacak bilgilerini HTML'e ekle
                    trafficInfoHTML += `
                        <div class="info-row">
                            <strong>Bölüm ${i + 1}:</strong> ${leg.start_address} → ${leg.end_address}
                        </div>
                        <div class="info-row">
                            <strong>Mesafe:</strong> ${leg.distance.text}
                        </div>
                    `;
                }
                
                // Toplam trafik gecikmesini hesapla
                const totalDelay = Math.round((totalTrafficDuration - totalNormalDuration) / 60);
                const trafficStatus = totalDelay > 0 ?
                    `<div class="traffic-status heavy">
                        <strong>⚠️ Toplam Trafik Gecikmesi:</strong> ${totalDelay} dakika
                    </div>` :
                    `<div class="traffic-status light">
                        <strong>✓ Normal Trafik Akışı</strong>
                    </div>`;
                
                trafficInfoHTML += `
                    <div class="info-row">
                        <strong>Normal Süre:</strong> ${Math.round(totalNormalDuration / 60)} dakika
                    </div>
                    <div class="info-row">
                        <strong>Trafikli Süre:</strong> ${Math.round(totalTrafficDuration / 60)} dakika
                    </div>
                    ${trafficStatus}
                </div></div>`;
                
                document.getElementById('directionsPanel').innerHTML = trafficInfoHTML;
            };
            
            processLegs();
            document.getElementById('trafficButton').classList.add('active');
        }

        trafficVisible = !trafficVisible;

    } catch (error) {
        console.error('Trafik katmanı değiştirme hatası:', error);
        alert('Trafik bilgisi gösterilirken bir hata oluştu.');
    }
}

// getTrafficInfo fonksiyonunu güncelle
async function getTrafficInfo(step) {
    const service = new google.maps.DistanceMatrixService();
    
    try {
        const result = await new Promise((resolve, reject) => {
            service.getDistanceMatrix({
                origins: [step.start_location],
                destinations: [step.end_location],
                travelMode: google.maps.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(),
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                }
            }, (response, status) => {
                if (status === 'OK') resolve(response);
                else reject(status);
            });
        });

        const element = result.rows[0].elements[0];
        const normalDuration = element.duration.value;
        const trafficDuration = element.duration_in_traffic ? 
            element.duration_in_traffic.value : normalDuration;
        const ratio = trafficDuration / normalDuration;

        let congestion;
        if (ratio > 2.0) congestion = 'very_heavy';
        else if (ratio > 1.5) congestion = 'heavy';
        else if (ratio > 1.2) congestion = 'medium';
        else congestion = 'light';

        return {
            congestion,
            ratio,
            normalDuration,
            trafficDuration
        };
    } catch (error) {
        console.error('Trafik bilgisi alınamadı:', error);
        return { 
            congestion: 'unknown',
            trafficDuration: step.duration.value,
            normalDuration: step.duration.value,
            ratio: 1
        };
    }
}

// Trafik yoğunluğuna göre renk belirleme
function getTrafficColor(congestion) {
    const colors = {
        very_heavy: '#8B0000', // Koyu kırmızı
        heavy: '#FF0000',      // Kırmızı
        medium: '#FFA500',     // Turuncu
        light: '#008000',      // Yeşil
        unknown: '#808080'     // Gri
    };
    return colors[congestion] || colors.unknown;
}
// Hava durumu verilerini gösteren fonksiyon
function showWeatherDataAlongRoute(route) {
    // settings.py dosyasında bulunan weather API anahtarını çek
    const weatherAPIKey = OPENWEATHER_API_KEY;
    const weatherUrl = 'https://api.openweathermap.org/data/2.5/weather';

    const steps = route.routes[0].legs[0].steps;
    let currentDistance = 0;
    let weatherMarkers = [];
    
    steps.forEach(step => {
        const stepDistance = step.distance.value;
        currentDistance += stepDistance;

        if (currentDistance >= 20000) {
            const lat = step.end_location.lat();
            const lng = step.end_location.lng();
            
            fetch(`${weatherUrl}?lat=${lat}&lon=${lng}&appid=${weatherAPIKey}`)
                .then(response => response.json())
                .then(data => {
                    // Hava durumu açıklamasını Türkçe'ye çevir
                    const weatherDescriptions = {
                        'clear sky': 'Açık Hava',
                        'few clouds': 'Az Bulutlu',
                        'scattered clouds': 'Parçalı Bulutlu',
                        'broken clouds': 'Çok Bulutlu',
                        'shower rain': 'Sağanak Yağış',
                        'rain': 'Yağmurlu',
                        'thunderstorm': 'Gök Gürültülü Fırtına',
                        'snow': 'Karlı',
                        'mist': 'Sisli'
                    };

                    const weatherInfo = weatherDescriptions[data.weather[0].description.toLowerCase()] || data.weather[0].description;
                    const temperature = data.main.temp - 273.15;
                    const humidity = data.main.humidity;
                    const windSpeed = data.wind.speed;
                    
                    // Hava durumu içeriğini oluştur
                    const weatherContent = `
                        <div class="info-window-content weather-info-window">
                            <button class="close-button" onclick="closeCurrentInfoWindow()"></button>
                            <div class="info-header">
                                <h3>Hava Durumu Bilgisi</h3>
                            </div>
                            <div class="info-content">
                                <div class="weather-details">
                                    <p><strong>Durum:</strong> ${weatherInfo}</p>
                                    <p><strong>Sıcaklık:</strong> ${temperature.toFixed(1)}°C</p>
                                    <p><strong>Nem:</strong> %${humidity}</p>
                                    <p><strong>Rüzgar Hızı:</strong> ${windSpeed} m/s</p>
                                </div>
                                <div class="info-buttons">
                                    <button onclick="zoomToLocation(${lat}, ${lng})">Bu Konuma Yakınlaş</button>
                                </div>
                            </div>
                        </div>
                    `;

                    const weatherMarker = new google.maps.Marker({
                        position: { lat, lng },
                        map: map,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                        },
                        title: 'Hava Durumu Noktası'
                    });

                    const infoWindow = new google.maps.InfoWindow({
                        content: weatherContent,
                        maxWidth: 300
                    });

                    // Info window stil ayarları
                    google.maps.event.addListener(infoWindow, 'domready', function() {
                        const iwOuter = document.querySelector('.gm-style-iw');
                        if (iwOuter) {
                            iwOuter.parentElement.style.backgroundColor = 'transparent';
                            iwOuter.style.padding = '0';
                            
                            // Kapatma butonunu özelleştir
                            const closeButton = iwOuter.nextElementSibling;
                            if (closeButton) {
                                closeButton.style.opacity = '1';
                                closeButton.style.right = '5px';
                                closeButton.style.top = '5px';
                                closeButton.style.border = 'none';
                            }
                        }
                    });

                    weatherMarker.addListener('click', () => {
                        if (currentInfoWindow) {
                            currentInfoWindow.close();
                        }
                        infoWindow.open(map, weatherMarker);
                        currentInfoWindow = infoWindow;
                    });

                    weatherMarkers.push(weatherMarker);
                    markers.push(weatherMarker);
                })
                .catch(error => {
                    console.error('Hava durumu verisi alınırken hata:', error);
                });

            currentDistance = 0;
        }
    });
}

// Konuma yakınlaşma fonksiyonu
function zoomToLocation(lat, lng) {
    map.setCenter({ lat, lng });
    map.setZoom(16);
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
}

// getBatteryLevel fonksiyonunu ekle
async function getBatteryLevel() {
    const batteryInput = document.getElementById('batteryLevel');
    return parseFloat(batteryInput.value) || 100; // Varsayılan olarak 100
}

// calculateRequiredChargingStops fonksiyonunu ekle
function calculateRequiredChargingStops(totalDistance, actualRange) {
    const stops = Math.ceil(totalDistance / actualRange) - 1;
    return Math.max(0, stops);
}

// findOptimalChargingStations fonksiyonunu ekle
async function findOptimalChargingStations(startLocation, endLocation, requiredStops) {
    try {
        const lat1 = startLocation.lat();
        const lng1 = startLocation.lng();
        const lat2 = endLocation.lat();
        const lng2 = endLocation.lng();
        
        const stations = [];
        const addedStationIds = new Set(); // Eklenen istasyonların ID'lerini takip etmek için
        
        // Her durak için optimal nokta hesapla
        for (let i = 1; i <= requiredStops; i++) {
            const ratio = i / (requiredStops + 1);
            const lat = lat1 + (lat2 - lat1) * ratio;
            const lng = lng1 + (lng2 - lng1) * ratio;
            
            // Bu noktaya en yakın şarj istasyonlarını al
            const response = await fetch(`/harita/get-nearby-charging-stations/?lat=${lat}&lng=${lng}`);
            const data = await response.json();
            
            if (data.stations && data.stations.length > 0) {
                // Daha önce eklenmemiş en yakın istasyonu bul
                for (const station of data.stations) {
                    if (!addedStationIds.has(station.place_id)) {
                        station.distance = calculateDistance(lat1, lng1, station.latitude, station.longitude);
                        stations.push(station);
                        addedStationIds.add(station.place_id); // İstasyon ID'sini kaydet
                        break; // İlk benzersiz istasyonu bulduktan sonra döngüden çık
                    }
                }
            }
        }
        
        // İstasyonları mesafeye göre sırala
        stations.sort((a, b) => a.distance - b.distance);
        
        // Gerekli durak sayısı kadar istasyon döndür
        return stations.slice(0, requiredStops);
    } catch (error) {
        console.error('Şarj istasyonları bulunamadı:', error);
        return [];
    }
}

// Mesafe hesaplama yardımcı fonksiyonu
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(value) {
    return value * Math.PI / 180;
}

// recalculateRouteWithWaypoints fonksiyonunu ekle
function recalculateRouteWithWaypoints(waypoints) {
    const request = {
        origin: document.getElementById('searchBox1').value,
        destination: document.getElementById('searchBox2').value,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
    };

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(request, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            showWeatherDataAlongRoute(result);
        } else {
            alert('Rota hesaplanamadı: ' + status);
        }
    });
}

// getWeatherData fonksiyonunu ekle
async function getWeatherData(location) {
    const response = await fetch(`/harita/get-weather/?lat=${location.lat()}&lng=${location.lng()}`);
    if (!response.ok) {
        throw new Error('Hava durumu verisi alınamadı');
    }
    return response.json();
}

// Kapatma fonksiyonunu ekle
function closeCurrentInfoWindow() {
    if (currentInfoWindow) {
        currentInfoWindow.close();
    }
}

function validateBatteryLevel(input) {
    // Değer 100'den büyükse 100'e, 0'dan küçükse 0'a ayarla
    if (input.value > 100) {
        input.value = 100;
    } else if (input.value < 0) {
        input.value = 0;
    }
    // Boş değer girilirse varsayılan olarak 100 yap
    if (input.value === '') {
        input.value = 100;
    }
}


