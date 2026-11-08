function slugify(text) {
  if (!text) return '';
  let slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!slug) {
    slug = `item-${Date.now().toString(36)}`;
  }
  return slug;
}

function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MAV-${dateStr}-${randomStr}`;
}

function paginate({ page = 1, limit = 10, total = 0 }) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const totalRecords = Math.max(0, parseInt(total, 10) || 0);
  const totalPages = Math.ceil(totalRecords / perPage) || 1;
  const offset = (currentPage - 1) * perPage;

  return {
    page: currentPage,
    limit: perPage,
    offset,
    total: totalRecords,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, reset_token_hash, reset_token_expires_at, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  slugify,
  generateOrderNumber,
  paginate,
  sanitizeUser,
};
