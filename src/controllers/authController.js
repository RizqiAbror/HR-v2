const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/cuti');
  res.render('auth/login', { layout: false }); // Render login tanpa layout main
};

const handleLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Username tidak ditemukan' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      nik: user.nik
    };

    return res.json({ success: true, message: 'Login berhasil' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const handleLogout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};

module.exports = { showLogin, handleLogin, handleLogout };
