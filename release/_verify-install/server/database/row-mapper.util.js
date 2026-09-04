"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamel = toCamel;
exports.toCamelList = toCamelList;
function toCamel(row) {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
        const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}
function toCamelList(rows) {
    return rows.map((r) => toCamel(r));
}
//# sourceMappingURL=row-mapper.util.js.map