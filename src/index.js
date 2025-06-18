//const OnStar = require('./deps/index.cjs');
const OnStar = require('onstarjs2');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const { Diagnostic } = require('./diagnostic');
const MQTT = require('./mqtt');
const Commands = require('./commands');
const logger = require('./logger');
const fs = require('fs');

// Detection monitoring functionality
const DetectionMonitor = {
    logAuthAttempt: (success, duration, error = null) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            success,
            duration,
            ...(error && { error: error.message }),
            ...(error?.response?.status && { statusCode: error.response.status })
        };
        
        try {
            const logPath = './data/authentication.log';
            const logDir = require('path').dirname(logPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
            
            if (success) {
                logger.info(`Authentication successful in ${(duration/1000).toFixed(1)}s`);
            } else {
                logger.warn(`Authentication failed after ${(duration/1000).toFixed(1)}s:`, error?.message);
            }
        } catch (e) {
            logger.error('Failed to log authentication attempt:', e.message);
        }
    },
    
    isDetected: (error) => {
        if (!error) return false;
        const message = error.message?.toLowerCase() || '';
        const status = error.response?.status;
        
        return status === 403 || status === 429 || 
               message.includes('blocked') || 
               message.includes('captcha') ||
               message.includes('bot detected') ||
               message.includes('akamai');
    }
};

let buttonConfigsPublished = '';
let refreshIntervalConfigPublished = '';

const onstarConfig = {
    deviceId: process.env.ONSTAR_DEVICEID || uuidv4(),
    vin: process.env.ONSTAR_VIN,
    username: process.env.ONSTAR_USERNAME,
    password: process.env.ONSTAR_PASSWORD,
    onStarTOTP: process.env.ONSTAR_TOTP,
    onStarPin: process.env.ONSTAR_PIN,
    tokenLocation: process.env.TOKEN_LOCATION || '',
    checkRequestStatus: _.get(process.env, 'ONSTAR_SYNC', 'true') === 'true',
    refreshInterval: parseInt(process.env.ONSTAR_REFRESH) || (30 * 60 * 1000), // 30 min
    requestPollingIntervalSeconds: parseInt(process.env.ONSTAR_POLL_INTERVAL) || 6, // 6 sec default
    requestPollingTimeoutSeconds: parseInt(process.env.ONSTAR_POLL_TIMEOUT) || 90, // 60 sec default
    allowCommands: _.get(process.env, 'ONSTAR_ALLOW_COMMANDS', 'true') === 'true',
    
    // Anti-detection configuration
    useEnhancedAuth: _.get(process.env, 'ONSTAR_USE_ENHANCED_AUTH', 'true') === 'true',
    stealthMode: _.get(process.env, 'ONSTAR_STEALTH_MODE', 'true') === 'true',
    userAgentRotation: _.get(process.env, 'ONSTAR_USER_AGENT_ROTATION', 'true') === 'true',
    humanDelays: _.get(process.env, 'ONSTAR_HUMAN_DELAYS', 'true') === 'true',
    maxRetryAttempts: parseInt(process.env.ONSTAR_MAX_RETRY_ATTEMPTS) || 3,
    retryBackoffMs: parseInt(process.env.ONSTAR_RETRY_BACKOFF_MS) || 5000
};

const onstarRequiredProperties = {
    vin: 'ONSTAR_VIN',
    username: 'ONSTAR_USERNAME',
    password: 'ONSTAR_PASSWORD',
    onStarTOTP: 'ONSTAR_TOTP',
    onStarPin: 'ONSTAR_PIN'
};

for (let prop in onstarRequiredProperties) {
    if (!onstarConfig[prop]) {
        throw new Error(`"${onstarRequiredProperties[prop]}" is not defined`);
    }
}

// Validate VIN
if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(onstarConfig.vin)) {
    throw new Error('Invalid VIN. Please check the value entered for VIN in ONSTAR_VIN.');
}

// Validate PIN
if (!/^\d{4}$/.test(onstarConfig.onStarPin)) {
    throw new Error('ONSTAR_PIN must be a 4-digit number');
}

if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('OnStar Config:', { onstarConfig });
} else {
    logger.info('OnStar Config:', { onstarConfig: { ...onstarConfig, password: '********', onStarTOTP: '***************', onStarPin: '####' } });
}

