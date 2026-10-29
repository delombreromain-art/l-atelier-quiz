export const FPS = 30;
export const DEFAULT_QUESTION_SECONDS = 10;
export const LONG_QUESTION_SECONDS = 15;
export const LONG_QUESTION_CHARACTER_LIMIT = 150;
export const ANSWER_FRAMES = 4 * FPS;
export const TRANSITION_FRAMES = 1.5 * FPS;
export const THEME_FRAMES = 4 * FPS;
export const ENDING_PAUSE_FRAMES = Math.round(0.5 * FPS);
export const CONCLUSION_VOICE_DELAY_FRAMES = Math.round(0.2 * FPS);
export const CONCLUSION_VISUAL_FADE_FRAMES = Math.round(0.35 * FPS);
export const DEFAULT_INTRODUCTION_SECONDS = 20;
export const MIN_INTRODUCTION_SECONDS = 12;
export const MAX_INTRODUCTION_SECONDS = 40;
export const DEFAULT_CONCLUSION_SECONDS = 10;
export const MIN_CONCLUSION_SECONDS = 4;
export const MAX_CONCLUSION_SECONDS = 20;
export const INTRODUCTION_FRAMES = DEFAULT_INTRODUCTION_SECONDS * FPS;
export const INTRODUCTION_QUESTION_GAP_FRAMES = FPS;
export const MAX_QUESTIONS = 60;
export const MAX_QUESTION_LIBRARY = 5000;
export const RIDDLE_TITLE = "Guess the Hidden Expression!";

export type VoiceId = "fr_FR-siwis-medium" | "fr_FR-upmc-medium" | "fr_FR-tom-medium" | "fr_FR-mls-medium";
export type VoiceSource = "ai" | "recording";

export type RecordingTake = { id: string; path: string; duration: number; originalPath?: string; originalDuration?: number };
export type RecordingClip = { id: string; takeId: string; start: number; end: number; pauseAfter: number; transitionMs: number; waveform?: number[] };
export type IntroductionLayerId = "logo" | "questionsPanel" | "history" | "geography" | "science" | "cinema" | "hourglass";
export type IntroductionLayer = {
  image: string | null;
  x: number;
  y: number;
  width: number;
  zIndex: number;
  visible: boolean;
};
export type IntroductionLayers = Record<IntroductionLayerId, IntroductionLayer>;
export type IntroductionDelayedScene = {
  background: string | null;
  sound: string | null;
  logo: IntroductionLayer;
  questionsPanel: IntroductionLayer;
  transition: { effect: "lightning" | "none"; enabled: boolean; startSeconds: number; durationFrames: number; soundVolume: number };
};
export type ConclusionLayer = { x: number; y: number; width: number };
export const CONCLUSION_LAYER_DEFAULTS: ConclusionLayer = { x: 480, y: 240, width: 960 };
export const CONCLUSION_LAYER_2_DEFAULTS: ConclusionLayer = { x: 1240, y: 380, width: 500 };
export const CONCLUSION_LAYER_3_DEFAULTS: ConclusionLayer = { x: 180, y: 580, width: 480 };

export const INTRODUCTION_LAYER_DEFAULTS: IntroductionLayers = {
  logo: { image: null, x: 600, y: 24, width: 720, zIndex: 1, visible: true },
  questionsPanel: { image: null, x: 440, y: 340, width: 1040, zIndex: 2, visible: true },
  history: { image: null, x: 110, y: 750, width: 310, zIndex: 3, visible: true },
  geography: { image: null, x: 475, y: 750, width: 310, zIndex: 4, visible: true },
  science: { image: null, x: 840, y: 750, width: 310, zIndex: 5, visible: true },
  cinema: { image: null, x: 1205, y: 750, width: 310, zIndex: 6, visible: true },
  hourglass: { image: null, x: 1530, y: 370, width: 270, zIndex: 7, visible: true },
};
export const INTRODUCTION_DELAYED_SCENE_DEFAULTS: IntroductionDelayedScene = {
  background: null,
  sound: null,
  logo: { image: null, x: 64, y: 52, width: 210, zIndex: 1, visible: true },
  questionsPanel: { image: null, x: 440, y: 340, width: 1040, zIndex: 2, visible: true },
  transition: { effect: "lightning", enabled: false, startSeconds: 8, durationFrames: 12, soundVolume: 100 },
};
export const DECOR_LOGO_LAYER_DEFAULT: IntroductionLayer = { image: null, x: 64, y: 52, width: 210, zIndex: 20, visible: true };

export type QuizQuestion = {
  id: string;
  enabled: boolean;
  title: string;
  prompt: string;
  answer: string;
  answerCommentary: string;
  force15Seconds: boolean;
  isRiddle: boolean;
  image: string | null;
  answerImage: string | null;
  themeImage: string | null;
  startsTheme: boolean;
  themeTitle: string;
  keepImageOnAnswer: boolean;
  questionAudio: string | null;
  answerAudio: string | null;
  commentaryAudio: string | null;
  questionAudioVoice: VoiceId | null;
  answerAudioVoice: VoiceId | null;
  commentaryAudioVoice: VoiceId | null;
  questionAudioRate: number | null;
  answerAudioRate: number | null;
  commentaryAudioRate: number | null;
  questionAudioDuration: number | null;
  answerAudioDuration: number | null;
  commentaryAudioDuration: number | null;
  questionRecording: string | null;
  questionRecordingDuration: number | null;
  questionRecordingOriginal: string | null;
  questionRecordingOriginalDuration: number | null;
  questionRecordingTakes: RecordingTake[];
  questionRecordingClips: RecordingClip[];
  answerRecording: string | null;
  answerRecordingDuration: number | null;
  answerRecordingOriginal: string | null;
  answerRecordingOriginalDuration: number | null;
  answerRecordingTakes: RecordingTake[];
  answerRecordingClips: RecordingClip[];
  commentaryRecording: string | null;
  commentaryRecordingDuration: number | null;
  commentaryRecordingOriginal: string | null;
  commentaryRecordingOriginalDuration: number | null;
  commentaryRecordingTakes: RecordingTake[];
  commentaryRecordingClips: RecordingClip[];
  questionVoiceSource: VoiceSource;
  answerVoiceSource: VoiceSource;
  commentaryVoiceSource: VoiceSource;
};

