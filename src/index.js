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
const block = require('pull-block')
const lp = require('pull-length-prefixed')
const pb = require('pull-protocol-buffers')

const proto = require('./proto')

function noop () { }

const multicodec = '/libp2p/webrtc/circuit/1.0.1'

const ErrorMsgs = require('./errcodes')

class WebRTCCircuit {
  constructor (libp2p, maxCons) {
    this._libp2p = libp2p
    this.maxCons = isNode ? 50 : 5
    this.maxCons = maxCons || this.maxCons
    this.totalCons = 0
  }

  dial (ma, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    callback = once(callback || noop)

    options = Object.assign({}, options, {
      initiator: true,
      trickle: false
    })

    if (isNode) {
      options.wrtc = wrtc
    }

    const channel = new SimplePeer(options)
    const conn = new Connection(toPull.duplex(channel))
    // chunk into 16kb size
    // TODO: make chunking configurable
    pull(conn, block({ size: 16384 }), lp.encode(), conn)

    let connected = false
    ma = multiaddr(ma)
    channel.on('signal', (signal) => {
      const addr = multiaddr(`/p2p-circuit`).encapsulate(`/ipfs/${ma.getPeerId()}`)
      this._libp2p.dialProtocol(addr, multicodec, (err, conn) => {
        if (err) {
          return callback(err)
        }

        pull(
          pull.values([{signal: JSON.stringify(signal)}]),
          pb.encode(proto.WebRTCCircuit),
          conn,
          pb.decode(proto.WebRTCCircuit),
          pull.collect((err, signal) => {
            if (err) { return callback(err) }
            if (signal[0].code !== proto.WebRTCCircuit.Status.OK) {
              return callback(new Error(ErrorMsgs[signal[0].code]))
            }

            try {
              channel.signal(signal[0].signal.toString())
              this.totalCons++
            } catch (err) {
              return callback(err)
            }
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
    channel.on('close', () => {
      conn.destroy()
      this.totalCons--
    })
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

      maSelf = multiaddr(ma)
      this._libp2p.handle(multicodec, (_, conn) => {
        pull(
          conn,
          pb.decode(proto.WebRTCCircuit),
          pull.asyncMap((msg, cb) => {
            if (this.maxCons <= this.totalCons) {
              return cb(null, {
                code: proto.WebRTCCircuit.Status.E_MAX_CONN_EXCEEDED
              })
            }

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
              try {
                this.totalCons++
                cb(null, {
                  signal: JSON.stringify(signal),
                  code: proto.WebRTCCircuit.Status.OK
                })
              } catch (err) {
                return callback(err)
              }
            })

            channel.on('close', () => {
              cb(null, {
                code: proto.WebRTCCircuit.Status.E_INTERNAL_ERR
              })
              this.totalCons--
            })

            channel.signal(msg.signal.toString())
          }),
          pb.encode(proto.WebRTCCircuit),
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
