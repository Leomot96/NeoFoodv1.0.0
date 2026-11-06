const tenantStorage = {
  run: (ctx, fn) => fn(),
  getStore: () => null
};

module.exports = {
  tenantStorage,
  runWithTenant: (ctx, fn) => fn(),
  getTenantContext: () => null,
  getTenantId: () => null,
  isSuperAdmin: () => false
};