export type QuizProject = {
  title: string;
  introductionText: string;
  introductionImage: string | null;
  introductionLayers: IntroductionLayers;
  introductionDelayedScene: IntroductionDelayedScene;
  introductionDurationSeconds: number;
  introductionAudio: string | null;
  introductionAudioDuration: number | null;
  introductionAudioVoice: VoiceId | null;
  introductionAudioRate: number | null;
  introductionRecording: string | null;
  introductionRecordingDuration: number | null;
  introductionRecordingOriginal: string | null;
  introductionRecordingOriginalDuration: number | null;
  introductionRecordingTakes: RecordingTake[];
  introductionRecordingClips: RecordingClip[];
  introductionVoiceSource: VoiceSource;
  introductionMusic: string | null;
  introductionMusicDuration: number | null;
  introductionMusicVolume: number;
  conclusionText: string;
  conclusionBackgroundImage: string | null;
  conclusionMusic: string | null;
  conclusionMusicVolume: number;
  conclusionImage: string | null;
  conclusionLayer: ConclusionLayer;
  conclusionImage2: string | null;
  conclusionLayer2: ConclusionLayer;
  conclusionImage3: string | null;
  conclusionLayer3: ConclusionLayer;
  conclusionDurationSeconds: number;
  conclusionAudio: string | null;
  conclusionAudioDuration: number | null;
  conclusionAudioVoice: VoiceId | null;
  conclusionAudioRate: number | null;
  conclusionRecording: string | null;
  conclusionRecordingDuration: number | null;
  conclusionRecordingOriginal: string | null;
  conclusionRecordingOriginalDuration: number | null;
  conclusionRecordingTakes: RecordingTake[];
  conclusionRecordingClips: RecordingClip[];
  conclusionVoiceSource: VoiceSource;
  introductionImages: string[];
  background: string | null;
  backgroundMusic: string | null;
  musicVolume: number;
  countdownSound: string | null;
  countdownSoundVolume: number;
  answerSound: string | null;
  answerSoundVolume: number;
  themeImage: string | null;
  logo: string | null;
  decorLogoLayer: IntroductionLayer;
  voice: VoiceId;
  themeTitle: string;
  speechRate: number;
  voiceVolume: number;
  questions: QuizQuestion[];
  archivedQuestions: QuizQuestion[];
};

export type QuizVideoProps = {
  project: QuizProject;
  questions: QuizQuestion[];
  questionOffset: number;
};

export const makeQuestion = (number: number): QuizQuestion => ({
  id: `question-${number}`,
  enabled: true,
  title: "",
  prompt: "",
  answer: "",
  answerCommentary: "",
  force15Seconds: false,
  isRiddle: false,
  image: null,
  answerImage: null,
  themeImage: null,
  startsTheme: false,
  themeTitle: "",
  keepImageOnAnswer: true,
  questionAudio: null,
  answerAudio: null,
  commentaryAudio: null,
  questionAudioVoice: null,
  answerAudioVoice: null,
  questionAudioRate: null,
  answerAudioRate: null,
  commentaryAudioVoice: null,
  commentaryAudioRate: null,
  questionAudioDuration: null,
  answerAudioDuration: null,
  commentaryAudioDuration: null,
  questionRecording: null,
  questionRecordingDuration: null,
  questionRecordingOriginal: null,
  questionRecordingOriginalDuration: null,
  questionRecordingTakes: [],
  questionRecordingClips: [],
  answerRecording: null,
  answerRecordingDuration: null,
  answerRecordingOriginal: null,
  answerRecordingOriginalDuration: null,
  answerRecordingTakes: [],
  answerRecordingClips: [],
  commentaryRecording: null,
  commentaryRecordingDuration: null,
  commentaryRecordingOriginal: null,
  commentaryRecordingOriginalDuration: null,
  commentaryRecordingTakes: [],
  commentaryRecordingClips: [],
  questionVoiceSource: "ai",
  answerVoiceSource: "ai",
  commentaryVoiceSource: "ai",
});

export const parseQuizCsv = (source: string): QuizQuestion[] => {
  const text = source.replace(/^\uFEFF/, "");
  const headerLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const delimiter = headerLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      if (cell.length > 0) throw new Error("Guillemet inattendu dans le fichier CSV.");
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Un champ entre guillemets n’est pas refermé.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("Le fichier doit contenir une ligne d’en-têtes et au moins une question.");

  const normalizeHeader = (header: string) => header.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ _-]+/g, "");
  const headers = rows[0].map(normalizeHeader);
  const questionColumn = headers.indexOf("question");
  const answerColumn = headers.indexOf("reponse");
  const titleColumn = headers.indexOf("titre");
  const commentaryColumn = headers.indexOf("commentaire");
  if (questionColumn < 0 || answerColumn < 0) throw new Error("Les colonnes obligatoires sont « question » et « reponse ». Consultez le format indiqué sous l’importeur.");

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_QUESTION_LIBRARY) throw new Error(`Le fichier contient ${dataRows.length} lignes ; la limite de la bibliotheque est de ${MAX_QUESTION_LIBRARY} questions.`);
  return dataRows.map((values, index) => {
    const read = (column: number) => column < 0 ? "" : (values[column] ?? "").trim();
    const prompt = read(questionColumn);
    const answer = read(answerColumn);
    const title = read(titleColumn);
    const answerCommentary = read(commentaryColumn);
    const rowNumber = index + 2;
    if (!prompt || !answer) throw new Error(`La ligne ${rowNumber} doit avoir une question et une réponse.`);
    if (prompt.length > 1000 || answer.length > 500 || title.length > 100 || answerCommentary.length > 1000) {
      throw new Error(`La ligne ${rowNumber} dépasse une limite : question 1 000, réponse 500, titre 100 ou commentaire 1 000 caractères.`);
    }
    return { ...makeQuestion(index + 1), title, prompt, answer, answerCommentary };
  });
};

