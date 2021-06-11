const assert = require('assert');
const _ = require('lodash');

const { Diagnostic, DiagnosticElement } = require('../src/diagnostic');
const apiResponse = require('./diagnostic.sample.json');

describe('Diagnostics', () => {
    let d;

    describe('Diagnostic', () => {
        beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[0]')));

        it('should parse a diagnostic response', () => {
            assert.strictEqual(d.name, 'AMBIENT AIR TEMPERATURE');
            assert.strictEqual(d.diagnosticElements.length, 2);
        });

        it('should toString() correctly', () => {
            const output = d.toString().trimEnd();
            const lines = output.split(/\r\n|\r|\n/);
            assert.strictEqual(lines.length, 3);
            assert.strictEqual(lines[0], 'AMBIENT AIR TEMPERATURE:');
        });
    });

    describe('DiagnosticElement', () => {
        beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[8]')));
        it('should parse a diagnostic element', () => {
            assert.strictEqual(d.name, 'TIRE PRESSURE');
            assert.ok(_.isArray(d.diagnosticElements));
            assert.strictEqual(d.diagnosticElements.length, 12);
        });

        it('should toString() correctly', () => {
            const output = d.toString().trimEnd();
            const lines = output.split(/\r\n|\r|\n/);
            assert.strictEqual(lines.length, 13);
            assert.strictEqual(lines[0], 'TIRE PRESSURE:');
            assert.strictEqual(lines[1], '  TIRE PRESSURE LF: 240.0kPa');
        });

        it('should strip non-alpha chars', () => {
            assert.strictEqual(DiagnosticElement.convertName('TEMP', '°F'), 'TEMP F');
        });
    });
});
