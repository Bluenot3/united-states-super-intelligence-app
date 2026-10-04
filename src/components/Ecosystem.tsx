import { ArrowUpRight, ChevronDown, LockKeyhole } from 'lucide-react';

export interface EcosystemProps {
  compact?: boolean;
}

interface EcosystemEntry {
  id: string;
  title: string;
  description: string;
  capabilities: string[];
  href?: string;
  action?: string;
  status?: string;
  detail: string;
}

interface EcosystemGroup {
  title: string;
  description: string;
  entries: EcosystemEntry[];
}

const groups: EcosystemGroup[] = [
  {
    title: 'Build',
    description: 'Turn an idea into something people can use.',
    entries: [
      {
        id: 'arsenal',
        title: 'Arsenal',
        description: 'The operating environment for agents, creative work, and deployable systems.',
        capabilities: ['Agents', 'Zen Mode', 'Z-ENGINE', 'Tune'],
        href: 'https://arsenal.world',
        action: 'Enter Arsenal',
        detail: 'Agents, Zen Mode, Z-ENGINE, and Tune belong to the existing Arsenal environment. Open Arsenal to use the surfaces available to your account. Zen Mode supports creation; protected lessons, learner progress, and course completion stay in their program pathways.',
      },
      {
        id: 'files-vault',
        title: 'Files / Vault',
        description: 'Keep the knowledge behind the work and the artifacts that come out of it.',
        capabilities: ['Knowledge', 'Projects', 'Artifacts'],
        href: 'https://arsenal.world',
        action: 'Open Arsenal',
        detail: 'Files, knowledge sources, and project artifacts remain in Arsenal with their ownership and access controls. USSI provides public context; your workspace is where you create, inspect, and manage the work.',
      },
    ],
  },
  {
    title: 'Learn',
    description: 'Build capability. Carry the proof forward.',
    entries: [
      {
        id: 'pioneer',
        title: 'AI Pioneer',
        description: 'Youth AI literacy through building, launching, and explaining real projects.',
        capabilities: ['Ages 11–18', 'Learn · build · deploy · prove'],
        href: 'https://arsenal.world/programs/pioneer',
        action: 'Explore the program',
        detail: 'The program pathway lives in Arsenal. Participation, guided learning, project work, and protected progress belong there. The outcomes you can explore here are explicitly modeled records for understanding the measurement framework.',
      },
      {
        id: 'vanguard',
        title: 'Vanguard',
        description: 'AI literacy and operator skills for adults, founders, and career changers.',
        capabilities: ['Adult learning', 'Operational capability'],
        href: 'https://arsenal.world/programs/vanguard',
        action: 'Explore the program',
        detail: 'Vanguard connects practical AI learning with useful workflows and working systems. Review its current program pathway in Arsenal for access, requirements, and available delivery.',
      },
      {
        id: 'credentials',
        title: 'Credentials / Zen Cards',
        description: 'Proof attached to the work, with a public record you can inspect.',
        capabilities: ['Evidence', 'Capability', 'Public record'],
        href: 'https://www.zenai.world/legacy-dossier',
        action: 'Inspect the record',
        detail: 'ZEN credentials and Zen Cards are the ecosystem’s proof layer. The Legacy Dossier opens the existing public program record. It is a source of evidence; an entry in the synthetic outcomes model does not issue a real credential.',
      },
    ],
  },
  {
    title: 'Operate',
    description: 'Connect intelligence to accountable, repeatable work.',
    entries: [
      {
        id: 'automation',
        title: 'Agents & automation',
        description: 'Tools, memory, workflows, schedules, and human approvals in one operating layer.',
        capabilities: ['Workflows', 'Schedules', 'Channels'],
        href: 'https://arsenal.world',
        action: 'Build in Arsenal',
        detail: 'Arsenal is the execution infrastructure. It connects agents with knowledge, tools, recurring work, and delivery channels. Available tools and integrations depend on the account and configuration in the existing platform.',
      },
      {
        id: 'business-spaces',
        title: 'Business Spaces',
        description: 'An operator cockpit for teams, knowledge, agents, and coordinated work.',
        capabilities: ['Teams', 'Operational context', 'Work queues'],
        status: 'Admin preview',
        detail: 'Business Spaces remains an admin preview in this USSI release. There is no public launch action here. Its existing Arsenal implementation keeps responsibility for access, agents, files, and operational workflows.',
      },
    ],
  },
  {
    title: 'Explore',
    description: 'Read the record. Find your next direction.',
    entries: [
      {
        id: 'arena',
        title: 'ZEN AI Arena',
        description: 'A model comparison and AI exploration pathway within the ZEN ecosystem.',
        capabilities: ['AI exploration', 'Model comparison'],
        href: 'https://arsenal.world',
        action: 'Explore Arsenal',
        detail: 'The ZEN ecosystem includes AI Arena as a model exploration direction. Start in Arsenal to inspect the AI tools available to your account; USSI does not run a second model router or promise a separate Arena session.',
      },
      {
        id: 'zen-world',
        title: 'ZEN AI World',
        description: 'The public home for achievements, programs, ideas, and the people behind the work.',
        capabilities: ['Public work', 'ZEN Weekly', 'Legacy Dossier'],
        href: 'https://www.zenai.world',
        action: 'Visit ZEN',
        detail: 'ZEN AI World is the public company gateway. Discover the founding record, program pathways, public work, field archive, and published intelligence, then continue into Arsenal when you are ready to build.',
      },
    ],
  },
];

