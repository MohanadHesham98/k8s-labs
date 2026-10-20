/* ============================================
   booking.js — Patient Dashboard Logic
   Doctor listing + Booking flow + My Bookings
   ============================================ */

(function () {
  'use strict';

  var Auth = window.SmallStepsAuth;
  if (!Auth) return;

  // Guard: require patient auth
  var session = Auth.requireAuth('patient');
  if (!session) return;

  // --- State ---
  var doctors = [];
  var bookings = [];
  var selectedDoctor = null;
  var selectedDate = null;
  var selectedSlot = null;
  var currentTab = 'book';
  var bookingFilter = 'all';

  // --- DOM ---
  var userGreeting = document.getElementById('userGreeting');
  var doctorGrid = document.getElementById('doctorGrid');
  var bookingsList = document.getElementById('bookingsList');
  var doctorSearch = document.getElementById('doctorSearch');
  var bookingFilterEl = document.getElementById('bookingFilter');
  var bookingModal = document.getElementById('bookingModal');
  var bookingDate = document.getElementById('bookingDate');
  var slotGrid = document.getElementById('slotGrid');
  var confirmBtn = document.getElementById('confirmBooking');

  // --- Init ---
  userGreeting.textContent = 'Hi, ' + session.user.name;

  // Set min date to today
  var today = new Date().toISOString().split('T')[0];
  bookingDate.min = today;

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

  // --- Search ---
  doctorSearch.addEventListener('input', function () {
    renderDoctors(this.value.toLowerCase());
  });

  // --- Booking filter ---
  bookingFilterEl.addEventListener('change', function () {
    bookingFilter = this.value;
    renderBookings();
  });

  // --- Load Doctors ---
  function loadDoctors() {
    if (Auth.isApiAvailable()) {
      Auth.api('GET', '/api/doctors')
        .then(function (data) {
          doctors = data;
          renderDoctors('');
        })
        .catch(function () {
          doctors = Auth.getDoctors();
          renderDoctors('');
        });
    } else {
      doctors = Auth.getDoctors();
      renderDoctors('');
    }
  }

  function renderDoctors(search) {
    doctorGrid.innerHTML = '';

    var filtered = doctors.filter(function (d) {
      if (!search) return true;
      return d.name.toLowerCase().includes(search) ||
             d.specialty.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
      doctorGrid.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#x1F50D;</div><h3>No doctors found</h3><p>Try a different search term.</p></div>';
      return;
    }

    filtered.forEach(function (doctor) {
      var card = document.createElement('div');
      card.className = 'doctor-card';

      var slotsHTML = doctor.slots.map(function (s) {
        return '<span class="doctor-card__slot">' + s + '</span>';
      }).join('');

      card.innerHTML =
        '<img class="doctor-card__photo" src="' + (doctor.photo || '') + '" alt="' + escapeHtml(doctor.name) + '" onerror="this.src=\'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop\'">' +
        '<div class="doctor-card__body">' +
          '<h3 class="doctor-card__name">' + escapeHtml(doctor.name) + '</h3>' +
          '<p class="doctor-card__specialty">' + escapeHtml(doctor.specialty) + '</p>' +
          '<div class="doctor-card__meta">' +
            '<span class="doctor-card__meta-item">&#x1F4C5; ' + escapeHtml(doctor.experience || 'Experienced') + '</span>' +
          '</div>' +
          (doctor.bio ? '<p class="doctor-card__bio">' + escapeHtml(doctor.bio) + '</p>' : '') +
          '<div class="doctor-card__slots-label">Available Slots</div>' +
          '<div class="doctor-card__slots">' + slotsHTML + '</div>' +
          '<div class="doctor-card__actions">' +
            '<button class="btn btn--primary" onclick="SmallStepsBooking.openBookingModal(' + doctor.id + ')">Book Session</button>' +
          '</div>' +
        '</div>';

      doctorGrid.appendChild(card);
    });
  }

  // --- Open booking modal ---
  window.SmallStepsBooking = {
    openBookingModal: function (doctorId) {
      selectedDoctor = doctors.find(function (d) { return d.id === doctorId; });
      if (!selectedDoctor) return;

      selectedDate = null;
      selectedSlot = null;
      bookingDate.value = '';
      confirmBtn.disabled = true;

      document.getElementById('modalDoctorName').textContent = selectedDoctor.name;
      document.getElementById('modalDoctorSpecialty').textContent = selectedDoctor.specialty;
      document.getElementById('modalDoctorPhoto').src = selectedDoctor.photo || '';
      document.getElementById('modalDoctorPhoto').onerror = function () {
        this.src = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop';
      };
      document.getElementById('bookingNotes').value = '';

      slotGrid.innerHTML = '<p class="slot-empty">Please select a date first.</p>';

      bookingModal.classList.add('active');
    },

    closeBookingModal: function () {
      bookingModal.classList.remove('active');
      selectedDoctor = null;
      selectedDate = null;
      selectedSlot = null;
    }
  };

  // --- Date change -> render slots ---
  bookingDate.addEventListener('change', function () {
    selectedDate = this.value;
    selectedSlot = null;
    confirmBtn.disabled = true;
    renderSlots();
  });

  function renderSlots() {
    if (!selectedDoctor || !selectedDate) {
      slotGrid.innerHTML = '<p class="slot-empty">Please select a date first.</p>';
      return;
    }

    // Get already-booked slots for this doctor+date
    var bookedSlots = getBookedSlots(selectedDoctor.id, selectedDate);

    slotGrid.innerHTML = '';
    selectedDoctor.slots.forEach(function (slot) {
      var btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.textContent = slot;

      if (bookedSlots.indexOf(slot) !== -1) {
        btn.classList.add('slot-btn--disabled');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', function () {
          document.querySelectorAll('.slot-btn').forEach(function (b) {
            b.classList.remove('selected');
          });
          btn.classList.add('selected');
          selectedSlot = slot;
          confirmBtn.disabled = false;
        });
      }

      slotGrid.appendChild(btn);
    });
  }

  function getBookedSlots(doctorId, date) {
    return bookings
      .filter(function (b) {
        return b.doctorId === doctorId && b.date === date && b.status !== 'Cancelled' && b.status !== 'Rejected';
      })
      .map(function (b) { return b.timeSlot; });
  }

  // --- Confirm booking ---
  confirmBtn.addEventListener('click', function () {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return;

    var notes = document.getElementById('bookingNotes').value.trim();

    if (Auth.isApiAvailable()) {
      Auth.api('POST', '/api/bookings', {
        doctorId: selectedDoctor.id,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes: notes
      })
        .then(function (booking) {
          bookings.push(booking);
          Auth.toast('Booking confirmed! Reference: ' + booking.bookingRef, 'success');
          window.SmallStepsBooking.closeBookingModal();
          renderBookings();
        })
        .catch(function (err) {
          Auth.toast(err.message || 'Failed to book session', 'error');
        });
    } else {
      // Local booking
      var allBookings = Auth.getBookings();
      var bookedSlots = getBookedSlots(selectedDoctor.id, selectedDate);
      if (bookedSlots.indexOf(selectedSlot) !== -1) {
        Auth.toast('That slot is already booked', 'error');
        return;
      }
      var booking = {
        id: Date.now(),
        bookingRef: 'BK-' + Date.now().toString(36).toUpperCase(),
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        specialty: selectedDoctor.specialty,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes: notes,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };
      allBookings.push(booking);
      Auth.setBookings(allBookings);
      bookings = allBookings.filter(function (b) { return b.userId === session.user.id; });
      Auth.toast('Booking created! Reference: ' + booking.bookingRef, 'success');
      window.SmallStepsBooking.closeBookingModal();
      renderBookings();
    }
  });

  // --- Modal close handlers ---
  document.getElementById('closeBookingModal').addEventListener('click', function () {
    window.SmallStepsBooking.closeBookingModal();
  });
  document.getElementById('cancelBookingModal').addEventListener('click', function () {
    window.SmallStepsBooking.closeBookingModal();
  });
  bookingModal.addEventListener('click', function (e) {
    if (e.target === bookingModal) {
      window.SmallStepsBooking.closeBookingModal();
    }
  });

  // --- Load Bookings ---
  function loadBookings() {
    if (Auth.isApiAvailable()) {
      Auth.api('GET', '/api/bookings')
        .then(function (data) {
          bookings = data;
          renderBookings();
        })
        .catch(function () {
          bookings = Auth.getBookings().filter(function (b) {
            return b.userId === session.user.id;
          });
          renderBookings();
        });
    } else {
      bookings = Auth.getBookings().filter(function (b) {
        return b.userId === session.user.id;
      });
      renderBookings();
    }
  }

  function renderBookings() {
    var filtered = bookings;
    if (bookingFilter !== 'all') {
      filtered = bookings.filter(function (b) { return b.status === bookingFilter; });
    }

    // Sort by date descending
    filtered.sort(function (a, b) {
      return new Date(b.date + 'T' + b.timeSlot) - new Date(a.date + 'T' + a.timeSlot);
    });

    bookingsList.innerHTML = '';

    if (filtered.length === 0) {
      bookingsList.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#x1F4C5;</div><h3>No bookings found</h3><p>Book a session to see it here.</p></div>';
      return;
    }

    filtered.forEach(function (booking) {
      var card = document.createElement('div');
      card.className = 'booking-card';

      var canCancel = booking.status === 'Pending' || booking.status === 'Confirmed';

      card.innerHTML =
        '<div class="booking-card__main">' +
          '<div class="booking-card__ref">' + escapeHtml(booking.bookingRef || ('#' + booking.id)) + '</div>' +
          '<div class="booking-card__doctor">' + escapeHtml(booking.doctorName) + '</div>' +
          '<div class="booking-card__specialty">' + escapeHtml(booking.specialty || '') + '</div>' +
          '<div class="booking-card__details">' +
            '<span class="booking-card__detail">&#x1F4C5; ' + formatDate(booking.date) + '</span>' +
            '<span class="booking-card__detail">&#x1F552; ' + escapeHtml(booking.timeSlot) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="booking-card__side">' +
          '<span class="status-badge status-badge--' + booking.status.toLowerCase() + '">' + booking.status + '</span>' +
          (canCancel ? '<button class="btn btn--danger btn--sm" onclick="SmallStepsBooking.cancelBooking(' + booking.id + ')">Cancel</button>' : '') +
        '</div>';

      bookingsList.appendChild(card);
    });
  }

  // --- Cancel booking ---
  window.SmallStepsBooking.cancelBooking = function (bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    if (Auth.isApiAvailable()) {
      Auth.api('DELETE', '/api/bookings/' + bookingId)
        .then(function () {
          var b = bookings.find(function (x) { return x.id === bookingId; });
          if (b) b.status = 'Cancelled';
          Auth.toast('Booking cancelled', 'warning');
          renderBookings();
        })
        .catch(function (err) {
          Auth.toast(err.message || 'Failed to cancel', 'error');
        });
    } else {
      var allBookings = Auth.getBookings();
      var b = allBookings.find(function (x) { return x.id === bookingId; });
      if (b) b.status = 'Cancelled';
      Auth.setBookings(allBookings);
      bookings = allBookings.filter(function (x) { return x.userId === session.user.id; });
      Auth.toast('Booking cancelled', 'warning');
      renderBookings();
    }
  };

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
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

})();
