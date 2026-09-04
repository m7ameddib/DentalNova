"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const permissions_guard_1 = require("./guards/permissions.guard");
const users_repository_1 = require("../database/repositories/users.repository");
const roles_repository_1 = require("../database/repositories/roles.repository");
const jwt_secret_service_1 = require("./jwt-secret.service");
const paths_service_1 = require("../common/paths.service");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            passport_1.PassportModule,
            config_1.ConfigModule,
            jwt_1.JwtModule.register({}),
        ],
        providers: [
            paths_service_1.PathsService,
            jwt_secret_service_1.JwtSecretService,
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            permissions_guard_1.PermissionsGuard,
            users_repository_1.UsersRepository,
            roles_repository_1.RolesRepository,
        ],
        controllers: [auth_controller_1.AuthController],
        exports: [auth_service_1.AuthService, permissions_guard_1.PermissionsGuard, jwt_secret_service_1.JwtSecretService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map