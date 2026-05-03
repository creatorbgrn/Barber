const config = window.CREWE_CUT_CONFIG || {};
const themeStorageKey = "crewe-cut-theme-pro";

// Elements
const authPanel = document.getElementById("admin-auth-panel");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("admin-login-form");
const logoutButton = document.getElementById("logout-button");
const loginButton = document.getElementById("admin-login-button");
const feedback = document.getElementById("admin-feedback");
const dashboardFeedback = document.getElementById("admin-dashboard-feedback");

// Navigation
const navItems = document.querySelectorAll(".nav-item");
const adminSections = document.querySelectorAll("[data-admin-section]");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sectionLabel = document.getElementById("topbar-section-label");

// Content Areas
const statsGrid = document.getElementById("admin-stats");
const latestBookings = document.getElementById("latest-bookings");
const todayBookings = document.getElementById("today-bookings");
const clientsList = document.getElementById("clients-list");
const subscribersList = document.getElementById("subscribers-list");
const bookingsTableBody = document.getElementById("bookings-table-body");
const mobileBookings = document.getElementById("mobile-bookings");
const servicesSettingsList = document.getElementById("services-settings-list");
const gallerySettingsList = document.getElementById("gallery-settings-list");

// State
let supabaseClient = null;
let siteSettings = null;
let allBookings = [];
let serviceChart = null;
let volumeChart = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentBookingFilter = { search: "", status: "all", date: "" };
let currentClientSearch = "";

const defaultShopSettings = {
  services: [
    { name: "Haircut", duration: "35 min", price: "£15", featured: true, active: true },
    { name: "Skin or Zero Fade", duration: "40 min", price: "£17", featured: true, active: true }
  ],
  gallery: [
    { title: "Shop front", src: "images/storefront.jpg", active: true }
  ],
  maxBookingsPerSlot: 1,
  slotIntervalMinutes: 30,
  unavailableDates: [],
  unavailableSlots: []
};

// --- UTILS ---

function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabaseClient;
}

function setFeedback(el, type, msg) {
    if (!el) return;
    el.hidden = false;
    el.className = `form-message ${type}`;
    el.textContent = msg;
    if (type === 'success') setTimeout(() => el.hidden = true, 5000);
}

function formatDay(day) {
    if (!day) return "N/A";
    const date = new Date(day + "T00:00:00");
    return new Intl.DateTimeFormat("en-GB", { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function formatTime(time) {
    return time ? time.slice(0, 5) : "00:00";
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getBookingFlags(booking) {
    const notes = String(booking?.notes || "");
    const toBool = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "yes" || value === "on";

    const newsletterByField =
        toBool(booking?.newsletter_subscribed) ||
        toBool(booking?.newsletter) ||
        toBool(booking?.newsletter_offer) ||
        toBool(booking?.newsletterOffer) ||
        toBool(booking?.is_subscriber);

    const discountByField =
        toBool(booking?.wants_discount) ||
        toBool(booking?.discount_10) ||
        toBool(booking?.discount10) ||
        toBool(booking?.discount_offer);

    const notesLower = notes.toLowerCase();
    const newsletterByNotes =
        notes.includes("[NEWSLETTER_SUBSCRIBER]") ||
        notesLower.includes("newsletter") ||
        notesLower.includes("subscrib");

    const discountByNotes =
        notes.includes("[DISCOUNT_10]") ||
        notesLower.includes("10%") ||
        notesLower.includes("discount");

    return {
        newsletter: newsletterByField || newsletterByNotes,
        discount: discountByField || discountByNotes
    };
}

// --- NAVIGATION ---

function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-admin-target");
            switchSection(target);
            if (window.innerWidth <= 768) closeSidebar();
        });
    });

    sidebarToggle?.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    mobileMenuBtn?.addEventListener("click", () => {
        sidebar.classList.add("mobile-open");
        sidebarOverlay.classList.add("visible");
    });

    sidebarOverlay?.addEventListener("click", closeSidebar);
}

function closeSidebar() {
    sidebar.classList.remove("mobile-open");
    sidebarOverlay.classList.remove("visible");
}

function switchSection(target) {
    navItems.forEach(i => i.classList.toggle("is-active", i.getAttribute("data-admin-target") === target));
    adminSections.forEach(s => s.classList.toggle("is-active", s.getAttribute("data-admin-section") === target));
    
    // Update breadcrumb
    const activeNav = document.querySelector(`.nav-item[data-admin-target="${target}"] .nav-label`);
    if (activeNav && sectionLabel) sectionLabel.textContent = activeNav.textContent;

    if (target === 'calendar') renderCalendar();
}

// --- DATA LOADING ---

