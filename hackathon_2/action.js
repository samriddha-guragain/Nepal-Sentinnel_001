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

// Station Passwords & Coordinates
const stationDatabase = {
    "Thamel": { password: "thamel123", coords: [27.7154, 85.3123], officers: 15, vehicles: 4 },
    "Lainchaur": { password: "lainchaur123", coords: [27.7172, 85.3145], officers: 12, vehicles: 3 },
    "Durbar Marg": { password: "durbarmarg123", coords: [27.7115, 85.3188], officers: 18, vehicles: 5 },
    "Baneshwor": { password: "baneshwor123", coords: [27.6938, 85.3402], officers: 20, vehicles: 6 },
    "Bouddha": { password: "bouddha123", coords: [27.7215, 85.3620], officers: 12, vehicles: 3 },
    "Patan / Lalitpur": { password: "patan123", coords: [27.6766, 85.3235], officers: 22, vehicles: 7 },
    "Koteshwor": { password: "koteshwor123", coords: [27.6773, 85.3486], officers: 15, vehicles: 4 },
    "Maharajgunj": { password: "maharajgunj123", coords: [27.7378, 85.3315], officers: 16, vehicles: 4 },
    "Balaju": { password: "balaju123", coords: [27.7342, 85.3056], officers: 14, vehicles: 3 },
    "Kalanki": { password: "kalanki123", coords: [27.6947, 85.2818], officers: 15, vehicles: 4 }
};

let currentActiveStation = localStorage.getItem('activePoliceStation') || null;
let map;
let allCrimesMarkersLayer = L.layerGroup();
let routingControl = null;
let selectedComplaintForReassign = null;

document.addEventListener('DOMContentLoaded', () => {
    if (currentActiveStation) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('dashboardApp').style.display = 'flex';
        initPortalSession(currentActiveStation);
    }
});

// Station Login Handler
window.handleStationLogin = function(e) {
    e.preventDefault();
    const station = document.getElementById('stationSelect').value;
    const pwd = document.getElementById('stationPassword').value;

    if (stationDatabase[station] && stationDatabase[station].password === pwd) {
        localStorage.setItem('activePoliceStation', station);
        currentActiveStation = station;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('dashboardApp').style.display = 'flex';
        initPortalSession(station);
    } else {
        alert("Invalid passcode for selected station. Please try again.");
    }
};

window.logoutStation = function() {
    localStorage.removeItem('activePoliceStation');
    location.reload();
};

function initPortalSession(stationName) {
    document.getElementById('activeStationTitle').textContent = `${stationName} Police Station - Operations`;
    
    // Load default or saved attendance
    const savedAtt = JSON.parse(localStorage.getItem(`att_${stationName}`)) || {
        officers: stationDatabase[stationName].officers,
        vehicles: stationDatabase[stationName].vehicles
    };

    document.getElementById('dispOfficers').textContent = savedAtt.officers;
    document.getElementById('dispVehicles').textContent = savedAtt.vehicles;

    initMap(stationName);
    fetchAssignedComplaints(stationName);
}

// Initialize Leaflet Map & Markers for all registered crimes
function initMap(stationName) {
    const stationCoords = stationDatabase[stationName].coords;
    map = L.map('map').setView(stationCoords, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    allCrimesMarkersLayer.addTo(map);

    // Add Station Pin
    const stationIcon = L.divIcon({
        className: 'custom-station-pin',
        html: '<div style="background-color:#4f46e5; color:white; padding:6px 10px; border-radius:20px; font-weight:700; font-size:11px; box-shadow:0 2px 6px rgba(0,0,0,0.4);"><i class="fa-solid fa-building-shield"></i> Station</div>',
        iconSize: [80, 30]
    });
    L.marker(stationCoords, { icon: stationIcon }).addTo(map).bindPopup(`<b>${stationName} Police Station</b>`);

    // Fetch and place all registered crimes across map
    db.collection("complaints").onSnapshot((snapshot) => {
        allCrimesMarkersLayer.clearLayers();
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.latitude && data.longitude) {
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);

                const crimeMarker = L.circleMarker([lat, lng], {
                    radius: 7,
                    fillColor: '#ef4444',
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.9
                });

                crimeMarker.bindPopup(`
                    <b>${data.crimeType || 'Incident'}</b><br>
                    Location: ${data.location}<br>
                    Status: ${data.approvalStatus || 'Pending'}<br>
                    Assigned Dept: ${data.assignedDepartment || 'None'}
                `);
                allCrimesMarkersLayer.addLayer(crimeMarker);
            }
        });
    });

    setTimeout(() => { map.invalidateSize(); }, 250);
}

