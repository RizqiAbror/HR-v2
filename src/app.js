const express = require('express');
const path    = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
require('dotenv').config();

const app = express();

// ── Template engine ──
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ── Body parsers ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──
app.use(express.static(path.join(__dirname, '../public')));

// ── Session ──
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));

// ── Global template variable ──
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ── Routes ──
const authRoutes = require('./routes/authRoutes');
const pageRoutes = require('./routes/pageRoutes');
const cutiRoutes = require('./routes/cutiRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const agentRoutes = require('./routes/agentRoutes');
const liburRoutes = require('./routes/liburRoutes');
const { isLoggedIn, isHRAdmin } = require('./middlewares/auth');

// Auth (Login/Logout)
app.use('/', authRoutes);

// Pages & APIs (Protected)
app.use('/', pageRoutes);
app.use('/api/cuti', isLoggedIn, isHRAdmin, cutiRoutes);
app.use('/api/employee', isLoggedIn, isHRAdmin, employeeRoutes);
app.use('/api/agent', isLoggedIn, isHRAdmin, agentRoutes);
app.use('/api/libur', isLoggedIn, isHRAdmin, liburRoutes);

// ── Cron Jobs ──
const { initCronJobs } = require('./utils/cronJobs');
initCronJobs();
console.log('[CRON] Cron jobs aktif');

// ── Start server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});