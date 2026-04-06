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

export function LostWoodsGame() {
  const { canvasRef, ui, startGame, restart } = useLostWoodsGame()

  return (
    <main className="lost-woods-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Lost Woods game canvas" />

      <div className="game-ui">
        <div className="keys-display">
          KEYS <span>{ui.collectedKeys}</span> / <span>{ui.totalKeys}</span>
        </div>
        <div className="controls-hint">WASD / ARROWS · SHIFT to run</div>
      </div>

      <div className="stamina-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ui.stamina}>
        <div className="stamina-label">STAMINA</div>
        <div className="stamina-track">
          <div
            className={`stamina-fill ${staminaClassName(ui.stamina)}`}
            style={{ width: `${ui.stamina}%` }}
          />
        </div>
      </div>

      <div className={`hint ${ui.hintVisible ? 'hint-visible' : 'hint-hidden'}`}>move toward the light</div>

      {ui.overlayVisible && (
        <section className="overlay-screen">
          <h1>LOST WOODS</h1>
          <p className="tagline">A HORROR EXPERIENCE</p>
          <p className="desc">Collect all 5 keys hidden in the forest.</p>
          <p className="desc">Use WASD or Arrow Keys to move.</p>
          <p className="desc">Hold Shift to run, but watch your stamina.</p>
          <p className="sub-desc">Your flashlight is your only friend.</p>
          <p className="warn">You are not alone in these woods.</p>
          <button type="button" className="action-btn action-btn-start" onClick={startGame}>
            ENTER THE FOREST
          </button>
        </section>
      )}

      {ui.jumpscareVisible && (
        <section className="jumpscare-screen">
          <div className="jumpscare-inner">
            <div className="jumpscare-face">{ui.jumpscareText}</div>
          </div>
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
