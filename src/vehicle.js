const _ = require('lodash');

class Vehicle {
    constructor(vehicle) {
        this.make = vehicle.make;
        this.model = vehicle.model;
        this.vin = vehicle.vin;
        this.year = vehicle.year;

        const diagCmd = _.find(
            _.get(vehicle, 'commands.command'),
            cmd => cmd.name === 'diagnostics'
        );
        this.supportedDiagnostics = _.get(diagCmd,
            'commandData.supportedDiagnostics.supportedDiagnostic');
    }

    isSupported(diag) {
        return _.includes(this.supportedDiagnostics, diag);
    }

    getSupported(diags = []) {
        if (diags.length === 0) {
            return this.supportedDiagnostics;
        }
        return _.intersection(this.supportedDiagnostics, diags);
    }

    toString() {
        return `${this.year} ${this.make} ${this.model}`;
    }
}

module.exports = Vehicle;