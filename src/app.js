const express = require('express')
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
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

// Import routes
const pageRoutes = require('./routes/pageRoutes')
const cutiRoutes = require('./routes/cutiRoutes')

app.use('/', pageRoutes)
app.use('/api/cuti', cutiRoutes)

// Route pertama — cek apakah server jalan
app.get('/', (req, res) => {
  res.send('HR System v2 — server jalan ✓')
})

// Jalankan server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`)
})