export const defaultProject: QuizProject = {
  title: "Mon premier quiz",
  introductionText: "",
  introductionImage: null,
  introductionLayers: INTRODUCTION_LAYER_DEFAULTS,
  introductionDelayedScene: INTRODUCTION_DELAYED_SCENE_DEFAULTS,
  introductionDurationSeconds: DEFAULT_INTRODUCTION_SECONDS,
  introductionAudio: null,
  introductionAudioDuration: null,
  introductionAudioVoice: null,
  introductionAudioRate: null,
  introductionRecording: null,
  introductionRecordingDuration: null,
  introductionRecordingOriginal: null,
  introductionRecordingOriginalDuration: null,
  introductionRecordingTakes: [],
  introductionRecordingClips: [],
  introductionVoiceSource: "ai",
  introductionMusic: null,
  introductionMusicDuration: null,
  introductionMusicVolume: 35,
  conclusionText: "",
  conclusionBackgroundImage: null,
  conclusionMusic: null,
  conclusionMusicVolume: 35,
  conclusionImage: null,
  conclusionLayer: CONCLUSION_LAYER_DEFAULTS,
  conclusionImage2: null,
  conclusionLayer2: CONCLUSION_LAYER_2_DEFAULTS,
  conclusionImage3: null,
  conclusionLayer3: CONCLUSION_LAYER_3_DEFAULTS,
  conclusionDurationSeconds: DEFAULT_CONCLUSION_SECONDS,
  conclusionAudio: null,
  conclusionAudioDuration: null,
  conclusionAudioVoice: null,
  conclusionAudioRate: null,
  conclusionRecording: null,
  conclusionRecordingDuration: null,
  conclusionRecordingOriginal: null,
  conclusionRecordingOriginalDuration: null,
  conclusionRecordingTakes: [],
  conclusionRecordingClips: [],
  conclusionVoiceSource: "ai",
  introductionImages: [],
  background: null,
  backgroundMusic: null,
  musicVolume: 25,
  countdownSound: null,
  countdownSoundVolume: 65,
  answerSound: null,
  answerSoundVolume: 35,
  themeImage: null,
  logo: null,
  decorLogoLayer: DECOR_LOGO_LAYER_DEFAULT,
  voice: "fr_FR-siwis-medium",
  themeTitle: "",
  speechRate: 100,
  voiceVolume: 85,
  questions: [
    {
      ...makeQuestion(1),
      prompt: "Quelle est la capitale de l’Australie ?",
      answer: "Canberra",
    },
    {
      ...makeQuestion(2),
      prompt: "Quelle planète est surnommée la planète rouge ?",
      answer: "Mars",
    },
    {
      ...makeQuestion(3),
      prompt: "Qui a écrit Le Petit Prince ?",
      answer: "Antoine de Saint-Exupéry",
    },
  ],
  archivedQuestions: [],
};

export const narrationAudio = (question: QuizQuestion, part: "question" | "answer" | "commentary", voice?: VoiceId, rate?: number) => {
  const recording = question[`${part}Recording`];
  if (question[`${part}VoiceSource`] === "recording") return recording ? { path: recording, duration: question[`${part}RecordingDuration`] ?? 0 } : null;
  const audio = question[`${part}Audio`];
  if (audio && (voice === undefined || question[`${part}AudioVoice`] === voice) && (rate === undefined || question[`${part}AudioRate`] === rate)) {
    return { path: audio, duration: question[`${part}AudioDuration`] ?? 0 };
  }
  return null;
};

export const questionDurationFrames = (question: QuizQuestion, voice?: VoiceId, rate?: number) => {
  const visibleTextLength = question.title.length + question.prompt.length;
  const base = (question.force15Seconds || visibleTextLength > LONG_QUESTION_CHARACTER_LIMIT ? LONG_QUESTION_SECONDS : DEFAULT_QUESTION_SECONDS) * FPS;
  return Math.max(base, Math.ceil((narrationAudio(question, "question", voice, rate)?.duration ?? 0) * FPS));
};

export const answerDisplayFrames = (question: QuizQuestion, voice?: VoiceId, rate?: number) => {
  const answerDuration = narrationAudio(question, "answer", voice, rate)?.duration ?? 0;
  return Math.max(ANSWER_FRAMES, Math.ceil(answerDuration * FPS));
};

export const transitionFramesAfter = (questions: QuizQuestion[], index: number) => {
  return index < questions.length - 1 ? TRANSITION_FRAMES : 0;
};

export const introductionSlides = (project: QuizProject) => [
  project.themeImage,
  ...project.questions.filter((question) => question.startsTheme).map((question) => question.themeImage),
  ...project.introductionImages,
].filter((image): image is string => Boolean(image));

export const introductionNarration = (project: QuizProject) => project.introductionVoiceSource === "recording"
  ? project.introductionRecording ? { path: project.introductionRecording, duration: project.introductionRecordingDuration ?? 0 } : null
  : project.introductionAudio && project.introductionAudioVoice === project.voice && project.introductionAudioRate === project.speechRate
    ? { path: project.introductionAudio, duration: project.introductionAudioDuration ?? 0 }
    : null;

export const conclusionNarration = (project: QuizProject) => project.conclusionVoiceSource === "recording"
  ? project.conclusionRecording ? { path: project.conclusionRecording, duration: project.conclusionRecordingDuration ?? 0 } : null
  : project.conclusionAudio && project.conclusionAudioVoice === project.voice && project.conclusionAudioRate === project.speechRate
    ? { path: project.conclusionAudio, duration: project.conclusionAudioDuration ?? 0 }
    : null;

export const introductionDurationFrames = (project: QuizProject) =>
  Math.max(Math.round(project.introductionDurationSeconds * FPS), Math.ceil((introductionNarration(project)?.duration ?? 0) * FPS));

