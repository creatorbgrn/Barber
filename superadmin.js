// SuperAdmin JavaScript
const config = window.CREWE_CUT_CONFIG || {};
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

// Auth
const authPanel = document.getElementById('superadmin-auth-panel');
const dashboard = document.getElementById('superadmin-dashboard');
const loginForm = document.getElementById('superadmin-login-form');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('superadmin-email').value;
  const password = document.getElementById('superadmin-password').value;
  const supabase = getSupabase();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login failed: ' + error.message);
  } else {
    checkAuth();
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  checkAuth();
});

async function checkAuth() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    authPanel.hidden = true;
    dashboard.hidden = false;
    loadDashboard();
  } else {
    authPanel.hidden = false;
    dashboard.hidden = true;
  }
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.section + '-section').classList.add('active');
  });
});

// Load Dashboard Data
async function loadDashboard() {
  const supabase = getSupabase();
  
  // Load websites
  const { data: websites } = await supabase.from('websites').select('*');
  document.getElementById('total-websites').textContent = websites.length;
  document.getElementById('active-websites').textContent = websites.filter(w => w.enabled).length;
  
  // Load bookings and revenue
  const { data: bookings } = await supabase.from('bookings').select('*');
  document.getElementById('total-bookings').textContent = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.revenue || 0), 0);
  document.getElementById('total-revenue').textContent = '£' + totalRevenue.toFixed(2);
  
  renderWebsites(websites);
  renderAnalytics();
  renderNotifications();
  renderProducts();
}

// Websites Management
function renderWebsites(websites) {
  const list = document.getElementById('websites-list');
  list.innerHTML = websites.map(w => `
    <div class="website-card">
      <div class="info">
        <h3>${w.name}</h3>
        <p>${w.url}</p>
        <p>Status: ${w.enabled ? 'Enabled' : 'Disabled'}</p>
      </div>
      <div class="actions">
        <button onclick="toggleWebsite(${w.id}, ${!w.enabled})">${w.enabled ? 'Disable' : 'Enable'}</button>
        <button onclick="sendNotification(${w.id})">Notify</button>
      </div>
    </div>
  `).join('');
}

async function toggleWebsite(id, enabled) {
  const supabase = getSupabase();
  await supabase.from('websites').update({ enabled }).eq('id', id);
  loadDashboard();
}

// Analytics
async function renderAnalytics() {
  const supabase = getSupabase();
  const start = document.getElementById('analytics-start').value || '2024-01-01';
  const end = document.getElementById('analytics-end').value || new Date().toISOString().split('T')[0];
  const websiteId = document.getElementById('analytics-website').value;
  
  let query = supabase.from('bookings').select('*').gte('created_at', start).lte('created_at', end);
  if (websiteId !== 'all') query = query.eq('website_id', websiteId);
  
  const { data: bookings } = await query;
  
  // Bookings Chart
  const bookingsCtx = document.getElementById('bookings-chart').getContext('2d');
  new Chart(bookingsCtx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [{
        label: 'Bookings',
        data: [10, 20, 15, 25, 30],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
      }]
    }
  });
  
  // Revenue Chart
  const revenueCtx = document.getElementById('revenue-chart').getContext('2d');
  new Chart(revenueCtx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [{
        label: 'Revenue',
        data: [1000, 1500, 1200, 1800, 2000],
        backgroundColor: '#764ba2',
      }]
    }
  });
}

// Notifications
document.getElementById('notification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const websiteId = document.getElementById('notification-website').value;
  const title = document.getElementById('notification-title').value;
  const message = document.getElementById('notification-message').value;
  
  const supabase = getSupabase();
  await supabase.from('notifications').insert({
    website_id: websiteId === 'all' ? null : websiteId,
    title,
    message,
    created_at: new Date()
  });
  
  renderNotifications();
});

async function renderNotifications() {
  const supabase = getSupabase();
  const { data: notifications } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  
  const list = document.getElementById('notifications-list');
  list.innerHTML = notifications.map(n => `
    <div class="notification-item">
      <h4>${n.title}</h4>
      <p>${n.message}</p>
      <small>${new Date(n.created_at).toLocaleString()}</small>
    </div>
  `).join('');
}

// Products
document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('product-name').value;
  const price = parseFloat(document.getElementById('product-price').value);
  const description = document.getElementById('product-description').value;
  
  const supabase = getSupabase();
  await supabase.from('products').insert({
    name,
    price,
    description,
    created_at: new Date()
  });
  
  renderProducts();
});

async function renderProducts() {
  const supabase = getSupabase();
  const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  
  const list = document.getElementById('products-list');
  list.innerHTML = products.map(p => `
    <div class="product-item">
      <h4>${p.name}</h4>
      <p>£${p.price.toFixed(2)}</p>
      <p>${p.description}</p>
    </div>
  `).join('');
}

// Initialize
checkAuth();