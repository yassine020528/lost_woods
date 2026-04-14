import { useCallback, useEffect, useRef, useState } from 'react'
import './LostWoodsGame.css'
import { InfoContent } from './InfoContent'
import { useLostWoodsGame } from './useLostWoodsGame'

const INTRO_SLIDES = [
  {
    location: 'NORTH AFRICA · KHMIR FOREST',
    lines: [
      'A baby has been taken.',
      'Abducted by a cult that believes innocent blood',
      'can be used in rituals to summon buried treasure.',
    ],
  },
  {
    location: null,
    lines: [
      'The baby is being held inside an abandoned building',
      'deep in the forest. The door is locked.',
      'Five keys were scattered across the woods by the fleeing cult.',
      'Find them all to open the door.',
    ],
  },
  {
    location: null,
    lines: [
      'The forest is not empty.',
      'Dark entities guard these woods.',
      'Do not shine your flashlight close to them,',
      'they will follow you, and they will not stop.',
    ],
  },
  {
    location: null,
    lines: [
      'The village elder gave you a spell before leaving to the woods.',
      'If dark entities get too close, cast it.',
      'It will destroy them.',
      'Use it wisely, it takes time to recharge.',
    ],
  },
]

const FADE_DURATION_MS = 800
const DESKTOP_MEDIA_QUERY = '(min-width: 1025px)'
const DEATH_LINES = [
  'You died before the ritual could be stopped.',
  'You failed to save the child.',
  'In the dark beyond the trees, the sacrifice was completed.',
  'Now the forest keeps what remains of both of you.',
]
const SAVED_BABY_SLIDES = [
  {
    location: null,
    lines: [],
  },
  {
    location: null,
    lines: [
      'You found the crib in the final room.',
      'You pulled the baby out before the ritual could be completed.',
      'For one child, the nightmare ended here.',
    ],
  },
  {
    location: null,
    lines: [
      'Each year, hundreds of children disappear across North Africa.',
      'Some are never found. Some return carrying stories no one wants to believe.',
      'The files stay open. The families stay waiting.',
    ],
  },
  {
    location: 'UNSOLVED CASE FILES',
    image: '/outro_image1.png',
    imageAlt: 'Portrait plaques of cemetery victims with their eyes covered',
    lines: [
      'In one cemetery, damaged portraits mark people said to be victims of sorcery.',
      'Sorcerers use the kidnapped children\'s blood to curse the victims,',
    ],
    caption: 'Undug portraits from a cemetery, associated with victims of sorcery.',
  },
  {
    location: 'UNSOLVED CASE FILES',
    image: '/outro_image2.png',
    imageAlt: 'A newspaper clipping about four missing children in a village',
    lines: [
      'A report tells of four children who vanished from a nearby village.',
      'The article offers no ending, only names, ages, and a silence',
      'that outlived the paper.',
    ],
    caption: 'Newspaper reports four missing children from a village in El Kef, Tunisia.',
  },
  {
    location: 'UNSOLVED CASE FILES',
    lines: [
      'Although the images used are AI-generated,',
      'the dark reality they reflect is all REAL.',
      'Hundreds of cases remain unsolved, while the rituals continue in the dark.',
      'And somewhere, a child is still waiting to be found.',
    ],
  },
]

