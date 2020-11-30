const _ = require('lodash');

const Measurement = require('./measurement');

class Diagnostic {
    constructor(diagResponse) {
        this.name = diagResponse.name;
        const validEle = _.filter(
            diagResponse.diagnosticElement,
            d => _.has(d, 'value') && _.has(d, 'unit')
        );
        this.diagnosticElements = _.map(validEle, e => new DiagnosticElement(e));
    }

    elementsToString(diag) {
        const validEle = _.filter(diag, d => _.has(d, 'value') && _.has(d, 'unit'));
        let output = '';
        _.forEach(validEle, e => output += `  ${e.name} ${e.value}${e.unit}\n`);
        return output;
    }

    toString() {
        let elements = '';
        _.forEach(this.diagnosticElements, e => elements += `  ${e.toString()}\n`)
        return `${this.name}:\n` + elements;
    }
}

class DiagnosticElement {
    constructor(ele) {
        this.name = ele.name;
        this.measurement = new Measurement(ele.value, ele.unit);
    }

    toString() {
        return `${this.name}: ${this.measurement.toString()}`;
    }
}

module.exports = { Diagnostic, DiagnosticElement };