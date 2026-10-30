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
  var currentFile = location.pathname.split('/').pop() || 'index.html';
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

window.getUserProfile = getUserProfile;
window.saveUserProfile = saveUserProfile;
window.renderAvatar = renderAvatar;
window.syncUserProfileUI = syncUserProfileUI;
window.showToast = showToast;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;

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
  var current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links .nav-item, .menu li').forEach(function(li) {
    var a = li.querySelector('a');
    if (a && a.getAttribute('href') === current) {
      li.classList.add('active');
    }
  });
});