/* eslint-env mocha */

'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const multiaddr = require('multiaddr')
const pull = require('pull-stream')
const series = require('async/series')

const utils = require('./utils')

describe.only('dial', () => {
  let wrtc1
  let wrtc2
  before(function (done) {
    this.timeout(50 * 1000)
    series([
      (cb) => utils.makeWrtcDirectNode(['/ip4/0.0.0.0/tcp/0/ws/p2p-webrtc-circuit'], cb),
      (cb) => utils.makeWrtcDirectNode(['/ip4/0.0.0.0/tcp/0/ws/p2p-webrtc-circuit'], cb),
      (cb) => setTimeout(cb, 2000)
    ], (err, nodes) => {
      expect(err).to.not.exist()
      wrtc1 = nodes[0]
      wrtc2 = nodes[1]
      done()
    })
  })

  it.only('dial webrtc circuit address', function (done) {
    this.timeout(10000 * 1000)
    const ma = multiaddr(`/p2p-webrtc-circuit/ipfs/${wrtc2.peerInfo.id.toB58String()}`)
    wrtc1.dial(ma, (err, conn) => {
      expect(err).to.not.exist()
      const data = Buffer.from('some data')
      pull(
        pull.values([data]),
        conn,
        pull.collect((err, values) => {
          expect(err).to.not.exist()
          expect(values).to.eql([data])
          done()
        })
      )
    })
  })

  it('dial offline / non-existent node on IPv4, check callback', (done) => {
    let maOffline = multiaddr('/ip4/127.0.0.1/tcp/55555/http/p2p-webrtc-direct')

    wd.dial(maOffline, (err, conn) => {
      expect(err).to.exist()
      done()
    })
  })

  it.skip('dial on IPv6', (done) => {
    // TODO IPv6 not supported yet
  })
})
