// Global variables
let map;
let hotspotsLayer;
let routingLayer;
let proximityLayer;
let landmarksLayer;
let isRoutingEnabled = true;
let markers = [];
let locationMarker;
let geoServerLayers = {};
let searchControl;

// Map initialization
function initMap() {
    // Initialize map
    map = L.map('map').setView([27.6253, 85.5561], 10);

    // Base layers with layer control
    const baseMaps = {
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        }),
        "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap'
        })
    };

    // Initialize GeoServer WMS layers
    const geoServerLayerGroup = L.layerGroup();
    
    geoServerLayers = {
        "Municipal Boundary": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:Municipal_boundary',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        }),
        "Nepal Local Units": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:NepalLocalUnits0',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        }),
        "Roads": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:Road',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        }),
        "Settlements": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:Settlements',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        }),
        "Ward Boundary": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:Ward_boundary',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        }),
        "Nepal": L.tileLayer.wms('http://localhost:8080/geoserver/demo/wms', {
            layers: 'demo:nepal',
            format: 'image/png',
            transparent: true,
            attribution: '© GeoServer'
        })
    };

    // Create empty layer groups
    routingLayer = L.layerGroup().addTo(map);
    proximityLayer = L.layerGroup();
    landmarksLayer = L.layerGroup();

    // Load hotspots and initialize layer controls
    loadHotspots().then(() => {
        // Create overlay layers object
        const overlayMaps = {
            "Accident Hotspots of Kavre": hotspotsLayer,
            "Enable Routing": routingLayer,
            "Proximity Analysis": proximityLayer,
            "Landmarks & Tourism": landmarksLayer
        };

        // Add GeoServer layers to the overlay
        Object.keys(geoServerLayers).forEach(key => {
            overlayMaps[key] = geoServerLayers[key];
        });

        // Add layer control to top right
        L.control.layers(baseMaps, overlayMaps, {
            collapsed: false
        }).addTo(map);
    });

    // Add custom controls at bottom left
    const customControls = L.control({ position: 'bottomleft' });
    customControls.onAdd = function() {
        const container = L.DomUtil.create('div', 'leaflet-custom-control');
        container.innerHTML = `
            <button id="toggleAnalysis" class="map-control-btn">Show Analysis</button>
            <button id="clearRoute" class="map-control-btn">Clear Route</button>
            <button id="showLocation" class="map-control-btn">Show My Location</button>
            <button id="clearLandmarks" class="map-control-btn">Clear Landmarks</button>
        `;
        return container;
    };
    customControls.addTo(map);

    // Add location search form
    const searchForm = L.control({ position: 'topright' });
    searchForm.onAdd = function() {
        const container = L.DomUtil.create('div', 'location-search-control');
        container.innerHTML = `
            <div class="search-container" style="
                background: white;
                padding: 10px;
                border-radius: 4px;
                box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                margin: 10px;
                width: 300px;
            ">
                <div style="margin-bottom: 10px;">
                    <input type="text" id="startLocation" placeholder="Enter start location" style="
                        width: 100%;
                        padding: 5px;
                        margin-bottom: 5px;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                    ">
                    <input type="text" id="endLocation" placeholder="Enter destination" style="
                        width: 100%;
                        padding: 5px;
                        margin-bottom: 5px;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                    ">
                    <button id="calculateRoute" style="
                        width: 100%;
                        padding: 5px;
                        background: #0066cc;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                    ">Calculate Route</button>
                </div>
            </div>
        `;
        return container;
    };
    searchForm.addTo(map);

    // Add event listener for the calculate route button
    document.getElementById('calculateRoute').addEventListener('click', handleLocationSearch);

    // Event listeners
    document.getElementById('toggleAnalysis').addEventListener('click', function() {
        const analysisPanel = document.getElementById('analysisPanel');
        analysisPanel.classList.toggle('hidden');
        if (!analysisPanel.classList.contains('hidden')) {
            createCharts();
            analysisPanel.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }
    });

    document.getElementById('clearRoute').addEventListener('click', clearRoute);
    document.getElementById('showLocation').addEventListener('click', showMyLocation);
    document.getElementById('clearLandmarks').addEventListener('click', clearLandmarks);

    // Layer control events
    map.on('overlayadd', function(e) {
        if (e.name === 'Enable Routing') {
            isRoutingEnabled = true;
        }
        if (e.name === 'Landmarks & Tourism') {
            map.on('click', handleLandmarksDiscovery);
        }
    });

    map.on('overlayremove', function(e) {
        if (e.name === 'Enable Routing') {
            isRoutingEnabled = false;
            clearRoute();
        }
        if (e.name === 'Landmarks & Tourism') {
            map.off('click', handleLandmarksDiscovery);
            clearLandmarks();
        }
    });

    // Map click handler
    map.on('click', function(e) {
        if (isRoutingEnabled) {
            handleRouting(e);
        }
        if (map.hasLayer(proximityLayer)) {
            performProximityAnalysis(e.latlng);
        }
    });
}

