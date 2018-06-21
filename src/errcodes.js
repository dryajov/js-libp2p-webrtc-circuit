'use strict'

const proto = require('./proto')

module.exports = {
  [proto.WebRTCCircuit.Status.OK]: 'OK',
  [proto.WebRTCCircuit.Status.E_MAX_CONN_EXCEEDED]: 'Maximum connections exceeded',
  [proto.WebRTCCircuit.Status.E_INTERNAL_ERR]: 'Internal error'
}
