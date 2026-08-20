window.map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([22.55, 88.37], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap © CARTO'
}).addTo(window.map);

function updateMarkerLabels() {
    window.map.getContainer().classList.toggle('map-labels-visible', window.map.getZoom() >= 14);
}
window.map.on('zoomend', updateMarkerLabels);
updateMarkerLabels();
const markers = L.markerClusterGroup({
    disableClusteringAtZoom: 11,
    maxClusterRadius: 15,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.5,
    showCoverageOnHover: false,
    iconCreateFunction(cluster) {
        const children = cluster.getAllChildMarkers();
        const red = children.filter(marker => marker.options.risk === 'Red').length;
        const yellow = children.filter(marker => marker.options.risk === 'Yellow').length;
        const risk = red ? 'red' : yellow ? 'yellow' : 'green';
        const icon = risk === 'red' ? '!' : risk === 'yellow' ? '⚠' : '✓';
        return L.divIcon({
            html: `<div class="cluster-badge cluster-badge--${risk}"><span>${icon}</span><strong>${cluster.getChildCount()}</strong></div>`,
            className: 'risk-cluster-icon',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
    }
});
window.markerClusterGroup = markers;
window.map.addLayer(markers);

window.MapMarkers = {
    icon(color, density, risk) {
        return L.divIcon({
            html: `<div class="risk-marker risk-marker--${risk.toLowerCase()}" style="--marker-color:${color}"><span class="risk-marker__halo"></span><span class="risk-marker__pin">${risk === 'Red' ? '!' : ''}</span><span class="risk-marker__density">${density}%</span></div>`,
            className: 'risk-marker-icon',
            iconSize: [68, 42],
            iconAnchor: [34, 21]
        });
    },
    add(pandal, color, label, onSelect) {
        const density = pandal.risk === 'Green' ? Math.min(34, 12 + pandal.popularity * 2) : pandal.risk === 'Yellow' ? Math.min(70, 48 + pandal.popularity * 2) : Math.min(98, 78 + pandal.popularity * 2);
        const wait = pandal.risk === 'Green' ? 5 + pandal.popularity : pandal.risk === 'Yellow' ? 15 + pandal.popularity * 2 : 30 + pandal.popularity * 3;
        const capacity = density < 35 ? 'Low capacity pressure' : density <= 70 ? 'Moderate capacity' : 'Critical capacity';
        const alert = pandal.risk === 'Red' ? 'Critical crowd pressure' : pandal.risk === 'Yellow' ? 'Elevated crowd pressure' : 'No active crowd alert';
        const card = `<div class="map-info-card" style="--marker-color:${color}"><div class="map-info-card__eyebrow">${pandal.risk === 'Red' ? 'CRITICAL ZONE' : pandal.risk === 'Yellow' ? 'WATCH ZONE' : 'SAFE ZONE'}</div><strong class="map-info-card__title">${pandal.name}</strong><div class="map-info-card__density"><span style="color:${color}">${density}%</span><span>${capacity}</span></div><div class="map-info-card__meta"><span>Estimated wait</span><strong>${wait} mins</strong></div><div class="map-info-card__alert"><span class="map-info-card__dot" style="background:${color}"></span>${alert}</div><div class="map-info-card__action">↗ Reroute Crowd</div></div>`;
        const marker = L.marker([pandal.lat, pandal.lon], { icon: this.icon(color, density, pandal.risk), risk: pandal.risk });
        marker.bindTooltip(card, {
            direction: 'top',
            offset: [0, -22],
            sticky: true,
            className: `dark-map-tooltip dark-map-tooltip--${pandal.risk.toLowerCase()}`,
            opacity: 1
        });
        marker.on('click', () => {
            document.querySelectorAll('.risk-marker-icon.is-selected').forEach(element => element.classList.remove('is-selected'));
            marker.getElement()?.classList.add('is-selected');
            window.map.flyTo([pandal.lat, pandal.lon], 15, { animate: true, duration: 0.8 });
            onSelect(pandal);
        });
        markers.addLayer(marker);
        return marker;
    },
    clear() {
        markers.clearLayers();
    },
    fitAll() {
        if (markers.getLayers().length) {
            window.map.fitBounds(markers.getBounds(), { padding: [50, 50] });
        }
    }
};

window.MapRouting = {
    route(points) {
        const coordinates = points.map(point => `${point.lon},${point.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        return fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) {
                    throw new Error('OSRM did not return a driving route');
                }
                if (window.routeLayer) window.map.removeLayer(window.routeLayer);
                window.routeLayer = L.geoJSON(data.routes[0].geometry, {
                    style: {
                        color: '#00E5FF',
                        weight: 5,
                        opacity: 0.85,
                        lineCap: 'round',
                        className: 'route-glow'
                    }
                }).addTo(window.map);
                window.map.fitBounds(window.routeLayer.getBounds(), { padding: [100, 100], animate: true });
                return window.routeLayer;
            });
    },
    fitActiveRoute() {
        if (window.routeLayer) {
            window.map.fitBounds(window.routeLayer.getBounds(), { padding: [100, 100], animate: true });
        }
    }
};
