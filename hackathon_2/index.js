console.log("CHECKPOINT 0: index.js script loaded.");

// --- 1. Firebase Configuration & Initialization ---
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
    console.log("CHECKPOINT 1: Firebase initialized successfully.");
} catch (e) {
    console.error("CHECKPOINT 1 ERROR: Firebase initialization error:", e);
}

const db = firebase.firestore();

// --- Predefined Kathmandu Area Coordinates ---
const locationCoords = {
    "Thamel": [27.7154, 85.3123],
    "Lainchaur": [27.7172, 85.3145],
    "Durbar Marg": [27.7115, 85.3188],
    "Baneshwor": [27.6938, 85.3402],
    "Bouddha": [27.7215, 85.3620],
    "Patan": [27.6766, 85.3235],
    "Koteshwor": [27.6773, 85.3486],
    "Maharajgunj": [27.7378, 85.3315],
    "Balaju": [27.7342, 85.3056],
    "Kalanki": [27.6947, 85.2818]
};

let map;
let currentMarker = null;

// --- Initialize Everything on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("CHECKPOINT 2: DOMContentLoaded fired. Starting initialization...");
    initMap();
    setupEventListeners();
});

// --- Leaflet Map Initialization ---
function initMap() {
    console.log("CHECKPOINT 4: initMap running...");
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error("CHECKPOINT 4 ERROR: Map container element with id 'map' not found!");
        return;
    }

    const kathmanduCenter = [27.7172, 85.3240];
    try {
        map = L.map('map').setView(kathmanduCenter, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Force recalculation of container size after render
        setTimeout(() => {
            map.invalidateSize();
            console.log("CHECKPOINT 4: Map size invalidated/refreshed successfully.");
        }, 250);

        // Click map to drop/move pin and grab coordinates
        map.on('click', function(e) {
            console.log("CHECKPOINT 4.1: Map clicked at coordinates:", e.latlng);
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);

            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lng;

            updateMarkerPosition([e.latlng.lat, e.latlng.lng]);
        });
        console.log("CHECKPOINT 4: Leaflet map initialized successfully.");
    } catch (err) {
        console.error("CHECKPOINT 4 ERROR: Failed to initialize Leaflet map:", err);
    }
}

function updateMarkerPosition(coords) {
    if (currentMarker) {
        currentMarker.setLatLng(coords);
        console.log("CHECKPOINT 4.2: Existing marker position updated to:", coords);
    } else {
        currentMarker = L.marker(coords, {draggable: true}).addTo(map);
        console.log("CHECKPOINT 4.3: New marker created at:", coords);
        
        currentMarker.on('dragend', function(event) {
            const position = event.target.getLatLng();
            console.log("CHECKPOINT 4.4: Marker dragged to:", position);
            document.getElementById('latitude').value = position.lat.toFixed(6);
            document.getElementById('longitude').value = position.lng.toFixed(6);
        });
    }
}

// --- Setup UI Event Listeners & Data Transfer ---
function setupEventListeners() {
    console.log("CHECKPOINT 5: setupEventListeners running...");
    
    // Dropdown area selector zooms the map and auto-pins coordinates
    const locationSelect = document.getElementById('kathmanduLocation');
    if (locationSelect) {
        locationSelect.addEventListener('change', function(e) {
            const selectedArea = e.target.value;
            console.log("CHECKPOINT 5.1: Location dropdown changed to:", selectedArea);
            if (selectedArea && locationCoords[selectedArea]) {
                const coords = locationCoords[selectedArea];
                map.setView(coords, 15);
                document.getElementById('latitude').value = coords[0].toFixed(6);
                document.getElementById('longitude').value = coords[1].toFixed(6);
                updateMarkerPosition(coords);
            }
        });
    } else {
        console.warn("CHECKPOINT 5 WARNING: Element 'kathmanduLocation' not found.");
    }

    // Drawer toggle logic
    const messageToggleBtn = document.getElementById('messageToggleBtn');
    const complaintDrawer = document.getElementById('complaintDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    if (messageToggleBtn && complaintDrawer) {
        messageToggleBtn.addEventListener('click', () => {
            complaintDrawer.classList.toggle('open');
        });
    }

    if (closeDrawerBtn && complaintDrawer) {
        closeDrawerBtn.addEventListener('click', () => {
            complaintDrawer.classList.remove('open');
        });
    }

    // Form Submission & Data Transfer to Firebase Firestore
    const crimeForm = document.getElementById('crimeForm');
    if (crimeForm) {
        crimeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log("CHECKPOINT 6: Form submit event triggered!");

            const latVal = document.getElementById('latitude').value;
            const lngVal = document.getElementById('longitude').value;

            if(!latVal || !lngVal) {
                console.warn("CHECKPOINT 6 WARNING: Latitude or Longitude is missing.");
                alert("Please select a location area or click on the map to pinpoint coordinates.");
                return;
            }

            const incidentReport = {
                crimeType: document.getElementById('crimeType').value,
                location: document.getElementById('kathmanduLocation').value,
                crimeDay: document.getElementById('crimeDay').value,
                crimeTime: document.getElementById('crimeTimeInput').value,
                latitude: latVal,
                longitude: lngVal,
                reporterName: document.getElementById('reporterName').value || "Anonymous",
                reporterPhone: document.getElementById('reporterPhone').value || "Not Provided",
                status: "Pending Review",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            console.log("CHECKPOINT 6.1: Preparing to send incident report to Firestore:", incidentReport);

            db.collection("complaints").add(incidentReport)
                .then((docRef) => {
                    console.log("CHECKPOINT 6.2 SUCCESS: Document successfully written with ID: ", docRef.id);
                    alert("Incident report successfully sent to database!");
                    crimeForm.reset();
                    if (currentMarker) {
                        map.removeLayer(currentMarker);
                        currentMarker = null;
                    }
                })
                .catch((error) => {
                    console.error("CHECKPOINT 6.3 ERROR: Error adding document to Firestore: ", error);
                    alert("Error submitting report. Please check the browser console.");
                });
        });
        console.log("CHECKPOINT 5: Form submit listener attached successfully.");
    } else {
        console.error("CHECKPOINT 5 ERROR: 'crimeForm' element not found!");
    }
}