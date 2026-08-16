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

let allComplaintsStore = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initInbox();
});

function initInbox() {
    // Setup sidebar tab listeners
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.getAttribute('data-filter');
            
            const titles = {
                'all': 'All Complaints',
                'pending': 'Pending Crimes',
                'approved': 'Approved Crimes',
                'rejected': 'Not Approved / Trash'
            };
            document.getElementById('currentCategoryTitle').textContent = titles[currentFilter] || 'Complaints';
            renderInboxList();
        });
    });

    // Setup Search listener
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        renderInboxList();
    });

    // Fetch data from Firestore
    db.collection("complaints")
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            allComplaintsStore = [];
            snapshot.forEach((doc) => {
                allComplaintsStore.push({ id: doc.id, ...doc.data() });
            });
            updateBadges();
            renderInboxList();
        }, (error) => {
            console.error("Error fetching inbox data:", error);
        });
}

function updateBadges() {
    let countAll = allComplaintsStore.length;
    let countPending = 0;
    let countApproved = 0;
    let countRejected = 0;

    allComplaintsStore.forEach(c => {
        const stat = c.approvalStatus || 'Pending';
        if (stat === 'Pending') countPending++;
        else if (stat === 'Approved') countApproved++;
        else if (stat === 'Rejected') countRejected++;
    });

    document.getElementById('countAll').textContent = countAll;
    document.getElementById('countPending').textContent = countPending;
    document.getElementById('countApproved').textContent = countApproved;
    document.getElementById('countRejected').textContent = countRejected;
}

function renderInboxList() {
    const container = document.getElementById('gmailListContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    container.innerHTML = '';

    // Filter by tab category
    let filtered = allComplaintsStore.filter(c => {
        const stat = c.approvalStatus || 'Pending';
        if (currentFilter === 'pending') return stat === 'Pending';
        if (currentFilter === 'approved') return stat === 'Approved';
        if (currentFilter === 'rejected') return stat === 'Rejected';
        return true; // 'all'
    });

    // Filter by search query
    if (searchTerm) {
        filtered = filtered.filter(c => 
            (c.crimeType && c.crimeType.toLowerCase().includes(searchTerm)) ||
            (c.location && c.location.toLowerCase().includes(searchTerm)) ||
            (c.reporterName && c.reporterName.toLowerCase().includes(searchTerm))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #64748b;">
                <i class="fa-regular fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i>
                <p>No complaints found in this section.</p>
            </div>
        `;
        return;
    }

    filtered.forEach((comp) => {
        const row = document.createElement('div');
        row.className = 'gmail-row';

        const approvalStat = comp.approvalStatus || 'Pending';
        const dateStr = comp.crimeDay || 'Recent';

        row.innerHTML = `
            <div class="gmail-row-summary">
                <span class="gmail-crime-type">${comp.crimeType || 'Incident'}</span>
                <span class="gmail-location"><i class="fa-solid fa-location-dot" style="color: #0284c7;"></i> ${comp.location}</span>
                <span class="gmail-snippet">Status: <b>${approvalStat}</b> | Assigned: ${comp.assignedDepartment || 'None'} | Reporter: ${comp.reporterName || 'Anonymous'}</span>
                <span class="gmail-date">${dateStr}</span>
            </div>
            <div class="gmail-row-details">
                <div class="detail-grid">
                    <p><b>Incident Category:</b> ${comp.crimeType}</p>
                    <p><b>Location Area:</b> ${comp.location}</p>
                    <p><b>Date & Time:</b> ${comp.crimeDay} at ${comp.crimeTime}</p>
                    <p><b>Exact Coordinates:</b> ${comp.latitude}, ${comp.longitude}</p>
                    <p><b>Reporter Name:</b> ${comp.reporterName}</p>
                    <p><b>Contact Phone:</b> ${comp.reporterPhone}</p>
                    <p><b>Approval Status:</b> ${approvalStat}</p>
                    <p><b>Assigned Department:</b> ${comp.assignedDepartment || 'Not Yet Assigned'}</p>
                </div>
            </div>
        `;

        // Gmail accordion click behavior to expand/collapse details
        const summary = row.querySelector('.gmail-row-summary');
        summary.addEventListener('click', () => {
            row.classList.toggle('expanded');
        });

        container.appendChild(row);
    });
}