'use strict'

const WebRTCDirect = require('./src')
const pull = require('pull-stream')
const utils = require('../test/utils')

let listener
function boot (done) {
  utils.createNode([
    '/ip4/127.0.0.1/tcp/12345/p2p-webrtc-direct', 
    '/ip4/127.0.0.1/tcp/12346/ws'
  ], (err, node) => {
    if (err) { return done(err) }
    const wd = new WebRTCDirect(node)
    listener = wd.createListener((conn) => pull(conn, conn))
    listener.listen(`/ipfs/${peer.id.toB58String()}/p2p-webrtc-direct`, done)
    listener.on('listening', () => {
      peer.multiaddrs.forEach((ma) => {
        console.log('node listening on: ', ma.toString())
      })
    })
  })
}

function shutdown (done) {
  listener.close(done)
}

module.exports = {
  hooks: {
    pre: boot,
    post: shutdown
  }
}
