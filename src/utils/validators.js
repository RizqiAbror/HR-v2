/**
 * Validasi NIK sesuai format PROJ_YY_MM_XXX
 * Contoh: PDG_26_05_001
 */
const validateNIK = (nik) => {
  const regex = /^[A-Z]{3,4}_\d{2}_\d{2}_\d{3}$/;
  return regex.test(nik);
};

module.exports = { validateNIK };
