"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localTodayIso = localTodayIso;
exports.addLocalDays = addLocalDays;
exports.localDayUtcBounds = localDayUtcBounds;
function localTodayIso() {
    const now = new Date();
    return formatLocalDateIso(now);
}
function addLocalDays(dateIso, days) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return formatLocalDateIso(dt);
}
function formatLocalDateIso(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function localDayUtcBounds(dateIso) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    const toSqlUtc = (dt) => dt.toISOString().slice(0, 19).replace('T', ' ');
    return { start: toSqlUtc(start), endExclusive: toSqlUtc(end) };
}
//# sourceMappingURL=local-date.util.js.map