export const conclusionDurationFrames = (project: QuizProject) =>
  project.conclusionText.trim() || project.conclusionBackgroundImage || project.conclusionMusic || project.conclusionImage || project.conclusionImage2 || project.conclusionImage3 || project.conclusionRecording || project.conclusionAudio
    ? Math.max(Math.round(project.conclusionDurationSeconds * FPS), Math.ceil((conclusionNarration(project)?.duration ?? 0) * FPS))
    : 0;

export const questionStartFrame = (questions: QuizQuestion[], index: number, introFrames = INTRODUCTION_FRAMES, voice?: VoiceId, rate?: number) => {
  let frame = introFrames + INTRODUCTION_QUESTION_GAP_FRAMES;
  for (let previous = 0; previous < index; previous += 1) {
    frame += questionDurationFrames(questions[previous], voice, rate) + answerDisplayFrames(questions[previous], voice, rate) + transitionFramesAfter(questions, previous);
  }
  return frame;
};

export const questionVideoDuration = (questions: QuizQuestion[], introFrames = INTRODUCTION_FRAMES, conclusionFrames = 0, voice?: VoiceId, rate?: number) =>
  questions.length === 0
    ? introFrames + INTRODUCTION_QUESTION_GAP_FRAMES + FPS + conclusionFrames
    : introFrames + questions.reduce((duration, _question, index) =>
      duration + questionDurationFrames(_question, voice, rate) + answerDisplayFrames(_question, voice, rate) + transitionFramesAfter(questions, index), INTRODUCTION_QUESTION_GAP_FRAMES) + conclusionFrames;

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "quiz";

export const isVoiceId = (value: unknown): value is VoiceId =>
  value === "fr_FR-siwis-medium" || value === "fr_FR-upmc-medium" || value === "fr_FR-tom-medium" || value === "fr_FR-mls-medium";

const normalizeRecordingTakes = (raw: unknown, fallbackPath: string | null, fallbackDuration: number | null, fallbackId: string): RecordingTake[] => {
  if (!Array.isArray(raw) || (raw.length === 0 && fallbackPath)) return fallbackPath ? [{ id: `take-${fallbackId}`, path: fallbackPath, duration: Math.max(0, fallbackDuration ?? 0) }] : [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const take = item as Partial<RecordingTake>;
    if (typeof take.id !== "string" || typeof take.path !== "string" || !take.path || typeof take.duration !== "number" || !Number.isFinite(take.duration) || take.duration <= 0) return [];
    return [{ id: take.id.slice(0, 100) || `take-${index + 1}`, path: take.path, duration: take.duration,
      originalPath: typeof take.originalPath === "string" && take.originalPath ? take.originalPath : undefined,
      originalDuration: typeof take.originalDuration === "number" && Number.isFinite(take.originalDuration) && take.originalDuration > 0 ? take.originalDuration : undefined }];
  }).slice(0, 100);
};

const normalizeRecordingClips = (raw: unknown, takes: RecordingTake[], fallbackId: string): RecordingClip[] => {
  if (!Array.isArray(raw)) {
    const first = takes[0];
    return first ? [{ id: `clip-${fallbackId}`, takeId: first.id, start: 0, end: first.duration, pauseAfter: 0, transitionMs: 8 }] : [];
  }
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const clip = item as Partial<RecordingClip>;
    const take = takes.find((candidate) => candidate.id === clip.takeId);
    if (!take || typeof clip.start !== "number" || typeof clip.end !== "number") return [];
    const start = Math.min(take.duration, Math.max(0, clip.start));
    const end = Math.min(take.duration, Math.max(start, clip.end));
    if (end - start < 0.01) return [];
    return [{
      id: typeof clip.id === "string" ? clip.id.slice(0, 100) : `clip-${fallbackId}-${index + 1}`,
      takeId: take.id,
      start,
      end,
      pauseAfter: typeof clip.pauseAfter === "number" ? Math.min(10, Math.max(0, clip.pauseAfter)) : 0,
      transitionMs: typeof clip.transitionMs === "number" ? Math.min(40, Math.max(0, clip.transitionMs)) : 8,
      waveform: Array.isArray(clip.waveform) ? clip.waveform.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).slice(0, 80).map((value) => Math.min(1, Math.max(0, value))) : undefined,
    }];
  }).slice(0, 500);
};

