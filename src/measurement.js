const convert = require('convert-units');

class Measurement {
    constructor(value, unit) {
        this.value = value;
        this.unit = Measurement.correctUnitName(unit);
    }

    static correctUnitName(unit) {
        switch (unit) {
            case 'Cel': return 'C';
            case 'kwh': return 'kWh';
            case 'KM': return 'km';
            case 'KPa': return 'kPa';
            case 'kmple': return 'km/l e'; // TODO check on this
            case 'volts': return 'V';
            case 'Stat':
            case 'N/A':
                return '';
            default: return unit;
        }
    }

    // TODO this may not be required. Check consuming application.
    static convertToImperial(value, unit) {
        switch(unit) {
            case 'Cel':
                const val = convert(value).from('C').to('F');
                return new Measurement(val, 'F');
            default:
                return new Measurement(value, unit);
        }
    }

    toString() {
        return `${this.value}${this.unit}`;
    }
}

module.exports = Measurement;