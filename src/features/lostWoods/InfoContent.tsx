export function InfoContent() {
  return (
    <div className="info-paper" aria-label="Classified archive details">
      <header className="info-masthead">
        <p className="info-edition">ARCHIVE EDITION · RESTRICTED CIRCULATION</p>
        <h2>THE KHOUMIRI GAZETTE</h2>
        <p className="info-date">April 6, 1939 · Special Investigations Desk</p>
      </header>

      <section className="info-banner-story">
        <figure className="info-photo-frame info-photo-frame-lead">
          <img className="info-photo" src="/info_pic1.png" alt="An old archive photograph tied to Zouhri folklore" loading="lazy" />
          <figcaption>Recovered photograph, date unknown.</figcaption>
        </figure>
        <div className="info-banner-copy">
          <p className="info-kicker">CLASSIFIED ARCHIVE</p>
          <h3>THE ZOUHRI PHENOMENON</h3>
          <p>
            In remote pockets of North Africa, the word Zouhri is spoken in lowered voices. These children,
            said to be born under the star of Zohra (Venus), are feared and desired as living thresholds
            between the seen world and the unseen. Occult circles claim their blood carries a spiritual
            sweetness that pacifies the Djinn guarding buried wealth. Across decades, that superstition has
            fed a hidden trade where a child is treated less as a life and more as a key to forbidden doors.
          </p>
          <br />
          <p>
                <strong>OPERATIONAL DIRECTIVE:</strong> Intelligence reports confirm a child vanished from the 
                lower foothills seventy-two hours ago. To breach the rusted threshold of the abandoned structure 
                where they are reportedly held, you must scour the Khoumiri woods for the five golden keys 
                discarded by the panicked seekers. Recovery of the keys is the only path to the interior; 
                recovery of the child is the only path to penance.
          </p>
        </div>
      </section>

      <div className="info-columns">
        <section className="info-article-block">
          <h4>THE MARKERS</h4>
          <figure className="info-photo-frame info-photo-frame-small">
            <img className="info-photo" src="/info_pic2.png" alt="A palm sketch marking the so-called line of destiny" loading="lazy" />
            <figcaption>Field notes: line of destiny indicators.</figcaption>
          </figure>
          <p className="drop-cap">
            Their selection methods are methodical and ruthless. Seekers begin with the so-called line of
            destiny, a single horizontal crease across the palm, then move to rarer signs: heterochromia,
            unusual crown whorls, and inherited marks read like coded scripture. To the sorcerer, these are not
            medical curiosities but seals of claim. A child carrying several markers is whispered about as a
            Great Key, believed capable of unfastening vaults sealed for centuries.
          </p>
        </section>

        <section className="info-article-block">
          <h4>THE HUNT</h4>
          <figure className="info-photo-frame info-photo-frame-small">
            <img className="info-photo" src="/info_pic3.png" alt="A misty mountain forest resembling the Kroumirie region" loading="lazy" />
            <figcaption>Khoumiri foothills, where reports converge.</figcaption>
          </figure>
          <p className="drop-cap">
            The region is named after its people, the Khumayr (locally Khmir), whose mountain communities have
            long shaped life in these forests. In later folklore and criminal rumor, outside treasure hunters
            recast the Khoumiri as a ritual frontier, entering with old maps, grave stories, and borrowed
            incantations. Many locals describe a quieter truth: children vanish into myth first, then into
            silence. This archive records that silence, and the names that never came home.
          </p>
        </section>
      </div>
    </div>
  )
}
