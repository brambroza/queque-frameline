export function generateShopKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let random = '';
  for (let i = 0; i < 6; i++) random += chars[Math.floor(Math.random() * chars.length)];
  return `SHOP-${random}`;
}