const mqttConfig = {
    host: process.env.MQTT_HOST || 'localhost',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: parseInt(process.env.MQTT_PORT) >= 0 ? parseInt(process.env.MQTT_PORT) : 1883,
    tls: process.env.MQTT_TLS === 'true',
    rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED !== 'false',
    prefix: process.env.MQTT_PREFIX || 'homeassistant',
    namePrefix: process.env.MQTT_NAME_PREFIX || '',
    pollingStatusTopic: process.env.MQTT_ONSTAR_POLLING_STATUS_TOPIC,
    listAllSensorsTogether: process.env.MQTT_LIST_ALL_SENSORS_TOGETHER === 'true',
    ca: process.env.MQTT_CA_FILE ? [fs.readFileSync(process.env.MQTT_CA_FILE)] : undefined,
    cert: process.env.MQTT_CERT_FILE ? fs.readFileSync(process.env.MQTT_CERT_FILE) : undefined,
    key: process.env.MQTT_KEY_FILE ? fs.readFileSync(process.env.MQTT_KEY_FILE) : undefined,
};

const mqttRequiredProperties = {
    username: 'MQTT_USERNAME',
    password: 'MQTT_PASSWORD',
    //pollingStatusTopic: 'MQTT_ONSTAR_POLLING_STATUS_TOPIC'    # No longer mandatory
};

for (let prop in mqttRequiredProperties) {
    if (!mqttConfig[prop]) {
        throw new Error(`"${mqttRequiredProperties[prop]}" is not defined`);
    }
}

if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('MQTT Config:', { mqttConfig });
} else {
    logger.info('MQTT Config:', { mqttConfig: { ...mqttConfig, password: '********', ca: undefined, cert: undefined, key: undefined } });
}

const init = () => {
    // Enhanced OnStar client with anti-detection features
    if (onstarConfig.useEnhancedAuth) {
        logger.info('Using enhanced OnStar client with anti-detection features');
        
        // Create enhanced config with anti-detection options
        const enhancedConfig = {
            ...onstarConfig,
            // Browser options for stealth mode
            browserOptions: {
                stealth: onstarConfig.stealthMode,
                userAgentRotation: onstarConfig.userAgentRotation,
                humanBehavior: onstarConfig.humanDelays,
                // Add proxy config if provided
                ...(process.env.ONSTAR_PROXY_SERVER && {
                    proxy: {
                        server: process.env.ONSTAR_PROXY_SERVER,
                        username: process.env.ONSTAR_PROXY_USERNAME,
                        password: process.env.ONSTAR_PROXY_PASSWORD
                    }
                })
            }
        };
        
        logger.debug('Enhanced config:', { 
            stealth: enhancedConfig.browserOptions.stealth,
            userAgentRotation: enhancedConfig.browserOptions.userAgentRotation,
            humanBehavior: enhancedConfig.browserOptions.humanBehavior,
            maxRetryAttempts: enhancedConfig.maxRetryAttempts
        });
        
        return new Commands(OnStar.create(enhancedConfig));
    } else {
        logger.info('Using standard OnStar client');
        return new Commands(OnStar.create(onstarConfig));
    }
};

const getVehicles = async commands => {
    logger.info('Requesting vehicles');
    const vehiclesRes = await commands.getAccountVehicles();
    logger.info('Vehicle request status:', { status: _.get(vehiclesRes, 'status') });
    const vehicles = _.map(
        _.get(vehiclesRes, 'response.data.vehicles.vehicle'),
        v => new Vehicle(v)
    );
    logger.debug('Vehicle request response:', { vehicles: _.map(vehicles, v => v.toString()) });
    return vehicles;
}

const getCurrentVehicle = async commands => {
    let lastError = null;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= onstarConfig.maxRetryAttempts; attempt++) {
        try {
            logger.info(`Getting vehicle information (attempt ${attempt}/${onstarConfig.maxRetryAttempts})`);
            const vehicles = await getVehicles(commands);
            const currentVeh = _.find(vehicles, v => v.vin.toLowerCase() === onstarConfig.vin.toLowerCase());
            
            if (!currentVeh) {
                throw new Error(`Configured vehicle VIN ${onstarConfig.vin} not available in account vehicles`);
            }
            
            // Success - log it
            DetectionMonitor.logAuthAttempt(true, Date.now() - startTime);
            return currentVeh;
            
        } catch (error) {
            lastError = error;
            logger.warn(`Vehicle request attempt ${attempt} failed:`, error.message);
            
            // Check if this looks like bot detection
            if (DetectionMonitor.isDetected(error)) {
                if (attempt < onstarConfig.maxRetryAttempts) {
                    const delay = onstarConfig.retryBackoffMs * Math.pow(2, attempt - 1);
                    const jitter = Math.random() * 1000;
                    const totalDelay = delay + jitter;
                    
                    logger.warn(`Bot detection suspected, waiting ${(totalDelay/1000).toFixed(1)}s before retry...`);
                    await new Promise(resolve => setTimeout(resolve, totalDelay));
                } else {
                    logger.error('Max retry attempts reached with suspected bot detection');
                }
            } else {
                // Non-detection error, don't retry
                break;
            }
        }
    }
    
    // Log the failure
    DetectionMonitor.logAuthAttempt(false, Date.now() - startTime, lastError);
    throw lastError || new Error('Authentication failed after all retry attempts');
};

