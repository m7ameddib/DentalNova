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
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const version_1 = require("./common/version");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger = new common_1.Logger('Bootstrap');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: true });
    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.setGlobalPrefix('api');
    const serveClient = process.env.SERVE_CLIENT === '1' || process.env.NODE_ENV === 'production';
    if (serveClient) {
        const candidates = [
            path.join(__dirname, '..', 'public'),
            path.join(process.cwd(), 'public'),
            path.join(__dirname, '..', '..', 'client', 'dist'),
            path.join(process.cwd(), 'client', 'dist'),
        ];
        const clientDist = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
        if (clientDist) {
            const indexHtml = path.join(clientDist, 'index.html');
            app.useStaticAssets(clientDist, { index: false });
            app.use((req, res, next) => {
                if (req.path.startsWith('/api'))
                    return next();
                res.sendFile(indexHtml);
            });
            logger.log(`Serving DNT Dental client from ${clientDist}`);
        }
        else {
            logger.warn('SERVE_CLIENT enabled but client dist not found');
        }
    }
    const host = process.env.HOST || '0.0.0.0';
    const port = process.env.PORT ? Number(process.env.PORT) : 4000;
    await app.listen(port, host);
    logger.log(`DNT Dental v${version_1.APP_VERSION} API on http://${host}:${port}/api`);
    const shutdown = async (signal) => {
        logger.log(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
bootstrap();
//# sourceMappingURL=main.js.map