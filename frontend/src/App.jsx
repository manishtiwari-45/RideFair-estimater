import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { getFairPrice, detectScam, getHotspots } from './api'
import './App.css'

// ── Small reusable spinner ────────────────────────────────────────────────────
function Spinner() {
  return <span className="spinner" aria-label="Loading" />
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {

  // ── Hotspot / Map state ───────────────────────────────────────────────────
  const [hotspots, setHotspots] = useState([])
  const [mapError, setMapError] = useState(null)

  // ── Price predictor state ─────────────────────────────────────────────────
  const [priceInputs,  setPriceInputs]  = useState({ dist: '', hour: '', weekend: '0' })
  const [priceResult,  setPriceResult]  = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError,   setPriceError]   = useState(null)
  const [priceFieldErr,setPriceFieldErr]= useState({})

  // ── Scam detector state ───────────────────────────────────────────────────
  const [scamInputs,  setScamInputs]  = useState({ dist: '', price: '' })
  const [scamResult,  setScamResult]  = useState(null)
  const [scamLoading, setScamLoading] = useState(false)
  const [scamError,   setScamError]   = useState(null)
  const [scamFieldErr,setScamFieldErr]= useState({})

  // ── Load hotspots on mount ────────────────────────────────────────────────
  useEffect(() => {
    getHotspots().then(data => {
      if (data.error) setMapError(data.error)
      else            setHotspots(data.hotspots)
    })
  }, [])

  // ── Price form validation ─────────────────────────────────────────────────
  const validatePrice = () => {
    const e = {}
    if (!priceInputs.dist || parseFloat(priceInputs.dist) <= 0)
      e.dist = 'Enter a distance greater than 0'
    if (priceInputs.hour === '' || parseInt(priceInputs.hour) < 0 || parseInt(priceInputs.hour) > 23)
      e.hour = 'Hour must be between 0 and 23'
    return e
  }

  const handlePredictPrice = async () => {
    const errs = validatePrice()
    if (Object.keys(errs).length) { setPriceFieldErr(errs); return }
    setPriceFieldErr({})
    setPriceLoading(true)
    setPriceError(null)
    setPriceResult(null)
    const data = await getFairPrice(priceInputs.dist, priceInputs.hour, priceInputs.weekend)
    if (data.error) setPriceError(data.error)
    else            setPriceResult(data)
    setPriceLoading(false)
  }

  // ── Scam form validation ──────────────────────────────────────────────────
  const validateScam = () => {
    const e = {}
    if (!scamInputs.dist  || parseFloat(scamInputs.dist)  <= 0) e.dist  = 'Enter a distance greater than 0'
    if (!scamInputs.price || parseFloat(scamInputs.price) <= 0) e.price = 'Enter a price greater than 0'
    return e
  }

  const handleDetectScam = async () => {
    const errs = validateScam()
    if (Object.keys(errs).length) { setScamFieldErr(errs); return }
    setScamFieldErr({})
    setScamLoading(true)
    setScamError(null)
    setScamResult(null)
    const data = await detectScam(scamInputs.dist, scamInputs.price)
    if (data.error) setScamError(data.error)
    else            setScamResult(data)
    setScamLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-wrapper">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="site-header">
        <h1 className="logo">🚖 RideFair</h1>
        <p className="tagline">
          AI-powered auto fare estimator — know the fair price before you negotiate.
        </p>
        <div className="badge-row">
          <span className="badge">Linear Regression</span>
          <span className="badge">Logistic Regression</span>
          <span className="badge">K-Means Clustering</span>
          <span className="badge">FastAPI + React</span>
        </div>
      </header>

      {/* ── Map: K-Means Hotspots ───────────────────────────────────────── */}
      <section aria-label="Hotspot Map">
        <div className="card">
          <div className="card-header">
            <span aria-hidden="true">📍</span>
            <h2>High Demand Zones</h2>
            <span className="algo-pill">K-Means</span>
          </div>
          <p className="card-subtitle">
            AI-clustered pickup hotspots based on historical ride data.
          </p>

          {mapError ? (
            <div className="error-banner" role="alert">⚠️ {mapError}</div>
          ) : (
            <div className="map-wrapper">
              <MapContainer
                center={[28.58, 77.33]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {hotspots.map((pt, idx) => (
                  <Marker key={idx} position={[pt.lat, pt.lon]}>
                    <Popup>🔥 Hotspot Zone {idx + 1}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>
      </section>

      {/* ── Two-column: Predictor + Detector ───────────────────────────── */}
      <div className="two-col">

        {/* ── Linear Regression: Price Predictor ─────────────── */}
        <div className="card">
          <div className="card-header">
            <span aria-hidden="true">💰</span>
            <h2>Fair Price Predictor</h2>
            <span className="algo-pill">Linear Reg.</span>
          </div>
          <p className="card-subtitle">
            Enter your trip details to get the fair fare estimate.
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="price-dist">Distance (km)</label>
              <input
                id="price-dist"
                type="number"
                placeholder="e.g. 5"
                min="0.1"
                value={priceInputs.dist}
                className={priceFieldErr.dist ? 'error' : ''}
                onChange={e => setPriceInputs({ ...priceInputs, dist: e.target.value })}
              />
              {priceFieldErr.dist && <span className="field-error">{priceFieldErr.dist}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="price-hour">Hour of day (0–23)</label>
              <input
                id="price-hour"
                type="number"
                placeholder="e.g. 10"
                min="0" max="23"
                value={priceInputs.hour}
                className={priceFieldErr.hour ? 'error' : ''}
                onChange={e => setPriceInputs({ ...priceInputs, hour: e.target.value })}
              />
              {priceFieldErr.hour && <span className="field-error">{priceFieldErr.hour}</span>}
            </div>

            <div className="form-group span-full">
              <label htmlFor="price-weekend">Day type</label>
              <select
                id="price-weekend"
                onChange={e => setPriceInputs({ ...priceInputs, weekend: e.target.value })}
              >
                <option value="0">Weekday</option>
                <option value="1">Weekend</option>
              </select>
            </div>
          </div>

          <button
            id="btn-predict-price"
            className="btn btn-primary"
            onClick={handlePredictPrice}
            disabled={priceLoading}
          >
            {priceLoading ? <><Spinner /> Estimating…</> : '⚡ Estimate Fair Fare'}
          </button>

          {priceError && (
            <div className="error-banner" role="alert">⚠️ {priceError}</div>
          )}

          {priceResult && (
            <div className="result-box price-result" role="region" aria-label="Price result">
              <div className="result-price">₹{priceResult.fair_price}</div>
              <div className="result-label">{priceResult.message}</div>
            </div>
          )}
        </div>

        {/* ── Logistic Regression: Scam Detector ─────────────── */}
        <div className="card">
          <div className="card-header">
            <span aria-hidden="true">🚨</span>
            <h2>Scam Detector</h2>
            <span className="algo-pill">Logistic Reg.</span>
          </div>
          <p className="card-subtitle">
            Enter the driver's quoted price to check if it's fair.
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="scam-dist">Distance (km)</label>
              <input
                id="scam-dist"
                type="number"
                placeholder="e.g. 5"
                min="0.1"
                value={scamInputs.dist}
                className={scamFieldErr.dist ? 'error' : ''}
                onChange={e => setScamInputs({ ...scamInputs, dist: e.target.value })}
              />
              {scamFieldErr.dist && <span className="field-error">{scamFieldErr.dist}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="scam-price">Price Asked (₹)</label>
              <input
                id="scam-price"
                type="number"
                placeholder="e.g. 150"
                min="1"
                value={scamInputs.price}
                className={scamFieldErr.price ? 'error' : ''}
                onChange={e => setScamInputs({ ...scamInputs, price: e.target.value })}
              />
              {scamFieldErr.price && <span className="field-error">{scamFieldErr.price}</span>}
            </div>
          </div>

          <button
            id="btn-detect-scam"
            className="btn btn-danger"
            onClick={handleDetectScam}
            disabled={scamLoading}
          >
            {scamLoading ? <><Spinner /> Analyzing…</> : '🔍 Check for Scam'}
          </button>

          {scamError && (
            <div className="error-banner" role="alert">⚠️ {scamError}</div>
          )}

          {scamResult && (
            <div
              className={`result-box ${scamResult.verdict === 'SCAM' ? 'scam-result' : 'safe-result'}`}
              role="region"
              aria-label="Scam detection result"
            >
              <div className={`verdict-text ${scamResult.verdict === 'SCAM' ? 'verdict-scam' : 'verdict-safe'}`}>
                {scamResult.verdict === 'SCAM' ? '🚨 SCAM' : '✅ FAIR'}
              </div>
              <div className="result-label" style={{ marginTop: '5px' }}>
                {scamResult.warning}
              </div>

              <div className="probability-bar-wrap">
                <div className="probability-label">
                  <span>Scam Probability</span>
                  <span>{scamResult.scam_probability}%</span>
                </div>
                <div className="probability-bar">
                  <div
                    className="probability-fill"
                    style={{ width: `${scamResult.scam_probability}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>{/* end .two-col */}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        Built with FastAPI · React · Scikit-Learn · Leaflet Maps
      </footer>

    </div>
  )
}

export default App
