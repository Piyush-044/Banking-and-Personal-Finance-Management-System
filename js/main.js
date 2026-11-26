/* ============================================================
   ApexBank - Shared Utilities & Persistent State (js/main.js)
   ============================================================ */

/* ---------- Toast Notification ---------- */
function showToast(msg, type) {
  type = type || 'success';
  var toast = document.getElementById('apex-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'apex-toast';
    toast.style.cssText = 'position:fixed;bottom:28px;right:28px;padding:14px 22px;border-radius:12px;font-weight:600;font-size:0.92rem;box-shadow:0 12px 36px rgba(0,0,0,0.45);z-index:99999;transition:opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1);display:none;max-width:400px;line-height:1.45;border:1px solid rgba(255,255,255,0.18);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);';
    document.body.appendChild(toast);
  }
  var bgs = { 
    success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))', 
    error: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))', 
    info: 'linear-gradient(135deg, rgba(56, 189, 248, 0.95), rgba(37, 99, 235, 0.95))', 
    warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))' 
  };
  toast.style.background = bgs[type] || bgs.success;
  toast.style.color = '#fff';
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(function() { 
      toast.style.display = 'none'; 
      toast.style.opacity = '1'; 
    }, 380);
  }, 3200);
}

/* ---------- User Profile Management (Shared & Persistent) ---------- */
var DEFAULT_USER_PROFILE = {
  firstName: 'Alex',
  lastName: 'Morgan',
  fullName: 'Alex Morgan',
  email: 'alex.morgan@apexbank.com',
  phone: '+91 98765 43210',
  dob: '1995-08-14',
  gender: 'female',
  address: '742 Evergreen Terrace, Suite 4B',
  city: 'Mumbai',
  state: 'Maharashtra',
  zip: '400001',
  country: 'IN',
  currency: 'INR',
  avatarType: 'initials',
  avatarInitials: 'AM',
  avatarImage: '',
  customerId: 'APX-984201',
  membershipTier: 'Platinum Tier',
  twoFactor: true,
  biometric: true,
  highValueLock: true,
  prefTransactions: true,
  prefSecurity: true,
  prefStatements: true,
  prefMarketing: false
};

/* Seed Demo Accounts */
var SEED_ACCOUNTS = {
  'alex.morgan@apexbank.com': Object.assign({}, DEFAULT_USER_PROFILE),
  'apx-984201': Object.assign({}, DEFAULT_USER_PROFILE),
  'priya.sharma@apexbank.com': Object.assign({}, DEFAULT_USER_PROFILE, {
    firstName: 'Priya',
    lastName: 'Sharma',
    fullName: 'Priya Sharma',
    email: 'priya.sharma@apexbank.com',
    customerId: 'APX-512089',
    avatarInitials: 'PS',
    phone: '+91 98112 33445',
    city: 'Delhi',
    state: 'Delhi',
    membershipTier: 'Gold Tier'
  }),
  'john.doe@apexbank.com': Object.assign({}, DEFAULT_USER_PROFILE, {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    email: 'john.doe@apexbank.com',
    customerId: 'APX-304918',
    avatarInitials: 'JD',
    phone: '+1 (555) 234-5678',
    gender: 'male',
    city: 'Bengaluru',
    state: 'Karnataka',
    membershipTier: 'Silver Tier'
  })
};

function getRegisteredUsers() {
  try {
    var stored = localStorage.getItem('apex_users_db');
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Error reading apex_users_db:', e);
  }
  try {
    localStorage.setItem('apex_users_db', JSON.stringify(SEED_ACCOUNTS));
  } catch (e) {}
  return Object.assign({}, SEED_ACCOUNTS);
}

function saveRegisteredUsers(db) {
  try {
    localStorage.setItem('apex_users_db', JSON.stringify(db));
  } catch (e) {
    console.error('Error saving apex_users_db:', e);
  }
}

