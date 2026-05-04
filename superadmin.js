// SuperAdmin Professional JavaScript
const config = window.CREWE_CUT_CONFIG || {};
let supabaseClient = null;
let currentUser = null;
let bookingsChart = null;
let revenueChart = null;

// Initialize theme
const savedTheme = localStorage.getItem('superadmin-theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);

// Theme toggle
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.createElement('button');
  themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  themeToggle.className = 'theme-toggle';
  themeToggle.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    transition: all 0.2s ease;
  `;
  themeToggle.addEventListener('click', toggleTheme);
  document.body.appendChild(themeToggle);
  updateThemeIcon();
});

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('superadmin-theme', newTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    showError('Supabase configuration not found');
    return null;
  }
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

// UI Helpers
function showLoading(element, text = 'Loading...') {
  element.innerHTML = `<div class="loading"><div class="spinner"></div><span>${text}</span></div>`;
}

function showError(message) {
  const notification = document.createElement('div');
  notification.className = 'notification-banner';
  notification.innerHTML = `
    <span><i class="fas fa-exclamation-triangle"></i> ${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

function showSuccess(message) {
  const notification = document.createElement('div');
  notification.className = 'notification-banner';
  notification.style.background = 'linear-gradient(135deg, var(--green), #22c55e)';
  notification.innerHTML = `
    <span><i class="fas fa-check-circle"></i> ${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Auth
const authPanel = document.getElementById('superadmin-auth-panel');
const dashboard = document.getElementById('superadmin-dashboard');
const loginForm = document.getElementById('superadmin-login-form');
const loginBtn = document.getElementById('superadmin-login-btn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('superadmin-email').value;
  const password = document.getElementById('superadmin-password').value;
  const supabase = getSupabase();

  if (!supabase) return;

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<div class="loading"><div class="spinner"></div><span>Signing in...</span></div>';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showError('Login failed: ' + error.message);
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span>Sign In</span>';
    } else {
      currentUser = data.user;
      checkAuth();
    }
  } catch (error) {
    showError('An unexpected error occurred');
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>Sign In</span>';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
  currentUser = null;
  checkAuth();
});

async function checkAuth() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check if user is superadmin
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!adminData) {
        showError('Access denied. Superadmin privileges required.');
        await supabase.auth.signOut();
        return;
      }

      currentUser = user;
      authPanel.hidden = true;
      dashboard.hidden = false;
      await loadDashboard();
    } else {
      authPanel.hidden = false;
      dashboard.hidden = true;
      currentUser = null;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    authPanel.hidden = false;
    dashboard.hidden = true;
  }
}

// Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const sectionId = btn.dataset.section + '-section';
    document.getElementById(sectionId).classList.add('active');
  });
});

// Load Dashboard Data
async function loadDashboard() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Load websites
    const { data: websites, error: websitesError } = await supabase
      .from('websites')
      .select('*')
      .order('created_at', { ascending: false });

    if (websitesError) throw websitesError;

    // Load bookings with revenue
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*');

    if (bookingsError) throw bookingsError;

    // Update stats
    document.getElementById('total-websites').textContent = websites?.length || 0;
    document.getElementById('active-websites').textContent = websites?.filter(w => w.enabled).length || 0;
    document.getElementById('total-bookings').textContent = bookings?.length || 0;

    const totalRevenue = bookings?.reduce((sum, b) => sum + (parseFloat(b.revenue) || 0), 0) || 0;
    document.getElementById('total-revenue').textContent = '£' + totalRevenue.toFixed(2);

    // Load all sections
    await Promise.all([
      renderWebsites(websites || []),
      renderAnalytics(),
      renderNotifications(),
      renderProducts()
    ]);

  } catch (error) {
    console.error('Dashboard load failed:', error);
    showError('Failed to load dashboard data');
  }
}

// Websites Management
function renderWebsites(websites) {
  const list = document.getElementById('websites-list');

  if (!websites || websites.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--muted);">No websites found</div>';
    return;
  }

  list.innerHTML = websites.map(w => `
    <div class="table-row">
      <div class="table-cell">
        <div class="cell-primary">${escapeHtml(w.name)}</div>
        <div class="cell-secondary">${escapeHtml(w.url)}</div>
      </div>
      <div class="table-cell">
        <span class="status-badge ${w.enabled ? 'status-active' : 'status-inactive'}">
          ${w.enabled ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="table-cell">
        <div class="cell-secondary">${new Date(w.created_at).toLocaleDateString()}</div>
      </div>
      <div class="table-cell">
        <div class="cell-secondary">${websites.filter(w2 => w2.enabled).indexOf(w) + 1}</div>
      </div>
      <div class="table-cell">
        <button class="action-btn ${w.enabled ? 'danger' : 'primary'}" onclick="toggleWebsite('${w.id}', ${!w.enabled})">
          <i class="fas fa-${w.enabled ? 'ban' : 'check'}"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Update website dropdowns
  updateWebsiteDropdowns(websites);
}

async function toggleWebsite(id, enabled) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('websites')
      .update({ enabled })
      .eq('id', id);

    if (error) throw error;

    showSuccess(`Website ${enabled ? 'enabled' : 'disabled'} successfully`);
    await loadDashboard();
  } catch (error) {
    console.error('Toggle website failed:', error);
    showError('Failed to update website status');
  }
}

function updateWebsiteDropdowns(websites) {
  const dropdowns = ['analytics-website', 'notification-website'];

  dropdowns.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '<option value="all">All Websites</option>' +
        websites.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
      if (currentValue && currentValue !== 'all') {
        select.value = currentValue;
      }
    }
  });
}

