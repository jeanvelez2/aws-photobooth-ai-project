import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// Context storage for correlation IDs
export const correlationContext = new AsyncLocalStorage<{ correlationId: string; userId?: string }>();

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const context = correlationContext.getStore();
    const logEntry = {
      ...info,
      timestamp: info.timestamp,
      service: 'ai-photobooth-backend',
      environment: process.env.NODE_ENV || 'development',
      correlationId: context?.correlationId,
      userId: context?.userId,
    };

    // Remove undefined values
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key as keyof typeof logEntry] === undefined) {
        delete logEntry[key as keyof typeof logEntry];
      }
    });

    return JSON.stringify(logEntry);
  })
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const context = correlationContext.getStore();
    const correlationId = context?.correlationId ? `[${context.correlationId}]` : '';
    const userId = context?.userId ? `[user:${context.userId}]` : '';
    return `${info.timestamp} ${info.level}: ${correlationId}${userId} ${info.message}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { service: 'ai-photobooth-backend' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat,
    }),
  ],
});

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: structuredFormat,
    })
  );
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: structuredFormat,
    })
  );
}

// Enhanced logger interface with correlation context
export interface LogContext {
  correlationId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  error?: Error | string;
  [key: string]: any;
}

export const createLogger = (defaultContext: LogContext = {}) => {
  return {
    debug: (message: string, context: LogContext = {}) => {
      logger.debug(sanitizeLogMessage(message), sanitizeLogContext({ ...defaultContext, ...context }));
    },
    info: (message: string, context: LogContext = {}) => {
      logger.info(sanitizeLogMessage(message), sanitizeLogContext({ ...defaultContext, ...context }));
    },
    warn: (message: string, context: LogContext = {}) => {
      logger.warn(sanitizeLogMessage(message), sanitizeLogContext({ ...defaultContext, ...context }));
    },
    error: (message: string, context: LogContext = {}) => {
      logger.error(sanitizeLogMessage(message), sanitizeLogContext({ ...defaultContext, ...context }));
    },
  };
};

// Log sanitization functions
const sanitizeLogMessage = (message: string): string => {
  if (typeof message !== 'string') return String(message);
  return message.replace(/[\r\n\t]/g, ' ').trim();
};

const sanitizeLogContext = (context: LogContext): LogContext => {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/[\r\n\t]/g, ' ').trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Utility function to generate correlation IDs
export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