async function loadData() {
    const supabase = getSupabase();
    if (!supabase) return;

    const [bookingsRes, settingsRes] = await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("site_settings").select("settings").eq("key", "main").maybeSingle()
    ]);

    if (bookingsRes.error) {
        setFeedback(dashboardFeedback, "error", "Could not load bookings.");
        return;
    }

    allBookings = bookingsRes.data || [];
    siteSettings = (settingsRes.data && settingsRes.data.settings) ? settingsRes.data.settings : structuredClone(defaultShopSettings);
    
    renderDashboard();
    renderBookingsTable();
    renderClients();
    renderSubscribers();
    renderSettings();
}

// --- RENDERING ---

function renderDashboard() {
    const activeBookings = allBookings.filter(b => b.status !== 'cancelled');
    const today = getTodayStr();
    const todayList = activeBookings.filter(b => b.preferred_day === today);
    const newCount = activeBookings.filter(b => b.status === 'new').length;

    // Stats
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="kpi-card">
                <div class="kpi-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div class="kpi-value">${activeBookings.length}</div>
                <div class="kpi-label">Active Bookings</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="color: var(--accent)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <div class="kpi-value">${newCount}</div>
                <div class="kpi-label">New Bookings</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="color: var(--green)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div class="kpi-value">${todayList.length}</div>
                <div class="kpi-label">Today</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="color: var(--blue)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="kpi-value">${new Set(allBookings.map(b => b.email)).size}</div>
                <div class="kpi-label">Unique Clients</div>
            </div>
        `;
    }

    renderAnalytics(); // Initialize charts
    renderCalendar();  // Initialize calendar
    
    // New Badge
    const badge = document.getElementById("nav-badge-new");
    if (badge) badge.textContent = newCount > 0 ? newCount : "";

    // Lists
    renderSimpleList(latestBookings, activeBookings.slice(0, 5), "No recent bookings.");
    renderSimpleList(todayBookings, todayList.slice(0, 5), "No bookings today.");
}

function renderAnalytics() {
    const pieCanvas = document.getElementById("service-pie-chart");
    if (!pieCanvas) return;

    let startDateInput = document.getElementById("analytics-start");
    let endDateInput = document.getElementById("analytics-end");
    
    if (!startDateInput.value) {
        const d = new Date(); d.setDate(d.getDate() - 30);
        startDateInput.value = d.toISOString().split('T')[0];
    }
    if (!endDateInput.value) {
        endDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    const startObj = new Date(startDateInput.value);
    const endObj = new Date(endDateInput.value);
    
    const dateRange = [];
    let curr = new Date(startObj);
    while (curr <= endObj) {
        dateRange.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }

    const filteredBookings = allBookings.filter(b => {
        const bd = new Date(b.preferred_day);
        return bd >= startObj && bd <= endObj && b.status !== 'cancelled';
    });

    const isLight = document.body.dataset.theme === "light";
    const labelColor = isLight ? "#695d4f" : "#8a9bb5";
    const gridColor = isLight ? "rgba(37, 24, 12, 0.05)" : "rgba(255,255,255,0.05)";
    const tooltipBg = isLight ? "#fdfaf6" : "#1e2330";
    const tooltipText = isLight ? "#1f1710" : "#f0f0f0";

    let revenue = 0;
    const servicesMap = {};
    if(siteSettings && siteSettings.services) {
        siteSettings.services.forEach(s => {
            servicesMap[s.name] = parseFloat(s.price.replace(/[^0-9.]/g, '')) || 0;
        });
    }

    const servicesCount = {};
    const servicesRevenue = {};
    const uniqueClients = new Set();
    
    filteredBookings.forEach(b => {
        servicesCount[b.service] = (servicesCount[b.service] || 0) + 1;
        const r = (servicesMap[b.service] || 15);
        servicesRevenue[b.service] = (servicesRevenue[b.service] || 0) + r;
        uniqueClients.add(b.email || b.phone || b.client_name);
        revenue += r;
    });

    const kpiGrid = document.getElementById("analytics-kpi");
    if (kpiGrid) {
        kpiGrid.innerHTML = `
            <div class="kpi-card" style="border-top: none; background: var(--surface2); box-shadow: 0 8px 30px rgba(0,0,0,0.04); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.5rem; padding: 1.5rem;">
                <div style="position: absolute; top: 0; left: 0; bottom: 0; width: 4px; background: var(--blue);"></div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="kpi-label" style="font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.75rem;">Total Bookings</div>
                    <div class="kpi-icon" style="color: var(--blue); background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </div>
                </div>
                <div class="kpi-value" style="font-size: 2rem; font-weight: 700; color: var(--text); margin-top: 0.5rem;">${filteredBookings.length}</div>
            </div>
            <div class="kpi-card" style="border-top: none; background: var(--surface2); box-shadow: 0 8px 30px rgba(0,0,0,0.04); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.5rem; padding: 1.5rem;">
                <div style="position: absolute; top: 0; left: 0; bottom: 0; width: 4px; background: var(--green);"></div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="kpi-label" style="font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.75rem;">Est. Revenue</div>
                    <div class="kpi-icon" style="color: var(--green); background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                </div>
                <div class="kpi-value" style="font-size: 2rem; font-weight: 700; color: var(--text); margin-top: 0.5rem;">£${revenue.toFixed(2)}</div>
            </div>
            <div class="kpi-card" style="border-top: none; background: var(--surface2); box-shadow: 0 8px 30px rgba(0,0,0,0.04); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.5rem; padding: 1.5rem;">
                <div style="position: absolute; top: 0; left: 0; bottom: 0; width: 4px; background: var(--accent);"></div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="kpi-label" style="font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.75rem;">Unique Clients</div>
                    <div class="kpi-icon" style="color: var(--accent); background: rgba(212, 164, 104, 0.1); padding: 8px; border-radius: 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                </div>
                <div class="kpi-value" style="font-size: 2rem; font-weight: 700; color: var(--text); margin-top: 0.5rem;">${uniqueClients.size}</div>
            </div>
            <div class="kpi-card" style="border-top: none; background: var(--surface2); box-shadow: 0 8px 30px rgba(0,0,0,0.04); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.5rem; padding: 1.5rem;">
                <div style="position: absolute; top: 0; left: 0; bottom: 0; width: 4px; background: #f59e0b;"></div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="kpi-label" style="font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.75rem;">Total Sales</div>
                    <div class="kpi-icon" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 8px; border-radius: 8px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M9 13h6M9 17h3"/></svg>
                    </div>
                </div>
                <div class="kpi-value" style="font-size: 2rem; font-weight: 700; color: var(--text); margin-top: 0.5rem;">£2,083</div>
            </div>
        `;
    }

    const summary = document.getElementById("analytics-sales-summary");
    if (summary) summary.innerHTML = `<div>£${revenue.toFixed(2)}</div><div style="font-size:0.85rem; color:var(--muted); font-weight:normal; margin-top:0.25rem;">Selected Range</div>`;

    const pieLabels = Object.keys(servicesCount);
    const pieData = Object.values(servicesCount);

    if (serviceChart) serviceChart.destroy();
    serviceChart = new Chart(pieCanvas, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieData,
                backgroundColor: ['#b9772f', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: labelColor, padding: 20 } }
            },
            cutout: '70%'
        }
    });

    const breakdownEl = document.getElementById("sales-service-breakdown");
    if (breakdownEl) {
        const max = Math.max(...Object.values(servicesRevenue), 1);
        breakdownEl.innerHTML = Object.entries(servicesRevenue)
            .sort((a,b) => b[1] - a[1])
            .map(([name, val]) => `
                <div class="service-breakdown-row">
                    <div style="min-width: 120px; font-size: 0.8rem">${name}</div>
                    <div class="service-breakdown-bar-wrap">
                        <div class="service-breakdown-bar" style="width: ${(val/max)*100}%"></div>
                    </div>
                    <div class="service-breakdown-count">£${val.toFixed(2)}</div>
                </div>
            `).join("");
    }
}

function renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;

    const now = new Date();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const label = document.getElementById("cal-month-label");
    if (label) {
        const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        label.textContent = monthName;
    }

    let html = "";
    // Headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
        html += `<div class="cal-day-header">${d}</div>`;
    });

    // Padding
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month"></div>`;

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayBookings = allBookings.filter(b => b.preferred_day === dateStr);
        const isToday = (d === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear()) ? "today" : "";
        
        html += `
            <div class="cal-day ${isToday}" onclick="showDayBookings('${dateStr}')" style="cursor:pointer;">
                <div class="cal-day-num">${d}</div>
                ${dayBookings.map(() => `<div class="cal-dot"></div>`).join("")}
                ${dayBookings.length > 0 ? `<div class="cal-count">${dayBookings.length}</div>` : ""}
            </div>
        `;
    }

    grid.innerHTML = html;
}

