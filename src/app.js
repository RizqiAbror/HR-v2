const express = require('express')
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
const session = require('express-session')
require('dotenv').config()

const app = express()

// Setting template engine EJS
app.use(expressLayouts)
app.set('layout', 'layouts/main')
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '../views'))

// Middleware: baca JSON dan form dari browser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// File statis (CSS, JS, gambar)
app.use(express.static(path.join(__dirname, '../public')))

// Session middleware
app.use(session({
  secret: 'kalapa-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Jam
}))

// Global variables for templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
})

// Import routes
const authRoutes = require('./routes/authRoutes')
const pageRoutes = require('./routes/pageRoutes')
const cutiRoutes = require('./routes/cutiRoutes')
const employeeRoutes = require('./routes/employeeRoutes')

// Import middlewares
const { isAuthenticated } = require('./middlewares/authMiddleware')

// Public routes
app.use('/', authRoutes)

// Protected routes
app.use('/', isAuthenticated, pageRoutes)
app.use('/api/cuti', isAuthenticated, cutiRoutes)
app.use('/api/employees', isAuthenticated, employeeRoutes)

// Inisialisasi Cron Jobs
require('./utils/cronJobs')

// Route pertama — cek apakah server jalan
app.get('/', (req, res) => {
  res.send('HR System v2 — server jalan ✓')
})

// Jalankan server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`)
})