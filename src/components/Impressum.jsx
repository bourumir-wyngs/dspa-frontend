function Impressum ({ suppressLabInfo = false }) {
  return (
    <>
      <main className="about">
      <div className="impressum-overview-container">
          <span className="impressum-header">Impressum</span><br />
          {!suppressLabInfo && (
            <>
              <a
                className="result-text"
                href="https://imsb.ethz.ch/research/picotti.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Picotti/Beltrao Lab
              </a><br />
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default Impressum;
