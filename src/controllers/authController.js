const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/cuti');
  res.render('auth/login', { pageTitle: 'Login', error: null });
};

const doLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('auth/login', {
        pageTitle: 'Login',
        error: 'Email dan password wajib diisi'
      });
    }

    const user = await prisma.user.findUnique({
      where: { emailKantor: email },
      include: { employee: true }
    });

    if (!user) {
      return res.render('auth/login', {
        pageTitle: 'Login',
        error: 'Email atau password salah'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.render('auth/login', {
        pageTitle: 'Login',
        error: 'Akun tidak aktif. Hubungi HR Admin.'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.render('auth/login', {
        pageTitle: 'Login',
        error: 'Email atau password salah'
      });
    }

    req.session.user = {
      id: user.id,
      email: user.emailKantor,
      role: user.role,
      nama: user.employee?.namaKaryawan || 'HR Admin',
      nik: user.employee?.nik || null,
      employeeId: user.employeeId
    };

    return res.redirect('/cuti');
  } catch (error) {
    console.error(error);
    return res.render('auth/login', {
      pageTitle: 'Login',
      error: 'Terjadi kesalahan, coba lagi'
    });
  }
};

const doLogout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

module.exports = { showLogin, doLogin, doLogout };
