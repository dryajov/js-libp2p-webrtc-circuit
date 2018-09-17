/* eslint-env mocha */

'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const crypto = require('crypto')
const pull = require('pull-stream')
const Connection = require('interface-connection').Connection
const pair = require('pull-pair/duplex')
const series = require('async/series')
const randomSplit = require('pull-randomly-split')

const WebRTCCirctuit = require('../src')

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

describe.skip('chunking', () => {
  const ma = '/ipfs/QmSswe1dCFRepmhjAMR5VfHeokGLcvVggkuDJm7RMfJSrE/p2p-webrtc-circuit'
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

  it('should chunk', function (done) {
    this.timeout(1000 * 1000)
    const bytes = crypto.randomBytes(1024 * 60)
    const listener = wrtc2.createListener((conn) => {
      pull(
        conn,
        pull.collect((err, data) => {
          console.dir(data)
          expect(err).to.not.exist()
          expect(data[0]).to.deep.eql(bytes)
          done()
        })
      )
    })

    series([
      (cb) => listener.listen(ma, cb),
      (cb) => wrtc1.dial(ma, (err, conn) => {
        expect(err).to.not.exist()
        pull(
          pull.values([bytes]),
          // randomSplit(1024, 1024),
          conn
        )
        cb()
      })
    ])
  })
})
