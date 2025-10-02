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
      logger.debug(message, { ...defaultContext, ...context });
    },
    info: (message: string, context: LogContext = {}) => {
      logger.info(message, { ...defaultContext, ...context });
    },
    warn: (message: string, context: LogContext = {}) => {
      logger.warn(message, { ...defaultContext, ...context });
    },
    error: (message: string, context: LogContext = {}) => {
      logger.error(message, { ...defaultContext, ...context });
    },
  };
};

// Utility function to generate correlation IDs
export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
