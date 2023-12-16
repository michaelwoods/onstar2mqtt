const OnStar = require('onstarjs');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const {Diagnostic} = require('./diagnostic');
const MQTT = require('./mqtt');
const Commands = require('./commands');
const logger = require('./logger');
const { log } = require('winston');


const onstarConfig = {
    deviceId: process.env.ONSTAR_DEVICEID || uuidv4(),
    vin: process.env.ONSTAR_VIN,
    username: process.env.ONSTAR_USERNAME,
    password: process.env.ONSTAR_PASSWORD,
    onStarPin: process.env.ONSTAR_PIN,
    checkRequestStatus: _.get(process.env, 'ONSTAR_SYNC', 'true') === 'true',
    refreshInterval: parseInt(process.env.ONSTAR_REFRESH) || (30 * 60 * 1000), // 30 min
    requestPollingIntervalSeconds: parseInt(process.env.ONSTAR_POLL_INTERVAL) || 6, // 6 sec default
    requestPollingTimeoutSeconds: parseInt(process.env.ONSTAR_POLL_TIMEOUT) || 60, // 60 sec default
    allowCommands: _.get(process.env, 'ONSTAR_ALLOW_COMMANDS', 'true') === 'true'
};
logger.info('OnStar Config', {onstarConfig});

const mqttConfig = {
    host: process.env.MQTT_HOST || 'localhost',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: parseInt(process.env.MQTT_PORT) || 1883,
    tls: process.env.MQTT_TLS || false,
    prefix: process.env.MQTT_PREFIX || 'homeassistant',
    namePrefix: process.env.MQTT_NAME_PREFIX || '',
};
logger.info('MQTT Config', {mqttConfig});

const init = () =>  new Commands(OnStar.create(onstarConfig));

const getVehicles = async commands => {
    logger.info('Requesting vehicles');
    const vehiclesRes = await commands.getAccountVehicles();
    logger.info('Vehicle request status', {status: _.get(vehiclesRes, 'status')});
    const vehicles = _.map(
        _.get(vehiclesRes, 'response.data.vehicles.vehicle'),
        v => new Vehicle(v)
    );
    logger.debug('Vehicle request response', {vehicles: _.map(vehicles, v => v.toString())});
    return vehicles;
}

const getCurrentVehicle = async commands => {
    const vehicles = await getVehicles(commands);
    const currentVeh = _.find(vehicles, v => v.vin.toLowerCase() === onstarConfig.vin.toLowerCase()); 
    if (!currentVeh) {
        throw new Error(`Configured vehicle VIN ${onstarConfig.vin} not available in account vehicles`);
    }
    return currentVeh;
}

const connectMQTT = async availabilityTopic => {
    const url = `${mqttConfig.tls ? 'mqtts' : 'mqtt'}://${mqttConfig.host}:${mqttConfig.port}`;
    const config = {
        username: mqttConfig.username,
        password: mqttConfig.password,
        will: {topic: availabilityTopic, payload: 'false', retain: true}
    };
    logger.info('Connecting to MQTT', {url, config: _.omit(config, 'password')});
    const client = await mqtt.connectAsync(url, config);
    logger.info('Connected to MQTT');
    return client;
}

