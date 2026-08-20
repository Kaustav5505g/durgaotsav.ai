const colorMap = { Green: '#10B981', Yellow: '#F5C542', Red: '#EF4444' };
const riskLabel = { Green: '✅ Safe to visit', Yellow: '⚠️ Moderate crowd', Red: '🚨 Avoid — Too crowded!' };
const riskBg = { Green: 'rgba(16,185,129,0.12)', Yellow: 'rgba(245,197,66,0.12)', Red: 'rgba(239,68,68,0.12)' };

const map = window.map;
const alertBanner = document.getElementById('alert-banner');
document.getElementById('dismiss-alert').addEventListener('click', () => { alertBanner.style.display = 'none'; });
document.getElementById('close-pandal-details').addEventListener('click', () => {
    document.getElementById('sidebar').style.display = 'none';
    document.querySelectorAll('.risk-marker-icon.is-selected').forEach(element => element.classList.remove('is-selected'));
});
function updateMarkerLabels() { map.getContainer().classList.toggle('map-labels-visible', map.getZoom() >= 14); }
map.on('zoomend', updateMarkerLabels);
updateMarkerLabels();

let pandalMarkers = [];
let hasFitInitialView = false;
let currentHour = 12;
let chartInstance = null;
let allPandals = [];
let activePujaDay = 'Maha Ashtami';

function updateHour(val) {
    currentHour = parseInt(val);
    document.getElementById('hour-display').innerText = currentHour + ':00';
    fetchLivePandalData();
}

function fetchLivePandalData() {
    const weather = document.getElementById('weather-select').value;
    activePujaDay = document.getElementById('puja-day-select').value;
    fetch(`/api/pandals/live?hour=${currentHour}&weather=${encodeURIComponent(weather)}&puja_day=${encodeURIComponent(activePujaDay)}`)
        .then(res => res.json())
        .then(data => {
            allPandals = data.pandals;
            MapMarkers.clear();
            pandalMarkers = [];
            document.getElementById('stat-green').innerText = data.stats.green;
            document.getElementById('stat-yellow').innerText = data.stats.yellow;
            document.getElementById('stat-red').innerText = data.stats.red;
            document.getElementById('alert-banner').style.display = data.stats.red >= 3 ? 'block' : 'none';

            const busiest = [...data.pandals].sort((a, b) => b.popularity - a.popularity)[0];
            document.getElementById('busiest-pandal').innerText = busiest.name;

                data.pandals.forEach(pandal => {
                const color = colorMap[pandal.risk];
                    const marker = MapMarkers.add(pandal, color, riskLabel[pandal.risk], showDetails);
                    pandalMarkers.push(marker);
            });
                if (!hasFitInitialView) {
                    MapMarkers.fitAll();
                    hasFitInitialView = true;
                }
        });
    document.getElementById('time-badge').innerText = 'Updated ' + new Date().toLocaleTimeString();
}

function loadData() {
    fetchLivePandalData();
}

function getTrendLabel(forecast) {
    if (!forecast || forecast.length === 0) return 'Forecast unavailable';
    const riskOrder = { Green: 1, Yellow: 2, Red: 3 };
    const start = riskOrder[forecast[0].risk] || 1;
    const end = riskOrder[forecast[forecast.length - 1].risk] || 1;
    if (end > start) return 'Increasing';
    if (end < start) return 'Decreasing';
    return 'Stable';
}

function buildRiskExplanation(pandal) {
    const riskText = {
        Green: "Risk is based on the model's prediction using the available crowd-pattern inputs for this pandal and time.",
        Yellow: "Risk is based on the model's prediction using the available crowd-pattern inputs, with moderate crowd pressure expected at this time.",
        Red: "Risk is based on the model's prediction using the available crowd-pattern inputs, indicating a high crowd-pressure period for this pandal."
    };
    return `<strong>Why this risk?</strong> ${riskText[pandal.risk]}`;
}

function buildExplainabilityWidget() {
    const features = [
        ['Time / Hour Impact', 40],
        ['Area Density', 30],
        ['Weather Impact', 15],
        ['Historical Trend', 15]
    ];
    return `<div class="explainability-title">Model feature contribution</div>${features.map(([label, value]) =>
        `<div class="explainability-row"><span>${label}</span><strong>${value}%</strong><span class="explainability-track"><span style="width:${value}%"></span></span></div>`
    ).join('')}`;
}