const connectMQTT = async availabilityTopic => {
    const url = `${mqttConfig.tls ? 'mqtts' : 'mqtt'}://${mqttConfig.host}:${mqttConfig.port}`;

    if (!mqttConfig.tls) {
        mqttConfig.ca = undefined;
        mqttConfig.cert = undefined;
        mqttConfig.key = undefined;
    }

    const config = {
        username: mqttConfig.username,
        password: mqttConfig.password,
        rejectUnauthorized: mqttConfig.rejectUnauthorized,
        ca: mqttConfig.ca,
        cert: mqttConfig.cert,
        key: mqttConfig.key,
        will: { topic: availabilityTopic, payload: 'false', retain: true }
    };
    logger.info('Connecting to MQTT:', { url, config: _.omit(config, 'password', 'ca', 'cert', 'key') });

    const client = await mqtt.connectAsync(url, config);
    logger.info('Connected to MQTT!');
    return client;
}

const configureMQTT = async (commands, client, mqttHA) => {
    if (!onstarConfig.allowCommands)
        return;

    client.on('message', (topic, message) => {
        logger.debug(`Subscription message: ${topic, message}`);
        const { command, options } = JSON.parse(message);
        const cmd = commands[command];
        if (!cmd) {
            if (topic === mqttHA.getRefreshIntervalTopic()) {
                logger.info(`Processing refreshInterval`);
                return;
            } else {
                logger.error('Command not found', { command });
                return;
            }
        }

        const topicArray = _.concat({ topic }, '/', { command }.command, '/', 'state');
        const commandStatusTopic = topicArray.map(item => item.topic || item).join('');

        const commandStatusSensorConfig = mqttHA.createCommandStatusSensorConfigPayload(command, mqttConfig.listAllSensorsTogether);
        logger.debug("Command Status Sensor Config:", commandStatusSensorConfig);
        const commandStatusSensorTimestampConfig = mqttHA.createCommandStatusSensorTimestampConfigPayload(command, mqttConfig.listAllSensorsTogether);
        logger.debug("Command Status Sensor Timestamp Config:", commandStatusSensorTimestampConfig);

        const commandFn = cmd.bind(commands);
        logger.debug(`List of const: Command: ${command}, cmd: ${cmd}, commandFn: ${commandFn.toString()}, options: ${options}`);
        if (command === 'diagnostics' || command === 'enginerpm') {
            logger.warn('Command sent:', { command });
            logger.warn(`Command Status Topic: ${commandStatusTopic}`);
            client.publish(commandStatusSensorConfig.topic, JSON.stringify(commandStatusSensorConfig.payload), { retain: true });
            client.publish(commandStatusSensorTimestampConfig.topic, JSON.stringify(commandStatusSensorTimestampConfig.payload), { retain: true });
            client.publish(commandStatusTopic,
                JSON.stringify({
                    "command": {
                        "error": {
                            "message": "Sent",
                            "response": {
                                "status": 0,
                                "statusText": "Sent"
                            }
                        }
                    },
                    "completionTimestamp": new Date().toISOString()
                }), { retain: true });
            (async () => {
                const states = new Map();
                logger.debug(`Options in command async block: ${options}`)
                let diagnosticItem;
                if (options) {
                    diagnosticItem = options.split(',');
                } else {
                    diagnosticItem = undefined;
                }
                logger.debug("Diagnostic Item:", diagnosticItem)
                const statsRes = await commands[command]({ diagnosticItem });
                //logger.debug({ statsRes });
                logger.info('Diagnostic request status', { status: _.get(statsRes, 'status') });
                logger.debug('Diagnostic Response Body from Command', statsRes.response.data.commandResponse.body.diagnosticResponse);
                // Make sure the response is always an array
                const diagnosticResponses = _.get(statsRes, 'response.data.commandResponse.body.diagnosticResponse');
                const diagArray = Array.isArray(diagnosticResponses) ? diagnosticResponses : [diagnosticResponses];
                const stats = _.map(
                    diagArray,
                    (d, index) => {
                        logger.debug('Diagnostic Array', { ...d, number: index + 1 });
                        return new Diagnostic({ ...d, number: index + 1 });
                    }
                );
                logger.debug('stats', stats);
                logger.debug('Diagnostic request response:', { stats: _.map(stats, s => s.toString()) });
                for (const s of stats) {
                    // configure once, then set or update states
                    for (const d of s.diagnosticElements) {
                        mqttHA.getConfigTopic(d);
                        mqttHA.getConfigPayload(s, d);
                    }
                    const topic = mqttHA.getStateTopic(s);
                    const payload = mqttHA.getStatePayload(s);
                    states.set(topic, payload);
                }
                const publishes = [];
                for (let [topic, state] of states) {
                    logger.info('Publishing message:', { topic, state });
                    publishes.push(
                        client.publish(topic, JSON.stringify(state), { retain: true })
                    );
                }
                await Promise.all(publishes);
                // refactor the response handling for commands - Done!
                const completionTimestamp = new Date().toISOString();
                logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                logger.warn('Command completed:', { command });
                logger.warn(`Command Status Topic: ${commandStatusTopic}`);
                client.publish(
                    commandStatusTopic,
                    JSON.stringify({
                        "command": {
                            "error": {
                                "message": "Completed Successfully",
                                "response": {
                                    "status": 0,
                                    "statusText": "Completed Successfully"
                                }
                            }
                        },
                        "completionTimestamp": completionTimestamp
                    }), { retain: true }
                );
            })()
                .catch((e) => {
                    if (e instanceof Error) {
                        const completionTimestamp = new Date().toISOString();
                        logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                        const errorPayload = {
                            error: _.pick(e, [
                                'message',
                                'response.status',
                                'response.statusText',
                                'response.headers',
                                'response.data',
                                'request.method',
                                'request.body',
                                'request.contentType',
                                'request.headers',
                                'request.url',
                                'stack'
                            ])
                        };
                        //const errorJson = JSON.stringify(errorPayload);
                        logger.error('Command Error!', { command, error: errorPayload });
                        logger.error(`Command Status Topic for Errored Command: ${commandStatusTopic}`);
                        client.publish(commandStatusTopic,
                            JSON.stringify({
                                "command": errorPayload,
                                "completionTimestamp": completionTimestamp
                            }), { retain: true });
                    }
                })
        }
        else if (command === 'alert') {
            //const modifiedOptions = {
            //    action: 'action: ["' + options.action + '"]',
            //    delay: parseInt(options.delay) || 0, // handle invalid or missing delay
            //    duration: parseInt(options.duration) || 0, // handle invalid or missing duration
            //    override: 'override: ["' + options.override + '"]'
            //};

            let action, delay, duration, override;
            let actionArray = undefined;
            let overrideArray = undefined;

            if (!options) {
                action = undefined;
                delay = undefined;
                duration = undefined;
                override = undefined;
                logger.debug('Options is Undefined!')
                return;
            }
            else {
                action = options.action;
                logger.debug(`Action: ${action}`);
                delay = options.delay;
                logger.debug(`Delay: ${delay}`);
                duration = options.duration;
                logger.debug(`Duration: ${duration}`);
                override = options.override;
                logger.debug(`Override: ${override}`);
            }

            if (action === '' || action === undefined) {
                actionArray = undefined;
            } else {
                actionArray = action.split(',');
            }
            logger.debug(`Action Array: ${actionArray}`);

            if (override === '' || override === undefined) {
                overrideArray = undefined;
            } else {
                overrideArray = override.split(',');
            }
            logger.debug(`Override Array: ${overrideArray}`);

            let request = {
                action: actionArray || ["Flash", "Honk"],
                delay: delay || 0,
                duration: duration || 1,
                override: overrideArray || ["DoorOpen", "IgnitionOn"]
            }

            logger.warn('Command sent:', { command });
            //logger.debug(`Command sent: Command: ${ command }, ModifiedOptions: ${ modifiedOptions }`);

            logger.warn(`Command Status Topic: ${commandStatusTopic}`);
            client.publish(commandStatusSensorConfig.topic, JSON.stringify(commandStatusSensorConfig.payload), { retain: true });
            client.publish(commandStatusSensorTimestampConfig.topic, JSON.stringify(commandStatusSensorTimestampConfig.payload), { retain: true });
            client.publish(commandStatusTopic,
                JSON.stringify({
                    "command": {
                        "error": {
                            "message": "Sent",
                            "response": {
                                "status": 0,
                                "statusText": "Sent"
                            }
                        }
                    },
                    "completionTimestamp": new Date().toISOString()
                }), { retain: true });
            //commandFn(modifiedOptions || {})
            logger.debug(`Command sent: Command: ${command}, Request: ${JSON.stringify(request)}`);
            commands[command](request)
                .then(data => {
                    // refactor the response handling for commands - Done!
                    const completionTimestamp = new Date().toISOString();
                    logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                    logger.warn('Command completed:', { command });
                    logger.warn(`Command Status Topic: ${commandStatusTopic}`);
                    client.publish(
                        commandStatusTopic,
                        JSON.stringify({
                            "command": {
                                "error": {
                                    "message": "Completed Successfully",
                                    "response": {
                                        "status": 0,
                                        "statusText": "Completed Successfully"
                                    }
                                }
                            },
                            "completionTimestamp": completionTimestamp
                        }), { retain: true }
                    );
                    const responseData = _.get(data, 'response.data');
                    if (responseData) {
                        logger.warn('Command response data:', { responseData });
                    }
                })
                //.catch((err)=> {logger.error('Command error', {command, err})            
                //logger.info(commandStatusTopic);
                //client.publish(commandStatusTopic, CircularJSON.stringify({"Command": err}), {retain: true})});
                .catch((e) => {
                    if (e instanceof Error) {
                        const completionTimestamp = new Date().toISOString();
                        logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                        const errorPayload = {
                            error: _.pick(e, [
                                'message',
                                'response.status',
                                'response.statusText',
                                'response.headers',
                                'response.data',
                                'request.method',
                                'request.body',
                                'request.contentType',
                                'request.headers',
                                'request.url',
                                'stack'
                            ])
                        };
                        //const errorJson = JSON.stringify(errorPayload);
                        logger.error('Command Error!', { command, error: errorPayload });
                        logger.error(`Command Status Topic for Errored Command: ${commandStatusTopic}`);
                        client.publish(commandStatusTopic,
                            JSON.stringify({
                                "command": errorPayload,
                                "completionTimestamp": completionTimestamp
                            }), { retain: true });
                    }
                });
        }

        else {
            logger.warn('Command sent:', { command }, { options });
            logger.warn(`Command Status Topic: ${commandStatusTopic}`);
            client.publish(commandStatusSensorConfig.topic, JSON.stringify(commandStatusSensorConfig.payload), { retain: true });
            client.publish(commandStatusSensorTimestampConfig.topic, JSON.stringify(commandStatusSensorTimestampConfig.payload), { retain: true });
            client.publish(commandStatusTopic,
                JSON.stringify({
                    "command": {
                        "error": {
                            "message": "Sent",
                            "response": {
                                "status": 0,
                                "statusText": "Sent"
                            }
                        }
                    },
                    "completionTimestamp": new Date().toISOString()
                }), { retain: true });
            commandFn(options || {})
                .then(data => {
                    // refactor the response handling for commands - Done!
                    const completionTimestamp = new Date().toISOString();
                    logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                    logger.warn('Command completed:', { command });
                    logger.warn(`Command Status Topic: ${commandStatusTopic}`);
                    client.publish(
                        commandStatusTopic,
                        JSON.stringify({
                            "command": {
                                "error": {
                                    "message": "Completed Successfully",
                                    "response": {
                                        "status": 0,
                                        "statusText": "Completed Successfully"
                                    }
                                }
                            },
                            "completionTimestamp": completionTimestamp
                        }), { retain: true }
                    );
                    const responseData = _.get(data, 'response.data');
                    if (responseData) {
                        logger.warn('Command response data:', { responseData });
                        const location = _.get(data, 'response.data.commandResponse.body.location');
                        const speed = _.get(data, 'response.data.commandResponse.body.speed');
                        const direction = _.get(data, 'response.data.commandResponse.body.direction');
                        if (location) {
                            const topic = mqttHA.getStateTopic({ name: command });
                            const deviceTrackerConfigTopic = mqttHA.getDeviceTrackerConfigTopic();
                            const vehicle = mqttHA.vehicle.toString();

                            const locationData = {
                                latitude: parseFloat(location.lat),
                                longitude: parseFloat(location.long),
                                speed: parseFloat(speed.value),
                                direction: parseFloat(direction.value)
                            };

                            const deviceTrackerConfig = {
                                "json_attributes_topic": topic,
                                "name": vehicle,
                                "unique_id": MQTT.convertName(vehicle) + '_device_tracker_' + onstarConfig.vin,
                            };

                            logger.debug(vehicle)

                            client.publish(topic, JSON.stringify(locationData), { retain: true })

                            client.publish(deviceTrackerConfigTopic, JSON.stringify(deviceTrackerConfig), { retain: true })
                                .then(() => {
                                    logger.warn(`Published device_tracker config to topic: ${deviceTrackerConfigTopic}`);
                                    logger.warn(`Published location to topic: ${topic}`);
                                    logger.debug("Device Tracker Config:", deviceTrackerConfig);
                                })
                        }
                    }
                })
                //.catch((err)=> {logger.error('Command error', {command, err})            
                //logger.info(commandStatusTopic);
                //client.publish(commandStatusTopic, CircularJSON.stringify({"Command": err}), {retain: true})});
                .catch((e) => {
                    if (e instanceof Error) {
                        const completionTimestamp = new Date().toISOString();
                        logger.debug(`Completion Timestamp: ${completionTimestamp}`);
                        const errorPayload = {
                            error: _.pick(e, [
                                'message',
                                'response.status',
                                'response.statusText',
                                'response.headers',
                                'response.data',
                                'request.method',
                                'request.body',
                                'request.contentType',
                                'request.headers',
                                'request.url',
                                'stack'
                            ])
                        };
                        //const errorJson = JSON.stringify(errorPayload);
                        logger.error('Command Error!', { command, error: errorPayload });
                        logger.error(`Command Status Topic for Errored Command: ${commandStatusTopic}`);
                        client.publish(commandStatusTopic,
                            JSON.stringify({
                                "command": errorPayload,
                                "completionTimestamp": completionTimestamp
                            }), { retain: true });
                    }
                });
        }
    });
    const topic = mqttHA.getCommandTopic();
    logger.info(`Subscribed to command topic: ${topic}`);
    await client.subscribe(topic);

};

