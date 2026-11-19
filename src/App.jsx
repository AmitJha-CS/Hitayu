import { useEffect, useState } from "react";

/* ---------- Content: edit these lists to update the site ---------- */

const products = [
  { name: "Tulsi Drops", use: "Daily immunity routine", note: "Holy basil, cold-extracted" },
  { name: "Ashwagandha Root Powder", use: "Calm energy and evening wind-down", note: "Sun-dried, single origin" },
  { name: "Triphala Churna", use: "Gentle digestion at night", note: "Amla, haritaki and bibhitaki" },
  { name: "Neem and Giloy Tablets", use: "Seasonal skin and balance", note: "No fillers, no binders" },
  { name: "Brahmi Hair Oil", use: "Scalp and head massage", note: "Cold-pressed sesame base" },
  { name: "Morning Herbal Chai", use: "A caffeine-light warm start", note: "Ginger, tulsi, cardamom" },
];

const habits = [
  { time: "5:30", title: "Wake with the light", text: "Drink a glass of warm water. Skip the phone for the first twenty minutes." },
  { time: "6:00", title: "Move and breathe", text: "Fifteen minutes of yoga, then five minutes of slow breathing." },
  { time: "8:00", title: "Eat a warm breakfast", text: "Seasonal fruit, soaked nuts or porridge with a herbal tea." },
  { time: "13:00", title: "Make lunch your main meal", text: "Eat sitting down, without screens. Walk for ten minutes afterward." },
  { time: "19:00", title: "Keep dinner light", text: "Soups, khichdi or steamed vegetables. Finish at least two hours before bed." },
  { time: "21:30", title: "Wind down", text: "Warm herbal infusion, a gentle foot massage and lights out by ten." },
];

const yoga = {
  Morning: [
    { pose: "Surya Namaskar", time: "5 rounds", how: "Flow through the twelve steps with the breath. One breath for each movement." },
    { pose: "Tadasana", time: "1 minute", how: "Stand tall with feet together, shoulders loose, weight even on both feet." },
    { pose: "Bhujangasana", time: "5 breaths", how: "Lie on your belly, press into your palms and lift the chest. Keep the elbows soft." },
  ],
  Focus: [
    { pose: "Vrikshasana", time: "30 sec each side", how: "Balance on one foot and place the other against the calf or thigh. Fix your gaze on a single point." },
    { pose: "Nadi Shodhana", time: "5 minutes", how: "Sit tall and breathe through alternate nostrils, slowly and evenly." },
    { pose: "Ardha Matsyendrasana", time: "5 breaths each side", how: "Sit with a long spine and twist from the belly, not the neck." },
  ],
  Evening: [
    { pose: "Balasana", time: "2 minutes", how: "Kneel, fold forward and rest your forehead on the floor. Let the back widen with each breath." },
    { pose: "Viparita Karani", time: "5 minutes", how: "Lie with your legs up a wall and arms open. Breathe slowly." },
    { pose: "Shavasana", time: "5 minutes", how: "Lie flat, release every muscle and let the breath settle by itself." },
  ],
};

/* ---------- Breathing guide (hero) ---------- */

const phases = [
  { label: "Breathe in", secs: 4, scale: 1 },
  { label: "Hold", secs: 4, scale: 1 },
  { label: "Breathe out", secs: 6, scale: 0.5 },
];

function BreathGuide() {
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(2);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setI((n) => (n + 1) % phases.length), phases[i].secs * 1000);
    return () => clearTimeout(t);
  }, [running, i]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      setI(2);
    } else {
      setRunning(true);
      setI(0);
    }
  };

  const p = phases[i];
  return (
    <div className="breath">
      <div className="breath-stage" aria-live="polite">
        <div
          className="breath-orb"
          style={{ transform: `scale(${p.scale})`, transitionDuration: running ? `${p.secs}s` : "0.8s" }}
        />
        <span className="breath-label">{running ? p.label : "Ready when you are"}</span>
      </div>
      <button className="btn btn-primary" onClick={toggle}>
        {running ? "Stop" : "Start a one-minute breath"}
      </button>
      <p className="breath-note">In for 4, hold for 4, out for 6.</p>
    </div>
  );
}

/* ---------- Page ---------- */

function Leaf() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19c0-8 5-14 15-14 0 9-5 15-13 15" fill="#2f6b3f" />
      <path d="M5 19c3-5 6-8 11-11" stroke="#f3f6ef" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState("Morning");

  return (
    <>
      <header className="nav">
        <a href="#top" className="brand">
          <Leaf /> Hitayu
        </a>
        <nav aria-label="Main">
          <a href="#herbs">Herbal products</a>
          <a href="#habits">Daily habits</a>
          <a href="#yoga">Yoga</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>Live lightly. Eat from the earth.</h1>
            <p>
              Hitayu makes organic herbal products and shares the daily habits and yoga that go with
              them. Start with one calm minute below.
            </p>
            <div className="row">
              <a className="btn btn-primary" href="#herbs">Shop herbal products</a>
              <a className="btn btn-ghost" href="#yoga">Try a yoga routine</a>
            </div>
          </div>
          <BreathGuide />
        </section>

        <section id="herbs" className="section">
          <div className="section-head">
            <h2>Herbal products</h2>
            <p>Made in small batches from organically grown herbs, with ingredients listed in full on every pack.</p>
          </div>
          <ul className="products">
            {products.map((p) => (
              <li key={p.name}>
                <h3>{p.name}</h3>
                <span>{p.use}</span>
                <span className="muted">{p.note}</span>
                <a href="#contact">Ask about this</a>
              </li>
            ))}
          </ul>
          <p className="fine">
            Herbal products support wellbeing and are not a substitute for medical advice. Speak to a doctor
            if you are pregnant, on medication or have a health condition.
          </p>
        </section>

        <section id="habits" className="section band">
          <div className="section-head">
            <h2>A day of good habits</h2>
            <p>A simple rhythm, based on Ayurvedic daily routine. Adjust the times to fit your life.</p>
          </div>
          <ol className="timeline">
            {habits.map((h) => (
              <li key={h.time}>
                <time>{h.time}</time>
                <div>
                  <h3>{h.title}</h3>
                  <p>{h.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="yoga" className="section">
          <div className="section-head">
            <h2>Yoga for every part of the day</h2>
            <p>Pick a time of day and follow the poses in order. Move slowly and stop if anything hurts.</p>
          </div>
          <div className="tabs" role="tablist">
            {Object.keys(yoga).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? "tab on" : "tab"}
                onClick={() => setTab(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <ul className="poses" role="tabpanel">
            {yoga[tab].map((y) => (
              <li key={y.pose}>
                <h3>{y.pose}</h3>
                <span className="chip">{y.time}</span>
                <p>{y.how}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="contact" className="section contact">
          <h2>Talk to Hitayu</h2>
          <p>Questions about a product, a wholesale order or a wellness workshop? Write to us and we will reply within two working days.</p>
          <a className="btn btn-primary" href="mailto:hello@hitayu.com">Email hello@hitayu.com</a>
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Hitayu. Organic living for everyday balance.</span>
      </footer>
    </>
  );
}
