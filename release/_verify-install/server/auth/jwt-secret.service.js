"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtSecretService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const paths_service_1 = require("../common/paths.service");
let JwtSecretService = class JwtSecretService {
    constructor(config, paths) {
        this.config = config;
        this.paths = paths;
        this.secret = this.readInitialSecret();
    }
    getSecret() {
        return this.secret;
    }
    setSecret(next) {
        this.paths.writeJwtSecret(next);
        this.secret = next;
    }
    reloadFromDisk() {
        this.secret = this.readInitialSecret();
    }
    readInitialSecret() {
        const fromFile = this.paths.readJwtSecret();
        if (fromFile)
            return fromFile;
        return this.config.get('JWT_SECRET') || 'dev-secret';
    }
};
exports.JwtSecretService = JwtSecretService;
exports.JwtSecretService = JwtSecretService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        paths_service_1.PathsService])
], JwtSecretService);
//# sourceMappingURL=jwt-secret.service.js.map