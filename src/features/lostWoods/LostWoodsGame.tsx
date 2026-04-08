import { useCallback, useEffect, useRef, useState } from 'react'
import './LostWoodsGame.css'
import { InfoContent } from './InfoContent'
import { useLostWoodsGame } from './useLostWoodsGame'

const INTRO_SLIDES = [
  {
    location: 'NORTH AFRICA · KHOUMIRI FOREST',
    lines: [
      'A child has been taken.',
      'Abducted by a cult that believes innocent blood',
      'can be used in rituals to summon buried treasure.',
    ],
  },
  {
    location: null,
    lines: [
      'They are being held inside an abandoned building',
      'deep in the forest.',
      'The door is locked.',
      'Five keys were scattered across the woods by the fleeing cult.',
      'Find them all.',
    ],
  },
  {
    location: null,
    lines: [
      'The forest is not empty.',
      'Dark entities guard these woods.',
      'Do not shine your flashlight directly at them —',
      'they will follow you, and they will not stop.',
    ],
  },
  {
    location: null,
    lines: [
      'Before you left, the village elder gave you a spell.',
      'If a djinn gets too close, cast it.',
      'It will destroy them.',
      'Use it wisely — it takes time to recharge.',
    ],
  },
]

const FADE_DURATION_MS = 800
const DEATH_LINES = [
  'You died before the ritual could be stopped.',
  'You failed to save the child.',
  'In the dark beyond the trees, the sacrifice was completed.',
  'Now the forest keeps what remains of both of you.',
]

