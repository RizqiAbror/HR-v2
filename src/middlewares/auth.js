// ── Middleware Auth ──

const isLoggedIn = (req, res, next) => {
  // Bypass if using x-admin-key for API triggers
  if (req.headers['x-admin-key'] === process.env.SESSION_SECRET) {
    return next();
  }

  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const isHRAdmin = (req, res, next) => {
  if (req.session.user?.role !== 'HR_ADMIN') {
    return res.status(403).render('error', {
      pageTitle: 'Akses Ditolak',
      message: 'Halaman ini hanya untuk HR Admin.'
    });
  }
  next();
};

module.exports = { isLoggedIn, isHRAdmin };
