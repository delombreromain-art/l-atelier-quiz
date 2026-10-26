"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MAX_QUESTIONS, MAX_QUESTION_LIBRARY, makeQuestion, parseQuizCsv, type QuizProject, type QuizQuestion } from "@/lib/quiz";
import "./questions.css";
export default function QuestionsPage() {
  const [project, setProject] = useState<QuizProject | null>(null); const [loaded, setLoaded] = useState(false); const [saveState, setSaveState] = useState("Chargement…"); const [search, setSearch] = useState(""); const [feedback, setFeedback] = useState(""); const [filter, setFilter] = useState<"all" | "active" | "inactive">("all"); const [shownCount, setShownCount] = useState(50); const [draggedId, setDraggedId] = useState<string | null>(null); const [dropTarget, setDropTarget] = useState<{ id: string; placement: "before" | "after" } | null>(null); const batchSize = 50; const sentinelRef = useRef<HTMLDivElement>(null); const dragYRef = useRef<number | null>(null);
  useEffect(() => { fetch("/api/project", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(); setProject(await r.json() as QuizProject); setLoaded(true); setSaveState("Enregistré"); }).catch(() => { setLoaded(true); setSaveState("Erreur de chargement"); }); }, []);
  useEffect(() => { if (!loaded || !project) return; setSaveState("Enregistrement…"); const timer = window.setTimeout(async () => { try { const r = await fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) }); if (!r.ok) throw new Error(); setSaveState("Toutes les modifications sont enregistrées"); } catch { setSaveState("Échec de l’enregistrement"); } }, 450); return () => window.clearTimeout(timer); }, [loaded, project]);
  useEffect(() => {
    if (!draggedId) return;
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const trackPointer = (event: DragEvent) => { dragYRef.current = event.clientY; };
    let frame = 0;
    const autoScroll = () => {
      const y = dragYRef.current;
      const edge = 110;
      if (y !== null && y < edge) window.scrollBy(0, -Math.min(18, Math.max(2, (edge - y) * 0.18)));
      else if (y !== null && y > window.innerHeight - edge) window.scrollBy(0, Math.min(18, Math.max(2, (y - window.innerHeight + edge) * 0.18)));
      frame = window.requestAnimationFrame(autoScroll);
    };
    window.addEventListener("dragover", trackPointer);
    frame = window.requestAnimationFrame(autoScroll);
    return () => { window.removeEventListener("dragover", trackPointer); window.cancelAnimationFrame(frame); root.style.scrollBehavior = previousScrollBehavior; dragYRef.current = null; };
  }, [draggedId]);
  const activeCount = project?.questions.filter(q => q.enabled !== false).length ?? 0;
  const updateQuestion = useCallback((id: string, patch: Partial<QuizQuestion>) => setProject(current => current ? ({ ...current, questions: current.questions.map(q => q.id === id ? { ...q, ...patch } : q) }) : current), []);
  const addQuestion = () => {
    if (!project || project.questions.length >= MAX_QUESTION_LIBRARY) return;
    const q = makeQuestion(project.questions.length + 1);
    q.id = `question-${crypto.randomUUID()}`;
    q.enabled = activeCount < MAX_QUESTIONS;
    const nextCount = project.questions.length + 1;
    setProject({ ...project, questions: [...project.questions, q] });
    setSearch(""); setFilter("all"); setShownCount(nextCount);
    setFeedback(q.enabled ? "Question ajoutee et activee." : "Question ajoutee. Activez-la quand une place se libere.");
    window.setTimeout(() => {
      const card = document.getElementById(`question-card-${q.id}`);
      if (card) window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - (window.innerHeight - card.offsetHeight) / 2);
      card?.querySelector<HTMLTextAreaElement>(".ql-field textarea")?.focus({ preventScroll: true });
    }, 250);
  };
  const importCsv = async (file: File, mode: "replace" | "append") => { try { const imported = parseQuizCsv(await file.text()); if (!project) return; if (mode === "replace" && !window.confirm(`Remplacer les ${project.questions.length} questions actuelles par ${imported.length} nouvelles questions ?`)) return; const base = mode === "replace" ? [] : project.questions; if (base.length + imported.length > MAX_QUESTION_LIBRARY) throw new Error(`La bibliothèque est limitée à ${MAX_QUESTION_LIBRARY} questions.`); const slots = Math.max(0, MAX_QUESTIONS - base.filter(q => q.enabled !== false).length); const rows = imported.map((q, i) => ({ ...q, id: `question-${crypto.randomUUID()}-${i}`, enabled: i < slots })); setProject({ ...project, questions: [...base, ...rows] }); setShownCount(50); setFeedback(`${imported.length} questions importées. ${Math.min(imported.length, slots)} activées${imported.length > slots ? `, ${imported.length - slots} laissées décochées (limite de 60)` : ""}.`); } catch (e) { setFeedback(e instanceof Error ? e.message : "Import CSV impossible."); } };
  const reorderQuestion = (sourceId: string, targetId: string, placement: "before" | "after") => {
    if (!project || sourceId === targetId) return;
    const questions = [...project.questions];
    const sourceIndex = questions.findIndex(question => question.id === sourceId);
    if (sourceIndex < 0) return;
    const [moving] = questions.splice(sourceIndex, 1);
    const targetIndex = questions.findIndex(question => question.id === targetId);
    if (targetIndex < 0) return;
    questions.splice(targetIndex + (placement === "after" ? 1 : 0), 0, moving);
    if (questions.every((question, index) => question.id === project.questions[index].id)) return;
    setProject({ ...project, questions });
    setFeedback("Question reordonnee. Le nouvel ordre est enregistre dans le quiz.");
    setDraggedId(null); setDropTarget(null);
  };
  const moveWithKeyboard = (id: string, index: number, direction: -1 | 1) => {
    if (!project) return;
    const target = project.questions[index + direction];
    if (target) reorderQuestion(id, target.id, direction < 0 ? "before" : "after");
  };
  const toggle = (q: QuizQuestion, enabled: boolean) => { if (enabled && activeCount >= MAX_QUESTIONS) { setFeedback("La sélection est complète (60/60). Décochez une question avant d’en activer une autre."); return; } updateQuestion(q.id, { enabled }); setFeedback(""); };
  const remove = (q: QuizQuestion) => { if (!project || project.questions.length <= 1 || !window.confirm("Supprimer définitivement cette question de la bibliothèque ?")) return; setProject({ ...project, questions: project.questions.filter(x => x.id !== q.id) }); };
  const visible = useMemo(() => project?.questions.map((question, index) => ({ question, index })).filter(({ question }) => `${question.title} ${question.prompt} ${question.answer} ${question.answerCommentary}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")) && (filter === "all" || (filter === "active") === (question.enabled !== false))) ?? [], [project, search, filter]);
  const visibleRows = visible.slice(0, shownCount);
  useEffect(() => { const sentinel = sentinelRef.current; if (!sentinel || shownCount >= visible.length) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setShownCount(count => Math.min(count + batchSize, visible.length)); }, { rootMargin: "0px" }); observer.observe(sentinel); return () => observer.disconnect(); }, [shownCount, visible.length]);
  return <main className="question-library"><header className="ql-top"><Link href="/" className="ql-back">← Retour au studio vidéo</Link><div className="ql-status"><i />{saveState}</div></header>
    <section className="ql-hero"><div><span className="ql-eyebrow">L’ATELIER QUIZ · BIBLIOTHÈQUE</span><h1>Questions &amp; réponses</h1><p>Importez, corrigez et sélectionnez les questions qui composeront votre prochaine vidéo.</p></div><div className="ql-count"><b>{activeCount}<small> / 60</small></b><span>questions activées</span><div className="ql-meter"><i style={{ width: `${Math.min(activeCount / 60 * 100, 100)}%` }} /></div><em>{project?.questions.length ?? 0} dans la bibliothèque</em></div></section>
    <section className="ql-toolbar"><div className="ql-imports"><label className="ql-button ql-primary">＋ Importer un CSV<input type="file" accept=".csv,text/csv" disabled={!project} onChange={e => { const f=e.target.files?.[0]; if(f) void importCsv(f,"replace"); e.currentTarget.value=""; }}/></label><label className="ql-button">Ajouter depuis un CSV<input type="file" accept=".csv,text/csv" disabled={!project} onChange={e => { const f=e.target.files?.[0]; if(f) void importCsv(f,"append"); e.currentTarget.value=""; }}/></label><button className="ql-button" onClick={addQuestion} disabled={!project || project.questions.length>=MAX_QUESTION_LIBRARY}>＋ Nouvelle question</button></div><span className="ql-csv-hint">CSV : <code>titre, question, reponse, commentaire</code> · jusqu’à {MAX_QUESTION_LIBRARY.toLocaleString("fr-FR")} questions</span></section>
    {feedback && <div className="ql-feedback" role="status">{feedback}<button onClick={()=>setFeedback("")}>×</button></div>}
    <section className="ql-list-head"><div><h2>Votre bibliothèque</h2><small className="ql-order-hint">Glissez la poignee pour reordonner les questions.</small><span>{visible.length} résultat{visible.length>1?"s":""}</span></div><div className="ql-filters"><input aria-label="Rechercher une question" value={search} onChange={e=>{setSearch(e.target.value);setShownCount(50);}} placeholder="⌕  Rechercher…"/><div>{(["all","active","inactive"] as const).map(key=><button key={key} className={filter===key?"selected":""} onClick={()=>{setFilter(key);setShownCount(50);}}>{key==="all"?"Toutes":key==="active"?"Activées":"Désactivées"}</button>)}</div></div></section>
    {!loaded ? <div className="ql-empty">Ouverture de la bibliothèque…</div> : !visible.length ? <div className="ql-empty">{project?.questions.length?"Aucune question ne correspond à cette recherche.":"Votre bibliothèque est vide. Importez un CSV ou ajoutez une question."}</div> : <div className="ql-cards">{visibleRows.map(({question:q,index})=><article id={`question-card-${q.id}`} className={`ql-card ${q.enabled===false?"is-off":""} ${draggedId===q.id?"is-dragging":""} ${dropTarget?.id===q.id?`drop-${dropTarget.placement}`:""}`} key={q.id} onDragOver={e=>{const source=draggedId||e.dataTransfer.getData("text/plain");if(!source||source===q.id)return;e.preventDefault();e.dataTransfer.dropEffect="move";const rect=e.currentTarget.getBoundingClientRect();const placement: "before"|"after"=e.clientY<rect.top+rect.height/2?"before":"after";setDropTarget(current=>current?.id===q.id&&current.placement===placement?current:{id:q.id,placement});}} onDrop={e=>{e.preventDefault();const source=draggedId||e.dataTransfer.getData("text/plain");if(source)reorderQuestion(source,q.id,dropTarget?.id===q.id?dropTarget.placement:"before");setDraggedId(null);setDropTarget(null);}}><div className="ql-card-top"><span className="ql-number">{String(index+1).padStart(2,"0")}</span><button type="button" className="ql-drag-handle" draggable aria-label={`Glisser la question ${index+1} pour changer son ordre`} title="Glisser pour reordonner" onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",q.id);dragYRef.current=e.clientY;setDraggedId(q.id);}} onDragEnd={()=>{setDraggedId(null);setDropTarget(null);}} onKeyDown={e=>{if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();moveWithKeyboard(q.id,index,e.key==="ArrowUp"?-1:1);}}}>&#x2807;</button><label className="ql-active"><input type="checkbox" checked={q.enabled!==false} onChange={e=>toggle(q,e.target.checked)}/><span className="ql-switch"/><b>{q.enabled===false?"Désactivée":"Dans la vidéo"}</b></label><button className="ql-delete" title="Supprimer cette question" onClick={()=>remove(q)}>Supprimer</button></div>
      <label className="ql-field"><span>TITRE <small>FACULTATIF</small></span><input value={q.title} maxLength={100} placeholder="Ex. Géographie" onChange={e=>updateQuestion(q.id,{title:e.target.value})}/></label><label className="ql-field"><span>QUESTION <small>{q.prompt.length}/1 000</small></span><textarea value={q.prompt} maxLength={1000} rows={2} placeholder="Saisissez la question…" onChange={e=>updateQuestion(q.id,{prompt:e.target.value})}/></label><div className="ql-answer-row"><label className="ql-field"><span>RÉPONSE <small>{q.answer.length}/500</small></span><textarea value={q.answer} maxLength={500} rows={2} placeholder="Saisissez la bonne réponse…" onChange={e=>updateQuestion(q.id,{answer:e.target.value})}/></label><label className="ql-field"><span>COMMENTAIRE DE LA RÉPONSE <small>FACULTATIF · {q.answerCommentary.length}/1 000</small></span><textarea value={q.answerCommentary} maxLength={1000} rows={2} placeholder="Une précision à afficher et lire après la réponse…" onChange={e=>updateQuestion(q.id,{answerCommentary:e.target.value})}/></label></div></article>)}</div>}
    {visible.length > shownCount && <div className="ql-scroll-sentinel" ref={sentinelRef} aria-live="polite">Descendez pour afficher la suite... {visible.length - shownCount} questions restantes</div>}
    <footer className="ql-footer"><Link href="/">← Revenir à la vidéo</Link><span>Les changements sont enregistrés automatiquement et repris dans le studio vidéo.</span></footer></main>;
}
