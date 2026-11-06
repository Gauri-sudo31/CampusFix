
const STORAGE_KEY = "campusfix_complaints";

const maintenanceStaff = [
    {
        id: "STF-01",
        name: "Rahul Sharma",
        team: "Electrical"
    },
    {
        id: "STF-02",
        name: "Priya Verma",
        team: "Plumbing"
    },
    {
        id: "STF-03",
        name: "Aman Singh",
        team: "General Maintenance"
    },
    {
        id: "STF-04",
        name: "Neha Gupta",
        team: "Internet"
    }
];

const sampleComplaints = [
    {
        id: "CF-1001",
        title: "Broken classroom light",
        category: "Electrical",
        location: "Block A, Room 204",
        description: "One of the classroom lights is not working.",
        date: "2026-10-26",
        status: "Submitted"
    },
    {
        id: "CF-1002",
        title: "Water leakage",
        category: "Plumbing",
        location: "Block B, First Floor",
        description: "Water is leaking near the washroom.",
        date: "2026-10-25",
        status: "In Progress"
    },
    {
        id: "CF-1003",
        title: "Damaged classroom chair",
        category: "Furniture",
        location: "Block C, Room 101",
        description: "A chair needs repair.",
        date: "2026-10-24",
        status: "Resolved"
    },
    {
        id: "CF-1004",
        title: "Wi-Fi connectivity issue",
        category: "Internet",
        location: "Library",
        description: "Wi-Fi connectivity is unstable.",
        date: "2026-10-23",
        status: "Assigned"
    }
];

let complaints = loadComplaints();
function closeComplaintDetails() {
    document.getElementById("details-modal").classList.remove("open");
}

function loadComplaints() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [...sampleComplaints];
        }
    } catch (error) {
        console.error("Could not load saved complaints:", error);
    }

    return [...sampleComplaints];
}