function showDayBookings(dateStr) {
    const panel = document.getElementById("cal-day-panel");
    const list = document.getElementById("cal-day-list");
    const title = document.getElementById("cal-day-title");
    if (!panel || !list) return;

    const dayBookings = allBookings.filter(b => b.preferred_day === dateStr);
    title.textContent = `Bookings for ${dateStr}`;
    panel.hidden = false;
    renderSimpleList(list, dayBookings, "No bookings for this date.");
}

function getStatusColor(status) {
    switch(status) {
        case 'cancelled': return 'var(--red, #ef4444)';
        case 'completed': return 'var(--green, #10b981)';
        case 'contacted': return 'var(--blue, #3b82f6)';
        case 'confirmed': return 'var(--accent, #d4a468)';
        case 'new': default: return 'var(--text, #111827)';
    }
}

function renderSimpleList(container, list, emptyMsg) {
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>${emptyMsg}</p></div>`;
        return;
    }

    container.innerHTML = list.map(b => `
        <div class="overview-item">
            <div>
                <div class="overview-name">${b.client_name}</div>
                <div class="overview-sub">${b.service}</div>
            </div>
            <div class="overview-right">
                <div class="overview-slot">${formatTime(b.preferred_time)}</div>
                <select style="appearance: none; background: transparent; border: 1px solid var(--border, #e5e7eb); border-radius: 6px; padding: 0.2rem 1.4rem 0.2rem 0.5rem; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: ${getStatusColor(b.status)}; outline: none; cursor: pointer; background-image: url('data:image/svg+xml;utf8,<svg stroke=%22${getStatusColor(b.status).replace('#','%23')}%22 fill=%22none%22 stroke-width=%222%22 viewBox=%220 0 24 24%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 xmlns=%22http://www.w3.org/2000/svg%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>'); background-repeat: no-repeat; background-position: right 0.3rem center; background-size: 0.8rem;" onchange="updateStatus('${b.id}', this.value)">
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${b.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
        </div>
    `).join("");
}

function renderBookingsTable() {
    if (!bookingsTableBody) return;
    
    let filtered = allBookings;
    if (currentBookingFilter.status === "all") {
        filtered = filtered.filter(b => b.status !== 'cancelled');
    } else {
        filtered = filtered.filter(b => b.status === currentBookingFilter.status);
    }
    
    if (currentBookingFilter.date) {
        filtered = filtered.filter(b => b.preferred_day === currentBookingFilter.date);
    }
    if (currentBookingFilter.search) {
        const query = currentBookingFilter.search.toLowerCase();
        filtered = filtered.filter(b => 
            (b.client_name && b.client_name.toLowerCase().includes(query)) ||
            (b.email && b.email.toLowerCase().includes(query)) ||
            (b.phone && b.phone.includes(query)) ||
            (b.service && b.service.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        bookingsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--muted)">No bookings match your filters.</td></tr>`;
        if (mobileBookings) mobileBookings.innerHTML = `<div class="empty-state"><p>No bookings match your filters.</p></div>`;
        return;
    }

    bookingsTableBody.innerHTML = filtered.map(b => `
        <tr>
            <td class="td-name" style="font-weight: 600;">${b.client_name}</td>
            <td style="color: var(--accent); font-weight: 500;">${b.service}</td>
            <td><strong>${formatDay(b.preferred_day)}</strong> <span style="color:var(--muted)">@ ${formatTime(b.preferred_time)}</span></td>
            <td>
                <div class="td-sub" style="font-weight: 500; color: var(--text);">${b.phone}</div>
                <div class="td-sub" style="font-size: 0.8rem;">${b.email || '-'}</div>
            </td>
            <td><div class="td-sub" style="font-style: italic;">${b.notes || '-'}</div></td>
            <td>
                <select style="appearance: none; background: var(--surface2, #fdfaf6); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 0.35rem 1.8rem 0.35rem 0.75rem; font-weight: 600; font-size: 0.85rem; color: ${getStatusColor(b.status)}; outline: none; cursor: pointer; background-image: url('data:image/svg+xml;utf8,<svg stroke=%22${getStatusColor(b.status).replace('#','%23')}%22 fill=%22none%22 stroke-width=%222%22 viewBox=%220 0 24 24%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 xmlns=%22http://www.w3.org/2000/svg%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1rem;" onchange="updateStatus('${b.id}', this.value)">
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${b.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
        </tr>
    `).join("");

    if (mobileBookings) {
        mobileBookings.innerHTML = filtered.map(b => `
            <div style="background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 12px; padding: 1.25rem; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <strong style="font-size: 1.15rem; color: var(--text);">${b.client_name}</strong>
                    <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 0.25rem 0.6rem; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); color: var(--muted);">${b.status}</span>
                </div>
                <div style="font-size: 0.95rem; font-weight: 600; color: var(--accent); margin-top: -0.25rem;">${b.service}</div>
                
                <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem; margin-top: 0.25rem; padding-top: 0.5rem; border-top: 1px dashed var(--border);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span style="color: var(--text); font-weight: 500;">${formatDay(b.preferred_day)} @ ${formatTime(b.preferred_time)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span style="color: var(--text); font-weight: 500;">${b.phone}</span>
                    </div>
                </div>
                
                <select style="appearance: none; width: 100%; background: var(--surface2, #fdfaf6); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 0.6rem 1rem; font-weight: 600; font-size: 0.9rem; color: ${getStatusColor(b.status)}; outline: none; cursor: pointer; background-image: url('data:image/svg+xml;utf8,<svg stroke=%22${getStatusColor(b.status).replace('#','%23')}%22 fill=%22none%22 stroke-width=%222%22 viewBox=%220 0 24 24%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 xmlns=%22http://www.w3.org/2000/svg%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>'); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.2rem;" onchange="updateStatus('${b.id}', this.value)">
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${b.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>
        `).join("");
    }
}