// Fetch complaints assigned to this station by admin
function fetchAssignedComplaints(stationName) {
    const container = document.getElementById('stationComplaintsContainer');

    db.collection("complaints")
        .where("assignedDepartment", "==", stationName)
        .onSnapshot((snapshot) => {
            container.innerHTML = '';
            let cases = [];

            snapshot.forEach((doc) => {
                cases.push({ id: doc.id, ...doc.data() });
            });

            if (cases.length === 0) {
                container.innerHTML = `<p class="loading-text">No active crime cases assigned to your station.</p>`;
                return;
            }

            cases.forEach((c) => {
                const card = document.createElement('div');
                card.className = 'station-crime-card';
                
                card.innerHTML = `
                    <div class="crime-card-top">
                        <h4>${c.crimeType || 'Incident'}</h4>
                        <span class="badge-assigned">${c.approvalStatus}</span>
                    </div>
                    <p><i class="fa-solid fa-location-dot"></i> <b>Location:</b> ${c.location}</p>
                    <p><i class="fa-solid fa-calendar"></i> <b>Date:</b> ${c.crimeDay} at ${c.crimeTime}</p>
                    <p><i class="fa-solid fa-user-shield"></i> <b>Allocated:</b> ${c.assignedOfficers || 0} Officers, ${c.assignedVehicles || 0} Cars</p>
                    
                    <div class="crime-action-buttons">
                        <button class="btn-complete" onclick="markCrimeCompleted('${c.id}')">
                            <i class="fa-solid fa-check"></i> Complete
                        </button>
                        <button class="btn-transfer" onclick="openReassignModal('${c.id}')">
                            <i class="fa-solid fa-shuffle"></i> Transfer
                        </button>
                        <button class="btn-route" onclick="generateFastestRoute(${c.latitude}, ${c.longitude}, '${c.crimeType}')" title="Get Fastest Route">
                            <i class="fa-solid fa-route"></i> Route
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        });
}

// Generate Fastest Route from Station to Crime Coordinates using Leaflet Routing Machine
window.generateFastestRoute = function(lat, lng, crimeTitle) {
    if (!lat || !lng) {
        alert("Invalid geographic coordinates for this crime.");
        return;
    }

    const stationCoords = stationDatabase[currentActiveStation].coords;

    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(stationCoords[0], stationCoords[1]),
            L.latLng(lat, lng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: {
            styles: [{ color: '#38bdf8', opacity: 0.8, weight: 5 }]
        }
    }).addTo(map);

    document.getElementById('routeInfoText').innerHTML = `<i class="fa-solid fa-route" style="color: #10b981;"></i> Fastest route generated to <b>${crimeTitle}</b> from ${currentActiveStation} Station.`;
};

// Mark crime as completed
window.markCrimeCompleted = function(complaintId) {
    if (!confirm("Are you sure you want to declare this crime case as completed?")) return;

    db.collection("complaints").doc(complaintId).update({
        approvalStatus: "Completed",
        status: "Resolved by " + currentActiveStation
    })
    .then(() => {
        alert("Crime case successfully marked as completed!");
    })
    .catch((error) => {
        console.error("Error updating complaint:", error);
    });
};

// Reassignment Modal Handlers
window.openReassignModal = function(complaintId) {
    selectedComplaintForReassign = complaintId;
    document.getElementById('reassignModal').style.display = 'flex';
};

window.closeReassignModal = function() {
    selectedComplaintForReassign = null;
    document.getElementById('reassignModal').style.display = 'none';
};

window.confirmReassignment = function() {
    const targetDept = document.getElementById('targetStationSelect').value;
    if (!selectedComplaintForReassign || !targetDept) return;

    if (targetDept === currentActiveStation) {
        alert("Case is already assigned to this station.");
        return;
    }

    db.collection("complaints").doc(selectedComplaintForReassign).update({
        assignedDepartment: targetDept,
        status: `Reassigned from ${currentActiveStation} to ${targetDept}`
    })
    .then(() => {
        alert(`Case successfully requested for reassignment to ${targetDept} Station.`);
        closeReassignModal();
    })
    .catch((error) => {
        console.error("Error reassigning case:", error);
    });
};

// Daily Attendance Modal Handlers
window.openAttendanceModal = function() {
    const currentAtt = JSON.parse(localStorage.getItem(`att_${currentActiveStation}`)) || {
        officers: stationDatabase[currentActiveStation].officers,
        vehicles: stationDatabase[currentActiveStation].vehicles
    };
    document.getElementById('attOfficers').value = currentAtt.officers;
    document.getElementById('attVehicles').value = currentAtt.vehicles;
    document.getElementById('attendanceModal').style.display = 'flex';
};

window.closeAttendanceModal = function() {
    document.getElementById('attendanceModal').style.display = 'none';
};

window.submitAttendance = function() {
    const officers = parseInt(document.getElementById('attOfficers').value);
    const vehicles = parseInt(document.getElementById('attVehicles').value);

    if (isNaN(officers) || isNaN(vehicles) || officers < 0 || vehicles < 0) {
        alert("Please enter valid positive numbers for officers and vehicles.");
        return;
    }

    const attData = { officers, vehicles };
    localStorage.setItem(`att_${currentActiveStation}`, JSON.stringify(attData));

    document.getElementById('dispOfficers').textContent = officers;
    document.getElementById('dispVehicles').textContent = vehicles;

    alert("Daily station attendance saved successfully!");
    closeAttendanceModal();
};