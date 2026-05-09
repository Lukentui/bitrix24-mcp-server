export class Logger {
    static info(message, data) {
        console.error(`[INFO] ${new Date().toISOString()}: ${message}`, data || '');
    }
    static error(message, error) {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '');
    }
    static warn(message, data) {
        console.error(`[WARN] ${new Date().toISOString()}: ${message}`, data || '');
    }
    static debug(message, data) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`[DEBUG] ${new Date().toISOString()}: ${message}`, data || '');
        }
    }
}
//# sourceMappingURL=logger.js.map