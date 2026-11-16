import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pngHeader } from './png-fixture.js'
import { readPngSize } from './png-size.js'

test('reads width and height from a PNG header', () => {
  assert.deepEqual(readPngSize(pngHeader(256)), { width: 256, height: 256 })
  assert.deepEqual(readPngSize(pngHeader(64, 32)), { width: 64, height: 32 })
})

test('rejects bytes that are not a PNG header', () => {
  assert.equal(readPngSize(new Uint8Array(10)), undefined)
  assert.equal(readPngSize(new Uint8Array(24)), undefined)

  const wrongChunk = pngHeader(50)
  wrongChunk.set([0x49, 0x44, 0x41, 0x54], 12) // IDAT where IHDR must be
  assert.equal(readPngSize(wrongChunk), undefined)
})
