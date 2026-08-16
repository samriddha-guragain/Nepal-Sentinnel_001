// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBeBgLuuSqq0vFJ7Fom03frIhTs8IuZyg",
    authDomain: "demo2-54ed9.firebaseapp.com",
    projectId: "demo2-54ed9",
    storageBucket: "demo2-54ed9.appfirebasestorage.app",
    messagingSenderId: "16717770666",
    appId: "1:16717770666:web:5c7ee542ae2cfd253362d3",
    measurementId: "G-6CY0PQLD4P"
};

try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase init error:", e);
}

const db = firebase.firestore();

// Predefined Kathmandu Area Coordinates
const locationCoords = {
    "Thamel": [27.7154, 85.3123],
    "Lainchaur": [27.7172, 85.3145],
    "Durbar Marg": [27.7115, 85.3188],
    "Baneshwor": [27.6938, 85.3402],
    "Bouddha": [27.7215, 85.3620],
    "Patan / Lalitpur": [27.6766, 85.3235],
    "Koteshwor": [27.6773, 85.3486],
    "Maharajgunj": [27.7378, 85.3315],
    "Balaju": [27.7342, 85.3056],
    "Kalanki": [27.6947, 85.2818]
};

let map;
let markersLayer = L.layerGroup();
let allComplaints = [];
let locationDangerMap = {};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initDataListeners();
    setupFilters();
});

// Initialize Leaflet Map
function initMap() {
    const kathmanduCenter = [27.7172, 85.3240];
    map = L.map('map').setView(kathmanduCenter, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer.addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 250);
}

// Fetch complaints & location danger metrics from Firestore in real-time
function initDataListeners() {
    // Listen to location danger levels
    db.collection("locations").onSnapshot((locSnapshot) => {
        locationDangerMap = {};
        locSnapshot.forEach((doc) => {
            locationDangerMap[doc.id] = doc.data().dangerLevel || 0;
        });

        // Listen to complaints
        db.collection("complaints").onSnapshot((compSnapshot) => {
            allComplaints = [];
            compSnapshot.forEach((doc) => {
                allComplaints.push({ id: doc.id, ...doc.data() });
            });

            populateDropdown();
            renderSidebarList();
            renderMapMarkers();
        });
    });
}

function populateDropdown() {
    const dropdown = document.getElementById('locationDropdown');
    dropdown.innerHTML = '<option value="">-- Select Kathmandu Location --</option>';
    
    Object.keys(locationCoords).forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        const danger = locationDangerMap[loc] || 0;
        opt.textContent = `${loc} (Danger: ${danger})`;
        dropdown.appendChild(opt);
    });

    dropdown.onchange = (e) => {
        const selectedLoc = e.target.value;
        if (selectedLoc && locationCoords[selectedLoc]) {
            map.setView(locationCoords[selectedLoc], 15);
        }
    };
}

// Render Sidebar with accordion for each location, showing crimes by status (green, gray, red)
function renderSidebarList() {
    const container = document.getElementById('locationsListContainer');
    const searchTerm = document.getElementById('mapSearchInput').value.toLowerCase();
    container.innerHTML = '';

    const locations = Object.keys(locationCoords).filter(loc => loc.toLowerCase().includes(searchTerm));

    if (locations.length === 0) {
        container.innerHTML = `<p class="loading-text">No locations found.</p>`;
        return;
    }

    locations.forEach(locName => {
        const dangerLevel = locationDangerMap[locName] || 0;
        const locCrimes = allComplaints.filter(c => c.location === locName);

        // Determine danger badge class based on requirements:
        // 1 <= danger < 5: Yellow
        // danger >= 5: Brown
        // danger > 10: Red
        let dangerClass = 'danger-safe';
        let dangerText = `Danger: ${dangerLevel}`;
        if (dangerLevel > 10) {
            dangerClass = 'danger-red';
            dangerText = `High Danger: ${dangerLevel}`;
        } else if (dangerLevel >= 5) {
            dangerClass = 'danger-brown';
            dangerText = `Moderate Danger: ${dangerLevel}`;
        } else if (dangerLevel >= 1) {
            dangerClass = 'danger-yellow';
            dangerText = `Caution: ${dangerLevel}`;
        }

        const item = document.createElement('div');
        item.className = 'location-accordion-item';

        let crimesHtml = locCrimes.length === 0 ? `<p style="color: #94a3b8; font-size: 12px;">No crimes recorded here yet.</p>` : '';
        
        locCrimes.forEach(c => {
            const stat = c.approvalStatus || 'Pending';
            let statusClass = 'status-pending'; // Gray
            if (stat === 'Approved') statusClass = 'status-approved'; // Green
            else if (stat === 'Rejected') statusClass = 'status-rejected'; // Red

            crimesHtml += `
                <div class="crime-mini-card ${statusClass}">
                    <p><b>${c.crimeType || 'Incident'}</b> (${stat})</p>
                    <p><i class="fa-solid fa-calendar"></i> ${c.crimeDay || 'N/A'} | Time: ${c.crimeTime || 'N/A'}</p>
                    <p><i class="fa-solid fa-user"></i> ${c.reporterName || 'Anonymous'}</p>
                </div>
            `;
        });

        item.innerHTML = `
            <div class="location-accordion-header">
                <span class="loc-name"><i class="fa-solid fa-map-pin" style="color: #38bdf8;"></i> ${locName}</span>
                <span class="danger-badge ${dangerClass}">${dangerText}</span>
            </div>
            <div class="location-accordion-body">
                ${crimesHtml}
            </div>
        `;

        // Click header to expand accordion & pan map
        item.querySelector('.location-accordion-header').addEventListener('click', () => {
            item.classList.toggle('expanded');
            if (locationCoords[locName]) {
                map.setView(locationCoords[locName], 14);
            }
        });

        container.appendChild(item);
    });
}

// Render map markers color-coded by danger level and status
function renderMapMarkers() {
    markersLayer.clearLayers();

    allComplaints.forEach(c => {
        if (!c.latitude || !c.longitude) return;

        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        const danger = locationDangerMap[c.location] || 0;

        // Marker color based on danger level
        let markerColor = 'blue';
        if (danger > 10) markerColor = 'red';
        else if (danger >= 5) markerColor = 'orange';
        else if (danger >= 1) markerColor = 'gold';
        else markerColor = 'green';

        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: markerColor,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #333;">
                <b style="color: #0f172a; font-size: 14px;">${c.crimeType}</b><br>
                <b>Location:</b> ${c.location}<br>
                <b>Status:</b> ${c.approvalStatus || 'Pending'}<br>
                <b>Date:</b> ${c.crimeDay} at ${c.crimeTime}<br>
                <b>Area Danger Score:</b> ${danger}
            </div>
        `);

        markersLayer.addLayer(marker);
    });
}

function setupFilters() {
    const searchInput = document.getElementById('mapSearchInput');
    searchInput.addEventListener('input', () => {
        renderSidebarList();
    });
}