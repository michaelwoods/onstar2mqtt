const _ = require('lodash');

/**
 * Supports Home Assistant MQTT Discovery (https://www.home-assistant.io/docs/mqtt/discovery/)
 *
 * Supplies sensor configuration data and initialize sensors in HA.
 *
 * Topic format: prefix/type/instance/name
 * Examples:
 * - homeassistant/sensor/VIN/TIRE_PRESSURE/state -- Diagnostic
 *      - payload: {
 *          TIRE_PRESSURE_LF: 244.0,
 *          TIRE_PRESSURE_LR: 240.0,
 *          TIRE_PRESSURE_PLACARD_FRONT: 262.0,
 *          TIRE_PRESSURE_PLACARD_REAR: 262.0,
 *          TIRE_PRESSURE_RF: 240.0,
 *          TIRE_PRESSURE_RR: 236.0,
 *      }
 * - homeassistant/sensor/VIN/TIRE_PRESSURE_LF/config -- Diagnostic Element
 *      - payload: {
 *          device_class: "pressure",
 *          name: "Tire Pressure: Left Front",
 *          state_topic: "homeassistant/sensor/VIN/TIRE_PRESSURE/state",
 *          unit_of_measurement: "kPa",
 *          value_template: "{{ value_json.TIRE_PRESSURE_LF }}",
 *          json_attributes_template: "{{ {'recommendation': value_json.TIRE_PRESSURE_PLACARD_FRONT} | tojson }}"
 *      }
 * - homeassistant/sensor/VIN/TIRE_PRESSURE_RR/config -- Diagnostic Element
 *      - payload: {
 *          device_class: "pressure",
 *          name: "Tire Pressure: Right Rear",
 *          state_topic: "homeassistant/sensor/VIN/TIRE_PRESSURE/state",
 *          unit_of_measurement: "kPa",
 *          value_template: "{{ value_json.TIRE_PRESSURE_RR }}",
 *          json_attributes_template: "{{ {'recommendation': value_json.TIRE_PRESSURE_PLACARD_REAR} | tojson }}"
 *      }
 */
class MQTT {
    constructor(vehicle, prefix = 'homeassistant', namePrefix) {
        this.prefix = prefix;
        this.vehicle = vehicle;
        this.instance = vehicle.vin;
        this.namePrefix = namePrefix
    }

    static convertName(name) {
        return _.toLower(_.replace(name, / /g, '_'));
    }

    static convertFriendlyName(name) {
        return _.startCase(_.lowerCase(name));
    }

    static determineSensorType(name) {
        switch (name) {
            case 'EV CHARGE STATE':
            case 'EV PLUG STATE':
            case 'PRIORITY CHARGE INDICATOR':
            case 'PRIORITY CHARGE STATUS':
                return 'binary_sensor';
            case 'getLocation':
                return 'device_tracker';
            default:
                return 'sensor';
        }
    }

    /**
     * @param {string} name
     * @returns {string}
     */
    addNamePrefix(name) {
        if (!this.namePrefix) return name
        return `${this.namePrefix} ${name}`
    }

    /**
     * @param {'sensor'|'binary_sensor'|'device_tracker'} type
     * @returns {string}
     */
    getBaseTopic(type = 'sensor') {
        return `${this.prefix}/${type}/${this.instance}`;
    }

    getAvailabilityTopic() {
        return `${this.prefix}/${this.instance}/available`;
    }

    // Add an additional availability topic for just diagnostics
    getDiagnosticAvailabilityTopic() {
        return `${this.prefix}/${this.instance}/diagsavailable`;
    }

    getCommandTopic() {
        return `${this.prefix}/${this.instance}/command`;
    }

    /**
     *
     * @param {DiagnosticElement} diag
     */
    getConfigTopic(diag) {
        let sensorType = MQTT.determineSensorType(diag.name);
        return `${this.getBaseTopic(sensorType)}/${MQTT.convertName(diag.name)}/config`;
    }