async function updateStatus(id, newStatus) {
    const supabase = getSupabase();
    console.log("Attempting to update booking", id, "to status", newStatus);
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
    if (error) {
        console.error("Supabase update error:", error);
        alert("Failed to update status: " + error.message);
        setFeedback(dashboardFeedback, "error", "Failed to update status: " + error.message);
    } else {
        loadData();
    }
}

function renderClients() {
    if (!clientsList) return;
    const clientsMap = {};
    allBookings.forEach(b => {
        const email = b.email || b.phone; // Fallback to phone if no email
        if (!clientsMap[email]) {
            clientsMap[email] = { name: b.client_name, email: b.email, phone: b.phone, visits: 0 };
        }
        clientsMap[email].visits++;
    });

    let list = Object.values(clientsMap);
    if (currentClientSearch) {
        const q = currentClientSearch.toLowerCase();
        list = list.filter(c => 
            (c.name && c.name.toLowerCase().includes(q)) || 
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
    }

    if (list.length === 0) {
        clientsList.innerHTML = `<div class="empty-state"><p>No clients found.</p></div>`;
        return;
    }

    clientsList.innerHTML = list.map(c => `
        <div class="client-item">
            <div class="client-avatar">${c.name[0]}</div>
            <div class="client-info">
                <div class="client-name">${c.name}</div>
                <div class="client-contact">${c.email || 'No email'} • ${c.phone}</div>
            </div>
            <div class="client-side">
                <span class="client-visits">${c.visits} Visits</span>
            </div>
        </div>
    `).join("");
}

function getSubscribersData() {
    const subscribersMap = {};

    allBookings.forEach((b) => {
        const flags = getBookingFlags(b);
        if (!flags.newsletter) return;

        const key = (b.email || b.phone || b.id || "").toLowerCase();
        if (!subscribersMap[key]) {
            subscribersMap[key] = {
                name: b.client_name || "Subscriber",
                email: b.email || "",
                phone: b.phone || "",
                requests: 0,
                discount: false,
                latest_service: b.service || "",
                latest_date: b.preferred_day || ""
            };
        }

        subscribersMap[key].requests += 1;
        if (flags.discount) {
            subscribersMap[key].discount = true;
        }

        if (b.preferred_day && (!subscribersMap[key].latest_date || b.preferred_day > subscribersMap[key].latest_date)) {
            subscribersMap[key].latest_date = b.preferred_day;
            subscribersMap[key].latest_service = b.service || subscribersMap[key].latest_service;
        }
    });

    return Object.values(subscribersMap).sort((a, b) => b.requests - a.requests);
}

function renderSubscribers() {
    if (!subscribersList) return;

    const subscribers = getSubscribersData();

    if (!subscribers.length) {
        subscribersList.innerHTML = `<div class="empty-state"><p>No newsletter subscribers yet. New entries appear when the booking checkbox is ticked.</p></div>`;
        return;
    }

    subscribersList.innerHTML = subscribers.map((s) => `
        <div class="client-item">
            <div class="client-avatar">${(s.name || "S").charAt(0).toUpperCase()}</div>
            <div class="client-info">
                <div class="client-name">${s.name}</div>
                <div class="client-contact">${s.email || "No email"} • ${s.phone || "No phone"}</div>
            </div>
            <div class="client-side">
                <span class="client-visits">${s.requests} Subscription${s.requests === 1 ? "" : "s"}</span>
                <span class="status-badge status-confirmed" style="margin-top:0.35rem; display:inline-block;">${s.discount ? "10% selected" : "Subscribed"}</span>
            </div>
        </div>
    `).join("");
}

// --- SETTINGS ---
function renderSettings() {
    if (!siteSettings) return;

    if (servicesSettingsList) {
        servicesSettingsList.innerHTML = siteSettings.services.map((svc, i) => `
            <div class="setting-item-box" style="padding:1.25rem; border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:1rem; background:var(--surface2);">
                <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                    <div class="field-group" style="flex:2; min-width:200px;">
                        <label class="field-label">Name</label>
                        <input class="field-input svc-name" type="text" value="${svc.name || ''}">
                    </div>
                    <div class="field-group" style="flex:1; min-width:100px;">
                        <label class="field-label">Price</label>
                        <input class="field-input svc-price" type="text" value="${svc.price || ''}">
                    </div>
                    <div class="field-group" style="flex:1; min-width:100px;">
                        <label class="field-label">Duration</label>
                        <input class="field-input svc-duration" type="text" value="${svc.duration || ''}">
                    </div>
                </div>
                <div class="field-group" style="margin-top: 0.8rem;">
                    <label class="field-label">Description</label>
                    <input class="field-input svc-desc" type="text" value="${svc.description || ''}">
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:1rem; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; gap:1rem;">
                        <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem;"><input type="checkbox" class="svc-active" ${svc.active ? 'checked' : ''}> Active</label>
                        <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem;"><input type="checkbox" class="svc-featured" ${svc.featured ? 'checked' : ''}> Popular</label>
                    </div>
                    <button class="btn btn-xs btn-ghost" onclick="removeService(${i})" style="color:var(--red); border-color:var(--red);">Remove</button>
                </div>
            </div>
        `).join("");
    }
    if (gallerySettingsList) {
        gallerySettingsList.innerHTML = siteSettings.gallery.map((img, i) => `
            <div class="setting-item-box" style="padding:1.25rem; border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:1rem; background:var(--surface2);">
                <div style="display:flex; gap:1.5rem; flex-wrap:wrap; align-items:center;">
                    <div style="width:80px; height:80px; border-radius:8px; overflow:hidden; background:var(--border); flex-shrink:0;">
                        <img src="${img.src || ''}" alt="preview" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" onload="this.style.display='block'">
                    </div>
                    <div style="flex:1; display:flex; gap:1rem; flex-wrap:wrap;">
                        <div class="field-group" style="flex:2; min-width:200px;">
                            <label class="field-label">Image URL</label>
                            <input class="field-input gal-src" type="text" value="${img.src || ''}" oninput="this.parentElement.parentElement.previousElementSibling.querySelector('img').src = this.value; this.parentElement.parentElement.previousElementSibling.querySelector('img').style.display='block'">
                        </div>
                        <div class="field-group" style="flex:1; min-width:150px;">
                            <label class="field-label">Title</label>
                            <input class="field-input gal-title" type="text" value="${img.title || ''}">
                        </div>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:1rem; align-items:center;">
                    <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem;"><input type="checkbox" class="gal-active" ${img.active ? 'checked' : ''}> Active</label>
                    <button class="btn btn-xs btn-ghost" onclick="removeGallery(${i})" style="color:var(--red); border-color:var(--red);">Remove</button>
                </div>
            </div>
        `).join("");
    }
    
    const maxBookings = document.getElementById("max-bookings-input");
    const interval = document.getElementById("slot-interval-input");
    const unavDates = document.getElementById("unavailable-dates-input");
    const unavSlots = document.getElementById("unavailable-slots-input");

    if (maxBookings) maxBookings.value = siteSettings.maxBookingsPerSlot || 1;
    if (interval) interval.value = siteSettings.slotIntervalMinutes || 30;
    if (unavDates) unavDates.value = (siteSettings.unavailableDates || []).join("\\n");
    if (unavSlots) unavSlots.value = (siteSettings.unavailableSlots || []).join("\\n");
}

async function saveSettings() {
    if (!siteSettings) return;
    const saveBtns = document.querySelectorAll(".site-settings-save");
    saveBtns.forEach(b => { b.disabled = true; b.textContent = "Saving..."; });

    try {
        if (servicesSettingsList) {
            const svcBoxes = servicesSettingsList.querySelectorAll('.setting-item-box');
            siteSettings.services = Array.from(svcBoxes).map(box => ({
                name: box.querySelector('.svc-name').value,
                price: box.querySelector('.svc-price').value,
                duration: box.querySelector('.svc-duration').value,
                description: box.querySelector('.svc-desc').value,
                active: box.querySelector('.svc-active').checked,
                featured: box.querySelector('.svc-featured').checked
            }));
        }

        if (gallerySettingsList) {
            const galBoxes = gallerySettingsList.querySelectorAll('.setting-item-box');
            siteSettings.gallery = Array.from(galBoxes).map(box => ({
                src: box.querySelector('.gal-src').value,
                title: box.querySelector('.gal-title').value,
                active: box.querySelector('.gal-active').checked
            }));
        }

        const maxBookings = document.getElementById("max-bookings-input");
        const interval = document.getElementById("slot-interval-input");
        const unavDates = document.getElementById("unavailable-dates-input");
        const unavSlots = document.getElementById("unavailable-slots-input");

        if (maxBookings) siteSettings.maxBookingsPerSlot = parseInt(maxBookings.value, 10);
        if (interval) siteSettings.slotIntervalMinutes = parseInt(interval.value, 10);
        if (unavDates) siteSettings.unavailableDates = unavDates.value.split("\\n").map(s => s.trim()).filter(Boolean);
        if (unavSlots) siteSettings.unavailableSlots = unavSlots.value.split("\\n").map(s => s.trim()).filter(Boolean);

        const supabase = getSupabase();
        const { error } = await supabase.from("site_settings").upsert({ key: "main", settings: siteSettings });
        
        if (error) throw error;
        setFeedback(dashboardFeedback, "success", "Settings saved successfully.");
    } catch (e) {
        setFeedback(dashboardFeedback, "error", "Failed to save settings: " + e.message);
    } finally {
        saveBtns.forEach(b => { b.disabled = false; b.textContent = "Save changes"; });
    }
}

window.removeService = function(index) {
    if (!confirm("Remove this service?")) return;
    siteSettings.services.splice(index, 1);
    renderSettings();
};

window.removeGallery = function(index) {
    if (!confirm("Remove this photo?")) return;
    siteSettings.gallery.splice(index, 1);
    renderSettings();
};

document.getElementById("add-service-button")?.addEventListener("click", () => {
    siteSettings.services.push({ name: "New Service", price: "£0", duration: "30 min", description: "", active: true, featured: false });
    renderSettings();
    setTimeout(() => {
        const boxes = servicesSettingsList.querySelectorAll('.setting-item-box');
        if(boxes.length > 0) boxes[boxes.length-1].scrollIntoView({ behavior: 'smooth' });
    }, 50);
});

document.getElementById("add-photo-button")?.addEventListener("click", () => {
    siteSettings.gallery.push({ src: "images/placeholder.jpg", title: "New Photo", active: true });
    renderSettings();
    setTimeout(() => {
        const boxes = gallerySettingsList.querySelectorAll('.setting-item-box');
        if(boxes.length > 0) boxes[boxes.length-1].scrollIntoView({ behavior: 'smooth' });
    }, 50);
});

// --- AUTH ---

async function checkAuth() {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        authPanel.hidden = true;
        adminApp.hidden = false;
        loadData();
    } else {
        authPanel.hidden = false;
        adminApp.hidden = true;
    }
}

loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const supabase = getSupabase();

    loginButton.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        setFeedback(feedback, "error", "Login failed: " + error.message);
        loginButton.disabled = false;
    } else {
        checkAuth();
    }
});

logoutButton?.addEventListener("click", async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    checkAuth();
});

// --- MANUAL BOOKING ---

function setupManualBooking() {
    const openBtn = document.getElementById("open-manual-booking");
    const modal = document.getElementById("manual-booking-modal-backdrop");
    const closeBtn = document.getElementById("manual-booking-close");
    const form = document.getElementById("manual-booking-form");

    if (!openBtn || !modal || !form) return;

    openBtn.addEventListener("click", () => {
        modal.hidden = false;
        // Default to today
        form.day.value = getTodayStr();
    });

    closeBtn?.addEventListener("click", () => {
        modal.hidden = true;
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.hidden = true;
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating...";

        const bookingData = {
            client_name: form.clientName.value,
            phone: form.phone.value,
            email: form.email.value || null,
            service: form.service.value,
            preferred_day: form.day.value,
            preferred_time: form.time.value,
            status: 'confirmed', // Admin bookings are confirmed by default
            created_at: new Date().toISOString()
        };

        const supabase = getSupabase();
        const { error } = await supabase.from("bookings").insert([bookingData]);

        submitBtn.disabled = false;
        submitBtn.textContent = "Create Booking";

        if (error) {
            alert("Error creating booking: " + error.message);
        } else {
            modal.hidden = true;
            form.reset();
            loadData(); // Refresh dashboard
        }
    });
}

