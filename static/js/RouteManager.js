class RouteManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: mapManager.map
        });
    }

    async calculateRoute(origin, destination) {
        try {
            const response = await this.directionsService.route({
                origin,
                destination,
                travelMode: google.maps.TravelMode.DRIVING
            });
            
            this.directionsRenderer.setDirections(response);
            return response;
        } catch (error) {
            console.error('Rota hesaplama hatası:', error);
            throw error;
        }
    }

    // ... diğer metodlar
} 