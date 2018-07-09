/* eslint-env mocha */

'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const pull = require('pull-stream')
const Connection = require('interface-connection').Connection
const pair = require('pull-pair/duplex')
const series = require('async/series')

const WebRTCCirctuit = require('../src')
const ErrorCodes = require('../src/errcodes')

const createNode = () => {
  const stream = pair()
  return {
    dialProtocol: (addr, multicodec, callback) => {
      callback(null, new Connection(stream[0]))
    },
    handle: (multicodec, callback) => {
      callback(null, new Connection(stream[1]))
    }
  }
}

describe('webrct', () => {
  const ma = '/p2p-webrtc-circuit/ipfs/QmSswe1dCFRepmhjAMR5VfHeokGLcvVggkuDJm7RMfJSrE'
  let wrtc1
  let wrtc2
  let node
  beforeEach(function () {
    node = createNode()
    wrtc1 = new WebRTCCirctuit()
    wrtc1.setLibp2p(node)
    wrtc2 = new WebRTCCirctuit()
    wrtc2.setLibp2p(node)
  })

  it('should negotiate webrtc', function (done) {
    const listener = wrtc2.createListener((conn) => {
      pull(
        conn,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data.toString()).to.equal('Hello!')
        }),
        pull.onEnd(done)
      )
    })

    series([
      (cb) => listener.listen(ma, cb),
      (cb) => wrtc1.dial(ma, (err, conn) => {
        expect(err).to.not.exist()
        pull(
          pull.values([Buffer.from('Hello!')]),
          conn
        )
        cb()
      })
    ], done)
  })

  it('dial should reject connection on max connections exceeded', function (done) {
    this.timeout(1000 * 5)
    wrtc1.maxCons = 0
    const listener = wrtc2.createListener(() => {})
    series([
      (cb) => listener.listen(ma, cb),
      (cb) => wrtc1.dial(ma, (err) => {
        expect(err).to.exist()
        expect(err.message).to.eql(ErrorCodes[100])
        cb()
      })
    ], done)
  })

  it('listen should reject connection on max connections exceeded', function (done) {
    this.timeout(1000 * 5)
    wrtc2.maxCons = 0
    const listener = wrtc2.createListener(() => { })
    series([
      (cb) => listener.listen(ma, cb),
      (cb) => wrtc1.dial(ma, (err) => {
        expect(err).to.exist()
        expect(err.message).to.eql(ErrorCodes[100])
        cb()
      })
    ], done)
  })
})
