'use strict'
const protons = require('protons')

module.exports = protons(`
message WebRTCCircuit {
  enum Status {
    OK = 1;
    E_MAX_CONN_EXCEEDED = 100;
    E_INTERNAL_ERR      = 200;
  }

  optional bytes signal = 1;
  optional Status code = 2;
}
`)
