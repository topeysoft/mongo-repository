"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function sanitizeModelName(name) {
    name = name || '';
    var clean = name.replace(/[^\w]/gi, '_') || '';
    return clean.toLowerCase();
}
exports.sanitizeModelName = sanitizeModelName;
//# sourceMappingURL=name.sanitizer.js.map