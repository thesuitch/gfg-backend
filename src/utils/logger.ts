const log = (level: string, message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  switch (level) {
    case 'error':
      console.error(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'info':
      console.info(prefix, message, ...args);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.log(prefix, message, ...args);
      }
      break;
    default:
      console.log(prefix, message, ...args);
  }
};

export const logger = {
  error: (message: string, ...args: any[]) => log('error', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
  log: (message: string, ...args: any[]) => log('log', message, ...args)
};
