'use strict'

const Libp2p = require('libp2p')
const WS = require('libp2p-websockets')
const PeerInfo = require('peer-info')
const Secio = require('libp2p-secio')
const Multiplex = require('libp2p-mplex')
const isNode = require('detect-node')

const WebRTCDirect = require('../src')

class Node extends Libp2p {
  constructor (peerInfo, options) {
    options = options || {}

    const modules = {
      transport: [],
      connection: {
        muxer: [Multiplex],
        crypto: [Secio]
      }
    }

    if (options.modules && options.modules.transport) {
      options.modules.transport.forEach((t) => modules.transport.push(t))
    }

    super(modules, peerInfo, undefined, options)
  }
}

function createNode (peer, addrs, options, callback) {
  if (typeof peer === 'function') {
    callback = peer
    peer = undefined
    addrs = []
    options = {}
  }

  if (Array.isArray(peer)) {
    callback = options
    options = addrs
    addrs = peer
    peer = undefined
  }

  const create = peer ? PeerInfo.create.bind(null, peer) : PeerInfo.create.bind()
  create((err, peer) => {
    if (err) { return callback(err) }
    addrs.forEach((addr) => {
      peer.multiaddrs.add(addr)
    })
    return callback(null, new Node(peer, options))
  })
}

exports.createNode = createNode

const ma = `/ip4/127.0.0.1/tcp/12346/ws/ipfs/QmSswe1dCFRepmhjAMR5VfHeokGLcvVggkuDJm7RMfJSrE`
function makeWrtcDirectNode (addrs, callback) {
  if (typeof addrs === 'function') {
    callback = addrs
    addrs = null
  }

  addrs = addrs || [
    '/ip4/0.0.0.0/tcp/0/ws'
  ]

  createNode(addrs, {
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
    if (err) { return callback(err) }
    const wd = new WebRTCDirect(node)
    node.modules.transport.push(wd)
    node.start((err) => {
      if (err) { return callback(err) }
      node.dial(ma, (err) => {
        if (err) { return callback(err) }
        callback(null, node)
      })
    })
  })
}

exports.makeWrtcDirectNode = makeWrtcDirectNode
