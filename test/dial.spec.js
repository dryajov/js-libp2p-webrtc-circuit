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

describe('dial', () => {
  const ma = '/p2p-webrtc-circuit/ipfs/QmSswe1dCFRepmhjAMR5VfHeokGLcvVggkuDJm7RMfJSrE'
  let wrtc1
  let wrtc2
  let node
  let stream
  beforeEach(function () {
    stream = pair()
    node = {
      dialProtocol: (addr, multicodec, callback) => {
        callback(null, new Connection(stream[0]))
      },
      handle: (multicodec, callback) => {
        callback(null, new Connection(stream[1]))
      }
    }

    wrtc1 = new WebRTCCirctuit()
    wrtc1.init(node)
    wrtc2 = new WebRTCCirctuit(node)
    wrtc2.init(node)
  })

  it('should negotiate webrtc', function (done) {
    this.timeout(1000 * 1000)
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

  it('should reject connection on max connections exceeded', function (done) {
    this.timeout(1000 * 1000)
    const listener = wrtc2.createListener()
    wrtc2.maxCons = 0
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
