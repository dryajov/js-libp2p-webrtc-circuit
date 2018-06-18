'use strict'

const wrtc = require('wrtc')
const SimplePeer = require('simple-peer')
const isNode = require('detect-node')
const toPull = require('stream-to-pull-stream')
const Connection = require('interface-connection').Connection
const EE = require('events').EventEmitter
const mafmt = require('mafmt')
const once = require('once')
const withIs = require('class-is')
const pull = require('pull-stream')
const multiaddr = require('multiaddr')
const through = require('pull-through')

function noop () { }

const multicodec = '/libp2p/webrtc/circuit/1.0.1'
class WebRTCCircuit {
  constructor (libp2p) {
    this._libp2p = libp2p
  }

  dial (ma, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    callback = once(callback || noop)

    Object.assign(options, {
      initiator: true,
      trickle: false
    })

    if (isNode) {
      options.wrtc = wrtc
    }

    const channel = new SimplePeer(options)
    const conn = new Connection(toPull.duplex(channel))

    let connected = false
    channel.on('signal', (signal) => {
      const addr = multiaddr(`/p2p-circuit`).encapsulate(`/ipfs/${ma.getPeerId()}`)
      this._libp2p.dialProtocol(addr, multicodec, (err, conn) => {
        if (err) {
          return callback(err)
        }

        pull(
          pull.values([JSON.stringify(signal)]),
          conn,
          pull.collect((err, signal) => {
            if (err) { return callback(err) }
            channel.signal(JSON.parse(signal))
          })
        )
      })
    })

    channel.on('connect', () => {
      connected = true
      callback(null, conn)
    })

    conn.destroy = channel.destroy.bind(channel)
    conn.getObservedAddrs = (callback) => callback(null, [ma])

    channel.on('timeout', () => callback(new Error('timeout')))
    channel.on('close', () => conn.destroy())
    channel.on('error', (err) => {
      if (!connected) {
        callback(err)
      }
    })

    return conn
  }

  createListener (options, handler) {
    if (typeof options === 'function') {
      handler = options
      options = {}
    }

    let maSelf
    const listener = new EE()
    listener.listen = (ma, callback) => {
      callback = callback || noop

      maSelf = ma
      this._libp2p.handle(multicodec, (_, conn) => {
        pull(
          conn,
          through(function (signal) {
            const options = {
              trickle: false
            }

            if (isNode) {
              options.wrtc = wrtc
            }

            const channel = new SimplePeer(options)
            const conn = new Connection(toPull.duplex(channel))

            channel.on('connect', () => {
              conn.getObservedAddrs = (callback) => callback(null, [])
              listener.emit('connection', conn)
              handler(conn)
            })

            channel.on('signal', (signal) => {
              this.queue(JSON.stringify(signal))
            })

            channel.signal(JSON.parse(signal))
          }),
          conn
        )
      })

      listener.emit('listening')
      callback()
    }

    listener.close = (options, callback) => {
      if (typeof options === 'function') {
        callback = options
        options = {}
      }

      callback = callback || noop

      this._libp2p.unhandle(multicodec)
      listener.emit('close')
      callback()
    }

    listener.getAddrs = (callback) => {
      setImmediate(() => {
        callback(null, [maSelf])
      })
    }

    return listener
  }

  filter (multiaddrs) {
    if (!Array.isArray(multiaddrs)) {
      multiaddrs = [multiaddrs]
    }

    return multiaddrs.filter((ma) => {
      if (ma.protoNames().indexOf('p2p-circuit') > -1) {
        return false
      }

      return mafmt.WebRTCCircuit.matches(ma)
    })
  }
}

module.exports = withIs(WebRTCCircuit, {
  className: 'WebRTCCircuit',
  symbolName: '@libp2p/js-libp2p-webrtc-direct/webrtccircuit'
})
