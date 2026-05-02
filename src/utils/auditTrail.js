const logAudit = async (prisma, data) => {
  try {
    const { nik, tableName, action, oldData, newData, changedBy } = data;
    await prisma.auditLog.create({
      data: {
        nik,
        tableName,
        action,
        oldData: oldData || null,
        newData: newData || null,
        changedBy
      }
    });
  } catch (error) {
    console.error('[AUDIT TRAIL ERROR]', error.message);
    // Kita tidak rethrow error agar main flow tidak rusak walau audit gagal
  }
};

module.exports = { logAudit };
