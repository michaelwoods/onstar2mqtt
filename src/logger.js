const winston = require('winston');
const _ = require('lodash');

const logger = winston.createLogger({
    level: _.get(process, 'env.LOG_LEVEL', 'info'),
    format: winston.format.simple(),
    // format: winston.format.json(),
    transports: [new winston.transports.Console({stderrLevels: ['error']})]
})


module.exports = logger;