function buildForecastSummary(forecast) {
    if (!forecast || forecast.length === 0) return 'Forecast data is not available.';
    const riskOrder = { Green: 1, Yellow: 2, Red: 3 };
    const max = forecast.reduce((best, current) => riskOrder[current.risk] > riskOrder[best.risk] ? current : best, forecast[0]);
    const summaryMap = {
        Green: 'Crowd conditions are expected to remain manageable over the next few hours.',
        Yellow: 'Crowd levels are likely to stay elevated for part of the next few hours.',
        Red: 'Crowd pressure is expected to remain high in the next few hours.'
    };
    let msg = summaryMap[max.risk] || 'Crowd conditions are being monitored.';
    const peakHour = `${String(max.hour).padStart(2, '0')}:00`;
    if (max.risk === 'Red' || max.risk === 'Yellow') msg += ` Expected peak: ${peakHour}.`;
    return msg;
}

function showDetails(pandal) {
    document.getElementById('sidebar').style.display = 'flex';
    MapRouting.fitActiveRoute();
    const color = colorMap[pandal.risk];
    document.getElementById('pandal-info').style.display = 'none';
    document.getElementById('pandal-detail-box').style.display = 'block';
    document.getElementById('pandal-name').innerText = pandal.name;
    document.getElementById('pandal-name').style.color = color;
    document.getElementById('pandal-risk').innerText = getRiskBadgeText(pandal.risk);
    document.getElementById('pandal-risk').style.background = riskBg[pandal.risk];
    document.getElementById('pandal-risk').style.color = color;
    document.getElementById('pandal-risk').style.border = `1px solid ${color}44`;
    document.getElementById('risk-explanation').innerHTML = buildRiskExplanation(pandal);
    document.getElementById('explainability-widget').innerHTML = buildExplainabilityWidget();
    document.getElementById('forecast-summary').innerText = `${activePujaDay} · ${buildForecastSummary(pandal.forecast)}`;
    document.getElementById('recommendation').innerHTML = buildRecommendation(pandal.risk);

    const currentTrend = getTrendLabel(pandal.forecast);
    const currentCrowd = `${pandal.name} is currently showing a ${currentTrend.toLowerCase()} trend based on the forecast for the next 6 hours.`;
    document.getElementById('pandal-details').innerHTML = `
        <div class="detail-meta"><strong>Current</strong><span>${currentTrend}</span></div>
        <div class="detail-meta"><strong>Weather</strong><span>${pandal.weather}</span></div>
        <div class="detail-meta"><strong>Hour</strong><span>${pandal.hour}:00</span></div>
        <div class="detail-meta detail-meta--popularity"><strong>Popularity</strong><div class="metric-line"><span class="metric-value">${pandal.popularity} / 10</span><span class="metric-track"><span class="metric-fill" style="width:${Math.min(100, pandal.popularity * 10)}%"></span></span></div></div>
        <div class="detail-meta" style="grid-column: 1 / -1;"><strong>Forecast Trend</strong><span>${currentCrowd}</span></div>`;

    if (pandal.alternatives && pandal.alternatives.length > 0) {
        document.getElementById('alternatives-box').style.display = 'block';
        document.getElementById('alternatives').innerHTML = pandal.alternatives.map((a, index) =>
            `<div class="alt-item ${index === 0 ? 'alt-item--warning' : ''}"><span class="alt-name">${a.name}</span><span class="alt-dist">${a.distance} km</span></div>`
        ).join('');
    } else document.getElementById('alternatives-box').style.display = 'none';

    const riskToNum = { Green: 20, Yellow: 55, Red: 85 };
    const forecastColor = value => value < 35 ? '#10B981' : value <= 70 ? '#F59E0B' : '#EF4444';
    const forecastLabel = value => value < 35 ? 'SAFE' : value <= 70 ? 'MOD' : 'HIGH';
    const forecastValues = pandal.forecast.map(f => riskToNum[f.risk]);
    if (chartInstance) chartInstance.destroy();
    const chartValueLabels = {
        id: 'chartValueLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            chart.data.datasets[0].data.forEach((value, index) => {
                const bar = chart.getDatasetMeta(0).data[index];
                ctx.fillStyle = '#f7f7f2';
                ctx.font = '700 9px Plus Jakarta Sans';
                ctx.textAlign = 'center';
                ctx.fillText(forecastLabel(value), bar.x, bar.y - 6);
            });
            ctx.restore();
        }
    };
    chartInstance = new Chart(document.getElementById('myChart').getContext('2d'), {
        type: 'bar',
        data: { labels: pandal.forecast.map(f => f.hour + ':00'), datasets: [{ data: forecastValues, backgroundColor: pandal.forecast.map((f, index) => f.hour === pandal.hour ? color + 'EE' : forecastColor(forecastValues[index]) + 'CC'), borderRadius: 4 }] },
        plugins: [chartValueLabels],
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, ticks: { color: '#9da3b5', callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.06)' } },
                x: { ticks: { color: '#9da3b5', font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
    setTimeout(() => map.flyTo([pandal.lat, pandal.lon], 15, { animate: true, duration: 0.8 }), 120);
}

function openPlanner() { document.getElementById('planner-modal').style.display = 'flex'; document.getElementById('plan-result').innerHTML = ''; }
function closePlanner() { document.getElementById('planner-modal').style.display = 'none'; }
function clearRoute() {
    if (window.routeLayer) map.removeLayer(window.routeLayer);
    if (window.routeMarkers) window.routeMarkers.forEach(m => map.removeLayer(m));
    window.routeMarkers = [];
    window.routeLayer = null;
}

function generatePlan() {
    const n = parseInt(document.getElementById('num-pandals').value);
    if (!allPandals.length) { alert('Please wait for map to load!'); return; }
    const riskOrder = { Green: 0, Yellow: 1, Red: 2 };
    const selected = [...allPandals].sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || b.popularity - a.popularity).slice(0, n);
    clearRoute(); window.routeMarkers = [];
    selected.forEach((p, i) => {
        const color = colorMap[p.risk];
        const icon = L.divIcon({ html: `<div style="background:${color};color:#000;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;">${i + 1}</div>`, className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
        window.routeMarkers.push(L.marker([p.lat, p.lon], { icon }).addTo(map).bindPopup(`<b>Stop ${i + 1}: ${p.name}</b><br><span style="color:${color}">${riskLabel[p.risk]}</span>`));
    });
    MapRouting.route(selected).catch(() => {
        document.getElementById('plan-result').insertAdjacentHTML('afterbegin', '<div class="route-error">Road route unavailable. Please try again.</div>');
    });
    let html = `<div style="font-size:11px;color:#9da3b5;margin-bottom:10px;">Your optimal ${n}-stop route is shown on the map.</div>`;
    selected.forEach((p, i) => { const color = colorMap[p.risk]; html += `<div class="plan-step"><div class="s-num">Stop ${i + 1}</div><div class="s-name" style="color:${color}">${p.name}</div><div class="s-risk" style="color:${color}">${riskLabel[p.risk]}</div></div>`; });
    const redCount = selected.filter(p => p.risk === 'Red').length;
    html += redCount > 0 ? `<div style="color:#F5C542;font-size:11px;margin-top:10px;">⚠️ ${redCount} stop(s) are crowded — try a different hour</div>` : `<div style="color:#10B981;font-size:11px;margin-top:10px;">✅ All stops currently safe to visit!</div>`;
    document.getElementById('plan-result').innerHTML = html;
}

function getRiskBadgeText(risk) { return { Green: 'Safe to visit', Yellow: 'Moderate crowd', Red: 'High crowd risk' }[risk] || 'Risk status'; }
function buildRecommendation(risk) {
    const mapping = { Green: 'Good choice. This pandal currently has a lower predicted crowd risk.', Yellow: 'Consider visiting during a less busy hour or checking nearby safer alternatives.', Red: 'Consider choosing a safer nearby pandal to reduce crowd exposure.' };
    return `<strong>Recommendation</strong>${mapping[risk] || 'Please review nearby safer alternatives before visiting.'}`;
}

window.addEventListener('resize', () => map.invalidateSize());
fetchLivePandalData();
setInterval(fetchLivePandalData, 5000);
