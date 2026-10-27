"use client";

import { useState } from "react";

type StudioPage = "studio" | "questions" | "voice";

export function StudioSidebar({ projectId, questionCount, page }: { projectId: string; questionCount: number; page: StudioPage }) {
  const [musicOpen, setMusicOpen] = useState(false);
  const query = `?id=${encodeURIComponent(projectId)}`;
  const home = (section: string) => `/${query}#${section}`;
  const linkClass = (selected = false) => `side-nav-link${selected ? " nav-active" : ""}`;

  return <aside className="sidebar">
    <a href={home("accueil")} className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">AQ</span><span><strong>L’Atelier Quiz</strong><small>STUDIO LOCAL</small></span></a>
    <div className="sidebar-label">CRÉATION</div>
    <nav className="side-nav" aria-label="Navigation du studio">
      <a className={linkClass(page === "voice")} href={`/studio-vocal${query}`}><span aria-hidden="true">🎙</span> Studio vocal</a>
      <a className={linkClass()} href={home("introduction")}><span>01</span> Introduction</a>
      <div className="side-nav-group">
        <button className="side-nav-link side-nav-group-trigger" aria-expanded={musicOpen} onClick={() => setMusicOpen((open) => !open)}><span>02</span> Musiques &amp; sons <i>{musicOpen ? "−" : "+"}</i></button>
        {musicOpen && <div className="side-nav-submenu"><a className="side-nav-sublink" href={home("musique-introduction")}>Musique d’introduction</a><a className="side-nav-sublink" href={home("musique-theme")}>Musique du thème</a><a className="side-nav-sublink" href={home("son-compte-a-rebours")}>Son du compte à rebours</a><a className="side-nav-sublink" href={home("son-reponses")}>Son des bonnes réponses</a><a className="side-nav-sublink" href={home("musique-conclusion")}>Musique de conclusion</a></div>}
      </div>
      <a className={linkClass(page === "questions")} href={`/questions${query}`} aria-current={page === "questions" ? "page" : undefined}><span>03</span> Questions <small>{questionCount}/60</small></a>
      <a className={linkClass()} href={home("voix")}><span>04</span> Voix off</a>
      <a className={linkClass()} href={home("habillage")}><span>05</span> Décor &amp; logo</a>
      <a className={linkClass()} href={home("conclusion")}><span>06</span> Conclusion</a>
      <div className="sidebar-label sidebar-label-secondary">FINALISATION</div>
      <a className={linkClass()} href={home("preview")}><span>07</span> Prévisualisation</a>
      <a className={linkClass()} href={home("export")}><span>08</span> Export MP4</a>
    </nav>
    <div className="sidebar-spacer" />
    <div className="local-card"><span className="local-led" /><strong>Projet sur ce PC</strong><small>Questions, médias et voix sont enregistrés dans le dossier du projet.</small></div>
    <div className="sidebar-version">STUDIO LOCAL · 60 QUESTIONS MAX</div>
  </aside>;
}
