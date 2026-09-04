"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let LicenseService = class LicenseService {
    constructor() {
        this.publicKeyPem = null;
    }
    loadPublicKey() {
        if (this.publicKeyPem)
            return this.publicKeyPem;
        const keyPath = path.join(process.cwd(), 'keys', 'license-public.pem');
        if (!fs.existsSync(keyPath)) {
            throw new common_1.BadRequestException('License verification key is not configured on this server.');
        }
        this.publicKeyPem = fs.readFileSync(keyPath, 'utf-8');
        return this.publicKeyPem;
    }
    parseAndVerify(licenseText) {
        const trimmed = licenseText.trim();
        const dot = trimmed.lastIndexOf('.');
        if (dot <= 0) {
            throw new common_1.BadRequestException('Invalid license format.');
        }
        const payloadB64 = trimmed.slice(0, dot);
        const sigB64 = trimmed.slice(dot + 1);
        let payloadJson;
        let signature;
        try {
            payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
            signature = Buffer.from(sigB64, 'base64url');
        }
        catch {
            throw new common_1.BadRequestException('Invalid license encoding.');
        }
        let payload;
        try {
            payload = JSON.parse(payloadJson);
        }
        catch {
            throw new common_1.BadRequestException('Invalid license payload.');
        }
        if (payload.product !== 'DNT Dental') {
            throw new common_1.BadRequestException('This license is not for DNT Dental.');
        }
        if (!payload.clinicId || !payload.licenseId || !payload.issuedAt || !payload.installationId?.trim()) {
            throw new common_1.BadRequestException('License payload is missing required fields (including installation ID).');
        }
        if (payload.expiresAt) {
            const expiry = new Date(payload.expiresAt);
            if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
                throw new common_1.BadRequestException('This license has expired.');
            }
        }
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(payloadJson);
        verifier.end();
        const ok = verifier.verify(this.loadPublicKey(), signature);
        if (!ok) {
            throw new common_1.BadRequestException('License signature verification failed.');
        }
        return payload;
    }
};
exports.LicenseService = LicenseService;
exports.LicenseService = LicenseService = __decorate([
    (0, common_1.Injectable)()
], LicenseService);
//# sourceMappingURL=license.service.js.map