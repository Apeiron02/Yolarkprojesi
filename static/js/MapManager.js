class MapManager {
    constructor(mapElementId, options = {}) {
        this.map = null;
        this.markers = [];
        this.currentInfoWindow = null;
        this.directionsRenderer = null;
        this.trafficLayer = null;
        this.mapElementId = mapElementId;
        this.options = {
            center: { lat: 38.6748, lng: 39.2225 },
            zoom: 14,
            ...options
        };
        
        this.init();
    }

    init() {
        this.map = new google.maps.Map(
            document.getElementById(this.mapElementId), 
            this.options
        );
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.map.addListener('click', (event) => this.handleMapClick(event));
    }

    handleMapClick(event) {
        const clickedLocation = event.latLng;
        this.updateClickedLocationMarker(clickedLocation);
        this.searchNearbyChargingStations(clickedLocation);
    }

    // ... diğer metodlar
} 