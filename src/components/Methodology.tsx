import { ArrowUpRight, ChevronDown, LockKeyhole, ShieldCheck } from 'lucide-react';
import { publicAsset } from '../lib/publicAsset';

const definitions = [
  ['Modeled enrollment date', 'September 9 of the cohort year plus the recorded enrollment-day offset, calculated in UTC.'],
  ['Cumulative enrollment', 'Enrollment records whose modeled join date is on or before the date cursor. Unique people across cohorts cannot be deduplicated.'],
  ['Dated outcomes', 'Only enrollment and first deployment have reconstructable dates. Stage, assessment and credential views show eventual cohort outcomes.'],
  ['Deployment rate', 'Records at stage S2 or above ÷ all records in the current view.'],
  ['Public launch rate', 'Records at stage S5 or above ÷ all records in the current view.'],
  ['Capstone rate', 'Records at stage S7 ÷ all records in the current view.'],
  ['Live at 90 days', 'Deployed records marked live at 90 days ÷ deployed records in the current view.'],
  ['Score gain', 'Average post-score minus pre-score, across records in the current view.'],
  ['Time to first deployment', 'Median modeled days among deployed records in the current view.'],
  ['30-day app users', 'Sum of user counts on deployed apps. People may appear in more than one app.'],
];

export default function Methodology() {
  return (
    <section className="methodology-view" aria-labelledby="methodology-title">
      <header className="page-header">
        <span className="eyebrow">USSI / THE EVIDENCE STANDARD</span>
        <h1 id="methodology-title">Trust is part<br /><em>of the interface.</em></h1>
        <p>Beautiful numbers still need a source, a definition, and an honest boundary. Here is what the outcomes explorer can tell you.</p>
      </header>

      <div className="panel method-intro">
        <ShieldCheck size={26} aria-hidden="true" />
        <div>
          <span className="eyebrow">SYNTHETIC / MODELED</span>
          <h2>Every record in this explorer is generated.</h2>
          <p>The supplied AI Pioneer explorer contains 34,300 synthetic learner records for the 2024–2026 cohorts. These records support program design, measurement planning, and interface prototyping. They are not observed learner results, verified enrollment totals, or real app telemetry.</p>
        </div>
        <dl className="method-facts">
          <div><dt>2024 model</dt><dd>6,200 records</dd></div>
          <div><dt>2025 model</dt><dd>11,300 records</dd></div>
          <div><dt>2026 model</dt><dd>16,800 records</dd></div>
          <div><dt>Source generation</dt><dd>PCG64 · seed 20270101</dd></div>
        </dl>
      </div>

      <div className="methodology-details">
        <details className="panel method-detail" open>
          <summary><span><span className="eyebrow">01 / DEFINITIONS</span><h2>Know what the denominator is.</h2></span><ChevronDown size={20} aria-hidden="true" /></summary>
          <p>Filters change the population in view. A percentage of all modeled learners answers a different question from a percentage of deployed projects.</p>
          <div className="method-table-wrap">
            <table className="method-table">
              <caption className="sr-only">Definitions used for modeled outcome measures</caption>
              <thead><tr><th scope="col">Measure</th><th scope="col">Definition</th></tr></thead>
              <tbody>{definitions.map(([measure, definition]) => <tr key={measure}><th scope="row">{measure}</th><td>{definition}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="method-note">A modeled learner can deploy an app and record several production deployments. Project counts, deployment events, and learner counts are different measures. App user totals are not a deduplicated count of people across the ecosystem.</p>
        </details>

        <details className="panel method-detail">
          <summary><span><span className="eyebrow">02 / INTERPRETATION</span><h2>A model is a question worth testing.</h2></span><ChevronDown size={20} aria-hidden="true" /></summary>
          <p>Rising outcome rates across cohorts are built into the source model’s assumptions about curriculum maturity, facilitator experience, and managed hosting. They do not establish that those changes caused an improvement.</p>
          <p>There is no control or comparison group. Enrollment selection is not modeled as a random sample, site codes do not identify real clubs, and pre/post score changes are not causal evidence. Use these views to explore a measurement design, not to cite observed impact.</p>
        </details>

        <details className="panel method-detail">
          <summary><span><span className="eyebrow">03 / THE NEXT COHORT</span><h2><LockKeyhole size={19} aria-hidden="true" />2027 stays sealed.</h2></span><ChevronDown size={20} aria-hidden="true" /></summary>
          <p>The source marks the 2027 cohort and the 2026 cohort’s retention into 2027 as sealed until March 30, 2027. This USSI preview includes only the supplied 2024–2026 records.</p>
          <p>The date is a source-data boundary, not a promise of an automatic release. A future cohort appears only when a new dataset is explicitly reviewed and published.</p>
        </details>

        <details className="panel method-detail">
          <summary><span><span className="eyebrow">04 / PUBLIC METRICS</span><h2>Measured impact needs a deliberate handoff.</h2></span><ChevronDown size={20} aria-hidden="true" /></summary>
          <p>A future Arsenal admin connection can publish approved aggregate metrics with a source, reporting period, denominator, update time, and review status. That connection is not active in this preview.</p>
          <p>Private learner records, protected course content, account information, and operating data stay in their existing systems. USSI is a public discovery and measurement surface; public summaries should never require exposing individual learner data.</p>
        </details>
      </div>

      <div className="method-source-links">
        <div><span className="eyebrow">OPEN THE SOURCES</span><p>Compare the experience with the supplied explorer and inspect the USSI project.</p></div>
        <a href={publicAsset('reference/outcomes-explorer.html')} target="_blank" rel="noopener noreferrer">Original outcomes explorer<ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
        <a href="https://github.com/Bluenot3/united-states-super-intelligence-app" target="_blank" rel="noopener noreferrer">USSI source repository<ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
      </div>
    </section>
  );
}
