import { describe, expect, it } from 'vitest'
import {
  isBlackKey,
  midiOf,
  midiToName,
  nameToMidi,
  nearestWithPitchClass,
  parsePitchClass,
  pitchClass,
  pitchClassDistance,
  transpose,
} from './notes'

describe('notes', () => {
  it('maps MIDI numbers to names (C4 = 60)', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(61)).toBe('C#4')
    expect(midiToName(61, true)).toBe('Db4')
    expect(midiToName(21)).toBe('A0')
    expect(midiToName(0)).toBe('C-1')
  })

  it('parses names to MIDI numbers', () => {
    expect(nameToMidi('C4')).toBe(60)
    expect(nameToMidi('Db4')).toBe(61)
    expect(nameToMidi('a0')).toBe(21)
    expect(nameToMidi('E♭3')).toBe(51)
    expect(nameToMidi('Cb4')).toBe(59)
    expect(nameToMidi('B#3')).toBe(60)
    expect(nameToMidi('H4')).toBeNull()
    expect(nameToMidi('C10')).toBeNull()
  })

  it('round-trips every MIDI note', () => {
    for (let m = 0; m <= 127; m++) {
      expect(nameToMidi(midiToName(m))).toBe(m)
      expect(nameToMidi(midiToName(m, true))).toBe(m)
    }
  })

  it('parses pitch classes', () => {
    expect(parsePitchClass('C')).toBe(0)
    expect(parsePitchClass('f#')).toBe(6)
    expect(parsePitchClass('Bb')).toBe(10)
    expect(parsePitchClass('Cb')).toBe(11)
    expect(parsePitchClass('X')).toBeNull()
  })

  it('computes pitch classes of negative numbers', () => {
    expect(pitchClass(-1)).toBe(11)
    expect(pitchClass(25)).toBe(1)
  })

  it('builds notes from pitch class and octave', () => {
    expect(midiOf(9, 4)).toBe(69)
    expect(midiOf(0, -1)).toBe(0)
  })

  it('transposes and clamps to the MIDI range', () => {
    expect(transpose(60, 7)).toBe(67)
    expect(transpose(125, 12)).toBe(127)
    expect(transpose(3, -12)).toBe(0)
  })

  it('knows black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true])
  })

  it('measures pitch-class distance', () => {
    expect(pitchClassDistance(0, 11)).toBe(1)
    expect(pitchClassDistance(0, 6)).toBe(6)
    expect(pitchClassDistance(2, 9)).toBe(5)
  })

  it('finds the nearest note of a pitch class', () => {
    expect(nearestWithPitchClass(7, 60)).toBe(55)
    expect(nearestWithPitchClass(4, 60)).toBe(64)
    expect(nearestWithPitchClass(0, 71)).toBe(72)
    expect(nearestWithPitchClass(6, 60)).toBe(54) // tie resolves downwards
  })
})