function IntroAnimation({
  onFinish,
  isMuted,
  toggleMute,
}: {
  onFinish: () => void
  isMuted: boolean
  toggleMute: () => void
}) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const transitionToSlide = useCallback((getNextIndex: (current: number) => number) => {
    if (phase !== 'hold') return
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('out')
    timerRef.current = setTimeout(() => {
      setSlideIndex((i) => {
        const next = getNextIndex(i)
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

  const advance = useCallback(() => {
    transitionToSlide((current) => current + 1)
  }, [transitionToSlide])

  const goBack = useCallback(() => {
    transitionToSlide((current) => Math.max(current - 1, 0))
  }, [transitionToSlide])

  useEffect(() => {
    timerRef.current = setTimeout(() => setPhase('hold'), FADE_DURATION_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const slide = INTRO_SLIDES[slideIndex]
  const isLast = slideIndex === INTRO_SLIDES.length - 1
  const canGoBack = slideIndex > 0

  return (
    <section
      className="intro-screen"
      role="button"
      tabIndex={0}
      onClick={advance}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() } }}
      aria-label="Story introduction, click to advance"
    >
      <button
        type="button"
        className="mute-btn menu-mute-btn"
        onClick={(e) => {
          e.stopPropagation()
          toggleMute()
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        title={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        <SoundIcon muted={isMuted} />
      </button>
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
        <button
          type="button"
          className="intro-nav-btn"
          onClick={(e) => {
            e.stopPropagation()
            goBack()
          }}
          disabled={!canGoBack}
        >
          BACK
        </button>
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

function DeathAnimation({
  onFinish,
  isMuted,
  toggleMute,
}: {
  onFinish: () => void
  isMuted: boolean
  toggleMute: () => void
}) {
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowButton(true), FADE_DURATION_MS + DEATH_LINES.length * 260)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <section className="intro-screen death-intro-screen" aria-label="Death ending">
      <button
        type="button"
        className="mute-btn menu-mute-btn"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        title={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        <SoundIcon muted={isMuted} />
      </button>
      <div className="intro-slide intro-slide-hold death-intro-slide">
        <p className="intro-location death-location">KHMIR FOREST</p>
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

function SavedBabyAnimation({
  onFinish,
  isMuted,
  toggleMute,
}: {
  onFinish: () => void
  isMuted: boolean
  toggleMute: () => void
}) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slide = SAVED_BABY_SLIDES[slideIndex]
  const isLast = slideIndex === SAVED_BABY_SLIDES.length - 1
  const showRescueTitle = slideIndex <= 1

  const transitionToSlide = useCallback((getNextIndex: (current: number) => number) => {
    if (phase !== 'hold') {
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('out')
    timerRef.current = setTimeout(() => {
      setSlideIndex((current) => {
        const next = getNextIndex(current)
        setPhase('in')
        timerRef.current = setTimeout(() => setPhase('hold'), FADE_DURATION_MS)
        return next
      })
    }, FADE_DURATION_MS)
  }, [phase])

  const advance = useCallback(() => {
    if (isLast) {
      return
    }
    transitionToSlide((current) => Math.min(current + 1, SAVED_BABY_SLIDES.length - 1))
  }, [isLast, transitionToSlide])

  const goBack = useCallback(() => {
    transitionToSlide((current) => Math.max(current - 1, 0))
  }, [transitionToSlide])

  useEffect(() => {
    timerRef.current = setTimeout(() => setPhase('hold'), FADE_DURATION_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <section
      className="intro-screen saved-baby-screen"
      role={isLast ? undefined : 'button'}
      tabIndex={0}
      onClick={advance}
      onKeyDown={(e) => {
        if (isLast) {
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          advance()
        }
      }}
      aria-label="Baby rescue ending, click to advance"
    >
      <button
        type="button"
        className="mute-btn menu-mute-btn"
        onClick={(e) => {
          e.stopPropagation()
          toggleMute()
        }}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        title={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        <SoundIcon muted={isMuted} />
      </button>
      <div className="intro-slide intro-slide-hold death-intro-slide saved-baby-slide">
        {showRescueTitle && <h2 className="death-title saved-baby-title">YOU SAVED THE BABY</h2>}
        <div className="intro-lines saved-baby-lines">
          <div className={`saved-baby-body intro-slide intro-slide-${phase}`}>
            <div className={showRescueTitle ? '' : 'saved-baby-body-evidence'}>
              {slide.location && <p className="intro-location saved-baby-location">{slide.location}</p>}
              {'image' in slide && slide.image && (
                <figure className="saved-baby-figure">
                  <img className="saved-baby-image" src={slide.image} alt={slide.imageAlt ?? ''} />
                  {slide.caption && <figcaption className="saved-baby-caption">{slide.caption}</figcaption>}
                </figure>
              )}
              {slide.lines.map((line, i) => (
                <p
                  key={i}
                  className="intro-line death-line saved-baby-line"
                  style={{ animationDelay: `${FADE_DURATION_MS + i * 220}ms` }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={`intro-controls death-controls saved-baby-controls ${isLast && phase === 'hold' ? 'death-controls-visible' : 'death-controls-hidden'}`}>
        <button
          type="button"
          className="action-btn action-btn-save"
          onClick={(e) => {
            e.stopPropagation()
            onFinish()
          }}
        >
          MAIN MENU
        </button>
      </div>
      {!isLast && (
        <div className="intro-controls saved-baby-advance-controls">
          <button
            type="button"
            className="intro-nav-btn"
            onClick={(e) => {
              e.stopPropagation()
              goBack()
            }}
            disabled={slideIndex === 0}
          >
            BACK
          </button>
          <span className="intro-advance-hint">click to continue</span>
          <button
            type="button"
            className="intro-skip-btn"
            onClick={(e) => {
              e.stopPropagation()
              onFinish()
            }}
          >
            SKIP
          </button>
        </div>
      )}
      <div className="intro-progress">
        {SAVED_BABY_SLIDES.map((_, i) => (
          <span key={i} className={`intro-pip ${i <= slideIndex ? 'intro-pip-active' : ''}`} />
        ))}
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

function MobileUnavailableScreen() {
  return (
    <main className="mobile-unavailable-screen" aria-label="Desktop only message">
      <div className="mobile-unavailable-card">
        <h1>LOST WOODS</h1>
        <p className="mobile-unavailable-title">Desktop Only</p>
        <p className="mobile-unavailable-text">
          The game is only available on desktop right now.
        </p>
        <p className="mobile-unavailable-text">
          Phone and tablet support is not available at the moment, but it will be soon.
        </p>
      </div>
    </main>
  )
}

function LostWoodsGameDesktop() {
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
    goToControls,
    goToInfo,
    goToCredits,
    goToMainMenu,
  } = useLostWoodsGame()
  const showHud =
    !ui.firstLoadVisible &&
    !ui.mainMenuVisible &&
    !ui.introVisible &&
    !ui.enteringBuilding &&
    !ui.savedBabyTransitionVisible &&
    !ui.deathVisible &&
    !ui.savedBabyVisible
  const showOutdoorHud = showHud && !ui.buildingVisible
  const lifeIcons = Array.from({ length: ui.totalLives }, (_, index) => index < ui.lives)

  return (
    <main className="lost-woods-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Lost Woods game canvas" />

      {showHud && (
        <div className="game-ui">
          {showOutdoorHud && (
            <div className="keys-display">
              KEYS <span>{ui.collectedKeys}</span> / <span>{ui.totalKeys}</span>
            </div>
          )}
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
          {showOutdoorHud && (
            <div className={`spell-panel ${ui.spellReady ? 'spell-ready' : 'spell-cooling'}`}>
              <div className="spell-header">
                SPELL <span className="spell-keybind">E</span>
              </div>
              <div className="spell-track">
                <div className="spell-fill" style={{ width: `${ui.spellCooldownPercent}%` }} />
              </div>
              <div className="spell-status">{ui.spellReady ? 'READY' : `RECHARGING ${ui.spellCooldownSeconds}s`}</div>
            </div>
          )}
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

      {showHud && <div className={`hint ${ui.hintVisible ? 'hint-visible' : 'hint-hidden'}`}>{ui.hintText}</div>}

      {ui.introVisible && <IntroAnimation onFinish={finishIntro} isMuted={isMuted} toggleMute={toggleMute} />}

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
            <button type="button" className="action-btn action-btn-menu" onClick={goToCredits}>
              CREDITS
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
            <p className="control-item"><span className="control-key">F</span> - Toggle flashlight on and off</p>
            <p className="control-item"><span className="control-key">E</span> - Cast purge spell outdoors / save the baby indoors</p>
            <p className="control-item"><span className="control-key">Esc</span> - Pause and resume game</p>
            <p className="control-item separator">OBJECTIVE</p>
            <p className="control-item">Avoid the creatures lurking in the darkness</p>
            <p className="control-item">Monsters only chase when your flashlight is on, touching them deadly</p>
            <p className="control-item">Collect all 5 keys hidden in the forest to open the locked door</p>
            <p className="control-item">Find and save the child in the abandonned building</p>
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

      {ui.mainMenuVisible && ui.currentMenuScreen === 'credits' && (
        <section className="overlay-screen">
          <h1>CREDITS</h1>
          <div className="menu-content credits-content">
            <p className="credits-text">
              All images in the game are AI-generated.<br />Any resemblance to real people, places, or events is purely a matter of chance.
            </p>
            <p className="credits-text">
              The game&apos;s backstory is fictional, but it draws inspiration from a very real and tragic phenomenon: the kidnapping and exploitation of children for witchcraft purposes.
            </p>
            <p className="credits-text">
              The horror is imagined. The grief behind that reality is not.
            </p>
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

      {ui.enteringBuilding && (
        <section className="building-transition-screen" aria-label="Entering the abandoned building">
          <div className="building-transition-fade" />
        </section>
      )}

      {ui.savedBabyTransitionVisible && (
        <section className="saved-baby-transition-screen" aria-label="Saving the baby">
          <div className="saved-baby-transition-fade" />
        </section>
      )}

      {ui.deathVisible && <DeathAnimation onFinish={backToMainMenu} isMuted={isMuted} toggleMute={toggleMute} />}

      {ui.savedBabyVisible && <SavedBabyAnimation onFinish={backToMainMenu} isMuted={isMuted} toggleMute={toggleMute} />}
    </main>
  )
}

export function LostWoodsGame() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const handleChange = () => setIsDesktop(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  if (!isDesktop) {
    return <MobileUnavailableScreen />
  }

  return <LostWoodsGameDesktop />
}
