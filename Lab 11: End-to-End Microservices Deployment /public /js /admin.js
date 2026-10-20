/* ============================================
   admin.js — Admin Dashboard Logic
   Doctor CRUD + Booking Management + Overview
   ============================================ */

(function () {
  'use strict';

  var Auth = window.SmallStepsAuth;
  if (!Auth) return;

  // Guard: require admin auth
  var session = Auth.requireAuth('admin');
  if (!session) return;

  // --- State ---
  var doctors = [];
  var bookings = [];
  var currentTab = 'overview';
  var bookingFilter = 'all';
  var editingDoctorId = null;

  // --- DOM ---
  var adminGreeting = document.getElementById('adminGreeting');
  var adminDoctorGrid = document.getElementById('adminDoctorGrid');
  var adminBookingsList = document.getElementById('adminBookingsList');
  var recentBookingsList = document.getElementById('recentBookingsList');
  var adminBookingFilter = document.getElementById('adminBookingFilter');
  var doctorModal = document.getElementById('doctorModal');
  var bookingStatusModal = document.getElementById('bookingStatusModal');

  // --- Init ---
  adminGreeting.textContent = session.user.name;

  loadDoctors();
  loadBookings();

  // --- Tab switching ---
  document.querySelectorAll('.dash-nav__tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var tabName = this.dataset.tab;
      switchTab(tabName);
    });
  });

  function switchTab(name) {
    currentTab = name;
    document.querySelectorAll('.dash-nav__tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.querySelectorAll('.dash-tab').forEach(function (s) {
      s.classList.toggle('active', s.id === 'tab-' + name);
    });
  }

  // ============================================
  // DOCTORS
  // ============================================

  function loadDoctors() {
    if (Auth.isApiAvailable()) {
      Auth.api('GET', '/api/doctors')
        .then(function (data) {
          doctors = data;
          renderDoctors();
          updateStats();
        })
        .catch(function () {
          doctors = Auth.getDoctors();
          renderDoctors();
          updateStats();
        });
    } else {
      doctors = Auth.getDoctors();
      renderDoctors();
      updateStats();
    }
  }

  function renderDoctors() {
    adminDoctorGrid.innerHTML = '';

    if (doctors.length === 0) {
      adminDoctorGrid.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#x1F468;</div><h3>No doctors yet</h3><p>Click "Add Doctor" to create your first therapist profile.</p></div>';
      return;
    }

    doctors.forEach(function (doctor) {
      var card = document.createElement('div');
      card.className = 'doctor-card doctor-card--admin';

      var slotsHTML = doctor.slots.map(function (s) {
        return '<span class="doctor-card__slot">' + s + '</span>';
      }).join('');

      card.innerHTML =
        '<img class="doctor-card__photo" src="' + (doctor.photo || '') + '" alt="' + escapeHtml(doctor.name) + '" onerror="this.src=\'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop\'">' +
        '<div class="doctor-card__body">' +
          '<h3 class="doctor-card__name">' + escapeHtml(doctor.name) + '</h3>' +
          '<p class="doctor-card__specialty">' + escapeHtml(doctor.specialty) + '</p>' +
          '<div class="doctor-card__meta">' +
            '<span class="doctor-card__meta-item">&#x1F4C5; ' + escapeHtml(doctor.experience || '') + '</span>' +
          '</div>' +
          (doctor.bio ? '<p class="doctor-card__bio">' + escapeHtml(doctor.bio) + '</p>' : '') +
          '<div class="doctor-card__slots-label">Available Slots</div>' +
          '<div class="doctor-card__slots">' + slotsHTML + '</div>' +
          '<div class="doctor-card__actions">' +
            '<button class="doctor-card__edit" onclick="SmallStepsAdmin.editDoctor(' + doctor.id + ')">Edit Doctor</button>' +
            '<button class="doctor-card__delete" onclick="SmallStepsAdmin.deleteDoctor(' + doctor.id + ')">Remove Doctor</button>' +
          '</div>' +
        '</div>';

      adminDoctorGrid.appendChild(card);
    });
  }

  // --- Add/Edit Doctor Modal ---
  document.getElementById('addDoctorBtn').addEventListener('click', function () {
    editingDoctorId = null;
    document.getElementById('doctorModalTitle').textContent = 'Add New Doctor';
    document.getElementById('doctorEditId').value = '';
    document.getElementById('doctorName').value = '';
    document.getElementById('doctorSpecialty').value = '';
    document.getElementById('doctorExperience').value = '';
    document.getElementById('doctorPhoto').value = '';
    document.getElementById('doctorSlots').value = '';
    document.getElementById('doctorBio').value = '';
    doctorModal.classList.add('active');
  });

  window.SmallStepsAdmin = {
    editDoctor: function (id) {
      var doctor = doctors.find(function (d) { return d.id === id; });
      if (!doctor) return;
      editingDoctorId = id;
      document.getElementById('doctorModalTitle').textContent = 'Edit Doctor';
      document.getElementById('doctorEditId').value = id;
      document.getElementById('doctorName').value = doctor.name;
      document.getElementById('doctorSpecialty').value = doctor.specialty;
      document.getElementById('doctorExperience').value = doctor.experience || '';
      document.getElementById('doctorPhoto').value = doctor.photo || '';
      document.getElementById('doctorSlots').value = (doctor.slots || []).join(', ');
      document.getElementById('doctorBio').value = doctor.bio || '';
      doctorModal.classList.add('active');
    },

    deleteDoctor: function (id) {
      var doctor = doctors.find(function (d) { return d.id === id; });
      if (!doctor) return;
      if (!confirm('Remove ' + doctor.name + ' from the platform?')) return;

      if (Auth.isApiAvailable()) {
        Auth.api('DELETE', '/api/doctors/' + id)
          .then(function () {
            doctors = doctors.filter(function (d) { return d.id !== id; });
            Auth.toast(doctor.name + ' removed', 'warning');
            renderDoctors();
            updateStats();
          })
          .catch(function (err) {
            Auth.toast(err.message || 'Failed to remove doctor', 'error');
          });
      } else {
        var allDoctors = Auth.getDoctors();
        allDoctors = allDoctors.filter(function (d) { return d.id !== id; });
        Auth.setDoctors(allDoctors);
        doctors = allDoctors;
        Auth.toast(doctor.name + ' removed', 'warning');
        renderDoctors();
        updateStats();
      }
    },

    closeDoctorModal: function () {
      doctorModal.classList.remove('active');
      editingDoctorId = null;
    },

    manageBooking: function (id) {
      var booking = bookings.find(function (b) { return b.id === id; });
      if (!booking) return;

      var body = document.getElementById('bookingStatusBody');
      var footer = document.getElementById('bookingStatusFooter');

      body.innerHTML =
        '<div class="booking-card__ref">' + escapeHtml(booking.bookingRef || ('#' + booking.id)) + '</div>' +
        '<div class="booking-card__doctor" style="margin:8px 0 4px;">' + escapeHtml(booking.doctorName) + '</div>' +
        '<div class="booking-card__specialty">' + escapeHtml(booking.specialty || '') + '</div>' +
        '<div class="booking-card__details" style="margin:12px 0;">' +
          '<span class="booking-card__detail">&#x1F464; ' + escapeHtml(booking.userName || '') + '</span>' +
          '<span class="booking-card__detail">&#x1F4C5; ' + formatDate(booking.date) + '</span>' +
          '<span class="booking-card__detail">&#x1F552; ' + escapeHtml(booking.timeSlot) + '</span>' +
        '</div>' +
        '<div style="margin:12px 0;">' +
          '<span class="status-badge status-badge--' + booking.status.toLowerCase() + '">' + booking.status + '</span>' +
        '</div>' +
        (booking.notes ? '<p style="font-size:0.85rem;color:var(--gray-600);margin-top:12px;"><strong>Notes:</strong> ' + escapeHtml(booking.notes) + '</p>' : '');

      var actions = '<div class="status-actions">';
      if (booking.status === 'Pending') {
        actions +=
          '<button class="status-action-btn status-action-btn--confirm" onclick="SmallStepsAdmin.updateBookingStatus(' + booking.id + ', \'Confirmed\')">Approve</button>' +
          '<button class="status-action-btn status-action-btn--reject" onclick="SmallStepsAdmin.updateBookingStatus(' + booking.id + ', \'Rejected\')">Reject</button>';
      }
      if (booking.status === 'Confirmed') {
        actions +=
          '<button class="status-action-btn status-action-btn--complete" onclick="SmallStepsAdmin.updateBookingStatus(' + booking.id + ', \'Completed\')">Mark Complete</button>' +
          '<button class="status-action-btn status-action-btn--cancel" onclick="SmallStepsAdmin.updateBookingStatus(' + booking.id + ', \'Cancelled\')">Cancel</button>';
      }
      if (booking.status === 'Completed') {
        actions += '<p style="color:var(--gray-500);font-size:0.85rem;">This session has been completed.</p>';
      }
      if (booking.status === 'Cancelled' || booking.status === 'Rejected') {
        actions += '<p style="color:var(--gray-500);font-size:0.85rem;">This booking is no longer active.</p>';
      }
      actions += '</div>';

      footer.innerHTML = actions;

      bookingStatusModal.classList.add('active');
    },

    updateBookingStatus: function (id, status) {
      if (Auth.isApiAvailable()) {
        Auth.api('PATCH', '/api/bookings/' + id, { status: status })
          .then(function (updated) {
            var b = bookings.find(function (x) { return x.id === id; });
            if (b) b.status = status;
            Auth.toast('Booking ' + status.toLowerCase(), 'success');
            bookingStatusModal.classList.remove('active');
            renderBookings();
            updateStats();
          })
          .catch(function (err) {
            Auth.toast(err.message || 'Failed to update status', 'error');
          });
      } else {
        var allBookings = Auth.getBookings();
        var b = allBookings.find(function (x) { return x.id === id; });
        if (b) b.status = status;
        Auth.setBookings(allBookings);
        bookings = allBookings;
        Auth.toast('Booking ' + status.toLowerCase(), 'success');
        bookingStatusModal.classList.remove('active');
        renderBookings();
        updateStats();
      }
    },

    closeStatusModal: function () {
      bookingStatusModal.classList.remove('active');
    }
  };

  // --- Save doctor ---
  document.getElementById('saveDoctorBtn').addEventListener('click', function () {
    var name = document.getElementById('doctorName').value.trim();
    var specialty = document.getElementById('doctorSpecialty').value.trim();
    var experience = document.getElementById('doctorExperience').value.trim();
    var photo = document.getElementById('doctorPhoto').value.trim();
    var slotsStr = document.getElementById('doctorSlots').value.trim();
    var bio = document.getElementById('doctorBio').value.trim();

    if (!name || !specialty) {
      Auth.toast('Name and specialty are required', 'error');
      return;
    }

    var slots = slotsStr ? slotsStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : ['09:00', '11:00', '14:00'];

    var payload = {
      name: name,
      specialty: specialty,
      experience: experience,
      photo: photo,
      slots: slots,
      bio: bio
    };

    if (editingDoctorId) {
      // Update
      if (Auth.isApiAvailable()) {
        Auth.api('PUT', '/api/doctors/' + editingDoctorId, payload)
          .then(function (updated) {
            var idx = doctors.findIndex(function (d) { return d.id === editingDoctorId; });
            if (idx !== -1) doctors[idx] = updated;
            Auth.toast('Doctor updated', 'success');
            window.SmallStepsAdmin.closeDoctorModal();
            renderDoctors();
          })
          .catch(function (err) {
            Auth.toast(err.message || 'Failed to update', 'error');
          });
      } else {
        var allDoctors = Auth.getDoctors();
        var idx = allDoctors.findIndex(function (d) { return d.id === editingDoctorId; });
        if (idx !== -1) {
          allDoctors[idx] = Object.assign({}, allDoctors[idx], payload);
        }
        Auth.setDoctors(allDoctors);
        doctors = allDoctors;
        Auth.toast('Doctor updated', 'success');
        window.SmallStepsAdmin.closeDoctorModal();
        renderDoctors();
      }
    } else {
      // Create
      if (Auth.isApiAvailable()) {
        Auth.api('POST', '/api/doctors', payload)
          .then(function (created) {
            doctors.push(created);
            Auth.toast('Doctor added', 'success');
            window.SmallStepsAdmin.closeDoctorModal();
            renderDoctors();
            updateStats();
          })
          .catch(function (err) {
            Auth.toast(err.message || 'Failed to add doctor', 'error');
          });
      } else {
        var allDoctors2 = Auth.getDoctors();
        var newId = allDoctors2.length > 0 ? Math.max.apply(null, allDoctors2.map(function (d) { return d.id; })) + 1 : 1;
        var newDoctor = Object.assign({ id: newId }, payload);
        allDoctors2.push(newDoctor);
        Auth.setDoctors(allDoctors2);
        doctors = allDoctors2;
        Auth.toast('Doctor added', 'success');
        window.SmallStepsAdmin.closeDoctorModal();
        renderDoctors();
        updateStats();
      }
    }
  });

  // --- Modal close handlers ---
  document.getElementById('closeDoctorModal').addEventListener('click', function () {
    window.SmallStepsAdmin.closeDoctorModal();
  });
  document.getElementById('cancelDoctorModal').addEventListener('click', function () {
    window.SmallStepsAdmin.closeDoctorModal();
  });
  doctorModal.addEventListener('click', function (e) {
    if (e.target === doctorModal) window.SmallStepsAdmin.closeDoctorModal();
  });

  document.getElementById('closeStatusModal').addEventListener('click', function () {
    window.SmallStepsAdmin.closeStatusModal();
  });
  bookingStatusModal.addEventListener('click', function (e) {
    if (e.target === bookingStatusModal) window.SmallStepsAdmin.closeStatusModal();
  });

  // ============================================
  // BOOKINGS
  // ============================================

  adminBookingFilter.addEventListener('change', function () {
    bookingFilter = this.value;
    renderBookings();
  });

  function loadBookings() {
    if (Auth.isApiAvailable()) {
      Auth.api('GET', '/api/bookings')
        .then(function (data) {
          bookings = data;
          renderBookings();
          updateStats();
        })
        .catch(function () {
          bookings = Auth.getBookings();
          renderBookings();
          updateStats();
        });
    } else {
      bookings = Auth.getBookings();
      renderBookings();
      updateStats();
    }
  }

  function renderBookings() {
    var filtered = bookings;
    if (bookingFilter !== 'all') {
      filtered = bookings.filter(function (b) { return b.status === bookingFilter; });
    }

    filtered.sort(function (a, b) {
      return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    });

    // Full list (All Bookings tab)
    renderBookingList(adminBookingsList, filtered);

    // Recent (Overview tab) - latest 5
    var recent = bookings.slice().sort(function (a, b) {
      return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    }).slice(0, 5);
    renderBookingList(recentBookingsList, recent);
  }

  function renderBookingList(container, list) {
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#x1F4C5;</div><h3>No bookings found</h3><p>Bookings will appear here when patients schedule sessions.</p></div>';
      return;
    }

    list.forEach(function (booking) {
      var card = document.createElement('div');
      card.className = 'booking-card';

      card.innerHTML =
        '<div class="booking-card__main">' +
          '<div class="booking-card__ref">' + escapeHtml(booking.bookingRef || ('#' + booking.id)) + '</div>' +
          '<div class="booking-card__doctor">' + escapeHtml(booking.doctorName) + '</div>' +
          '<div class="booking-card__specialty">' + escapeHtml(booking.specialty || '') + '</div>' +
          '<div class="booking-card__details">' +
            '<span class="booking-card__detail">&#x1F464; ' + escapeHtml(booking.userName || '') + '</span>' +
            '<span class="booking-card__detail">&#x1F4C5; ' + formatDate(booking.date) + '</span>' +
            '<span class="booking-card__detail">&#x1F552; ' + escapeHtml(booking.timeSlot) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="booking-card__side">' +
          '<span class="status-badge status-badge--' + booking.status.toLowerCase() + '">' + booking.status + '</span>' +
          '<button class="btn btn--outline btn--sm" onclick="SmallStepsAdmin.manageBooking(' + booking.id + ')">Manage</button>' +
        '</div>';

      container.appendChild(card);
    });
  }

  // ============================================
  // OVERVIEW STATS
  // ============================================

  function updateStats() {
    var total = bookings.length;
    var pending = bookings.filter(function (b) { return b.status === 'Pending'; }).length;
    var confirmed = bookings.filter(function (b) { return b.status === 'Confirmed'; }).length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statDoctors').textContent = doctors.length;
  }

  // --- Utilities ---
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

})();