export const normalizeProject = (input: unknown): QuizProject | null => {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<QuizProject>;
  if (!Array.isArray(value.questions) || value.questions.length > MAX_QUESTION_LIBRARY) return null;
  if (value.questions.filter((question) => question && typeof question === "object" && (question as Partial<QuizQuestion>).enabled !== false).length > MAX_QUESTIONS) return null;
  if (!isVoiceId(value.voice)) return null;

  const questions: QuizQuestion[] = [];
  for (const [index, item] of value.questions.entries()) {
    if (!item || typeof item !== "object") return null;
    const row = item as Partial<QuizQuestion>;
    if (typeof row.prompt !== "string" || typeof row.answer !== "string") return null;
    if (row.prompt.length > 1000 || row.answer.length > 500 || (row.title?.length ?? 0) > 100 || (row.answerCommentary?.length ?? 0) > 1000) return null;
    const questionId = typeof row.id === "string" ? row.id.slice(0, 80) : `question-${index + 1}`;
    const questionPath = typeof row.questionRecording === "string" ? row.questionRecording : null;
    const answerPath = typeof row.answerRecording === "string" ? row.answerRecording : null;
    const commentaryPath = typeof row.commentaryRecording === "string" ? row.commentaryRecording : null;
    const questionDuration = typeof row.questionRecordingDuration === "number" ? Math.max(0, row.questionRecordingDuration) : null;
    const answerDuration = typeof row.answerRecordingDuration === "number" ? Math.max(0, row.answerRecordingDuration) : null;
    const commentaryDuration = typeof row.commentaryRecordingDuration === "number" ? Math.max(0, row.commentaryRecordingDuration) : null;
    const questionTakes = normalizeRecordingTakes(row.questionRecordingTakes, questionPath, questionDuration, `${questionId}-question`);
    const answerTakes = normalizeRecordingTakes(row.answerRecordingTakes, answerPath, answerDuration, `${questionId}-answer`);
    const commentaryTakes = normalizeRecordingTakes(row.commentaryRecordingTakes, commentaryPath, commentaryDuration, `${questionId}-commentary`);
    questions.push({
      ...makeQuestion(index + 1),
      id: questionId,
      enabled: row.enabled !== false,
      title: row.isRiddle === true ? RIDDLE_TITLE : typeof row.title === "string" ? row.title : "",
      prompt: row.prompt,
      answer: row.answer,
      answerCommentary: typeof row.answerCommentary === "string" ? row.answerCommentary : "",
      force15Seconds: row.force15Seconds === true,
      isRiddle: row.isRiddle === true,
      image: typeof row.image === "string" ? row.image : null,
      answerImage: typeof row.answerImage === "string" ? row.answerImage : null,
      themeImage: typeof row.themeImage === "string" ? row.themeImage : null,
      startsTheme: row.startsTheme === true,
      themeTitle: typeof row.themeTitle === "string" ? row.themeTitle.slice(0, 100) : "",
      keepImageOnAnswer: row.keepImageOnAnswer !== false,
      questionAudio: typeof row.questionAudio === "string" ? row.questionAudio : null,
      answerAudio: typeof row.answerAudio === "string" ? row.answerAudio : null,
      commentaryAudio: typeof row.commentaryAudio === "string" ? row.commentaryAudio : null,
      questionAudioVoice: isVoiceId(row.questionAudioVoice) ? row.questionAudioVoice : null,
      answerAudioVoice: isVoiceId(row.answerAudioVoice) ? row.answerAudioVoice : null,
      commentaryAudioVoice: isVoiceId(row.commentaryAudioVoice) ? row.commentaryAudioVoice : null,
      questionAudioRate: typeof row.questionAudioRate === "number" ? row.questionAudioRate : null,
      answerAudioRate: typeof row.answerAudioRate === "number" ? row.answerAudioRate : null,
      commentaryAudioRate: typeof row.commentaryAudioRate === "number" ? row.commentaryAudioRate : null,
      questionAudioDuration: typeof row.questionAudioDuration === "number" ? row.questionAudioDuration : null,
      answerAudioDuration: typeof row.answerAudioDuration === "number" ? row.answerAudioDuration : null,
      commentaryAudioDuration: typeof row.commentaryAudioDuration === "number" ? row.commentaryAudioDuration : null,
      questionRecording: typeof row.questionRecording === "string" ? row.questionRecording : null,
      questionRecordingDuration: typeof row.questionRecordingDuration === "number" ? Math.max(0, row.questionRecordingDuration) : null,
      questionRecordingOriginal: typeof row.questionRecordingOriginal === "string" ? row.questionRecordingOriginal : typeof row.questionRecording === "string" ? row.questionRecording : null,
      questionRecordingOriginalDuration: typeof row.questionRecordingOriginalDuration === "number" ? Math.max(0, row.questionRecordingOriginalDuration) : typeof row.questionRecordingDuration === "number" ? Math.max(0, row.questionRecordingDuration) : null,
      questionRecordingTakes: questionTakes,
      questionRecordingClips: normalizeRecordingClips(row.questionRecordingClips, questionTakes, `${questionId}-question`),
      answerRecording: typeof row.answerRecording === "string" ? row.answerRecording : null,
      answerRecordingDuration: typeof row.answerRecordingDuration === "number" ? Math.max(0, row.answerRecordingDuration) : null,
      answerRecordingOriginal: typeof row.answerRecordingOriginal === "string" ? row.answerRecordingOriginal : typeof row.answerRecording === "string" ? row.answerRecording : null,
      answerRecordingOriginalDuration: typeof row.answerRecordingOriginalDuration === "number" ? Math.max(0, row.answerRecordingOriginalDuration) : typeof row.answerRecordingDuration === "number" ? Math.max(0, row.answerRecordingDuration) : null,
      answerRecordingTakes: answerTakes,
      answerRecordingClips: normalizeRecordingClips(row.answerRecordingClips, answerTakes, `${questionId}-answer`),
      commentaryRecording: typeof row.commentaryRecording === "string" ? row.commentaryRecording : null,
      commentaryRecordingDuration: typeof row.commentaryRecordingDuration === "number" ? Math.max(0, row.commentaryRecordingDuration) : null,
      commentaryRecordingOriginal: typeof row.commentaryRecordingOriginal === "string" ? row.commentaryRecordingOriginal : typeof row.commentaryRecording === "string" ? row.commentaryRecording : null,
      commentaryRecordingOriginalDuration: typeof row.commentaryRecordingOriginalDuration === "number" ? Math.max(0, row.commentaryRecordingOriginalDuration) : typeof row.commentaryRecordingDuration === "number" ? Math.max(0, row.commentaryRecordingDuration) : null,
      commentaryRecordingTakes: commentaryTakes,
      commentaryRecordingClips: normalizeRecordingClips(row.commentaryRecordingClips, commentaryTakes, `${questionId}-commentary`),
      questionVoiceSource: row.questionVoiceSource === "recording" || (!row.questionVoiceSource && row.questionRecording) ? "recording" : "ai",
      answerVoiceSource: row.answerVoiceSource === "recording" || (!row.answerVoiceSource && row.answerRecording) ? "recording" : "ai",
      commentaryVoiceSource: row.commentaryVoiceSource === "recording" || (!row.commentaryVoiceSource && row.commentaryRecording) ? "recording" : "ai",
    });
  }

  const layerInput = value.introductionLayers && typeof value.introductionLayers === "object"
    ? value.introductionLayers as Partial<Record<IntroductionLayerId, Partial<IntroductionLayer>>>
    : {};
  const layerIds = Object.keys(INTRODUCTION_LAYER_DEFAULTS) as IntroductionLayerId[];
  const introductionLayers = Object.fromEntries(layerIds.map((id) => {
    const raw: Partial<IntroductionLayer> = layerInput[id] && typeof layerInput[id] === "object" ? layerInput[id] : {};
    const defaults = INTRODUCTION_LAYER_DEFAULTS[id];
    const width = typeof raw.width === "number" && Number.isFinite(raw.width)
      ? Math.min(1920, Math.max(40, raw.width))
      : defaults.width;
    const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : defaults.x;
    const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : defaults.y;
    return [id, {
      image: typeof raw.image === "string" ? raw.image : null,
      x: Math.min(1920 - width, Math.max(0, x)),
      y: Math.min(1080, Math.max(0, y)),
      width,
      zIndex: typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex) ? Math.min(100, Math.max(1, raw.zIndex)) : defaults.zIndex,
      visible: raw.visible !== false,
    }];
  })) as IntroductionLayers;
  const delayedSceneInput = value.introductionDelayedScene && typeof value.introductionDelayedScene === "object"
    ? value.introductionDelayedScene as Partial<IntroductionDelayedScene>
    : {};
  const delayedPanelInput = delayedSceneInput.questionsPanel && typeof delayedSceneInput.questionsPanel === "object"
    ? delayedSceneInput.questionsPanel as Partial<IntroductionLayer>
    : {};
  const delayedPanelDefaults = INTRODUCTION_DELAYED_SCENE_DEFAULTS.questionsPanel;
  const delayedLogoInput = delayedSceneInput.logo && typeof delayedSceneInput.logo === "object"
    ? delayedSceneInput.logo as Partial<IntroductionLayer>
    : {};
  const delayedLogoDefaults = INTRODUCTION_DELAYED_SCENE_DEFAULTS.logo;
  const delayedLogoWidth = typeof delayedLogoInput.width === "number" && Number.isFinite(delayedLogoInput.width)
    ? Math.min(1920, Math.max(40, delayedLogoInput.width))
    : delayedLogoDefaults.width;
  const delayedPanelWidth = typeof delayedPanelInput.width === "number" && Number.isFinite(delayedPanelInput.width)
    ? Math.min(1920, Math.max(40, delayedPanelInput.width))
    : delayedPanelDefaults.width;
  const introductionDelayedScene: IntroductionDelayedScene = {
    background: typeof delayedSceneInput.background === "string" ? delayedSceneInput.background : null,
    sound: typeof delayedSceneInput.sound === "string" ? delayedSceneInput.sound : null,
    logo: {
      image: typeof delayedLogoInput.image === "string" ? delayedLogoInput.image : null,
      x: Math.min(1920 - delayedLogoWidth, Math.max(0, typeof delayedLogoInput.x === "number" && Number.isFinite(delayedLogoInput.x) ? delayedLogoInput.x : delayedLogoDefaults.x)),
      y: Math.min(1080, Math.max(0, typeof delayedLogoInput.y === "number" && Number.isFinite(delayedLogoInput.y) ? delayedLogoInput.y : delayedLogoDefaults.y)),
      width: delayedLogoWidth,
      zIndex: typeof delayedLogoInput.zIndex === "number" && Number.isFinite(delayedLogoInput.zIndex) ? Math.min(100, Math.max(1, delayedLogoInput.zIndex)) : delayedLogoDefaults.zIndex,
      visible: delayedLogoInput.visible !== false,
    },
    questionsPanel: {
      image: typeof delayedPanelInput.image === "string" ? delayedPanelInput.image : null,
      x: Math.min(1920 - delayedPanelWidth, Math.max(0, typeof delayedPanelInput.x === "number" && Number.isFinite(delayedPanelInput.x) ? delayedPanelInput.x : delayedPanelDefaults.x)),
      y: Math.min(1080, Math.max(0, typeof delayedPanelInput.y === "number" && Number.isFinite(delayedPanelInput.y) ? delayedPanelInput.y : delayedPanelDefaults.y)),
      width: delayedPanelWidth,
      zIndex: typeof delayedPanelInput.zIndex === "number" && Number.isFinite(delayedPanelInput.zIndex) ? Math.min(100, Math.max(1, delayedPanelInput.zIndex)) : delayedPanelDefaults.zIndex,
      visible: delayedPanelInput.visible !== false,
    },
    transition: {
      effect: delayedSceneInput.transition?.effect === "none" ? "none" : "lightning",
      enabled: delayedSceneInput.transition?.enabled === true,
      startSeconds: typeof delayedSceneInput.transition?.startSeconds === "number" && Number.isFinite(delayedSceneInput.transition.startSeconds)
        ? Math.min(120, Math.max(0, delayedSceneInput.transition.startSeconds))
        : INTRODUCTION_DELAYED_SCENE_DEFAULTS.transition.startSeconds,
      durationFrames: typeof delayedSceneInput.transition?.durationFrames === "number" && Number.isFinite(delayedSceneInput.transition.durationFrames)
        ? Math.min(90, Math.max(1, Math.round(delayedSceneInput.transition.durationFrames)))
        : INTRODUCTION_DELAYED_SCENE_DEFAULTS.transition.durationFrames,
      soundVolume: typeof delayedSceneInput.transition?.soundVolume === "number" && Number.isFinite(delayedSceneInput.transition.soundVolume)
        ? Math.min(100, Math.max(0, delayedSceneInput.transition.soundVolume))
        : INTRODUCTION_DELAYED_SCENE_DEFAULTS.transition.soundVolume,
    },
  };
  const conclusionLayerInput = value.conclusionLayer && typeof value.conclusionLayer === "object"
    ? value.conclusionLayer as Partial<ConclusionLayer>
    : {};
  const conclusionWidth = typeof conclusionLayerInput.width === "number" && Number.isFinite(conclusionLayerInput.width)
    ? Math.min(1920, Math.max(40, conclusionLayerInput.width))
    : CONCLUSION_LAYER_DEFAULTS.width;
  const conclusionLayer: ConclusionLayer = {
    x: Math.min(1920 - conclusionWidth, Math.max(0, typeof conclusionLayerInput.x === "number" && Number.isFinite(conclusionLayerInput.x) ? conclusionLayerInput.x : CONCLUSION_LAYER_DEFAULTS.x)),
    y: Math.min(1080, Math.max(0, typeof conclusionLayerInput.y === "number" && Number.isFinite(conclusionLayerInput.y) ? conclusionLayerInput.y : CONCLUSION_LAYER_DEFAULTS.y)),
    width: conclusionWidth,
  };
  const conclusionLayer2Input = value.conclusionLayer2 && typeof value.conclusionLayer2 === "object"
    ? value.conclusionLayer2 as Partial<ConclusionLayer>
    : {};
  const conclusionWidth2 = typeof conclusionLayer2Input.width === "number" && Number.isFinite(conclusionLayer2Input.width)
    ? Math.min(1920, Math.max(40, conclusionLayer2Input.width))
    : CONCLUSION_LAYER_2_DEFAULTS.width;
  const conclusionLayer2: ConclusionLayer = {
    x: Math.min(1920 - conclusionWidth2, Math.max(0, typeof conclusionLayer2Input.x === "number" && Number.isFinite(conclusionLayer2Input.x) ? conclusionLayer2Input.x : CONCLUSION_LAYER_2_DEFAULTS.x)),
    y: Math.min(1080, Math.max(0, typeof conclusionLayer2Input.y === "number" && Number.isFinite(conclusionLayer2Input.y) ? conclusionLayer2Input.y : CONCLUSION_LAYER_2_DEFAULTS.y)),
    width: conclusionWidth2,
  };
  const conclusionLayer3Input = value.conclusionLayer3 && typeof value.conclusionLayer3 === "object"
    ? value.conclusionLayer3 as Partial<ConclusionLayer>
    : {};
  const conclusionWidth3 = typeof conclusionLayer3Input.width === "number" && Number.isFinite(conclusionLayer3Input.width)
    ? Math.min(1920, Math.max(40, conclusionLayer3Input.width))
    : CONCLUSION_LAYER_3_DEFAULTS.width;
  const conclusionLayer3: ConclusionLayer = {
    x: Math.min(1920 - conclusionWidth3, Math.max(0, typeof conclusionLayer3Input.x === "number" && Number.isFinite(conclusionLayer3Input.x) ? conclusionLayer3Input.x : CONCLUSION_LAYER_3_DEFAULTS.x)),
    y: Math.min(1080, Math.max(0, typeof conclusionLayer3Input.y === "number" && Number.isFinite(conclusionLayer3Input.y) ? conclusionLayer3Input.y : CONCLUSION_LAYER_3_DEFAULTS.y)),
    width: conclusionWidth3,
  };
  const decorLogoInput = value.decorLogoLayer && typeof value.decorLogoLayer === "object"
    ? value.decorLogoLayer as Partial<IntroductionLayer>
    : {};
  const decorLogoWidth = typeof decorLogoInput.width === "number" && Number.isFinite(decorLogoInput.width)
    ? Math.min(1920, Math.max(40, decorLogoInput.width))
    : DECOR_LOGO_LAYER_DEFAULT.width;
  const decorLogoLayer: IntroductionLayer = {
    image: null,
    x: Math.min(1920 - decorLogoWidth, Math.max(0, typeof decorLogoInput.x === "number" && Number.isFinite(decorLogoInput.x) ? decorLogoInput.x : DECOR_LOGO_LAYER_DEFAULT.x)),
    y: Math.min(1080, Math.max(0, typeof decorLogoInput.y === "number" && Number.isFinite(decorLogoInput.y) ? decorLogoInput.y : DECOR_LOGO_LAYER_DEFAULT.y)),
    width: decorLogoWidth,
    zIndex: typeof decorLogoInput.zIndex === "number" && Number.isFinite(decorLogoInput.zIndex) ? Math.min(100, Math.max(1, decorLogoInput.zIndex)) : DECOR_LOGO_LAYER_DEFAULT.zIndex,
    visible: decorLogoInput.visible !== false,
  };

  const archivedInput = Array.isArray(value.archivedQuestions) ? value.archivedQuestions.slice(0, MAX_QUESTION_LIBRARY) : [];
  const archivedQuestions = archivedInput.length
    ? normalizeProject({ ...value, questions: archivedInput, archivedQuestions: [] })?.questions ?? []
    : [];
  if (questions.length + archivedQuestions.length > MAX_QUESTION_LIBRARY) return null;

  return {
    title: typeof value.title === "string" ? value.title.slice(0, 120) : "Mon quiz",
    introductionText: typeof value.introductionText === "string" ? value.introductionText.slice(0, 1000) : "",
    introductionImage: typeof value.introductionImage === "string" ? value.introductionImage : null,
    introductionLayers,
    introductionDelayedScene,
    introductionDurationSeconds: typeof value.introductionDurationSeconds === "number"
      ? Math.min(MAX_INTRODUCTION_SECONDS, Math.max(MIN_INTRODUCTION_SECONDS, value.introductionDurationSeconds))
      : DEFAULT_INTRODUCTION_SECONDS,
    introductionAudio: typeof value.introductionAudio === "string" ? value.introductionAudio : null,
    introductionAudioDuration: typeof value.introductionAudioDuration === "number" ? Math.max(0, value.introductionAudioDuration) : null,
    introductionAudioVoice: isVoiceId(value.introductionAudioVoice) ? value.introductionAudioVoice : null,
    introductionAudioRate: typeof value.introductionAudioRate === "number" ? value.introductionAudioRate : null,
    introductionRecording: typeof value.introductionRecording === "string" ? value.introductionRecording : null,
    introductionRecordingDuration: typeof value.introductionRecordingDuration === "number" ? Math.max(0, value.introductionRecordingDuration) : null,
    introductionRecordingOriginal: typeof value.introductionRecordingOriginal === "string" ? value.introductionRecordingOriginal : typeof value.introductionRecording === "string" ? value.introductionRecording : null,
    introductionRecordingOriginalDuration: typeof value.introductionRecordingOriginalDuration === "number" ? Math.max(0, value.introductionRecordingOriginalDuration) : typeof value.introductionRecordingDuration === "number" ? Math.max(0, value.introductionRecordingDuration) : null,
    introductionRecordingTakes: normalizeRecordingTakes(value.introductionRecordingTakes, typeof value.introductionRecording === "string" ? value.introductionRecording : null, typeof value.introductionRecordingDuration === "number" ? value.introductionRecordingDuration : null, "introduction"),
    introductionRecordingClips: normalizeRecordingClips(value.introductionRecordingClips, normalizeRecordingTakes(value.introductionRecordingTakes, typeof value.introductionRecording === "string" ? value.introductionRecording : null, typeof value.introductionRecordingDuration === "number" ? value.introductionRecordingDuration : null, "introduction"), "introduction"),
    introductionVoiceSource: value.introductionVoiceSource === "recording" || (!value.introductionVoiceSource && value.introductionRecording) ? "recording" : "ai",
    introductionMusic: typeof value.introductionMusic === "string" ? value.introductionMusic : null,
    introductionMusicDuration: typeof value.introductionMusicDuration === "number" && Number.isFinite(value.introductionMusicDuration) && value.introductionMusicDuration > 0
      ? value.introductionMusicDuration
      : null,
    introductionMusicVolume: typeof value.introductionMusicVolume === "number"
      ? Math.min(100, Math.max(0, value.introductionMusicVolume))
      : defaultProject.introductionMusicVolume,
    conclusionText: typeof value.conclusionText === "string" ? value.conclusionText.slice(0, 1000) : "",
    conclusionBackgroundImage: typeof value.conclusionBackgroundImage === "string" ? value.conclusionBackgroundImage : null,
    conclusionMusic: typeof value.conclusionMusic === "string" ? value.conclusionMusic : null,
    conclusionMusicVolume: typeof value.conclusionMusicVolume === "number"
      ? Math.min(100, Math.max(0, value.conclusionMusicVolume))
      : defaultProject.conclusionMusicVolume,
    conclusionImage: typeof value.conclusionImage === "string" ? value.conclusionImage : null,
    conclusionLayer,
    conclusionImage2: typeof value.conclusionImage2 === "string" ? value.conclusionImage2 : null,
    conclusionLayer2,
    conclusionImage3: typeof value.conclusionImage3 === "string" ? value.conclusionImage3 : null,
    conclusionLayer3,
    conclusionDurationSeconds: typeof value.conclusionDurationSeconds === "number"
      ? Math.min(MAX_CONCLUSION_SECONDS, Math.max(MIN_CONCLUSION_SECONDS, value.conclusionDurationSeconds))
      : DEFAULT_CONCLUSION_SECONDS,
    conclusionAudio: typeof value.conclusionAudio === "string" ? value.conclusionAudio : null,
    conclusionAudioDuration: typeof value.conclusionAudioDuration === "number" ? Math.max(0, value.conclusionAudioDuration) : null,
    conclusionAudioVoice: isVoiceId(value.conclusionAudioVoice) ? value.conclusionAudioVoice : null,
    conclusionAudioRate: typeof value.conclusionAudioRate === "number" ? value.conclusionAudioRate : null,
    conclusionRecording: typeof value.conclusionRecording === "string" ? value.conclusionRecording : null,
    conclusionRecordingDuration: typeof value.conclusionRecordingDuration === "number" ? Math.max(0, value.conclusionRecordingDuration) : null,
    conclusionRecordingOriginal: typeof value.conclusionRecordingOriginal === "string" ? value.conclusionRecordingOriginal : typeof value.conclusionRecording === "string" ? value.conclusionRecording : null,
    conclusionRecordingOriginalDuration: typeof value.conclusionRecordingOriginalDuration === "number" ? Math.max(0, value.conclusionRecordingOriginalDuration) : typeof value.conclusionRecordingDuration === "number" ? Math.max(0, value.conclusionRecordingDuration) : null,
    conclusionRecordingTakes: normalizeRecordingTakes(value.conclusionRecordingTakes, typeof value.conclusionRecording === "string" ? value.conclusionRecording : null, typeof value.conclusionRecordingDuration === "number" ? value.conclusionRecordingDuration : null, "conclusion"),
    conclusionRecordingClips: normalizeRecordingClips(value.conclusionRecordingClips, normalizeRecordingTakes(value.conclusionRecordingTakes, typeof value.conclusionRecording === "string" ? value.conclusionRecording : null, typeof value.conclusionRecordingDuration === "number" ? value.conclusionRecordingDuration : null, "conclusion"), "conclusion"),
    conclusionVoiceSource: value.conclusionVoiceSource === "recording" || (!value.conclusionVoiceSource && value.conclusionRecording) ? "recording" : "ai",
    introductionImages: Array.isArray(value.introductionImages)
      ? value.introductionImages.filter((image): image is string => typeof image === "string").slice(0, 60)
      : [],
    background: typeof value.background === "string" ? value.background : null,
    backgroundMusic: typeof value.backgroundMusic === "string" ? value.backgroundMusic : null,
    musicVolume: typeof value.musicVolume === "number"
      ? Math.min(100, Math.max(0, value.musicVolume))
      : defaultProject.musicVolume,
    countdownSound: typeof value.countdownSound === "string" ? value.countdownSound : null,
    countdownSoundVolume: typeof value.countdownSoundVolume === "number"
      ? Math.min(100, Math.max(0, value.countdownSoundVolume))
      : defaultProject.countdownSoundVolume,
    answerSound: typeof value.answerSound === "string" ? value.answerSound : null,
    answerSoundVolume: typeof value.answerSoundVolume === "number"
      ? Math.min(100, Math.max(0, value.answerSoundVolume))
      : defaultProject.answerSoundVolume,
    themeImage: typeof value.themeImage === "string" ? value.themeImage : null,
    logo: typeof value.logo === "string" ? value.logo : null,
    decorLogoLayer,
    voice: value.voice,
    themeTitle: typeof value.themeTitle === "string" ? value.themeTitle.slice(0, 100) : "",
    speechRate: Math.min(120, Math.max(80, Number(value.speechRate) || 100)),
    voiceVolume: Math.min(100, Math.max(0, Number(value.voiceVolume) || 0)),
    questions,
    archivedQuestions,
  };
};
