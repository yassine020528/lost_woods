import type { Monster, Player } from './types'

export interface AudioController {
  stop: () => void
  setMuted: (muted: boolean) => void
  playKeyCollect: () => void
  playJumpscare: () => void
  playSpellCast: () => void
}

export function createAmbientAudio(getScene: () => {
  gameStarted: boolean
  winShown: boolean
  deathShown: boolean
  monsters: Monster[]
  player: Player
}, initialMuted = false): AudioController | null {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return null
  }

  const audioCtx = new AudioContextCtor()
  const timers: number[] = []

  const registerTimeout = (cb: () => void, ms: number): void => {
    const id = window.setTimeout(cb, ms)
    timers.push(id)
  }

  const master = audioCtx.createGain()
  let isMuted = initialMuted
  master.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime)
  master.connect(audioCtx.destination)

  const setMuted = (muted: boolean): void => {
    isMuted = muted
    const target = muted ? 0 : 0.7
    const now = audioCtx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setTargetAtTime(target, now, 0.02)
  }

  const makeDrone = (freq: number, detune: number, volume: number): void => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
    osc.detune.setValueAtTime(detune, audioCtx.currentTime)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(280, audioCtx.currentTime)
    gain.gain.setValueAtTime(0, audioCtx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 4)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    osc.start()

    const lfo = audioCtx.createOscillator()
    const lfoGain = audioCtx.createGain()
    lfo.frequency.setValueAtTime(0.08 + Math.random() * 0.04, audioCtx.currentTime)
    lfoGain.gain.setValueAtTime(volume * 0.35, audioCtx.currentTime)
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()
  }

  makeDrone(55, 0, 0.18)
  makeDrone(55, -14, 0.12)
  makeDrone(82, 7, 0.08)

  const makeWind = (): void => {
    const bufSize = audioCtx.sampleRate * 3
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate)
    const data = buf.getChannelData(0)

    for (let i = 0; i < bufSize; i += 1) {
      data[i] = Math.random() * 2 - 1
    }

    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.loop = true

    const bandPass = audioCtx.createBiquadFilter()
    bandPass.type = 'bandpass'
    bandPass.frequency.setValueAtTime(600, audioCtx.currentTime)
    bandPass.Q.setValueAtTime(0.5, audioCtx.currentTime)

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0, audioCtx.currentTime)
    gain.gain.linearRampToValueAtTime(0.09, audioCtx.currentTime + 5)

    src.connect(bandPass)
    bandPass.connect(gain)
    gain.connect(master)
    src.start()

    const gust = (): void => {
      const time = audioCtx.currentTime
      const peak = 0.06 + Math.random() * 0.1
      const duration = 1.5 + Math.random() * 3

      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(gain.gain.value, time)
      gain.gain.linearRampToValueAtTime(peak, time + duration * 0.3)
      gain.gain.linearRampToValueAtTime(0.04, time + duration)

      registerTimeout(gust, 3000 + Math.random() * 5000)
    }

    registerTimeout(gust, 4000)
  }

  makeWind()

  const makeCreak = (): void => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()

    osc.type = 'sine'
    const startFreq = 120 + Math.random() * 80
    const endFreq = startFreq + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 60)
    const duration = 0.15 + Math.random() * 0.35
    const time = audioCtx.currentTime

    osc.frequency.setValueAtTime(startFreq, time)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(300, time)
    filter.Q.setValueAtTime(2, time)

    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.05, time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    osc.start(time)
    osc.stop(time + duration + 0.05)

    registerTimeout(makeCreak, 4000 + Math.random() * 12000)
  }

  registerTimeout(makeCreak, 3000)

  const makeMoan = (): void => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()

    osc.type = 'sine'
    const time = audioCtx.currentTime
    const baseFreq = 180 + Math.random() * 120
    const duration = 1.5 + Math.random() * 2

    osc.frequency.setValueAtTime(baseFreq, time)
    osc.frequency.linearRampToValueAtTime(baseFreq * (0.85 + Math.random() * 0.3), time + duration)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, time)

    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.02, time + duration * 0.3)
    gain.gain.linearRampToValueAtTime(0, time + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    osc.start(time)
    osc.stop(time + duration + 0.1)

    registerTimeout(makeMoan, 8000 + Math.random() * 18000)
  }

  registerTimeout(makeMoan, 6000)

  const heartbeatGain = audioCtx.createGain()
  heartbeatGain.gain.setValueAtTime(0, audioCtx.currentTime)
  heartbeatGain.connect(master)

  const thump = (): void => {
    const time = audioCtx.currentTime

    const oscA = audioCtx.createOscillator()
    const gainA = audioCtx.createGain()
    oscA.type = 'sine'
    oscA.frequency.setValueAtTime(60, time)
    oscA.frequency.exponentialRampToValueAtTime(30, time + 0.12)
    gainA.gain.setValueAtTime(0.6, time)
    gainA.gain.exponentialRampToValueAtTime(0.0001, time + 0.18)
    oscA.connect(gainA)
    gainA.connect(heartbeatGain)
    oscA.start(time)
    oscA.stop(time + 0.2)

    const oscB = audioCtx.createOscillator()
    const gainB = audioCtx.createGain()
    oscB.type = 'sine'
    oscB.frequency.setValueAtTime(55, time + 0.18)
    oscB.frequency.exponentialRampToValueAtTime(28, time + 0.3)
    gainB.gain.setValueAtTime(0.4, time + 0.18)
    gainB.gain.exponentialRampToValueAtTime(0.0001, time + 0.32)
    oscB.connect(gainB)
    gainB.connect(heartbeatGain)
    oscB.start(time + 0.18)
    oscB.stop(time + 0.35)
  }

  const updateHeartbeat = (): void => {
    const scene = getScene()
    if (!scene.gameStarted || scene.winShown || scene.deathShown) {
      requestAnimationFrame(updateHeartbeat)
      return
    }

    let minDist = Number.POSITIVE_INFINITY
    scene.monsters.forEach((monster) => {
      const dist = Math.hypot(monster.x - scene.player.x, monster.y - scene.player.y)
      if (dist < minDist) {
        minDist = dist
      }
    })

    const danger = Math.max(0, 1 - minDist / 250)
    heartbeatGain.gain.setTargetAtTime(danger * 0.8, audioCtx.currentTime, 0.5)
    requestAnimationFrame(updateHeartbeat)
  }

  const scheduleThump = (): void => {
    thump()
    const scene = getScene()
    const minDist = scene.monsters.reduce((min, monster) => {
      return Math.min(min, Math.hypot(monster.x - scene.player.x, monster.y - scene.player.y))
    }, Number.POSITIVE_INFINITY)
    const danger = Math.max(0, 1 - minDist / 250)
    const interval = 300 + 700 * (1 - danger)
    registerTimeout(scheduleThump, interval)
  }

  registerTimeout(scheduleThump, 2000)
  updateHeartbeat()

  const playKeyCollect = (): void => {
    const time = audioCtx.currentTime

    const makeTone = (frequency: number, startGain: number, endTime: number): void => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      const filter = audioCtx.createBiquadFilter()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(frequency, time)
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, endTime)

      filter.type = 'highpass'
      filter.frequency.setValueAtTime(700, time)

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(startGain, time + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start(time)
      osc.stop(endTime + 0.03)
    }

    makeTone(880, 0.3, time + 0.11)
    makeTone(1320, 0.2, time + 0.14)
  }

  const playJumpscare = (): void => {
    const time = audioCtx.currentTime

    const noiseDuration = 0.35
    const noiseSize = Math.max(1, Math.floor(audioCtx.sampleRate * noiseDuration))
    const noiseBuffer = audioCtx.createBuffer(1, noiseSize, audioCtx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseSize; i += 1) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.9
    }

    const noiseSource = audioCtx.createBufferSource()
    noiseSource.buffer = noiseBuffer

    const noiseFilter = audioCtx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(1800, time)
    noiseFilter.Q.setValueAtTime(0.9, time)

    const noiseGain = audioCtx.createGain()
    noiseGain.gain.setValueAtTime(0.001, time)
    noiseGain.gain.exponentialRampToValueAtTime(0.26, time + 0.03)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDuration)

    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noiseSource.start(time)
    noiseSource.stop(time + noiseDuration + 0.02)

    const makeStab = (frequency: number, decay: number, gainPeak: number): void => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      const filter = audioCtx.createBiquadFilter()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(frequency, time)
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.45), time + decay)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(2400, time)
      filter.frequency.exponentialRampToValueAtTime(380, time + decay)

      gain.gain.setValueAtTime(0.001, time)
      gain.gain.exponentialRampToValueAtTime(gainPeak, time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start(time)
      osc.stop(time + decay + 0.04)
    }

    makeStab(260, 0.24, 0.2)
    makeStab(130, 0.28, 0.16)
  }

  const playSpellCast = (): void => {
    const time = audioCtx.currentTime

    const crackDuration = 0.22
    const crackSize = Math.max(1, Math.floor(audioCtx.sampleRate * crackDuration))
    const crackBuffer = audioCtx.createBuffer(1, crackSize, audioCtx.sampleRate)
    const crackData = crackBuffer.getChannelData(0)
    for (let i = 0; i < crackSize; i += 1) {
      crackData[i] = Math.random() * 2 - 1
    }

    const crackSource = audioCtx.createBufferSource()
    crackSource.buffer = crackBuffer

    const crackFilter = audioCtx.createBiquadFilter()
    crackFilter.type = 'highpass'
    crackFilter.frequency.setValueAtTime(1100, time)

    const crackGain = audioCtx.createGain()
    crackGain.gain.setValueAtTime(0.001, time)
    crackGain.gain.exponentialRampToValueAtTime(0.2, time + 0.015)
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + crackDuration)

    crackSource.connect(crackFilter)
    crackFilter.connect(crackGain)
    crackGain.connect(master)
    crackSource.start(time)
    crackSource.stop(time + crackDuration + 0.02)

    const rumbleOsc = audioCtx.createOscillator()
    const rumbleFilter = audioCtx.createBiquadFilter()
    const rumbleGain = audioCtx.createGain()

    rumbleOsc.type = 'triangle'
    rumbleOsc.frequency.setValueAtTime(95, time + 0.03)
    rumbleOsc.frequency.exponentialRampToValueAtTime(42, time + 0.75)

    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.setValueAtTime(220, time)

    rumbleGain.gain.setValueAtTime(0.001, time + 0.02)
    rumbleGain.gain.exponentialRampToValueAtTime(0.16, time + 0.14)
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.95)

    rumbleOsc.connect(rumbleFilter)
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(master)
    rumbleOsc.start(time + 0.02)
    rumbleOsc.stop(time + 1)
  }

  return {
    setMuted,
    playKeyCollect,
    playJumpscare,
    playSpellCast,
    stop: () => {
      timers.forEach((id) => window.clearTimeout(id))
      audioCtx.close().catch(() => {
        // Ignore close errors for browsers that already closed the context.
      })
    },
  }
}