// --- THEME ---

function getStoredTheme() {
    const stored = window.localStorage.getItem(themeStorageKey);
    return (stored === "light" || stored === "dark") ? stored : "dark";
}

function applyTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    document.body.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;

    // Update charts if they exist
    if (typeof renderAnalytics === "function") {
        renderAnalytics();
    }

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        const icon = button.querySelector("[data-theme-icon]");
        const targetTheme = nextTheme === "light" ? "dark" : "light";

        button.setAttribute("aria-label", `Switch to ${targetTheme} theme`);
        button.setAttribute("aria-pressed", String(nextTheme === "dark"));

        if (icon) {
            if (nextTheme === "light") {
                // Moon icon for switching back to dark mode
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
            } else {
                // Sun icon for switching to light mode
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
            }
        }
    });
}

function setupThemeToggle() {
    applyTheme(getStoredTheme());

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
            window.localStorage.setItem(themeStorageKey, nextTheme);
            applyTheme(nextTheme);
        });
    });
}

// --- INIT ---

document.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupNavigation();
    setupManualBooking();
    checkAuth();
    
    // Clock
    setInterval(() => {
        const clock = document.getElementById("topbar-clock");
        if (clock) clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    // Filter bindings
    const bookingSearch = document.getElementById("booking-search-input");
    if (bookingSearch) {
        bookingSearch.addEventListener("input", (e) => {
            currentBookingFilter.search = e.target.value;
            renderBookingsTable();
        });
    }

    const statusChips = document.querySelectorAll("#status-filter-chips .chip");
    statusChips.forEach(chip => {
        chip.addEventListener("click", (e) => {
            statusChips.forEach(c => c.classList.remove("is-active"));
            e.target.classList.add("is-active");
            currentBookingFilter.status = e.target.getAttribute("data-status");
            renderBookingsTable();
        });
    });

    const bookingDatePreset = document.getElementById("booking-date-preset");
    const bookingDateWrap = document.getElementById("booking-custom-date-wrap");
    const bookingDateFilter = document.getElementById("booking-date-filter");

    if (bookingDatePreset) {
        bookingDatePreset.addEventListener("change", (e) => {
            const val = e.target.value;
            if (val === "custom") {
                bookingDateWrap.style.display = "flex";
                if (bookingDateFilter.value) {
                    currentBookingFilter.date = bookingDateFilter.value;
                } else {
                    currentBookingFilter.date = ""; 
                }
            } else {
                bookingDateWrap.style.display = "none";
                if (val === "all") {
                    currentBookingFilter.date = "";
                } else if (val === "today") {
                    currentBookingFilter.date = getTodayStr();
                } else if (val === "tomorrow") {
                    const t = new Date(); t.setDate(t.getDate() + 1);
                    currentBookingFilter.date = t.toISOString().split("T")[0];
                }
            }
            renderBookingsTable();
        });
    }

    if (bookingDateFilter) {
        bookingDateFilter.addEventListener("change", (e) => {
            if (bookingDatePreset.value === "custom") {
                currentBookingFilter.date = e.target.value;
                renderBookingsTable();
            }
        });
    }

    const clientSearch = document.getElementById("client-search-input");
    if (clientSearch) {
        clientSearch.addEventListener("input", (e) => {
            currentClientSearch = e.target.value;
            renderClients();
        });
    }

    // Calendar bindings
    const prevBtn = document.getElementById("cal-prev");
    const nextBtn = document.getElementById("cal-next");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
    }

    // Export CSV
    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            if (allBookings.length === 0) return;
            const headers = "ID,Name,Phone,Email,Service,Date,Time,Status,Notes\\n";
            const rows = allBookings.map(b => `"${b.id}","${b.client_name}","${b.phone}","${b.email||''}","${b.service}","${b.preferred_day}","${b.preferred_time}","${b.status}","${b.notes||''}"`).join("\\n");
            const blob = new Blob([headers + rows], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crewecut_bookings_${getTodayStr()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        });
    }

    // Export subscribers CSV (Excel-friendly)
    const exportSubscribersBtn = document.getElementById("export-subscribers-btn");
    if (exportSubscribersBtn) {
        exportSubscribersBtn.addEventListener("click", () => {
            const subscribers = getSubscribersData();
            if (!subscribers.length) {
                setFeedback(dashboardFeedback, "error", "No subscriber data to export yet.");
                return;
            }

            const headers = "Name,Email,Phone,Total Subscriptions,Discount Selected,Latest Service,Latest Booking Date\n";
            const rows = subscribers.map((s) => `"${String(s.name || "").replaceAll('"', '""')}","${String(s.email || "").replaceAll('"', '""')}","${String(s.phone || "").replaceAll('"', '""')}","${String(s.requests || 0)}","${s.discount ? "Yes" : "No"}","${String(s.latest_service || "").replaceAll('"', '""')}","${String(s.latest_date || "").replaceAll('"', '""')}"`).join("\n");
            const csv = "\ufeff" + headers + rows;
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `crewecut_subscribers_${getTodayStr()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            setFeedback(dashboardFeedback, "success", "Subscribers exported.");
        });
    }

    // Refresh Hooks
    const refreshBtn = document.getElementById("refresh-bookings-button");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            const icon = refreshBtn.querySelector("svg");
            if(icon) icon.style.animation = "shimmer 1s infinite linear";
            loadData().then(() => {
                if(icon) icon.style.animation = "none";
            });
        });
    }

    // Settings
    const saveBtns = document.querySelectorAll(".site-settings-save");
    saveBtns.forEach(b => b.addEventListener("click", saveSettings));

    const presetSelect = document.getElementById("analytics-preset");
    const customDates = document.getElementById("analytics-custom-dates");
    const startDateInput = document.getElementById("analytics-start");
    const endDateInput = document.getElementById("analytics-end");

    if (presetSelect && customDates && startDateInput && endDateInput) {
        presetSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            if (val === "custom") {
                customDates.style.display = "flex";
                return; 
            } else {
                customDates.style.display = "none";
            }
            
            const end = new Date();
            let start = new Date();
            
            if (val === "today") {
                // start is already end
            } else if (val === "7days") {
                start.setDate(end.getDate() - 6);
            } else if (val === "30days") {
                start.setDate(end.getDate() - 29);
            } else if (val === "thismonth") {
                start = new Date(end.getFullYear(), end.getMonth(), 1);
            } else if (val === "alltime") {
                start = new Date(end.getFullYear() - 5, 0, 1); // 5 years ago
            }

            startDateInput.value = start.toISOString().split('T')[0];
            endDateInput.value = end.toISOString().split('T')[0];
            renderAnalytics();
        });

        startDateInput.addEventListener("change", renderAnalytics);
        endDateInput.addEventListener("change", renderAnalytics);
    }

});

// Export functions for HTML usage
window.updateStatus = updateStatus;
