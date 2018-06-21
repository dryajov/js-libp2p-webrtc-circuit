'use strict'

const WebRTCDirect = require('./src')
const utils = require('./test/utils')

const WS = require('libp2p-websockets')
const PeerId = require('peer-id')
const id = require('./test/peer')

let libp2pNode
function boot (done) {
  PeerId.createFromJSON(id, (err, peerId) => {
    if (err) { return done(err) }
    utils.createNode(peerId,
      [
        '/ip4/127.0.0.1/tcp/12346/ws'
      ], {
        modules: {
          transport: [
            new WS()
          ]
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true
          }
        }
      }, (err, node) => {
        if (err) { return done(err) }
        libp2pNode = node
        const wd = new WebRTCDirect(node)
        node.modules.transport.push(wd)
        node.peerInfo.multiaddrs.add(`/ipfs/${node.peerInfo.id.toB58String()}/p2p-webrtc-direct`)
        node.start(() => {
          node.peerInfo.multiaddrs.forEach(addr => {
            console.log(`node listenning on: ${addr.toString()}`)
          })
        })
      })
  })
}

function shutdown (done) {
  libp2pNode.stop(() => {
    console.log('Stopped!')
  })
}

boot((err) => {
  if (err) { throw err }
  console.log('Started!')
})

process.on('SIGINT', shutdown)
