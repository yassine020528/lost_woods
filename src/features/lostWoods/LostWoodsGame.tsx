import './LostWoodsGame.css'
import { useLostWoodsGame } from './useLostWoodsGame'

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
    pauseGame,
    resumeGame,
    backToMainMenu,
    restart,
    goToControls,
    goToInfo,
    goToMainMenu,
  } = useLostWoodsGame()
  const showHud = !ui.firstLoadVisible && !ui.mainMenuVisible

  return (
    <main className="lost-woods-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Lost Woods game canvas" />

      {showHud && (
        <div className="game-ui">
          <div className="keys-display">
            KEYS <span>{ui.collectedKeys}</span> / <span>{ui.totalKeys}</span>
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

      {showHud && <div className={`hint ${ui.hintVisible ? 'hint-visible' : 'hint-hidden'}`}>move toward the light</div>}

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
        <section className="overlay-screen">
          <h1>INFO</h1>
          <div className="menu-content">
            <p className="info-placeholder">Coming soon...</p>
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
          <div className="jumpscare-text">IT FOUND YOU</div>
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
        <section className="result-screen death-screen">
          <h2>YOU ARE GONE</h2>
          <p>The forest swallowed you whole.</p>
          <button type="button" className="action-btn action-btn-death" onClick={restart}>
            TRY AGAIN
          </button>
        </section>
      )}
    </main>
  )
}