function performProximityAnalysis(latlng) {
    // Clear previous proximity analysis
    proximityLayer.clearLayers();

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div>';
    document.querySelector('.map-container').appendChild(loadingDiv);

    // Define analysis radius (in meters)
    const radius = 2000; // 2km radius

    // Add circle to show analysis area
    const circle = L.circle(latlng, {
        radius: radius,
        color: '#ff4444',
        fillColor: '#ff4444',
        fillOpacity: 0.2,
        weight: 2
    }).addTo(proximityLayer);

    // Add center marker
    const centerMarker = L.marker(latlng, {
        icon: L.icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(proximityLayer);

    // Overpass API query for amenities
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="school"](around:${radius},${latlng.lat},${latlng.lng});
            node["amenity"="hospital"](around:${radius},${latlng.lat},${latlng.lng});
            node["amenity"="fuel"](around:${radius},${latlng.lat},${latlng.lng});
            node["amenity"="charging_station"](around:${radius},${latlng.lat},${latlng.lng});
        );
        out body;
        >;
        out skel qt;
    `;

    // Fetch amenities using Overpass API
    fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
    })
    .then(response => response.json())
    .then(data => {
        const amenityCounts = {
            school: 0,
            hospital: 0,
            fuel: 0,
            charging_station: 0
        };

        // Process and display results
        data.elements.forEach(element => {
            if (element.type === 'node' && element.tags) {
                const amenityType = element.tags.amenity;
                amenityCounts[amenityType]++;

                // Create marker with appropriate icon
                const marker = L.marker([element.lat, element.lon], {
                    icon: createAmenityIcon(amenityType)
                });

                // Create popup content
                const popupContent = `
                    <div class="amenity-popup">
                        <h4>${element.tags.name || amenityType.charAt(0).toUpperCase() + amenityType.slice(1)}</h4>
                        <p><strong>Type:</strong> ${amenityType}</p>
                        ${element.tags.operator ? `<p><strong>Operator:</strong> ${element.tags.operator}</p>` : ''}
                        ${element.tags.opening_hours ? `<p><strong>Hours:</strong> ${element.tags.opening_hours}</p>` : ''}
                    </div>
                `;

                marker.bindPopup(popupContent);
                proximityLayer.addLayer(marker);
            }
        });

        // Create summary popup content
        const popupContent = `
            <div class="proximity-analysis-popup">
                <h4>Amenities within ${radius/1000}km radius</h4>
                <ul>
                    <li>Schools: ${amenityCounts.school}</li>
                    <li>Hospitals: ${amenityCounts.hospital}</li>
                    <li>Fuel Stations: ${amenityCounts.fuel}</li>
                    <li>EV Charging Stations: ${amenityCounts.charging_station}</li>
                </ul>
                <p>Click on markers for details</p>
            </div>
        `;

        // Add popup to center marker
        centerMarker.bindPopup(popupContent).openPopup();
    })
    .catch(error => {
        console.error('Error fetching amenities:', error);
        alert('Error fetching amenities. Please try again.');
    })
    .finally(() => {
        // Remove loading indicator
        document.querySelector('.loading-overlay')?.remove();
    });
}

function createAmenityIcon(amenityType) {
    let iconUrl;
    
    switch(amenityType) {
        case 'school':
            iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
            break;
        case 'hospital':
            iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
            break;
        case 'fuel':
            iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png';
            break;
        case 'charging_station':
            iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png';
            break;
        default:
            iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png';
    }

    return L.icon({
        iconUrl: iconUrl,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

// Add this new function for handling location search
async function handleLocationSearch() {
    const startLocation = document.getElementById('startLocation').value;
    const endLocation = document.getElementById('endLocation').value;

    if (!startLocation || !endLocation) {
        alert('Please enter both start and end locations');
        return;
    }

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div>';
    document.querySelector('.map-container').appendChild(loadingDiv);

    try {
        // Get coordinates for start location
        const startCoords = await getCoordinates(startLocation);
        if (!startCoords) throw new Error('Could not find start location');

        // Get coordinates for end location
        const endCoords = await getCoordinates(endLocation);
        if (!endCoords) throw new Error('Could not find end location');

        // Clear existing route and markers
        clearRoute();

        // Create markers for start and end points
        const startMarker = L.marker([startCoords.lat, startCoords.lon], {
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });

        const endMarker = L.marker([endCoords.lat, endCoords.lon], {
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });

        startMarker.on('dragend', updateRoute);
        endMarker.on('dragend', updateRoute);

        markers = [startMarker, endMarker];
        markers.forEach(marker => routingLayer.addLayer(marker));

        // Calculate and display route
        updateRoute();

        // Fit map to show both markers
        const bounds = L.latLngBounds([startCoords.lat, startCoords.lon], [endCoords.lat, endCoords.lon]);
        map.fitBounds(bounds, { padding: [50, 50] });

    } catch (error) {
        console.error('Error:', error);
        alert('Error finding location. Please check the addresses and try again.');
    } finally {
        // Remove loading indicator
        document.querySelector('.loading-overlay')?.remove();
    }
}

// Add this new function for geocoding
async function getCoordinates(location) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}
// New Landmarks Feature Functions
async function handleLandmarksDiscovery(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div>';
    document.querySelector('.map-container').appendChild(loadingDiv);

    try {
        // Overpass API query for landmarks and tourism attractions within 2km radius
        const radius = 2000; // 2km in meters
        const query = `
            [out:json][timeout:25];
            (
                node["tourism"](around:${radius},${lat},${lon});
                node["historic"](around:${radius},${lat},${lon});
                node["leisure"="park"](around:${radius},${lat},${lon});
                node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
                way["tourism"](around:${radius},${lat},${lon});
                way["historic"](around:${radius},${lat},${lon});
                way["leisure"="park"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        const data = await response.json();

        // Clear existing landmarks
        clearLandmarks();

        // Process and display results
        data.elements.forEach(element => {
            if (element.type === 'node' && (element.tags || {}).name) {
                const marker = L.marker([element.lat, element.lon], {
                    icon: createLandmarkIcon(element.tags)
                });

                const popupContent = createPopupContent(element.tags);
                marker.bindPopup(popupContent);
                landmarksLayer.addLayer(marker);
            }
        });

        // Add circle to show search radius
        L.circle([lat, lon], {
            radius: radius,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.1,
            weight: 1
        }).addTo(landmarksLayer);

    } catch (error) {
        console.error('Error fetching landmarks:', error);
        alert('Error fetching landmarks. Please try again.');
    } finally {
        // Remove loading indicator
        document.querySelector('.loading-overlay')?.remove();
    }
}

function createLandmarkIcon(tags) {
    let iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
    
    if (tags.tourism) {
        iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png';
    } else if (tags.historic) {
        iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
    } else if (tags.leisure === 'park') {
        iconUrl = 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png';
    }

    return L.icon({
        iconUrl: iconUrl,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

function createPopupContent(tags) {
    let content = `<div class="landmark-popup">`;
    
    if (tags.name) {
        content += `<strong>${tags.name}</strong><br>`;
    }
    
    if (tags.tourism) {
        content += `<em>Tourism: ${tags.tourism}</em><br>`;
    }
    if (tags.historic) {
        content += `<em>Historic: ${tags.historic}</em><br>`;
    }
    if (tags.leisure) {
        content += `<em>Leisure: ${tags.leisure}</em><br>`;
    }
    
    if (tags.description) {
        content += `<p>${tags.description}</p>`;
    }
    
    if (tags.website) {
        content += `<a href="${tags.website}" target="_blank">Website</a>`;
    }
    
    content += '</div>';
    return content;
}

function clearLandmarks() {
    landmarksLayer.clearLayers();
}

// Keep all existing functions unchanged
function loadHotspots() {
    return fetch('/api/hotspots')
        .then(response => response.json())
        .then(data => {
            hotspotsLayer = L.geoJSON(data, {
                pointToLayer: function(feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 6,
                        fillColor: "#ff7800",
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: function(feature, layer) {
                    if (feature.properties) {
                        layer.bindPopup(`
                            <strong>Year:</strong> ${feature.properties.Year || 'N/A'}<br>
                            <strong>Cause:</strong> ${feature.properties.Cause || 'N/A'}
                        `);
                    }
                }
            }).addTo(map);
            return hotspotsLayer;
        })
        .catch(error => {
            console.error('Error loading hotspots:', error);
            return null;
        });
}

function handleRouting(e) {
    if (markers.length < 2) {
        const marker = L.marker(e.latlng, { 
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });
        
        marker.on('dragend', updateRoute);
        markers.push(marker);
        routingLayer.addLayer(marker);

        if (markers.length === 2) {
            updateRoute();
        }
    } else {
        clearRoute();
    }
}

function clearRoute() {
    markers.forEach(marker => routingLayer.removeLayer(marker));
    markers = [];
    routingLayer.clearLayers();
}

function updateRoute() {
    if (markers.length === 2) {
        const start = markers[0].getLatLng();
        const end = markers[1].getLatLng();
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-overlay';
        loadingDiv.innerHTML = '<div class="loading-spinner"></div>';
        document.querySelector('.map-container').appendChild(loadingDiv);

        // OSRM API endpoint
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        
        fetch(osrmUrl)
            .then(response => response.json())
            .then(data => {
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    
                    // Clear previous route but keep markers
                    routingLayer.clearLayers();
                    markers.forEach(marker => routingLayer.addLayer(marker));
                    
                    // Add the route polyline
                    L.geoJSON(route.geometry, {
                        style: {
                            color: '#0066cc',
                            weight: 5,
                            opacity: 0.7
                        }
                    }).addTo(routingLayer);
                    
                    // Calculate distance and duration
                    const distance = (route.distance / 1000).toFixed(2);
                    const duration = Math.round(route.duration / 60);
                    
                    // Add route information popup
                    L.popup()
                        .setLatLng(end)
                        .setContent(`
                            <div class="route-info-popup">
                                <strong>Route Information</strong><br>
                                Distance: ${distance} km<br>
                                Duration: ${duration} min
                            </div>
                        `)
                        .openOn(map);
                }
            })
            .catch(error => {
                console.error('Routing error:', error);
                alert('Error calculating route. Please try again.');
            })
            .finally(() => {
                // Remove loading indicator
                document.querySelector('.loading-overlay')?.remove();
            });
    }
}

function showMyLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    const locationButton = document.getElementById('showLocation');
    locationButton.disabled = true;
    locationButton.textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latlng = [position.coords.latitude, position.coords.longitude];

            // Remove existing location marker if it exists
            if (locationMarker) {
                map.removeLayer(locationMarker);
            }

            // Create custom location marker
            locationMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'custom-location-marker',
                    html: `<div style="
                        background-color: #4285f4;
                        border: 2px solid white;
                        border-radius: 50%;
                        width: 16px;
                        height: 16px;
                        box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
                    "></div>`
                })
            }).addTo(map);

            // Pan to location with animation
            map.setView(latlng, 15, {
                animate: true,
                duration: 1
            });

            // Add accuracy circle
            const accuracyRadius = position.coords.accuracy;
            L.circle(latlng, {
                radius: accuracyRadius,
                color: '#4285f4',
                fillColor: '#4285f4',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(map);

            locationButton.disabled = false;
            locationButton.textContent = 'Show My Location';
        },
        (error) => {
            let errorMessage;
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
                default:
                    errorMessage = 'An unknown error occurred';
            }
            alert(errorMessage);
            locationButton.disabled = false;
            locationButton.textContent = 'Show My Location';
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

function createCharts() {
    // Bar Chart
    const barCtx = document.getElementById('barChart').getContext('2d');
    new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Speeding', 'Distraction', 'Weather', 'Vehicle Failure', 'Other'],
            datasets: [{
                label: 'Accident Causes',
                data: [30, 25, 15, 10, 20],
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Pie Chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
            datasets: [{
                data: [20, 30, 25, 25],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}