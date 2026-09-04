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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcryptjs"));
const users_repository_1 = require("../database/repositories/users.repository");
const roles_repository_1 = require("../database/repositories/roles.repository");
const jwt_secret_service_1 = require("./jwt-secret.service");
let AuthService = class AuthService {
    constructor(usersRepo, rolesRepo, jwtService, jwtSecret, config) {
        this.usersRepo = usersRepo;
        this.rolesRepo = rolesRepo;
        this.jwtService = jwtService;
        this.jwtSecret = jwtSecret;
        this.config = config;
    }
    async validateCredentials(username, password) {
        const user = this.usersRepo.findByUsername(username);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid username or password');
        }
        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
            throw new common_1.UnauthorizedException('Invalid username or password');
        }
        return this.toAuthenticatedUser(user.id);
    }
    toAuthenticatedUser(userId) {
        const user = this.usersRepo.findById(userId);
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const role = this.rolesRepo.findById(user.roleId);
        const permissions = role ? this.rolesRepo.getPermissionsForRole(role.id).map((p) => p.key) : [];
        return {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            isActive: user.isActive,
            roleId: user.roleId,
            roleName: role?.name ?? 'unknown',
            roleLabel: role?.label ?? 'Unknown',
            permissions,
        };
    }
    login(authUser) {
        const payload = {
            sub: authUser.id,
            username: authUser.username,
            roleName: authUser.roleName,
        };
        return {
            accessToken: this.jwtService.sign(payload, {
                secret: this.jwtSecret.getSecret(),
                expiresIn: this.config.get('JWT_EXPIRES_IN') || '12h',
            }),
            user: authUser,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository,
        roles_repository_1.RolesRepository,
        jwt_1.JwtService,
        jwt_secret_service_1.JwtSecretService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map