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
        const converted = _.map(_.filter(this.diagnosticElements, e => e.isConvertible),
            e => DiagnosticElement.convert(e));
        this.diagnosticElements.push(... converted);
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
    /**
     *
     * @param {DiagnosticElement} element
     */
    static convert(element) {
        const {name, unit, value} = element;
        const convertedUnit = Measurement.convertUnit(unit);
        return new DiagnosticElement({
            name: DiagnosticElement.convertName(name, convertedUnit),
            unit: convertedUnit,
            value: Measurement.convertValue(value, unit)
        })
    }

    static convertName(name, unit) {
        return `${name} ${_.replace(_.toUpper(unit), /\W/g, '')}`;
    }

    /**
     * @param {string} ele.name
     * @param {string|number} ele.value
     * @param {string} ele.unit
     */
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

    get isConvertible() {
        return this.measurement.isConvertible;
    }

    toString() {
        return `${this.name}: ${this.measurement.toString()}`;
    }
}

module.exports = {Diagnostic, DiagnosticElement};