function IntroAnimation({ onFinish }: { onFinish: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advance = useCallback(() => {
    if (phase !== 'hold') return
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('out')
    timerRef.current = setTimeout(() => {
      setSlideIndex((i) => {
        const next = i + 1
        if (next >= INTRO_SLIDES.length) {
          onFinish()
          return i
        }
        setPhase('in')
        timerRef.current = setTimeout(() => setPhase('hold'), FADE_DURATION_MS)
        return next
      })
    }, FADE_DURATION_MS)
  }, [phase, onFinish])

  useEffect(() => {
    timerRef.current = setTimeout(() => setPhase('hold'), FADE_DURATION_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const slide = INTRO_SLIDES[slideIndex]
  const isLast = slideIndex === INTRO_SLIDES.length - 1

  return (
    <section
      className="intro-screen"
      role="button"
      tabIndex={0}
      onClick={advance}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() } }}
      aria-label="Story introduction, click to advance"
    >
      <div className={`intro-slide intro-slide-${phase}`}>
        {slide.location && (
          <p className="intro-location">{slide.location}</p>
        )}
        <div className="intro-lines">
          {slide.lines.map((line, i) => (
            <p
              key={i}
              className="intro-line"
              style={{ animationDelay: `${FADE_DURATION_MS + i * 180}ms` }}
            >
              {line || <span>&nbsp;</span>}
            </p>
          ))}
        </div>
      </div>
      <div className="intro-controls">
        <span className="intro-advance-hint">
          {isLast ? 'ENTER THE FOREST' : 'click to continue'}
        </span>
        <button
          type="button"
          className="intro-skip-btn"
          onClick={(e) => { e.stopPropagation(); onFinish() }}
        >
          SKIP
        </button>
      </div>
      <div className="intro-progress">
        {INTRO_SLIDES.map((_, i) => (
          <span key={i} className={`intro-pip ${i <= slideIndex ? 'intro-pip-active' : ''}`} />
        ))}
      </div>
    </section>
  )
}

function DeathAnimation({ onFinish }: { onFinish: () => void }) {
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowButton(true), FADE_DURATION_MS + DEATH_LINES.length * 260)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <section className="intro-screen death-intro-screen" aria-label="Death ending">
      <div className="intro-slide intro-slide-hold death-intro-slide">
        <p className="intro-location death-location">KHOUMIRI FOREST</p>
        <div className="intro-lines">
          <h2 className="death-title">YOU DIED</h2>
          {DEATH_LINES.map((line, i) => (
            <p
              key={i}
              className="intro-line death-line"
              style={{ animationDelay: `${FADE_DURATION_MS + i * 220}ms` }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className={`intro-controls death-controls ${showButton ? 'death-controls-visible' : 'death-controls-hidden'}`}>
        <button type="button" className="action-btn action-btn-death" onClick={onFinish}>
          MAIN MENU
        </button>
      </div>
    </section>
  )
}

const staminaClassName = (stamina: number): string => {
  if (stamina > 55) {
    return 'stamina-good'
  }
  if (stamina > 22) {
    return 'stamina-mid'
  }
  return 'stamina-low'
}

const SoundIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mute-icon">
    <path d="M3 10h4l5-4v12l-5-4H3z" fill="currentColor" />
    {!muted && (
      <>
        <path d="M15 9a4 4 0 010 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17.5 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
    {muted && <path d="M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
  </svg>
)

export function LostWoodsGame() {
  const {
    canvasRef,
    ui,
    isMuted,
    toggleMute,
    enterMainMenu,
    startGame,
    finishIntro,
    pauseGame,
    resumeGame,
    backToMainMenu,
    restart,
    goToControls,
    goToInfo,
    goToMainMenu,
  } = useLostWoodsGame()
  const showHud = !ui.firstLoadVisible && !ui.mainMenuVisible && !ui.introVisible
  const lifeIcons = Array.from({ length: ui.totalLives }, (_, index) => index < ui.lives)

  return (
    <main className="lost-woods-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Lost Woods game canvas" />

      {showHud && (
        <div className="game-ui">
          <div className="keys-display">
            KEYS <span>{ui.collectedKeys}</span> / <span>{ui.totalKeys}</span>
          </div>
          <div className="lives-display" aria-label={`${ui.lives} of ${ui.totalLives} lives remaining`}>
            <span className="lives-label">LIVES</span>
            <div className="lives-icons" aria-hidden="true">
              {lifeIcons.map((isActive, index) => (
                <span key={index} className={`life-icon ${isActive ? 'life-icon-active' : 'life-icon-lost'}`}>
                  ☠
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="mute-btn hud-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <SoundIcon muted={isMuted} />
          </button>
          <button
            type="button"
            className="pause-btn hud-pause-btn"
            onClick={ui.paused ? resumeGame : pauseGame}
            aria-label={ui.paused ? 'Resume game (Esc)' : 'Pause game (Esc)'}
            title={ui.paused ? 'Resume game (Esc)' : 'Pause game (Esc)'}
          >
            {ui.paused ? 'RESUME (ESC)' : 'PAUSE (ESC)'}
          </button>
          <div className={`spell-panel ${ui.spellReady ? 'spell-ready' : 'spell-cooling'}`}>
            <div className="spell-header">
              SPELL <span className="spell-keybind">E</span>
            </div>
            <div className="spell-track">
              <div className="spell-fill" style={{ width: `${ui.spellCooldownPercent}%` }} />
            </div>
            <div className="spell-status">{ui.spellReady ? 'READY' : `RECHARGING ${ui.spellCooldownSeconds}s`}</div>
          </div>
        </div>
      )}

      {showHud && (
        <div className="stamina-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ui.stamina}>
          <div className="stamina-label">STAMINA</div>
          <div className="stamina-track">
            <div
              className={`stamina-fill ${staminaClassName(ui.stamina)}`}
              style={{ width: `${ui.stamina}%` }}
            />
          </div>
          <div className="sprint-hint">hold Shift to sprint</div>
        </div>
      )}

      {showHud && <div className={`hint ${ui.hintVisible ? 'hint-visible' : 'hint-hidden'}`}>find the keys to open the door</div>}

      {ui.introVisible && <IntroAnimation onFinish={finishIntro} />}

      {ui.firstLoadVisible && (
        <section
          className="first-load-screen"
          role="button"
          tabIndex={0}
          onClick={enterMainMenu}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              enterMainMenu()
            }
          }}
        >
          <h1>LOST WOODS</h1>
          <p className="tagline">A HORROR EXPERIENCE</p>
          <p className="desc">Click anywhere to continue</p>
        </section>
      )}

      {ui.mainMenuVisible && ui.currentMenuScreen === 'main' && (
        <section className="overlay-screen">
          <h1>LOST WOODS</h1>
          <p className="tagline">A HORROR EXPERIENCE</p>
          <button
            type="button"
            className="mute-btn menu-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <SoundIcon muted={isMuted} />
          </button>
          <div className="menu-buttons">
            <button type="button" className="action-btn action-btn-start" onClick={startGame}>
              ENTER THE FOREST
            </button>
            <button type="button" className="action-btn action-btn-menu" onClick={goToControls}>
              CONTROLS
            </button>
            <button type="button" className="action-btn action-btn-menu" onClick={goToInfo}>
              INFO
            </button>
          </div>
        </section>
      )}

      {ui.mainMenuVisible && ui.currentMenuScreen === 'controls' && (
        <section className="overlay-screen">
          <h1>CONTROLS</h1>
          <div className="menu-content">
            <p className="control-item"><span className="control-key">WASD / Arrow Keys</span> - Move around the forest</p>
            <p className="control-item"><span className="control-key">Shift</span> - Sprint (consumes stamina)</p>
            <p className="control-item"><span className="control-key">E</span> - Cast purge spell (30s cooldown)</p>
            <p className="control-item"><span className="control-key">Esc</span> - Pause and resume game</p>
            <p className="control-item separator">OBJECTIVE</p>
            <p className="control-item">Collect all 5 keys hidden in the forest</p>
            <p className="control-item">Avoid the creatures lurking in the darkness</p>
            <p className="control-item">Use your flashlight to navigate and the spell to defend yourself</p>
          </div>
          <button
            type="button"
            className="mute-btn menu-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <SoundIcon muted={isMuted} />
          </button>
          <button type="button" className="action-btn action-btn-menu" onClick={goToMainMenu}>
            BACK
          </button>
        </section>
      )}

      {ui.mainMenuVisible && ui.currentMenuScreen === 'info' && (
        <section className="overlay-screen overlay-screen-info">
          <div className="menu-content menu-content-info">
            <InfoContent />
          </div>
          <button
            type="button"
            className="mute-btn menu-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <SoundIcon muted={isMuted} />
          </button>
          <button type="button" className="action-btn action-btn-menu info-back-btn" onClick={goToMainMenu}>
            BACK
          </button>
        </section>
      )}

      {ui.paused && (
        <section className="result-screen pause-screen">
          <h2>PAUSED</h2>
          <p>Take a breath. The woods can wait.</p>
          <button
            type="button"
            className="mute-btn menu-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            <SoundIcon muted={isMuted} />
          </button>
          <button type="button" className="action-btn action-btn-pause" onClick={resumeGame}>
            RESUME
          </button>
          <button type="button" className="action-btn action-btn-pause" onClick={backToMainMenu}>
            MAIN MENU
          </button>
        </section>
      )}

      {ui.jumpscareVisible && (
        <section className="jumpscare-screen">
          <div className="jumpscare-text">YOU'VE BEEN CAUGHT</div>
        </section>
      )}

      {ui.winVisible && (
        <section className="result-screen win-screen">
          <h2>YOU ESCAPED</h2>
          <p>The forest releases you for now.</p>
          <button type="button" className="action-btn action-btn-win" onClick={restart}>
            PLAY AGAIN
          </button>
        </section>
      )}

      {ui.deathVisible && (
        <DeathAnimation onFinish={backToMainMenu} />
      )}
    </main>
  )
}
