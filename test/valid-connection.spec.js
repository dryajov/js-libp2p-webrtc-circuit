/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const pair = require('pull-pair/duplex')
const pull = require('pull-stream')
const Connection = require('interface-connection').Connection
const series = require('async/series')

const WebRTCCirctuit = require('../src')

describe('valid Connection', () => {
  const ma = '/p2p-webrtc-circuit/ipfs/QmSswe1dCFRepmhjAMR5VfHeokGLcvVggkuDJm7RMfJSrE'
  let conn

  let wrtc1
  let wrtc2
  let node
  let stream
  beforeEach(function (done) {
    stream = pair()
    node = {
      dialProtocol: (addr, multicodec, callback) => {
        callback(null, new Connection(stream[0]))
      },
      handle: (multicodec, callback) => {
        callback(null, new Connection(stream[1]))
      }
    }

    wrtc1 = new WebRTCCirctuit(node)
    wrtc2 = new WebRTCCirctuit(node)

    const listener = wrtc2.createListener()
    series([
      (cb) => listener.listen(ma, cb),
      (cb) => wrtc1.dial(ma, (err, _conn) => {
        expect(err).to.not.exist()
        conn = _conn
        cb()
      })
    ], done)
  })

  after((done) => {
    pull(
      pull.empty(),
      conn,
      pull.onEnd(done)
    )
  })

  it('get observed addrs', (done) => {
    conn.getObservedAddrs((err, addrs) => {
      expect(err).to.not.exist()
      expect(addrs[0].toString()).to.equal(ma.toString())
      done()
    })
  })

  it('get Peer Info', (done) => {
    conn.getPeerInfo((err, peerInfo) => {
      expect(err).to.exist()
      done()
    })
  })

  it('set Peer Info', (done) => {
    conn.setPeerInfo('info')
    conn.getPeerInfo((err, peerInfo) => {
      expect(err).to.not.exist()
      expect(peerInfo).to.equal('info')
      done()
    })
  })
})
