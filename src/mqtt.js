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
    constructor(prefix = 'homeassistant', instance = 'XXX') {
        this.prefix = prefix;
        this.instance = instance;
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
            default:
                return 'sensor';
        }
    }

    /**
     * @param {'sensor'|'binary_sensor'} type
     * @returns {string}
     */
    getBaseTopic(type = 'sensor') {
        return `${this.prefix}/${type}/${this.instance}`;
    }

    /**
     *
     * @param {DiagnosticElement} diag
     */
    getConfigTopic(diag) {
        let sensorType = MQTT.determineSensorType(diag.name);
        return `${this.getBaseTopic(sensorType)}/${MQTT.convertName(diag.name)}/config`;
    }

    /**
     *
     * @param {Diagnostic} diag
     */
    getStateTopic(diag) {
        let sensorType = MQTT.determineSensorType(diag.name);
        return `${this.getBaseTopic(sensorType)}/${MQTT.convertName(diag.name)}/state`;
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
                    const num = _.toNumber(e.value);
                    value = _.isNaN(num) ? e.value : num;
                    break;
            }
            state[MQTT.convertName(e.name)] = value;
        });
        return state;
    }

    mapConfigPayload(diag, diagEl, device_class, name, attr) {
        name = name || MQTT.convertFriendlyName(diagEl.name);
        // TODO availability
        return {
            device_class,
            name,
            state_topic: this.getStateTopic(diag),
            unit_of_measurement: diagEl.unit,
            value_template: `{{ value_json.${MQTT.convertName(diagEl.name)} }}`,
            json_attributes_template: attr
        };
    }

    /**
     *
     * @param {Diagnostic} diag
     * @param {DiagnosticElement} diagEl
     */
    getConfigMapping(diag, diagEl) {
        // TODO: this sucks, find a better way to map these diagnostics and their elements for discovery.
        switch (diagEl.name) {
            case 'LIFETIME ENERGY USED':
            case 'LIFETIME EFFICIENCY':
            case 'ELECTRIC ECONOMY':
                return this.mapConfigPayload(diag, diagEl, 'energy');
            case 'INTERM VOLT BATT VOLT':
            case 'EV PLUG VOLTAGE':
                return this.mapConfigPayload(diag, diagEl, 'voltage');
            case 'HYBRID BATTERY MINIMUM TEMPERATURE':
            case 'AMBIENT AIR TEMPERATURE':
                return this.mapConfigPayload(diag, diagEl, 'temperature');
            case 'EV BATTERY LEVEL':
                return this.mapConfigPayload(diag, diagEl, 'battery');
            case 'TIRE PRESSURE LF':
                return this.mapConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Front', `{{ {"recommendation": value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT')}} | tojson }}`);
            case 'TIRE PRESSURE LR':
                return this.mapConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Left Rear', `{{ {"recommendation": value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR')}} | tojson }}`);
            case 'TIRE PRESSURE RF':
                return this.mapConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Front', `{{ {"recommendation": value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_FRONT')}} | tojson }}`);
            case 'TIRE PRESSURE RR':
                return this.mapConfigPayload(diag, diagEl, 'pressure', 'Tire Pressure: Right Rear', `{{ {"recommendation": value_json.${MQTT.convertName('TIRE_PRESSURE_PLACARD_REAR')}} | tojson }}`);
            // binary sensor
            case 'EV PLUG STATE': // unplugged/plugged
                return this.mapConfigPayload(diag, diagEl, 'plug');
            case 'EV CHARGE STATE': // not_charging/charging
                return this.mapConfigPayload(diag, diagEl, 'battery_charging');
            // binary_sensor, but no applicable device_class
            case 'PRIORITY CHARGE INDICATOR': // FALSE/TRUE
            case 'PRIORITY CHARGE STATUS': // NOT_ACTIVE/ACTIVE
            // no device class, camel case name
            case 'EV RANGE':
            case 'ODOMETER':
            case 'LAST TRIP TOTAL DISTANCE':
            case 'LAST TRIP ELECTRIC ECON':
            case 'LIFETIME MPGE':
            case 'CHARGER POWER LEVEL':
            default:
                return this.mapConfigPayload(diag, diagEl);
        }
    }
}

module.exports = MQTT;