    getButtonConfig(cmd) {        
        return [`${this.getBaseTopic('button')}/${MQTT.convertName(cmd)}/config`, this.mapButtonConfigPayload(cmd) ];
        // return [ `${this.getBaseTopic('button')}/${MQTT.convertName(cmd)}/config`, `${this.getBaseTopic('event')}/${MQTT.convertName(cmd + '_result')}/config` ]
        // ie: [ 'homeassistant/button/VIN/startvehicle/config' , 'homeassistant/event/VIN/startvehicle_result/config' ]
    }
    getEventConfig(cmd) {
        return [`${this.getBaseTopic('event')}/${MQTT.convertName(cmd)}/config`, this.mapEventConfigPayload(cmd) ];
    }
    /**
     *
     * @param {Diagnostic} diag
     */
    getStateTopic(diag) {
        let sensorType = MQTT.determineSensorType(diag.name);
        return `${this.getBaseTopic(sensorType)}/${MQTT.convertName(diag.name)}/state`;
    }
    getEventStateTopic(_name) {
        return `${this.getBaseTopic('event')}/${MQTT.convertName(_name)}/state`;
    }

    /**
     *
     * @param {Diagnostic} diag
     * @param {DiagnosticElement} diagEl
     */
    getConfigPayload(diag, diagEl) {
        return this.getConfigMapping(diag, diagEl);
    }

    /**
     * Return the state payload for this diagnostic
     * @param {Diagnostic} diag
     */
    getStatePayload(diag) {
        const state = {};
        _.forEach(diag.diagnosticElements, e => {
            // massage the binary_sensor values
            let value;
            switch (e.name) {
                case 'EV PLUG STATE': // unplugged/plugged
                    value = e.value === 'plugged';
                    break;
                case 'EV CHARGE STATE': // not_charging/charging
                    value = e.value === 'charging';
                    break;
                case 'PRIORITY CHARGE INDICATOR': // FALSE/TRUE
                    value = e.value === 'TRUE';
                    break;
                case 'PRIORITY CHARGE STATUS': // NOT_ACTIVE/ACTIVE
                    value = e.value === 'ACTIVE';
                    break;
                default:
                    // coerce to number if possible, API uses strings :eyeroll:
                    // eslint-disable-next-line no-case-declarations
                    const num = _.toNumber(e.value);
                    value = _.isNaN(num) ? e.value : num;
                    break;
            }
            state[MQTT.convertName(e.name)] = value;
        });
        return state;
    }

    // a truer "base" config payload that works for buttons, events, sensors, etc
    // (anything that might vary between devices shouldn't be in here)  This takes care
    // of name, unique_id, and device elements
    mapBaseConfigPayload(name) {        
        name = this.addNamePrefix(name);
        let unique_id = `${this.vehicle.vin}-${name}`
        unique_id = unique_id.replace(/\s+/g, '-').toLowerCase();
        return {
            name,            
            device: {
                identifiers: [this.vehicle.vin],
                manufacturer: this.vehicle.make,
                model: this.vehicle.year,
                name: this.vehicle.toString()
            },
            // availability differs between diagnostics and non-diagnostics
            unique_id: unique_id
        };
    }

    // this is really only usable by diagnostics data... If that changes, note
    // that there's a diagnostic specific availability topic in here...
    mapBaseDiagConfigPayload(diag, diagEl, device_class, name, attr) {
        name = name || MQTT.convertFriendlyName(diagEl.name);        
        return _.extend(
            {
                device_class,
                availability : [ 
                    {
                        payload_available : 'true',
                        payload_not_available : 'false',
                        topic : this.getAvailabilityTopic()
                    },
                    {
                        payload_available : 'true',
                        payload_not_available : 'false',
                        topic : this.getDiagnosticAvailabilityTopic()
                    }
                ],
                state_topic: this.getStateTopic(diag),
                value_template: `{{ value_json.${MQTT.convertName(diagEl.name)} }}`,
                json_attributes_topic: _.isUndefined(attr) ? undefined : this.getStateTopic(diag),
                json_attributes_template: attr,
            }, this.mapBaseConfigPayload(name));
    }

    mapEventConfigPayload(_name) {
        return _.extend(
            {
                availability_topic: this.getAvailabilityTopic(),
                payload_available: 'true',
                payload_not_available: 'false',
                retain: false,
                state_topic: this.getEventStateTopic(_name),
                event_types: [ "success", "failure" ]
            }, this.mapBaseConfigPayload(_name));
    }

    mapButtonConfigPayload(_name) {
        return _.extend(
            {
                availability_topic: this.getAvailabilityTopic(),
                payload_available: 'true',
                payload_not_available: 'false',
                retain: false,
                command_topic: this.getCommandTopic(), // this uses the generic command topic
                payload_press: `{ "command": "${_name}" }`
            }, this.mapBaseConfigPayload(_name));
    }