logger.info('!-- Starting OnStar2MQTT Polling --!');
(async () => {
    try {
        const commands = init();
        const vehicle = await getCurrentVehicle(commands);

        const mqttHA = new MQTT(vehicle, mqttConfig.prefix, mqttConfig.namePrefix);
        const availTopic = mqttHA.getAvailabilityTopic();
        const client = await connectMQTT(availTopic);
        client.publish(availTopic, 'true', { retain: true })
            .then(() => logger.debug('Published availability'));
        await configureMQTT(commands, client, mqttHA);

        const configurations = new Map();
        const run = async () => {
            let topicArray;
            if (!mqttConfig.pollingStatusTopic) {
                topicArray = _.concat(mqttHA.getPollingStatusTopic(), '/', 'state');
            } else {
                topicArray = _.concat(mqttConfig.pollingStatusTopic, '/', 'state');
            }
            const pollingStatusTopicState = topicArray.map(item => item.topic || item).join('');
            logger.info(`pollingStatusTopicState: ${pollingStatusTopicState}`);

            const pollingStatusMessagePayload = mqttHA.createPollingStatusMessageSensorConfigPayload(pollingStatusTopicState, mqttConfig.listAllSensorsTogether);
            logger.debug("pollingStatusMessagePayload:", pollingStatusMessagePayload);
            const pollingStatusCodePayload = mqttHA.createPollingStatusCodeSensorConfigPayload(pollingStatusTopicState, mqttConfig.listAllSensorsTogether);
            logger.debug("pollingStatusCodePayload:", pollingStatusCodePayload);
            const pollingStatusMessageTimestampPayload = mqttHA.createPollingStatusTimestampSensorConfigPayload(pollingStatusTopicState, mqttConfig.listAllSensorsTogether);
            logger.debug("pollingStatusMessageTimestampPayload:", pollingStatusMessageTimestampPayload);

            client.publish(pollingStatusTopicState,
                JSON.stringify({
                    "error": {
                        "message": "Pending Initialization of OnStar2MQTT",
                        "response": {
                            "status": -2000,
                            "statusText": "Pending Initialization of OnStar2MQTT"
                        }
                    },
                    "completionTimestamp": new Date().toISOString()
                }), { retain: false })

            if (!buttonConfigsPublished) {
                client.publish(pollingStatusMessagePayload.topic, JSON.stringify(pollingStatusMessagePayload.payload), { retain: true });
                client.publish(pollingStatusCodePayload.topic, JSON.stringify(pollingStatusCodePayload.payload), { retain: true });
                client.publish(pollingStatusMessageTimestampPayload.topic, JSON.stringify(pollingStatusMessageTimestampPayload.payload), { retain: true });
                logger.info(`Polling Status Message Sensors Published!`);
            }

            let topicArrayTF;
            if (!mqttConfig.pollingStatusTopic) {
                topicArrayTF = _.concat(mqttHA.getPollingStatusTopic(), '/', 'lastpollsuccessful');
            } else {
                topicArrayTF = _.concat(mqttConfig.pollingStatusTopic, '/', 'lastpollsuccessful');
            }
            const pollingStatusTopicTF = topicArrayTF.map(item => item.topic || item).join('');
            logger.info(`pollingStatusTopicTF, ${pollingStatusTopicTF}`);

            if (!buttonConfigsPublished) {
                const pollingStatusTFPayload = mqttHA.createPollingStatusTFSensorConfigPayload(pollingStatusTopicTF, mqttConfig.listAllSensorsTogether);
                logger.debug("pollingStatusTFPayload:", pollingStatusTFPayload);
                client.publish(pollingStatusTFPayload.topic, JSON.stringify(pollingStatusTFPayload.payload), { retain: true });
                logger.info(`Polling Status TF Sensor Published!`);
            }

            client.publish(pollingStatusTopicTF, "false", { retain: true });

            const states = new Map();
            const v = vehicle;
            logger.info('Requesting diagnostics');
            logger.debug(`GetSupported: ${v.getSupported()}`);

            if (!buttonConfigsPublished) {
                const sensors = [
                    { name: 'oil_life', component: null, icon: 'mdi:oil-level' },
                    { name: 'tire_pressure', component: 'tire_pressure_lf_message', icon: 'mdi:car-tire-alert' },
                    { name: 'tire_pressure', component: 'tire_pressure_lr_message', icon: 'mdi:car-tire-alert' },
                    { name: 'tire_pressure', component: 'tire_pressure_rf_message', icon: 'mdi:car-tire-alert' },
                    { name: 'tire_pressure', component: 'tire_pressure_rr_message', icon: 'mdi:car-tire-alert' },
                ];

                for (let sensor of sensors) {
                    const sensorMessagePayload = mqttHA.createSensorMessageConfigPayload(sensor.name, sensor.component, sensor.icon);
                    logger.debug(`Sensor Message Payload: ${sensor.name}, ${sensor.component}`, sensorMessagePayload);
                    client.publish(sensorMessagePayload.topic, JSON.stringify(sensorMessagePayload.payload), { retain: true });
                }
                logger.info(`Sensor Message Configs Published!`);
            }

            function publishButtonConfigs() {
                // Only run on initial startup
                if (!buttonConfigsPublished) {
                    // Get supported commands            
                    logger.debug(`Supported Commands: ${v.getSupportedCommands()}`);

                    // Get button configs and payloads
                    let tasks;
                    if (mqttConfig.listAllSensorsTogether === true) {
                        tasks = [
                            mqttHA.createButtonConfigPayload(v),
                        ];
                    } else {
                        tasks = [
                            mqttHA.createButtonConfigPayload(v),
                            mqttHA.createButtonConfigPayloadCSMG(v),
                        ];
                    }

                    tasks.forEach(({ buttonConfigs, configPayloads }, taskIndex) => {
                        // Publish button config and payload for each button in first set
                        buttonConfigs.forEach((buttonConfig, index) => {
                            const configPayload = configPayloads[index];
                            const buttonType = taskIndex === 0 ? "Button" : "Button for Command Status";
                            logger.warn(`${buttonType} Config Topic: ${JSON.stringify(buttonConfig)}`);
                            logger.debug(`${buttonType} Config Payload: ${JSON.stringify(configPayload)}`);

                            // Publish configPayload as the payload to the respective MQTT topic
                            logger.debug(`Publishing ${buttonType} Config: ${buttonConfig} Payload: ${JSON.stringify(configPayload)}`);
                            client.publish(buttonConfig, JSON.stringify(configPayload), { retain: true });
                        });
                    });
                    buttonConfigsPublished = 'true';
                    logger.info(`Button Configs Published!`);
                }
            }
            publishButtonConfigs();

            const statsRes = await commands.diagnostics({ diagnosticItem: v.getSupported() });
            logger.info('Diagnostic request status', { status: _.get(statsRes, 'status') });
            const stats = _.map(
                _.get(statsRes, 'response.data.commandResponse.body.diagnosticResponse'),
                d => new Diagnostic(d)
            );
            logger.debug('Diagnostic request response:', { stats: _.map(stats, s => s.toString()) });

            for (const s of stats) {
                if (!s.hasElements()) {
                    continue;
                }
                // configure once, then set or update states
                for (const d of s.diagnosticElements) {
                    const topic = mqttHA.getConfigTopic(d)
                    const payload = mqttHA.getConfigPayload(s, d);
                    configurations.set(topic, { configured: false, payload });
                }

                const topic = mqttHA.getStateTopic(s);
                const payload = mqttHA.getStatePayload(s);
                states.set(topic, payload);
            }
            const publishes = [];
            // publish sensor configs
            for (let [topic, config] of configurations) {
                // configure once
                if (!config.configured) {
                    config.configured = true;
                    const { payload } = config;
                    logger.info('Publishing message:', { topic, payload });
                    publishes.push(
                        client.publish(topic, JSON.stringify(payload), { retain: true })
                    );
                }
            }
            // update sensor states
            for (let [topic, state] of states) {
                logger.info('Publishing message:', { topic, state });
                publishes.push(
                    client.publish(topic, JSON.stringify(state), { retain: true })
                );
            }

            await Promise.all(publishes);

            const completionTimestamp = new Date().toISOString();
            logger.debug(`Completion Timestamp: ${completionTimestamp}`);
            //client.publish(pollingStatusTopicState, JSON.stringify({"ok":{"message":"Data Polled Successfully"}}), {retain: false});
            client.publish(pollingStatusTopicState,
                JSON.stringify({
                    "error": {
                        "message": "N/A",
                        "response": {
                            "status": 0,
                            "statusText": "N/A"
                        }
                    },
                    "completionTimestamp": completionTimestamp
                }), { retain: true })
            client.publish(pollingStatusTopicTF, "true", { retain: true });
        };

        const main = async () => run()

            .then(() => logger.info('Updates complete, sleeping.'))
            .catch((e) => {
                let topicArray;
                if (!mqttConfig.pollingStatusTopic) {
                    topicArray = _.concat(mqttHA.getPollingStatusTopic(), '/', 'state');
                } else {
                    topicArray = _.concat(mqttConfig.pollingStatusTopic, '/', 'state');
                }
                const pollingStatusTopicState = topicArray.map(item => item.topic || item).join('');
                logger.debug('pollingStatusTopicState', { pollingStatusTopicState });

                let topicArrayTF;
                if (!mqttConfig.pollingStatusTopic) {
                    topicArrayTF = _.concat(mqttHA.getPollingStatusTopic(), '/', 'lastpollsuccessful');
                } else {
                    topicArrayTF = _.concat(mqttConfig.pollingStatusTopic, '/', 'lastpollsuccessful');
                }
                const pollingStatusTopicTF = topicArrayTF.map(item => item.topic || item).join('');
                logger.debug('pollingStatusTopicTF', { pollingStatusTopicTF });

                if (e instanceof Error) {
                    const errorPayload = {
                        error: _.pick(e, [
                            'message',
                            'response.status',
                            'response.statusText',
                            'response.headers',
                            'response.data',
                            'request.method',
                            'request.body',
                            'request.contentType',
                            'request.headers',
                            'request.url',
                            'stack'
                        ])
                    };
                    //const errorJson = JSON.stringify(errorPayload);
                    const completionTimestamp = new Date().toISOString();
                    client.publish(pollingStatusTopicState,
                        JSON.stringify({
                            ...errorPayload,
                            "completionTimestamp": completionTimestamp
                        }), { retain: true })
                    logger.error('Error Polling Data:', { error: errorPayload });
                    client.publish(pollingStatusTopicTF, "false", { retain: true })

                } else {
                    //const errorJson = JSON.stringify({ error: e })
                    const completionTimestamp = new Date().toISOString();
                    client.publish(pollingStatusTopicState,
                        JSON.stringify({
                            ...{ error: e },
                            "completionTimestamp": completionTimestamp
                        }), { retain: true })
                    logger.error('Error Polling Data:', { error: e });
                    client.publish(pollingStatusTopicTF, "false", { retain: true })
                }
            });

        await main();

        let refreshInterval;
        const refreshIntervalTopic = mqttHA.getRefreshIntervalTopic();
        const refreshIntervalCurrentValTopic = mqttHA.getRefreshIntervalCurrentValTopic();
        logger.info(`refreshIntervalTopic: ${refreshIntervalTopic}`);
        logger.info(`refreshIntervalCurrentValTopic: ${refreshIntervalCurrentValTopic}`);

        if (!refreshIntervalConfigPublished) {
            const pollingRefreshIntervalPayload = mqttHA.createPollingRefreshIntervalSensorConfigPayload(refreshIntervalCurrentValTopic, mqttConfig.listAllSensorsTogether);
            logger.debug("pollingRefreshIntervalSensorConfigPayload:", pollingRefreshIntervalPayload);
            client.publish(pollingRefreshIntervalPayload.topic, JSON.stringify(pollingRefreshIntervalPayload.payload), { retain: true });
            refreshIntervalConfigPublished = 'true';
            logger.info(`Polling Refresh Interval Sensor Published!`);
        }

        // Subscribe to the topic
        client.subscribe(refreshIntervalTopic);
        // Set initial interval
        refreshInterval = setInterval(main, onstarConfig.refreshInterval);
        logger.info(`Initial refreshInterval: ${onstarConfig.refreshInterval}`);
        client.publish(refreshIntervalCurrentValTopic, onstarConfig.refreshInterval.toString(), { retain: true });
        //client.publish(refreshIntervalTopic, onstarConfig.refreshInterval.toString(), { retain: true });

        client.on('message', async (topic, message) => {
            if (topic === refreshIntervalTopic) {
                const newRefreshInterval = parseInt(message.toString());
                // Clear previous interval
                clearInterval(refreshInterval);
                // Start new interval with updated refresh interval
                refreshInterval = setInterval(main, newRefreshInterval);
                logger.info(`Updated refreshInterval to ${newRefreshInterval}`);
                client.publish(refreshIntervalCurrentValTopic, newRefreshInterval.toString(), { retain: true });
            }
        });

    } catch (e) {
        logger.error('Main function error:', { error: e });
    }
})();
