/* ============================================
   auth.js — Authentication & Session Management
   Works with both Express API and LocalStorage fallback
   ============================================ */

(function () {
  'use strict';

  // --- Config ---
  var API_BASE = '';  // Same origin; Nginx proxies /api

  // --- LocalStorage fallback seed data ---
  var SEED_DOCTORS = [
    {
      id: 1,
      name: 'Dr. Emily Carter',
      specialty: 'Cognitive Behavioral Therapy',
      experience: '12 years',
      photo: 'https://images.unsplash.com/photo-1559839734-3954cd162c01?w=400&h=400&fit=crop',
      slots: ['09:00', '11:00', '13:30', '15:00'],
      bio: 'Specializes in anxiety and depression management using evidence-based CBT techniques.'
    },
    {
      id: 2,
      name: 'Dr. Marcus Lee',
      specialty: 'Trauma & PTSD Therapy',
      experience: '8 years',
      photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
      slots: ['10:00', '12:00', '14:00', '16:30'],
      bio: 'Dedicated to helping patients process and heal from traumatic experiences.'
    },
    {
      id: 3,
      name: 'Dr. Sofia Patel',
      specialty: 'Family & Relationship Counseling',
      experience: '15 years',
      photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop',
      slots: ['08:30', '10:30', '14:30', '17:00'],
      bio: 'Guides families and couples through conflict resolution and deeper connection.'
    },
    {
      id: 4,
      name: 'Dr. James Okafor',
      specialty: 'Adolescent Psychology',
      experience: '10 years',
      photo: 'https://images.unsplash.com/photo-1638202993928-7267aad4ae38?w=400&h=400&fit=crop',
      slots: ['09:30', '11:30', '13:00', '15:30'],
      bio: 'Passionate about supporting teens through academic stress and emotional growth.'
    }
  ];

  var SEED_ADMIN = {
    id: 'admin-001',
    name: 'Administrator',
    email: 'admin@smallsteps.com',
    password: 'admin123',
    role: 'admin'
  };

  // --- Storage helpers ---
  var Auth = window.SmallStepsAuth = {};

  Auth.initStorage = function () {
    if (!localStorage.getItem('ss_doctors')) {
      localStorage.setItem('ss_doctors', JSON.stringify(SEED_DOCTORS));
    }
    if (!localStorage.getItem('ss_users')) {
      localStorage.setItem('ss_users', JSON.stringify([SEED_ADMIN]));
    }
    if (!localStorage.getItem('ss_bookings')) {
      localStorage.setItem('ss_bookings', JSON.stringify([]));
    }
  };

  Auth.getDoctors = function () {
    return JSON.parse(localStorage.getItem('ss_doctors') || '[]');
  };

  Auth.setDoctors = function (doctors) {
    localStorage.setItem('ss_doctors', JSON.stringify(doctors));
  };

  Auth.getBookings = function () {
    return JSON.parse(localStorage.getItem('ss_bookings') || '[]');
  };

  Auth.setBookings = function (bookings) {
    localStorage.setItem('ss_bookings', JSON.stringify(bookings));
  };

  Auth.getUsers = function () {
    return JSON.parse(localStorage.getItem('ss_users') || '[]');
  };

  // --- Session ---
  Auth.getSession = function () {
    var token = localStorage.getItem('ss_token');
    var user = localStorage.getItem('ss_user');
    if (token && user) {
      return { token: token, user: JSON.parse(user) };
    }
    return null;
  };

  Auth.setSession = function (token, user) {
    localStorage.setItem('ss_token', token);
    localStorage.setItem('ss_user', JSON.stringify(user));
  };

  Auth.clearSession = function () {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
  };

  // --- API helper ---
  Auth.api = function (method, path, body) {
    return fetch(API_BASE + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': Auth.getSession() ? 'Bearer ' + Auth.getSession().token : ''
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  };

  // --- Check if API is available ---
  Auth.isApiAvailable = function () {
    return Auth._apiAvailable !== false;
  };

  Auth.checkApi = function () {
    return fetch(API_BASE + '/api/health', { method: 'GET' })
      .then(function (res) { return res.ok; })
      .catch(function () { return false; });
  };

  // --- Local auth helpers (fallback) ---
  Auth.localLogin = function (email, password) {
    var users = Auth.getUsers();
    var user = users.find(function (u) { return u.email === email && u.password === password; });
    if (!user) throw new Error('Invalid credentials');
    var token = 'local-' + btoa(user.id + ':' + Date.now());
    var safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    Auth.setSession(token, safeUser);
    return { token: token, user: safeUser };
  };

  Auth.localRegister = function (name, email, password) {
    var users = Auth.getUsers();
    var existing = users.find(function (u) { return u.email === email; });
    if (existing) throw new Error('Email already registered');
    var user = {
      id: 'user-' + Date.now(),
      name: name,
      email: email,
      password: password,
      role: 'patient'
    };
    users.push(user);
    localStorage.setItem('ss_users', JSON.stringify(users));
    var token = 'local-' + btoa(user.id + ':' + Date.now());
    var safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    Auth.setSession(token, safeUser);
    return { token: token, user: safeUser };
  };

  // --- Public auth methods (try API, fall back to local) ---
  Auth.login = function (email, password) {
    if (Auth.isApiAvailable()) {
      return Auth.api('POST', '/api/auth/login', { email: email, password: password })
        .then(function (data) {
          Auth.setSession(data.token, data.user);
          return data;
        })
        .catch(function (err) {
          if (err.message === 'Failed to fetch') {
            Auth._apiAvailable = false;
            return Auth.localLogin(email, password);
          }
          throw err;
        });
    }
    return Promise.resolve(Auth.localLogin(email, password));
  };

  Auth.register = function (name, email, password) {
    if (Auth.isApiAvailable()) {
      return Auth.api('POST', '/api/auth/register', { name: name, email: email, password: password })
        .then(function (data) {
          Auth.setSession(data.token, data.user);
          return data;
        })
        .catch(function (err) {
          if (err.message === 'Failed to fetch') {
            Auth._apiAvailable = false;
            return Auth.localRegister(name, email, password);
          }
          throw err;
        });
    }
    return Promise.resolve(Auth.localRegister(name, email, password));
  };

  // --- Route guard ---
  Auth.requireAuth = function (role) {
    var session = Auth.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    if (role && session.user.role !== role) {
      if (session.user.role === 'admin') {
        window.location.href = '/admin-dashboard.html';
      } else {
        window.location.href = '/patient-dashboard.html';
      }
      return null;
    }
    return session;
  };

  Auth.logout = function () {
    Auth.clearSession();
    window.location.href = '/login.html';
  };

  // --- Toast helper (shared) ---
  Auth.toast = function (message, type) {
    var toast = document.getElementById('toast');
    if (!toast) {
      alert(message);
      return;
    }
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' toast--' + type : '');
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 3000);
  };

  // --- Initialize ---
  Auth.initStorage();

  // Check API availability on load
  Auth.checkApi().then(function (available) {
    Auth._apiAvailable = available;
  });

  // --- Login page logic ---
  if (document.getElementById('loginForm')) {
    initLoginPage();
  }

  function initLoginPage() {
    var currentMode = 'patient';
    var loginForm = document.getElementById('loginForm');
    var registerForm = document.getElementById('registerForm');
    var patientModeBtn = document.getElementById('patientModeBtn');
    var adminModeBtn = document.getElementById('adminModeBtn');
    var adminHint = document.getElementById('adminHint');
    var loginRoleLabel = document.getElementById('loginRoleLabel');

    // Mode toggle
    patientModeBtn.addEventListener('click', function () {
      currentMode = 'patient';
      patientModeBtn.classList.add('active');
      adminModeBtn.classList.remove('active');
      adminHint.style.display = 'none';
      loginRoleLabel.textContent = 'patient';
    });

    adminModeBtn.addEventListener('click', function () {
      currentMode = 'admin';
      adminModeBtn.classList.add('active');
      patientModeBtn.classList.remove('active');
      adminHint.style.display = 'block';
      loginRoleLabel.textContent = 'admin';
    });

    // Form toggle
    document.getElementById('showRegister').addEventListener('click', function (e) {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    });

    document.getElementById('showLogin').addEventListener('click', function (e) {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    });

    // Password toggles
    document.querySelectorAll('.password-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(this.dataset.target);
        if (input.type === 'password') {
          input.type = 'text';
          this.textContent = 'Hide';
        } else {
          input.type = 'password';
          this.textContent = 'Show';
        }
      });
    });

    // Login submit
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      var errorEl = document.getElementById('loginError');
      var submitBtn = document.getElementById('loginSubmit');

      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      Auth.login(email, password)
        .then(function (data) {
          if (currentMode === 'admin' && data.user.role !== 'admin') {
            Auth.clearSession();
            throw new Error('These credentials do not have admin access.');
          }
          if (currentMode === 'patient' && data.user.role === 'admin') {
            Auth.clearSession();
            throw new Error('Please use the admin portal for admin accounts.');
          }
          if (data.user.role === 'admin') {
            window.location.href = '/admin-dashboard.html';
          } else {
            window.location.href = '/patient-dashboard.html';
          }
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Login failed. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        });
    });

    // Register submit
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('regName').value.trim();
      var email = document.getElementById('regEmail').value.trim();
      var password = document.getElementById('regPassword').value;
      var errorEl = document.getElementById('registerError');
      var submitBtn = document.getElementById('registerSubmit');

      if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        return;
      }

      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      Auth.register(name, email, password)
        .then(function () {
          window.location.href = '/patient-dashboard.html';
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Registration failed. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        });
    });
  }

  // --- Global logout handler ---
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'logoutBtn') {
      Auth.logout();
    }
  });

})();
