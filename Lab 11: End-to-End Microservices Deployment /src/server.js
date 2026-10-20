const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from the public directory
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR));

// --- In-memory data store (seeded on startup) ---
let doctors = [];
let bookings = [];
let users = [];
let nextDoctorId = 1;
let nextBookingId = 1;

function seedData() {
  doctors = [
    {
      id: nextDoctorId++,
      name: 'Dr. Emily Carter',
      specialty: 'Cognitive Behavioral Therapy',
      experience: '12 years',
      photo: 'https://images.unsplash.com/photo-1559839734-3954cd162c01?w=400&h=400&fit=crop',
      slots: ['09:00', '11:00', '13:30', '15:00'],
      bio: 'Specializes in anxiety and depression management using evidence-based CBT techniques.'
    },
    {
      id: nextDoctorId++,
      name: 'Dr. Marcus Lee',
      specialty: 'Trauma & PTSD Therapy',
      experience: '8 years',
      photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
      slots: ['10:00', '12:00', '14:00', '16:30'],
      bio: 'Dedicated to helping patients process and heal from traumatic experiences.'
    },
    {
      id: nextDoctorId++,
      name: 'Dr. Sofia Patel',
      specialty: 'Family & Relationship Counseling',
      experience: '15 years',
      photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop',
      slots: ['08:30', '10:30', '14:30', '17:00'],
      bio: 'Guides families and couples through conflict resolution and deeper connection.'
    },
    {
      id: nextDoctorId++,
      name: 'Dr. James Okafor',
      specialty: 'Adolescent Psychology',
      experience: '10 years',
      photo: 'https://images.unsplash.com/photo-1638202993928-7267aad4ae38?w=400&h=400&fit=crop',
      slots: ['09:30', '11:30', '13:00', '15:30'],
      bio: 'Passionate about supporting teens through academic stress and emotional growth.'
    }
  ];

  bookings = [];
  users = [];

  // Seed admin account
  const adminPass = bcrypt.hashSync('admin123', 10);
  users.push({
    id: 'admin-001',
    name: 'Administrator',
    email: 'admin@smallsteps.com',
    password: adminPass,
    role: 'admin'
  });
}

seedData();

// --- Auth middleware ---
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// --- API Routes ---

// AUTH: Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const existing = users.find(u => u.email === email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hashed = bcrypt.hashSync(password, 10);
  const user = { id: crypto.randomUUID(), name, email, password: hashed, role: 'patient' };
  users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// AUTH: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// AUTH: Verify
app.get('/api/auth/verify', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// DOCTORS: List all
app.get('/api/doctors', (req, res) => {
  res.json(doctors);
});

// DOCTORS: Create (admin only)
app.post('/api/doctors', authenticate, requireAdmin, (req, res) => {
  const { name, specialty, experience, photo, slots, bio } = req.body;
  if (!name || !specialty) return res.status(400).json({ error: 'Name and specialty required' });
  const doctor = {
    id: nextDoctorId++,
    name,
    specialty,
    experience: experience || 'Not specified',
    photo: photo || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
    slots: slots || ['09:00', '11:00', '14:00'],
    bio: bio || ''
  };
  doctors.push(doctor);
  res.json(doctor);
});

// DOCTORS: Update (admin only)
app.put('/api/doctors/:id', authenticate, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = doctors.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Doctor not found' });
  const { name, specialty, experience, photo, slots, bio } = req.body;
  doctors[idx] = {
    ...doctors[idx],
    name: name || doctors[idx].name,
    specialty: specialty || doctors[idx].specialty,
    experience: experience || doctors[idx].experience,
    photo: photo || doctors[idx].photo,
    slots: slots || doctors[idx].slots,
    bio: bio !== undefined ? bio : doctors[idx].bio
  };
  res.json(doctors[idx]);
});

// DOCTORS: Delete (admin only)
app.delete('/api/doctors/:id', authenticate, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = doctors.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Doctor not found' });
  doctors.splice(idx, 1);
  res.json({ success: true });
});

// BOOKINGS: List all (admin) or by user (patient)
app.get('/api/bookings', authenticate, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json(bookings);
  }
  const userBookings = bookings.filter(b => b.userId === req.user.id);
  res.json(userBookings);
});

// BOOKINGS: Create
app.post('/api/bookings', authenticate, (req, res) => {
  const { doctorId, date, timeSlot, notes } = req.body;
  if (!doctorId || !date || !timeSlot) return res.status(400).json({ error: 'Doctor, date, and time slot required' });
  const doctor = doctors.find(d => d.id === parseInt(doctorId));
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  const existing = bookings.find(b => b.doctorId === parseInt(doctorId) && b.date === date && b.timeSlot === timeSlot && b.status !== 'Cancelled');
  if (existing) return res.status(409).json({ error: 'That slot is already booked' });
  const booking = {
    id: nextBookingId++,
    bookingRef: 'BK-' + Date.now().toString(36).toUpperCase(),
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    doctorId: parseInt(doctorId),
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date,
    timeSlot,
    notes: notes || '',
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  res.json(booking);
});

// BOOKINGS: Update status (admin)
app.patch('/api/bookings/:id', authenticate, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const booking = bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const { status } = req.body;
  const valid = ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'Rejected'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  booking.status = status;
  res.json(booking);
});

// BOOKINGS: Cancel (patient can cancel own)
app.delete('/api/bookings/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const booking = bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  booking.status = 'Cancelled';
  res.json({ success: true, booking });
});

// HEALTH check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', doctors: doctors.length, bookings: bookings.length, users: users.length });
});

// SPA fallback - serve files from public/ for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Small Steps server running on port ${PORT}`);
});
