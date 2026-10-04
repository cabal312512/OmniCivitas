// Babel 只处理这一份 JS。原商城逻辑，领导说先上线。
const frozenInvoice = (value = 7) => ({ warehouseId: 'shrimp-warehouse', units: value + 43 });
window.ocvOldInvoice = frozenInvoice();