function parseNameFromIdentifier(identifier) {
  if (!identifier) return { firstName: 'User', lastName: '', fullName: 'User' };
  var raw = identifier.trim();
  if (raw.indexOf('@') !== -1) {
    raw = raw.split('@')[0];
  }
  var parts = raw.split(/[._\-+\s]+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'User', lastName: '', fullName: 'User' };

  var capitalize = function(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  var clean = parts.map(capitalize);
  var first = clean[0] || 'User';
  var last = clean.slice(1).join(' ') || '';
  var full = (first + ' ' + last).trim();
  return { firstName: first, lastName: last, fullName: full };
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function registerUser(userData, skipApiSync) {
  var db = getRegisteredUsers();
  var rawEmail = (userData.email || '').trim().toLowerCase();
  var fullName = (userData.fullName || '').trim();
  var nameParts = fullName.split(/\s+/).filter(Boolean);
  var firstName = userData.firstName || nameParts[0] || 'User';
  var lastName = userData.lastName || (nameParts.slice(1).join(' ') || '');
  var email = rawEmail || (firstName.toLowerCase() + '.' + (lastName ? lastName.toLowerCase() : 'user') + '@apexbank.com');
  var customerId = userData.customerId || ('APX-' + Math.floor(100000 + Math.random() * 900000));

  var firstInit = firstName ? firstName.charAt(0).toUpperCase() : '';
  var lastInit = lastName ? lastName.charAt(0).toUpperCase() : '';
  var initials = (firstInit + lastInit) || firstName.substring(0, 2).toUpperCase() || 'U';

  var profile = Object.assign({}, DEFAULT_USER_PROFILE, userData, {
    email: email,
    fullName: (firstName + ' ' + lastName).trim() || 'User',
    firstName: firstName,
    lastName: lastName,
    customerId: customerId,
    avatarInitials: initials,
    password: userData.password || ''
  });

  db[email.toLowerCase()] = profile;
  db[customerId.toLowerCase()] = profile;
  if (profile.fullName) {
    db[profile.fullName.toLowerCase()] = profile;
  }
  saveRegisteredUsers(db);

  // Sync to backend REST API unless caller awaits ApexAPI.register directly
  if (!skipApiSync && typeof fetch !== 'undefined') {
    ApexAPI.register(profile);
  }

  return profile;
}

/* ============================================================
   ApexBank Backend REST API Client (Persistent Data Layer)
   ============================================================ */
var ApexAPI = {
  async login(identifier, password) {
    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier, password: password })
      });
      var data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('apex_user_profile', JSON.stringify(data.user));
        syncUserProfileUI(data.user);
        return data.user;
      }
    } catch (e) {
      console.warn('API login offline, using local fallback:', e);
    }
    return null;
  },

  async register(userData) {
    try {
      var res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      var data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('apex_user_profile', JSON.stringify(data.user));
        syncUserProfileUI(data.user);
        return data.user;
      }
    } catch (e) {
      console.warn('API register offline, using local fallback:', e);
    }
    return null;
  },

  async updateProfile(patch) {
    try {
      var current = getUserProfile();
      var payload = Object.assign({}, current, patch);
      var res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': current.id || current.email },
        body: JSON.stringify(payload)
      });
      var data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('apex_user_profile', JSON.stringify(data.user));
        syncUserProfileUI(data.user);
        return data.user;
      }
    } catch (e) {
      console.warn('API updateProfile offline:', e);
    }
    return null;
  },

  async getAccounts(userId) {
    try {
      var u = getUserProfile();
      var id = userId || u.id || u.email;
      var res = await fetch('/api/accounts?userId=' + encodeURIComponent(id));
      var data = await res.json();
      if (data.success && data.accounts) return data.accounts;
    } catch (e) {
      console.warn('API getAccounts offline:', e);
    }
    return [];
  },

  async openAccount(accData) {
    try {
      var u = getUserProfile();
      var payload = Object.assign({ userId: u.id || u.email }, accData);
      var res = await fetch('/api/accounts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.warn('API openAccount offline:', e);
      return { success: false, error: e.message };
    }
  },

  async updateAccount(accData) {
    try {
      var u = getUserProfile();
      var payload = Object.assign({ userId: u.id || u.email }, accData);
      var res = await fetch('/api/accounts/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.warn('API updateAccount offline:', e);
      return { success: false, error: e.message };
    }
  },

  async getTransactions(userId) {
    try {
      var u = getUserProfile();
      var id = userId || u.id || u.email;
      var res = await fetch('/api/transactions?userId=' + encodeURIComponent(id));
      var data = await res.json();
      if (data.success && data.transactions) return data.transactions;
    } catch (e) {
      console.warn('API getTransactions offline:', e);
    }
    return [];
  },

  async transferMoney(txData) {
    try {
      var u = getUserProfile();
      var payload = Object.assign({ userId: u.id || u.email }, txData);
      var res = await fetch('/api/transactions/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.warn('API transferMoney offline:', e);
      return { success: false, error: e.message };
    }
  },

  async getStats(userId) {
    try {
      var u = getUserProfile();
      var id = userId || u.id || u.email;
      var res = await fetch('/api/stats?userId=' + encodeURIComponent(id));
      var data = await res.json();
      if (data.success && data.stats) return data.stats;
    } catch (e) {
      console.warn('API getStats offline:', e);
    }
    return null;
  }
};

function loginUser(identifier, password, skipApiSync) {
  if (!identifier) return getUserProfile();
  var db = getRegisteredUsers();
  var key = identifier.trim().toLowerCase();

  var found = db[key];
  if (!found) {
    for (var k in db) {
      if (db.hasOwnProperty(k)) {
        var u = db[k];
        if (
          (u.email && u.email.toLowerCase() === key) ||
          (u.customerId && u.customerId.toLowerCase() === key) ||
          (u.fullName && u.fullName.toLowerCase() === key)
        ) {
          found = u;
          break;
        }
      }
    }
  }

  // If new user not found in database, dynamically register them on the fly!
  if (!found) {
    var parsed = parseNameFromIdentifier(identifier);
    var isEmail = identifier.indexOf('@') !== -1;
    var userEmail = isEmail ? identifier.trim().toLowerCase() : (parsed.firstName.toLowerCase() + (parsed.lastName ? '.' + parsed.lastName.toLowerCase().replace(/\s+/g, '') : '') + '@apexbank.com');
    found = registerUser({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      fullName: parsed.fullName,
      email: userEmail,
      password: password || ''
    }, true);
  }

  // Persist as current active user
  localStorage.setItem('apex_user_profile', JSON.stringify(found));
  localStorage.setItem('apex_current_user_email', found.email);
  syncUserProfileUI(found);

  // Sync with backend API unless caller awaits ApexAPI.login directly
  if (!skipApiSync && typeof fetch !== 'undefined') {
    ApexAPI.login(identifier, password);
  }

  return found;
}

function getUserProfile() {
  try {
    var stored = localStorage.getItem('apex_user_profile');
    if (stored) {
      var parsed = JSON.parse(stored);
      return Object.assign({}, DEFAULT_USER_PROFILE, parsed);
    }
  } catch (e) {
    console.error('Error reading apex_user_profile:', e);
  }
  return Object.assign({}, DEFAULT_USER_PROFILE);
}

function saveUserProfile(patch) {
  try {
    var current = getUserProfile();
    var merged = Object.assign({}, current, patch);

    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      var f = (merged.firstName || '').trim();
      var l = (merged.lastName || '').trim();
      merged.fullName = (f + ' ' + l).trim() || 'User';

      if (merged.avatarType !== 'image') {
        var firstInit = f ? f.charAt(0).toUpperCase() : '';
        var lastInit = l ? l.charAt(0).toUpperCase() : '';
        merged.avatarInitials = (firstInit + lastInit) || f.substring(0, 2).toUpperCase() || 'U';
      }
    }

    if (patch.customerId !== undefined) {
      merged.customerId = (patch.customerId || '').trim() || 'APX-984201';
    }

    localStorage.setItem('apex_user_profile', JSON.stringify(merged));

    // Also update in registered users database
    try {
      var db = getRegisteredUsers();
      if (merged.email) db[merged.email.toLowerCase()] = merged;
      if (merged.customerId) db[merged.customerId.toLowerCase()] = merged;
      if (merged.fullName) db[merged.fullName.toLowerCase()] = merged;
      saveRegisteredUsers(db);
    } catch (e2) {}

    // Sync to backend REST API
    if (typeof fetch !== 'undefined') {
      ApexAPI.updateProfile(merged);
    }

    syncUserProfileUI(merged);
    return merged;
  } catch (e) {
    console.error('Error saving apex_user_profile:', e);
    return null;
  }
}

function renderAvatar(avatarEl, profile) {
  if (!avatarEl) return;
  profile = profile || getUserProfile();
  if (profile.avatarType === 'image' && profile.avatarImage) {
    avatarEl.innerHTML = '<img src="' + profile.avatarImage + '" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">';
  } else {
    avatarEl.textContent = profile.avatarInitials || 'AM';
  }
}

function syncUserProfileUI(profile) {
  profile = profile || getUserProfile();

  // 1. Update user name everywhere
  document.querySelectorAll('.user-name').forEach(function(el) {
    el.textContent = profile.fullName;
  });

  // 2. Update user avatars
  document.querySelectorAll('.user-avatar').forEach(function(el) {
    renderAvatar(el, profile);
  });

  // 3. Update profile hero elements
  var heroName = document.getElementById('hero-user-name');
  if (heroName) heroName.textContent = profile.fullName;

  var heroEmail = document.getElementById('hero-user-email');
  if (heroEmail) heroEmail.textContent = profile.email;

  var heroAvatar = document.getElementById('hero-avatar');
  if (heroAvatar) renderAvatar(heroAvatar, profile);

  // Update Customer ID in hero and all elements
  var heroCustomerId = document.getElementById('hero-customer-id');
  if (heroCustomerId) heroCustomerId.textContent = profile.customerId || 'APX-984201';
  document.querySelectorAll('.customer-id').forEach(function(el) {
    el.textContent = profile.customerId || 'APX-984201';
  });

  // Update Membership Tier Badge
  var heroTier = document.getElementById('hero-tier-badge');
  if (heroTier && profile.membershipTier) {
    var icon = profile.membershipTier.includes('Private') ? '💎 ' : profile.membershipTier.includes('Gold') ? '🥇 ' : profile.membershipTier.includes('Silver') ? '🥈 ' : '👑 ';
    heroTier.textContent = icon + profile.membershipTier;
  }

  // 4. Update card holder names on cards
  document.querySelectorAll('.card-holder-name').forEach(function(el) {
    el.textContent = profile.fullName.toUpperCase();
  });

  // 5. Update dashboard greeting
  var dashGreeting = document.querySelector('.page-title-group p');
  var currentFile = (typeof location !== 'undefined' && location.pathname) ? (location.pathname.split('/').pop() || 'index.html') : 'index.html';
  if (dashGreeting && (currentFile === 'index.html' || currentFile === '')) {
    var h = new Date().getHours();
    var greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    dashGreeting.textContent = greeting + ', ' + (profile.firstName || 'User') + '! Here is your financial overview.';
  }
}

/* ---------- Theme Management (Executive Midnight / Crisp Light) ---------- */
function getSavedTheme() {
  return localStorage.getItem('apex_theme') || 'dark';
}

function applyTheme(theme) {
  theme = theme || getSavedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('apex_theme', theme);
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    if (theme === 'light') {
      btn.innerHTML = '<span>☀️</span> Light';
      btn.title = 'Current: Light Theme. Click for Dark Theme';
    } else {
      btn.innerHTML = '<span>🌙</span> Dark';
      btn.title = 'Current: Dark Theme. Click for Light Theme';
    }
  }
}