function saveComplaints() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
    } catch (error) {
        showToast("Could not save data in this browser.");
        console.error("Could not save complaints:", error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function getStatusClass(status) {
    const classes = {
        "Submitted": "status-submitted",
        "Assigned": "status-assigned",
        "In Progress": "status-in-progress",
        "Resolved": "status-resolved"
    };

    return classes[status] || "status-submitted";
}

function statusBadge(status) {
    return `<span class="status-badge ${getStatusClass(status)}">${escapeHTML(status)}</span>`;
}

function renderStats() {
    const total = complaints.length;
    const pending = complaints.filter(item => item.status === "Submitted").length;
    const assigned = complaints.filter(item => item.status === "Assigned").length;
    const inProgress = complaints.filter(item => item.status === "In Progress").length;
    const resolved = complaints.filter(item => item.status === "Resolved").length;
    const open = total - resolved;
    const resolutionRate = total === 0 ? 0 : Math.round((resolved / total) * 100);

    document.getElementById("total-count").textContent = total;
    document.getElementById("pending-count").textContent = pending;
    document.getElementById("progress-count").textContent = inProgress + assigned;
    document.getElementById("resolved-count").textContent = resolved;
    document.getElementById("resolution-rate").textContent = resolutionRate + "%";
    document.getElementById("open-count").textContent = open;
}

function renderRecentComplaints() {
    const tbody = document.getElementById("recent-complaints");
    const emptyMessage = document.getElementById("recent-empty");

    const recent = [...complaints]
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 5);

    tbody.innerHTML = recent.map(item => `
        <tr>
            <td>
    <button class="text-button complaint-details-btn"
        data-id="${escapeHTML(item.id)}">
        ${escapeHTML(item.id)}
    </button>
</td>
            <td>${escapeHTML(item.title)}</td>
            <td>${escapeHTML(item.location)}</td>
            <td>${formatDate(item.date)}</td>
            <td>${statusBadge(item.status)}</td>
        </tr>
    `).join("");

    emptyMessage.style.display = recent.length ? "none" : "block";
}

function renderAllComplaints() {
    const tbody = document.getElementById("all-complaints");
    const emptyMessage = document.getElementById("all-empty");
    const search = document.getElementById("search-input").value
        .trim()
        .toLowerCase();
    const status = document.getElementById("status-filter").value;

    const filtered = [...complaints]
        .sort((a, b) => b.id.localeCompare(a.id))
        .filter(item => {
            const matchesSearch = [
                item.id,
                item.title,
                item.category,
                item.location
            ].some(value => String(value).toLowerCase().includes(search));

            const matchesStatus = status === "All" || item.status === status;

            return matchesSearch && matchesStatus;
        });

    tbody.innerHTML = filtered.map(item => `
        <tr>
            <td>${escapeHTML(item.id)}</td>
            <td>${escapeHTML(item.title)}</td>
            <td>${escapeHTML(item.category)}</td>
            <td>${escapeHTML(item.location)}</td>
            <td>${formatDate(item.date)}</td>
            <td>
                <select class="status-select"
                    data-id="${escapeHTML(item.id)}"
                    aria-label="Change status for ${escapeHTML(item.id)}">
                    ${["Submitted", "Assigned", "In Progress", "Resolved"]
                        .map(option => `
                            <option value="${option}"
                                ${item.status === option ? "selected" : ""}>
                                ${option}
                            </option>
                        `).join("")}
                </select>
            </td>
        </tr>
    `).join("");

    emptyMessage.style.display = filtered.length ? "none" : "block";
}

function renderAnalytics() {
    const chart = document.getElementById("category-chart");
    const emptyMessage = document.getElementById("analytics-empty");

    if (complaints.length === 0) {
        chart.innerHTML = "";
        emptyMessage.style.display = "block";
        return;
    }

    emptyMessage.style.display = "none";

    const counts = {};

    complaints.forEach(item => {
        counts[item.category] = (counts[item.category] || 0) + 1;
    });

    const categories = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    const maxCount = Math.max(...categories.map(item => item[1]));

    chart.innerHTML = categories.map(([category, count]) => {
        const width = (count / maxCount) * 100;

        return `
            <div class="category-row">
                <span class="category-name">${escapeHTML(category)}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${width}%"></div>
                </div>
                <span class="category-count">${count}</span>
            </div>
        `;
    }).join("");
}

function renderApp() {
    renderStats();
    renderRecentComplaints();
    renderAllComplaints();
    renderAnalytics();
}

function showPage(pageName) {
    const pages = document.querySelectorAll(".page");
    const navLinks = document.querySelectorAll(".nav-link");
    const pageTitle = document.getElementById("page-title");

    pages.forEach(page => {
        page.classList.toggle("active", page.id === `${pageName}-page`);
    });

    navLinks.forEach(link => {
        link.classList.toggle("active", link.dataset.page === pageName);
    });

    const titles = {
        dashboard: "Dashboard",
        complaints: "Complaints",
        maintenance: "Maintenance Team",
        analytics: "Analytics"
    };

    pageTitle.textContent = titles[pageName] || "Dashboard";
}

function openModal() {
    document.getElementById("complaint-modal").classList.add("open");
    document.getElementById("issue-title").focus();
}

function closeModal() {
    document.getElementById("complaint-modal").classList.remove("open");
    document.getElementById("complaint-form").reset();
}

let toastTimeout;

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function openComplaintDetails(complaintId) {
    const complaint = complaints.find(item => item.id === complaintId);

    if (!complaint) {
        showToast("Complaint not found.");
        return;
    }

    document.getElementById("detail-title").textContent = complaint.title;
    document.getElementById("detail-id").textContent = complaint.id;
    document.getElementById("detail-category").textContent = complaint.category;
    document.getElementById("detail-location").textContent = complaint.location;
    document.getElementById("detail-date").textContent = formatDate(complaint.date);
    document.getElementById("detail-description").textContent = complaint.description;
    document.getElementById("detail-status").innerHTML = statusBadge(complaint.status);

const staffSelect = document.getElementById("staff-select");

staffSelect.innerHTML = `
    <option value="">Unassigned</option>
    ${maintenanceStaff.map(staff => `
        <option value="${staff.id}">
            ${staff.name} — ${staff.team}
        </option>
    `).join("")}
`;

staffSelect.value = complaint.assignedTo || "";

document.getElementById("assignment-message").textContent = "";

    document.getElementById("details-modal").classList.add("open");
}


async function createComplaint(event) {
    event.preventDefault();

    const title = document.getElementById("issue-title").value.trim();
    const category = document.getElementById("category").value;
    const location = document.getElementById("location").value.trim();
    const description = document.getElementById("description").value.trim();

    if (!title || !category || !location || !description) {
        showToast("Please complete all fields.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/complaints`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                title,
                category,
                location,
                description
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Complaint submission failed.");
            return;
        }

        await fetchComplaints();

        document.getElementById("complaint-form").reset();
        closeModal();
        showPage("dashboard");
        showToast("Complaint submitted successfully!");

    } catch (error) {
        console.error("Complaint submission error:", error);
        showToast("Could not connect to the server.");
    }
}


function updateComplaintStatus(event) {
    const select = event.target.closest(".status-select");

    if (!select) {
        return;
    }

    const complaint = complaints.find(item => item.id === select.dataset.id);

    if (!complaint) {
        return;
    }

    complaint.status = select.value;

    saveComplaints();
    renderApp();
    showToast(`${complaint.id} status updated.`);
}

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        showPage(link.dataset.page);
    });
});