const configureMQTT = async (vehicle, commands, client, mqttHA) => {

    if (!onstarConfig.allowCommands)
        return;
    const availTopic = mqttHA.getAvailabilityTopic();
    const configurations = new Map();

    // publish an HA auto discovery topic for the device_tracker
    client.publish(mqttHA.getConfigTopic({ name: "getLocation" }), 
        JSON.stringify(mqttHA.getConfigPayload( {name: "getLocation"}, null)), {retain: true});

    // TODO: publish for any buttons (start, cancelstart, lock, unlock, etc, etc)


    // TODO: ideally, would publish for all the possible diagnostics...  (this will require a ton of work in mqtt.js)

    // get the mqtt client listening for messages...
    client.on('message', (topic, message) => {
        logger.debug('Subscription message', {topic, message});
        var {command, options} = JSON.parse(message);
        const cmd = commands[command];
        if (!cmd) {
            logger.error('Command not found', {command});
            return;
        }
        const commandFn = cmd.bind(commands);
        // special case:  if a "diagnostics" command is used and no options are specified, default to all supported diagnostic items
        if ((command == 'diagnostics') && !options) {
            options = { diagnosticItem: vehicle.getSupported() };
        }

        logger.info('Command sent', { command });
        commandFn(options || {}) // this will always throw a RequestError on failure, so "success" can be assumed outside the catch block
            .then(data => {
                // TODONE refactor the response handling for commands
                logger.info('Command completed', { command });
                logger.debug(`Status: ${data.status}, response: ` + JSON.stringify(data.response.data));
                const responseData = _.get(data, 'response.data'); 
                switch (command) {
                    case 'getLocation': 
                        const location = _.get(data, 'response.data.commandResponse.body.location');
                        client.publish(mqttHA.getStateTopic({ name: command }),
                            JSON.stringify({ latitude: Number(location.lat), longitude: Number(location.long) }), { retain: true })
                            .then(() => logger.info('Published device_tracker topic.'));
                        break;

                    case 'diagnostics': 
                        {
                            const diag = _.get(data, 'response.data.commandResponse.body.diagnosticResponse');
                            const states = new Map();
                            const v = vehicle;

                            logger.info('got diagnostic response');
                            const stats = _.map(diag, d => new Diagnostic(d));
                            logger.debug('Diagnostic request response', {stats: _.map(stats, s => s.toString())});
                            for (const s of stats) {
                                if (!s.hasElements()) {
                                    continue;
                                }
                                // configure once, then set or update states
                                for (const d of s.diagnosticElements) {
                                    const topic = mqttHA.getConfigTopic(d)
                                    const payload = mqttHA.getConfigPayload(s, d);
                                    configurations.set(topic, {configured: false, payload});
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
                                    const {payload} = config;
    //                                logger.debug('Publishing message', {topic, payload});
                                    publishes.push(
                                        client.publish(topic, JSON.stringify(payload), {retain: true})
                                    );
                                }
                            }

                            // update sensor states
                            for (let [topic, state] of states) {
                                logger.info('Publishing message', {topic, state});
                                publishes.push(
                                    client.publish(topic, JSON.stringify(state), {retain: true})
                                );
                            }
                            Promise.all(publishes);
                        }
                        break;

                    default:
                        // this will be a "success" response to a command other than diagnostics or location.
                        // (Any failures or timeouts throw exceptions, so we know it's a success.)
                        // response.data.commandResponse.body may contain useful information that varies depending on
                        // the command.  From testing:
                        //  start/cancelStart - has elements for cabin preconditioning, start time, cabin temp, etc - but none of it has valid data (for my car)
                        //  lock/unlock - null body
                        //  getChargingProfile's body has chargingProfile.chargeMode (IMMEDIATE) and chargingProfile.rateType (PEAK)
                        //  setChargingProfile - null body
                        //  alert/cancelAlert - null body
                        
                        // So, the only thing that might have a useful response is getChargingProfile.
                        // Now, the question is... how do I get the response back to the user?  For now, just publish a 
                        // sensor topic (ie: /homeassistant/vin/sensor/cancelalert) with a payload of either the word "success" or
                        // any useful information.
                        client.publish(mqttHA.getStateTopic({ name: command }), 
                            (command == "getChargingProfile") 
                                ?  JSON.stringify(_.get(data, 'response.data.commandResponse.body')) 
                                : "success", 
                            {retain: false});
                } // switch
            })
            .catch(err => {
                if (err instanceof Error) {                    
                    logger.error('Error', {error: _.pick(err, [
                        'message', 'stack',
                        'response.status', 'response.statusText', 'response.headers', 'response.data',
                        'request.method', 'request.body', 'request.contentType', 'request.headers', 'request.url'
                        ])});
                    // publish that the command failed.
                    client.publish(mqttHA.getStateTopic({ name: command }), "failure", {retain: false});
                    // in addition, if this was a diagnostics command, mark all the diagnostic entities as unavailable...
                } else {
                    logger.error('Error', {error: err});
                }
            });

    });
    const topic = mqttHA.getCommandTopic();
    logger.info('Subscribing to command topic', {topic});
    await client.subscribe(topic);
};

(async () => {
    try {
        const commands = init();
        const vehicle = await getCurrentVehicle(commands);

        const mqttHA = new MQTT(vehicle, mqttConfig.prefix, mqttConfig.namePrefix);
        const availTopic = mqttHA.getAvailabilityTopic();
        const client = await connectMQTT(availTopic);
        client.publish(availTopic, 'true', {retain: true})
            .then(() => logger.debug('Published availability'));
        
        await configureMQTT(vehicle, commands, client, mqttHA);

        const configurations = new Map();
        const run = async () => {
            const states = new Map();
            const v = vehicle;
            logger.info('Requesting diagnostics');
            client.publish(mqttHA.getCommandTopic(),  JSON.stringify({command : 'diagnostics'}));
        };

        const main = async () => run()
            .then(() => logger.info('Updates complete, sleeping.'))
            .catch(e => {
                if (e instanceof Error) {
                    logger.error('Error', {error: _.pick(e, [
                        'message', 'stack',
                        'response.status', 'response.statusText', 'response.headers', 'response.data',
                        'request.method', 'request.body', 'request.contentType', 'request.headers', 'request.url'
                        ])});
                } else {
                    logger.error('Error', {error: e});
                }
            });

        await main();
        setInterval(main, onstarConfig.refreshInterval);
    } catch (e) {
        logger.error('Main function error.', {error: e});
        logger.error('Stack: ' + e.stack);
    }
})();