    mapDeviceTrackerConfigPayload(_name) {

        let retVal = _.extend(
            {
                availability_topic: this.getAvailabilityTopic(),
                payload_available: 'true',
                payload_not_available: 'false',
                json_attributes_topic: this.getStateTopic({name: _name}),
            }, this.mapBaseConfigPayload(_name));

        // _name is going to be a command name, and not very user friendly for a tracker...
        //   so, for this one device, clean things up a bit by re-writing the name
        retVal.name = this.addNamePrefix("Vehicle Location");
        return retVal;
    }

    mapSensorConfigPayload(diag, diagEl, device_class, name, attr) {
        name = name || MQTT.convertFriendlyName(diagEl.name);
        return _.extend(
            this.mapBaseDiagConfigPayload(diag, diagEl, device_class, name, attr),
            {unit_of_measurement: diagEl.unit});
    }

    mapBinarySensorConfigPayload(diag, diagEl, device_class, name, attr) {
        name = name || MQTT.convertFriendlyName(diagEl.name);
        return _.extend(
            this.mapBaseDiagConfigPayload(diag, diagEl, device_class, name, attr),
            {payload_on: true, payload_off: false});
    }

    /**
     *
     * @param {Diagnostic} diag
     * @param {DiagnosticElement} diagEl
     */
    getConfigMapping(diag, diagEl) {
        // TODO: this sucks, find a better way to map these diagnostics and their elements for discovery.
        // this is a hack.. a really ugly hack
        if (diag.name === "getLocation") {
            return this.mapDeviceTrackerConfigPayload(diag.name);
        }

        switch (diagEl.name) {
            case 'LIFETIME ENERGY USED':
            case 'LIFETIME EFFICIENCY':
            case 'ELECTRIC ECONOMY':
                return this.mapSensorConfigPayload(diag, diagEl, 'energy');
            case 'INTERM VOLT BATT VOLT':
            case 'EV PLUG VOLTAGE':
                return this.mapSensorConfigPayload(diag, diagEl, 'voltage');
            case 'HYBRID BATTERY MINIMUM TEMPERATURE':
            case 'AMBIENT AIR TEMPERATURE':
            case 'AMBIENT AIR TEMPERATURE F':
            case 'ENGINE COOLANT TEMP':
            case 'ENGINE COOLANT TEMP F':
                return this.mapSensorConfigPayload(diag, diagEl, 'temperature');
            case 'EV BATTERY LEVEL':
                return this.mapSensorConfigPayload(diag, diagEl, 'battery');
            case 'TIRE PRESSURE LF':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Front', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT')}} | tojson }}`);
            case 'TIRE PRESSURE LF PSI':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Front PSI', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT_PSI')}} | tojson }}`);
            case 'TIRE PRESSURE LR':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Rear', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR')}} | tojson }}`);
            case 'TIRE PRESSURE LR PSI':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Rear PSI', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR_PSI')}} | tojson }}`);
            case 'TIRE PRESSURE RF':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Front', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT')}} | tojson }}`);
            case 'TIRE PRESSURE RF PSI':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Front PSI', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT_PSI')}} | tojson }}`);
            case 'TIRE PRESSURE RR':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Rear', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR')}} | tojson }}`);
            case 'TIRE PRESSURE RR PSI':
                return this.mapSensorConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Rear PSI', `{{ {'recommendation': value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR_PSI')}} | tojson }}`);
            // binary sensor
            case 'EV PLUG STATE': // unplugged/plugged
                return this.mapBinarySensorConfigPayload(diag, diagEl, 'plug');
            case 'EV CHARGE STATE': // not_charging/charging
                return this.mapBinarySensorConfigPayload(diag, diagEl, 'battery_charging');
            // binary_sensor, but no applicable device_class
            case 'PRIORITY CHARGE INDICATOR': // FALSE/TRUE
            case 'PRIORITY CHARGE STATUS': // NOT_ACTIVE/ACTIVE
                return this.mapBinarySensorConfigPayload(diag, diagEl);
            // no device class, camel case name
            case 'EV RANGE':
            case 'ODOMETER':
            case 'LAST TRIP TOTAL DISTANCE':
            case 'LAST TRIP ELECTRIC ECON':
            case 'LIFETIME MPGE':
            case 'CHARGER POWER LEVEL':
            default:
                return this.mapSensorConfigPayload(diag, diagEl);
        }
    }
}

module.exports = MQTT;