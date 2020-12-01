const _ = require('lodash');

const Measurement = require('./measurement');

/**
 *
 */
class Diagnostic {
    constructor(diagResponse) {
        this.name = diagResponse.name;
        const validEle = _.filter(
            diagResponse.diagnosticElement,
            d => _.has(d, 'value') && _.has(d, 'unit')
        );
        this.diagnosticElements = _.map(validEle, e => new DiagnosticElement(e));
    }

    hasElements() {
        return this.diagnosticElements.length >= 1;
    }

    toString() {
        let elements = '';
        _.forEach(this.diagnosticElements, e => elements += `  ${e.toString()}\n`)
        return `${this.name}:\n` + elements;
    }
}

class DiagnosticElement {
    constructor(ele) {
        this._name = ele.name;
        this.measurement = new Measurement(ele.value, ele.unit);
    }

    get name() {
        return this._name;
    }

    get value() {
        return this.measurement.value;
    }

    get unit() {
        return this.measurement.unit;
    }

    toString() {
        return `${this.name}: ${this.measurement.toString()}`;
    }
}

module.exports = { Diagnostic, DiagnosticElement };