// Analytics
async function renderAnalytics() {
  const supabase = getSupabase();
  if (!supabase) return;

  const websiteId = document.getElementById('analytics-website').value;
  const start = document.getElementById('analytics-start').value || '2024-01-01';
  const end = document.getElementById('analytics-end').value || new Date().toISOString().split('T')[0];

  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    if (websiteId !== 'all') {
      query = query.eq('website_id', websiteId);
    }

    const { data: bookings, error } = await query;
    if (error) throw error;

    // Process data for charts
    const bookingsByMonth = {};
    const revenueByMonth = {};

    (bookings || []).forEach(booking => {
      const date = new Date(booking.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      bookingsByMonth[monthKey] = (bookingsByMonth[monthKey] || 0) + 1;
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + (parseFloat(booking.revenue) || 0);
    });

    const months = Object.keys(bookingsByMonth).sort();
    const bookingCounts = months.map(month => bookingsByMonth[month]);
    const revenueAmounts = months.map(month => revenueByMonth[month]);

    // Bookings Chart
    const bookingsCtx = document.getElementById('bookings-chart');
    if (bookingsCtx) {
      // Destroy old chart if it exists
      if (bookingsChart) {
        bookingsChart.destroy();
      }
      
      bookingsChart = new Chart(bookingsCtx, {
        type: 'line',
        data: {
          labels: months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }),
          datasets: [{
            label: 'Bookings',
            data: bookingCounts,
            borderColor: 'var(--accent)',
            backgroundColor: 'rgba(212, 164, 104, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'var(--border)' },
              ticks: { color: 'var(--text)' }
            },
            x: {
              grid: { color: 'var(--border)' },
              ticks: { color: 'var(--text)' }
            }
          }
        }
      });
    }

    // Revenue Chart
    const revenueCtx = document.getElementById('revenue-chart');
    if (revenueCtx) {
      // Destroy old chart if it exists
      if (revenueChart) {
        revenueChart.destroy();
      }
      
      revenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
          labels: months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }),
          datasets: [{
            label: 'Revenue (£)',
            data: revenueAmounts,
            backgroundColor: 'var(--accent2)',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'var(--border)' },
              ticks: {
                color: 'var(--text)',
                callback: value => '£' + value
              }
            },
            x: {
              grid: { color: 'var(--border)' },
              ticks: { color: 'var(--text)' }
            }
          }
        }
      });
    }

  } catch (error) {
    console.error('Analytics render failed:', error);
    showError('Failed to load analytics data');
  }
}

// Notifications
document.getElementById('notification-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const websiteId = document.getElementById('notification-website').value;
  const title = document.getElementById('notification-title').value.trim();
  const message = document.getElementById('notification-message').value.trim();

  if (!title || !message) {
    showError('Please fill in all fields');
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const notificationData = {
      title,
      message,
      created_at: new Date().toISOString()
    };

    if (websiteId !== 'all') {
      notificationData.website_id = websiteId;
    }

    const { error } = await supabase
      .from('notifications')
      .insert([notificationData]);

    if (error) throw error;

    showSuccess('Notification sent successfully');
    document.getElementById('notification-form').reset();
    await renderNotifications();

  } catch (error) {
    console.error('Send notification failed:', error);
    showError('Failed to send notification');
  }
});

async function renderNotifications() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const list = document.getElementById('notifications-list');

    if (!notifications || notifications.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--muted);">No notifications sent yet</div>';
      return;
    }

    list.innerHTML = notifications.map(n => `
      <div class="table-row">
        <div class="table-cell">
          <div class="cell-primary">${escapeHtml(n.title)}</div>
          <div class="cell-secondary">${escapeHtml(n.message)}</div>
        </div>
        <div class="table-cell">
          <div class="cell-secondary">${new Date(n.created_at).toLocaleDateString()}</div>
        </div>
        <div class="table-cell">
          <div class="cell-secondary">${new Date(n.created_at).toLocaleTimeString()}</div>
        </div>
        <div class="table-cell">
          <span class="status-badge status-active">Sent</span>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Notifications render failed:', error);
    showError('Failed to load notifications');
  }
}

// Products
document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  const description = document.getElementById('product-description').value.trim();

  if (!name || isNaN(price) || !description) {
    showError('Please fill in all fields correctly');
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('products')
      .insert([{
        name,
        price,
        description,
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;

    showSuccess('Product added successfully');
    document.getElementById('product-form').reset();
    await renderProducts();

  } catch (error) {
    console.error('Add product failed:', error);
    showError('Failed to add product');
  }
});

async function renderProducts() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = document.getElementById('products-list');

    if (!products || products.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--muted);">No products added yet</div>';
      return;
    }

    list.innerHTML = products.map(p => `
      <div class="table-row">
        <div class="table-cell">
          <div class="cell-primary">${escapeHtml(p.name)}</div>
          <div class="cell-secondary">${escapeHtml(p.description)}</div>
        </div>
        <div class="table-cell">
          <div class="cell-primary">£${parseFloat(p.price).toFixed(2)}</div>
        </div>
        <div class="table-cell">
          <div class="cell-secondary">${new Date(p.created_at).toLocaleDateString()}</div>
        </div>
        <div class="table-cell">
          <button class="action-btn danger" onclick="deleteProduct('${p.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Products render failed:', error);
    showError('Failed to load products');
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showSuccess('Product deleted successfully');
    await renderProducts();

  } catch (error) {
    console.error('Delete product failed:', error);
    showError('Failed to delete product');
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});