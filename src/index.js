const OnStar = require('onstarjs');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const {Diagnostic} = require('./diagnostic');
const MQTT = require('./mqtt');
const Commands = require('./commands');
const logger = require('./logger');

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
    const diagavailTopic = mqttHA.getDiagnosticAvailabilityTopic();
    const configurations = new Map();

    // publish an HA auto discovery topic for the device_tracker
    client.publish(mqttHA.getConfigTopic({ name: "getLocation" }), 
        JSON.stringify(mqttHA.getConfigPayload( {name: "getLocation"}, null)), {retain: true});


    // Concept:  other than "getLocation" and "diagnostics", the other commands could be considered
    //  buttons (and published as such to MQTT/HA.)  Then, the RESPONSE to the button presses 
    //  could be published as MQTT events.  
    //
    //      So, publish an MQTT button called "startVehicle" that has a config including:
    //          - button:
    //              command_topic: "homeassistant/VIN/command"  <-- use the generic command topic to KISS
    //              payload_press: "{ 'command' : 'startVehicle' }"
    //              retain: false
    //
    //      Then, so the user can check to see if the car was actually started:
    //          - event:
    //              state_topic: "homeassistant/VIN/events/startvehicle"  // note all lowercase
    //              event_types:
    //                  - "success"
    //                  - "failure"
    //              // something else for attributes so specific err info can be copied
    //
    //      Why not use a switch?  Because buttons/events better represent the paradigm presented
    //      by onstar.  A switch is a state that can be monitored, but onstar doesn't allow us
    //      to check if the car is currently running to turn off the "startVehicle" switch. We can
    //      only send the command (button) and see the immediate response (event.)
    //
    //      The buttons and events will have to have similar, but different, names.  For example,
    //      the button would be startVehicle and the event would be startVehicle-result. (I'm not 
    //      thrilled with that. Can an autodiscovery config topic have payloads for different 
    //      types of entities?  The state topics would absolutely have to be different... and that
    //      would really break the paradigm in mqtt.js.)
    //
    //      ... and it turns out that MQTT-events are broken.  That's fine.  To keep things easier
    //      for automations, just use a single "command_result" event.  Within that event, stuff
    //      all kinds of data, including the command sent, the success/failure state, a timestamp,
    //      a friendly name, and even a friendly message that can be directly copied to a notification.    

    const buttonCommands = [ 
        { cmd: 'startVehicle', friendlyName: "Start", icon: "mdi:car-key" }, 
        { cmd: 'cancelStartVehicle', friendlyName: "Cancel Start", icon: "mdi:car-off" }, 
        { cmd: 'alert', friendlyName: "Flash Lights and Honk Horn", icon: "mdi:alarm-light" }, 
        { cmd: 'alertFlash', friendlyName: "Flash Lights", icon: "mdi:alarm-light" }, 
        { cmd: 'alertHonk', friendlyName: "Honk Horn", icon: "mdi:alarm-light" }, 
        { cmd: 'lockDoor', friendlyName: "Lock Doors", icon: "mdi:car-door-lock" }, 
        { cmd: 'unlockDoor', friendlyName: "Unlock Doors", icon: "mdi:car-door" }, 
        { cmd: 'getLocation', friendlyName: "Get Location", icon: "mdi:map-marker", noevent: true }
    ];

    // map it to an array of objects to make things easier

    buttonCommands.forEach(cmd => {
        const [ ctopic, cpayload ] = mqttHA.getButtonConfig(cmd.cmd);
        if (cmd.icon)
            cpayload.icon = cmd.icon;
        if (cmd.friendlyName)
            cpayload.name = MQTT.convertFriendlyName(cpayload.name);

        logger.info('topic: ' + ctopic);
        logger.info('payload: ' + JSON.stringify(cpayload));
        client.publish(ctopic, JSON.stringify(cpayload), {retain: true});

        // just publish a single comment event and stick all the results in there
        const [ etopic, epayload ] = mqttHA.getEventConfig('command_result');
        client.publish(etopic, JSON.stringify(epayload), {retain: true});
        
    });
    

    // TODO: publish autodiscovery for a "number" representing the timer used for auto-polling
    //   diagnostics.  (This will have to subscribe to the message as well as publish to it.)

    // Ideally, would publish the autodiscovery topics for all the diagnostics here....
    //  HOWEVER, until I see a diagnostics response, I don't know what topics to create!  I can figure out
    //  what diagnosticItems the vehicle supports, but there's no 1:1 relationship between that and the stuff that
    //  the mqtt.js creates from the returned JSON.  Therefore, leave that diagnostics discovery topic stuff
    //  alone.

    // get the mqtt client listening for messages...
    client.on('message', (topic, message) => {
        logger.debug('Incoming subscription message', {topic, message});
        var {command, options} = JSON.parse(message);
        const cmd = commands[command];
        if (!cmd) {
            logger.error('Command not found', {command});
            return;
        }
        const cmdObj = buttonCommands.find(( c ) => c.cmd === command);
        const cmdFriendlyName = (cmdObj && cmdObj.friendlyName) ? cmdObj.friendlyName : command;

        const commandFn = cmd.bind(commands);
        // special case:  if a "diagnostics" command is used and no options are specified, default to all supported diagnostic items
        if ((command == 'diagnostics') && !options) {
            options = { diagnosticItem: vehicle.getSupported() };
        }

        logger.info('Sending command request to onstar: ', { command });
        commandFn(options || {}) // this will always throw a RequestError on failure, so "success" can be assumed outside the catch block
            .then(data => {
                logger.info('onstart completed successfully: ', { command });
                logger.debug(`Status: ${data.status}, response: ` + JSON.stringify(data.response.data));
                switch (command) {
                    case 'getLocation': 
                        {
                            const location = _.get(data, 'response.data.commandResponse.body.location');
                            client.publish(mqttHA.getStateTopic({ name: command }),
                            JSON.stringify({ latitude: Number(location.lat), longitude: Number(location.long) }), { retain: true })
                            .then(() => logger.info('Published device_tracker topic.'));
                        }
                        break;

                    case 'diagnostics': 
                        {
                            // mark diagnostics as available
                            client.publish(diagavailTopic, 'true', {retain: true});
                            const diag = _.get(data, 'response.data.commandResponse.body.diagnosticResponse');
                            const states = new Map();

                            const stats = _.map(diag, d => new Diagnostic(d));
                            for (const s of stats) {
                                if (!s.hasElements()) {
                                    continue;
                                }
                                // configure once, then set or update states
                                for (const d of s.diagnosticElements) {
                                    const topic = mqttHA.getConfigTopic(d)
                                    const payload = mqttHA.getConfigPayload(s, d);
                                    // this resets "configured" and the payload every single time a diag response comes back!!!
                                    // configurations.set(topic, {configured: false, payload});
                                    
                                    // this, however, will only set if it doesn't exist yet, and therefore leave 'configured' unchanged
                                    if (!configurations.has(topic))
                                        configurations.set(topic, {configured: false, payload});
                                }
                                const topic = mqttHA.getStateTopic(s);
                                const payload = mqttHA.getStatePayload(s);
                                states.set(topic, payload);
                            }

                            // publish sensor configs
                            for (let [topic, config] of configurations) {
                                // configure once
                                if (!config.configured) {
                                    config.configured = true;
                                    const {payload} = config;
                                    logger.debug('Publishing discovery topic: ', {topic});
                                    client.publish(topic, JSON.stringify(payload), {retain: true});
                                }
                            }

                            // update sensor states
                            for (let [topic, state] of states) {
                                logger.info('Publishing message', {topic, state});
                                    client.publish(topic, JSON.stringify(state), {retain: true});
                            }
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
                        // Build up a single "command_result" event with anything the user might want in
                        // the payload.  The "event_type" is required for MQTT events (even if they are
                        // broken at the moment, assume they might work some day.)
                        var resultEvent = { event_type: "success", 
                            friendlyName : cmdFriendlyName, 
                            command, 
                            timestamp : new Date(Date.now()).toISOString(),
                            friendlyMessage : `The "${cmdFriendlyName}" command was successful.` 
                        };
                        if (command == "getChargingProfile") 
                            resultEvent.response = _.get(data, 'response.data.commandResponse.body');                        
                        client.publish(mqttHA.getEventStateTopic('command_result'), JSON.stringify(resultEvent), {retain: false});
                } // switch
            })
            .catch(err => {
                if (err instanceof Error) {                    
                    logger.error('Error', {error: _.pick(err, [
                        'message', 'stack',
                        'response.status', 'response.statusText', 'response.headers', 'response.data',
                        'request.method', 'request.body', 'request.contentType', 'request.headers', 'request.url'
                        ])});
                    // see commands above on the contents of resultEvent.
                    // publish that the command failed. 
                    const topic = mqttHA.getEventStateTopic('command_result');
                    var resultEvent = { event_type: "failure", 
                        friendlyName : cmdFriendlyName, 
                        command, 
                        timestamp : new Date(Date.now()).toISOString(),
                        friendlyMessage : `The "${cmdFriendlyName}" command failed.` 
                    };
                    // in addition, if this was a diagnostics command, mark all the diagnostic entities as unavailable...
                    if (command == "diagnostics")
                        client.publish(diagavailTopic, 'false', {retain: true})
                    else
                        client.publish(topic, JSON.stringify(resultEvent), {retain: false});
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

        const run = async () => {
            logger.info('Requesting diagnostics');
            client.publish(mqttHA.getCommandTopic(),  JSON.stringify({command : 'diagnostics'}));
        };

        const main = async () => run()
            .then(() => logger.info(`Updates requested, sleeping for ${onstarConfig.refreshInterval / 60000} minutes.`))
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
