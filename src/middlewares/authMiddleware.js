/**
 * Middleware untuk memproteksi route dari user yang belum login
 */
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

/**
 * Middleware untuk mengecek role admin
 */
const isAdmin = (req, res, next) => {
  if (req.session.user && (req.session.user.role === 'SUPERADMIN' || req.session.user.role === 'HR_ADMIN')) {
    return next();
  }
  res.status(403).send('Akses Ditolak: Hanya Admin yang diperbolehkan');
};

module.exports = { isAuthenticated, isAdmin };