const compactEntries = groups.flatMap((group) => group.entries).filter((entry) =>
  ['arsenal', 'pioneer', 'vanguard'].includes(entry.id),
);

function EcosystemRow({ entry, index }: { entry: EcosystemEntry; index: number }) {
  return (
    <article className={`ecosystem-row${entry.status ? ' ecosystem-row-preview' : ''}`}>
      <div className="ecosystem-row-main">
        <span className="ecosystem-row-index" aria-hidden="true">{String(index).padStart(2, '0')}</span>
        <div className="ecosystem-row-copy">
          <div className="ecosystem-row-title">
            <h3>{entry.title}</h3>
            {entry.status && <span className="status-pill"><LockKeyhole size={12} aria-hidden="true" />{entry.status}</span>}
          </div>
          <p>{entry.description}</p>
          <div className="ecosystem-capabilities" aria-label={`${entry.title} capabilities`}>
            {entry.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
          </div>
        </div>
        {entry.href && (
          <a className="ecosystem-row-action" href={entry.href} target="_blank" rel="noopener noreferrer">
            <span>{entry.action}</span><ArrowUpRight size={18} aria-hidden="true" />
            <span className="sr-only"> (opens a new tab)</span>
          </a>
        )}
      </div>
      <details className="ecosystem-row-detail">
        <summary>{entry.status ? 'About the admin preview' : 'How it connects'}<ChevronDown size={14} aria-hidden="true" /></summary>
        <p>{entry.detail}</p>
      </details>
    </article>
  );
}

export default function Ecosystem({ compact = false }: EcosystemProps) {
  if (compact) {
    return (
      <section className="ecosystem-compact" aria-labelledby="compact-ecosystem-title">
        <div className="section-title">
          <span className="eyebrow">THE CONNECTED ECOSYSTEM</span>
          <h2 id="compact-ecosystem-title">An idea. A skill. A working system.</h2>
        </div>
        <div className="ecosystem-compact-grid">
          {compactEntries.map((entry, index) => (
            <a key={entry.id} href={entry.href} className="ecosystem-compact-item" target="_blank" rel="noopener noreferrer">
              <span className="ecosystem-row-index">0{index + 1}</span>
              <div><h3>{entry.title}</h3><p>{entry.description}</p></div>
              <ArrowUpRight size={20} aria-hidden="true" />
              <span className="sr-only">Opens a new tab</span>
            </a>
          ))}
        </div>
      </section>
    );
  }

  let rowIndex = 0;

  return (
    <section className="ecosystem-view" aria-labelledby="ecosystem-title">
      <header className="page-header">
        <span className="eyebrow">USSI / THE ZEN ECOSYSTEM</span>
        <h1 id="ecosystem-title">An ecosystem.<br /><em>One ambition.</em></h1>
        <p>Intelligence becomes capability when learning, creation, operations, and proof work together. Find the part of ZEN that moves your ambition forward.</p>
      </header>
      <div className="ecosystem-groups">
        {groups.map((group, groupIndex) => (
          <section className="ecosystem-group" key={group.title} aria-labelledby={`ecosystem-group-${groupIndex}`}>
            <header className="ecosystem-group-header">
              <span className="eyebrow">0{groupIndex + 1}</span>
              <h2 id={`ecosystem-group-${groupIndex}`}>{group.title}</h2>
              <p>{group.description}</p>
            </header>
            <div className="ecosystem-rows">
              {group.entries.map((entry) => <EcosystemRow entry={entry} index={++rowIndex} key={entry.id} />)}
            </div>
          </section>
        ))}
      </div>
      <aside className="ecosystem-footnote">
        <span className="eyebrow">ONE CONNECTED SYSTEM</span>
        <p>Discover the ecosystem here. Your account, projects, programs, and operating tools continue in Arsenal.</p>
        <a href="https://arsenal.world" target="_blank" rel="noopener noreferrer">Continue to Arsenal<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
      </aside>
    </section>
  );
}