document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.goto);
    });
});

document.getElementById("add-complaint-btn")
    .addEventListener("click", openModal);

document.getElementById("add-complaint-btn-2")
    .addEventListener("click", openModal);

document.getElementById("close-modal")
    .addEventListener("click", closeModal);

document.getElementById("cancel-modal")
    .addEventListener("click", closeModal);

document.getElementById("complaint-modal")
    .addEventListener("click", event => {
        if (event.target.id === "complaint-modal") {
            closeModal();
        }
    });

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});

document.getElementById("complaint-form")
    .addEventListener("submit", createComplaint);

document.getElementById("search-input")
    .addEventListener("input", renderAllComplaints);

document.getElementById("status-filter")
    .addEventListener("change", renderAllComplaints);

document.getElementById("all-complaints")
    .addEventListener("change", updateComplaintStatus);

document.addEventListener("click", event => {
    const button = event.target.closest(".complaint-details-btn");

    if (button) {
        openComplaintDetails(button.dataset.id);
    }
});

document.getElementById("close-details")
    .addEventListener("click", closeComplaintDetails);

document.getElementById("close-details-bottom")
    .addEventListener("click", closeComplaintDetails);

document.getElementById("details-modal")
    .addEventListener("click", event => {
        if (event.target.id === "details-modal") {
            closeComplaintDetails();
        }
    });

document.getElementById("assign-staff-btn")
    .addEventListener("click", () => {
        const complaintId = document.getElementById("detail-id").textContent;

        const complaint = complaints.find(item => item.id === complaintId);

        if (!complaint) {
            showToast("Complaint not found.");
            return;
        }

        const staffId = document.getElementById("staff-select").value;

        complaint.assignedTo = staffId;

        if (staffId && complaint.status === "Submitted") {
            complaint.status = "Assigned";
        }

        saveComplaints();
        renderApp();
        openComplaintDetails(complaintId);

        document.getElementById("assignment-message").textContent =
            staffId ? "Staff assignment saved successfully." : "Complaint is now unassigned.";

        showToast(staffId ? "Staff assigned successfully." : "Assignment removed.");
    });

renderApp();

const API_URL = "http://127.0.0.1:5000";
async function fetchComplaints() {
    try {
        const response = await fetch(`${API_URL}/api/complaints`, {
            method: "GET",
            credentials: "include"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to fetch complaints");
        }

        complaints = data.map(item => ({
            id: String(item.complaint_id),
            title: item.title,
            category: item.category_name,
            location: item.location,
            description: item.description,
            date: item.created_at ? item.created_at.slice(0, 10) : "",
            status: item.status,
            assignedTo: item.assigned_staff || ""
        }));

        renderApp();

    } catch (error) {
        console.error("Error fetching complaints:", error);
        showToast("Unable to load complaints.");
    }
}

document.getElementById("login-tab").addEventListener("click", () => {
    document.getElementById("login-form").style.display = "block";
    document.getElementById("register-form").style.display = "none";
    document.getElementById("login-tab").classList.add("active");
    document.getElementById("register-tab").classList.remove("active");
});

document.getElementById("register-tab").addEventListener("click", () => {
    document.getElementById("register-form").style.display = "block";
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-tab").classList.add("active");
    document.getElementById("login-tab").classList.remove("active");
});

document.getElementById("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
        full_name: document.getElementById("register-name").value.trim(),
        email: document.getElementById("register-email").value.trim(),
        password: document.getElementById("register-password").value
    };

    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Registration failed.");
            return;
        }

        showToast("Registration successful! Please login.");
        document.getElementById("login-tab").click();
        document.getElementById("register-form").reset();

    } catch (error) {
        showToast("Could not connect to the server.");
    }
});


document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value
    };

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Invalid login details.");
            return;
        }

        document.getElementById("auth-screen").style.display = "none";
        document.querySelector(".app").style.display = "flex";

        showToast("Welcome to CampusFix!");
        await fetchComplaints();

    } catch (error) {
        console.error("Login error:", error);
        showToast("Login error: " + error.message);
    }
});