function toggleTheme() {
  var current = getSavedTheme();
  var next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  showToast(next === 'light' ? '☀️ Switched to Crisp Light Theme' : '🌙 Switched to Midnight Dark Theme', 'info');
}

window.escapeHTML = escapeHTML;
window.ApexAPI = ApexAPI;
window.getUserProfile = getUserProfile;
window.saveUserProfile = saveUserProfile;
window.renderAvatar = renderAvatar;
window.syncUserProfileUI = syncUserProfileUI;
window.showToast = showToast;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.getRegisteredUsers = getRegisteredUsers;
window.parseNameFromIdentifier = parseNameFromIdentifier;
window.SEED_ACCOUNTS = SEED_ACCOUNTS;

document.addEventListener('DOMContentLoaded', function() {
  // Apply saved theme
  applyTheme();

  // Attach theme toggle button if present
  var themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  // Sync profile data to UI
  syncUserProfileUI();

  // Active navigation link highlight
  var current = (typeof location !== 'undefined' && location.pathname) ? (location.pathname.split('/').pop() || 'index.html') : 'index.html';
  document.querySelectorAll('.nav-links .nav-item, .menu li').forEach(function(li) {
    var a = li.querySelector('a');
    if (a && a.getAttribute('href') === current) {
      li.classList.add('active');
    }
  });
});