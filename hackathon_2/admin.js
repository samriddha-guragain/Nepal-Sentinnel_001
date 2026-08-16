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

// Department Stations with Initial Total Inventories (Officers & Vehicles)
const kathmanduStations = {
    "Thamel": { totalOfficers: 15, totalVehicles: 4 },
    "Lainchaur": { totalOfficers: 12, totalVehicles: 3 },
    "Durbar Marg": { totalOfficers: 18, totalVehicles: 5 },
    "Baneshwor": { totalOfficers: 20, totalVehicles: 6 },
    "Bouddha": { totalOfficers: 12, totalVehicles: 3 },
    "Patan / Lalitpur": { totalOfficers: 22, totalVehicles: 7 },
    "Koteshwor": { totalOfficers: 15, totalVehicles: 4 },
    "Maharajgunj": { totalOfficers: 16, totalVehicles: 4 },
    "Balaju": { totalOfficers: 14, totalVehicles: 3 },
    "Kalanki": { totalOfficers: 15, totalVehicles: 4 }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchPendingComplaints();
    listenForNewCrimesCaution();
});

// Real-time listener to trigger a caution alert whenever a new crime is registered in any area
function listenForNewCrimesCaution() {
    db.collection("complaints")
        .where("approvalStatus", "==", "Pending")
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    console.warn(`CAUTION: New crime registered in ${data.location}! Type: ${data.crimeType}`);
                    // Optional visual banner / browser alert
                }
            });
        });
}

// Real-time listener for pending complaints queue
function fetchPendingComplaints() {
    const container = document.getElementById('pendingComplaintsContainer');
    const pendingCountBadge = document.getElementById('pendingCount');

    db.collection("complaints")
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            container.innerHTML = '';
            let pendingList = [];

            snapshot.forEach((doc) => {
                const data = { id: doc.id, ...doc.data() };
                if (!data.approvalStatus || data.approvalStatus === 'Pending') {
                    pendingList.push(data);
                }
            });

            pendingCountBadge.textContent = pendingList.length;

            if (pendingList.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                        <i class="fa-solid fa-circle-check" style="font-size: 40px; color: #10b981; margin-bottom: 10px;"></i>
                        <p>No pending complaints left to review!</p>
                    </div>
                `;
                return;
            }

            pendingList.forEach((comp, index) => {
                const card = document.createElement('div');
                card.className = 'admin-card';

                let optionsHtml = '<option value="">-- Assign Department Station --</option>';
                Object.keys(kathmanduStations).forEach(station => {
                    const selected = comp.location === station ? 'selected' : '';
                    const stats = kathmanduStations[station];
                    optionsHtml += `<option value="${station}" ${selected}>${station} Station (${stats.totalOfficers} Officers, ${stats.totalVehicles} Cars)</option>`;
                });

                card.innerHTML = `
                    <div class="card-header">
                        <h4>#${index + 1} - ${comp.crimeType || 'Incident'}</h4>
                        <span class="badge-status pending">Pending</span>
                    </div>
                    <div class="card-body">
                        <p><i class="fa-solid fa-location-dot"></i> <b>Area:</b> ${comp.location}</p>
                        <p><i class="fa-solid fa-calendar-day"></i> <b>Date & Time:</b> ${comp.crimeDay || 'N/A'} at ${comp.crimeTime || 'N/A'}</p>
                        <p><i class="fa-solid fa-map-pin"></i> <b>Coords:</b> ${comp.latitude}, ${comp.longitude}</p>
                        <p><i class="fa-solid fa-user"></i> <b>Reporter:</b> ${comp.reporterName} (${comp.reporterPhone})</p>
                    </div>
                    <div class="card-actions">
                        <select class="department-select" id="dept-${comp.id}">
                            ${optionsHtml}
                        </select>
                        <div class="resources-group">
                            <div class="resource-field">
                                <label for="officers-${comp.id}">Officers to Assign</label>
                                <input type="number" id="officers-${comp.id}" class="resource-input" min="1" placeholder="Officers">
                            </div>
                            <div class="resource-field">
                                <label for="vehicles-${comp.id}">Vehicles / Cars</label>
                                <input type="number" id="vehicles-${comp.id}" class="resource-input" min="0" placeholder="Cars">
                            </div>
                        </div>
                        <div class="action-buttons">
                            <button class="btn-approve" onclick="approveComplaint('${comp.id}', '${comp.location}')">
                                <i class="fa-solid fa-check"></i> Approve & Allocate
                            </button>
                            <button class="btn-reject" onclick="rejectComplaint('${comp.id}')">
                                <i class="fa-solid fa-trash"></i> Move to Trash
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }, (error) => {
            console.error("Error fetching pending complaints:", error);
            container.innerHTML = `<p style="color: red;">Error loading complaints from database.</p>`;
        });
}

// Approve action with resource validation AND danger level increment (+1)
window.approveComplaint = function(id, locationName) {
    const deptSelect = document.getElementById(`dept-${id}`);
    const assignedDept = deptSelect.value;
    const officersInput = parseInt(document.getElementById(`officers-${id}`).value) || 0;
    const vehiclesInput = parseInt(document.getElementById(`vehicles-${id}`).value) || 0;

    if (!assignedDept) {
        alert("Please select a department station.");
        return;
    }

    const stationData = kathmanduStations[assignedDept];
    const totalOfficers = stationData.totalOfficers;
    const maxAllowedOfficers = Math.floor((2 / 3) * totalOfficers);
    const minStationReserve = 2;

    if ((totalOfficers - officersInput) < minStationReserve) {
        alert(`Validation Error: A mandatory minimum of ${minStationReserve} officers must remain at the station!`);
        return;
    }

    if (officersInput > maxAllowedOfficers) {
        alert(`Validation Error: Maximum allowed officers is 2/3rd (${maxAllowedOfficers}) of total personnel (${totalOfficers}).`);
        return;
    }

    if (vehiclesInput > stationData.totalVehicles) {
        alert(`Validation Error: Station only has ${stationData.totalVehicles} vehicles available.`);
        return;
    }

    // Update Complaint & Increment Danger Level for Location
    const locRef = db.collection("locations").doc(assignedDept);

    db.runTransaction(async (transaction) => {
        const locDoc = await transaction.get(locRef);
        let currentDanger = 0;
        if (locDoc.exists) {
            currentDanger = locDoc.data().dangerLevel || 0;
        }
        // Increment danger level by 1 upon approval
        transaction.set(locRef, { dangerLevel: currentDanger + 1 }, { merge: true });

        // Update complaint status
        const compRef = db.collection("complaints").doc(id);
        transaction.update(compRef, {
            approvalStatus: "Approved",
            assignedDepartment: assignedDept,
            assignedOfficers: officersInput,
            assignedVehicles: vehiclesInput,
            status: `Assigned to ${assignedDept} (${officersInput} Officers, ${vehiclesInput} Vehicles)`
        });
    })
    .then(() => {
        alert(`Complaint approved, assigned to ${assignedDept}, and location danger level increased by +1!`);
    })
    .catch((error) => {
        console.error("Error in approval transaction: ", error);
        alert("Failed to process approval.");
    });
};

window.rejectComplaint = function(id) {
    if (!confirm("Are you sure you want to move this complaint to trash?")) return;

    db.collection("complaints").doc(id).update({
        approvalStatus: "Rejected",
        status: "Moved to Trash"
    })
    .then(() => {
        alert("Complaint moved to trash.");
    })
    .catch((error) => {
        console.error("Error rejecting complaint:", error);
    });
};