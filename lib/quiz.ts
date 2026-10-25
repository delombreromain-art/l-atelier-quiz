export const FPS = 30;
export const DEFAULT_QUESTION_SECONDS = 10;
export const LONG_QUESTION_SECONDS = 15;
export const LONG_QUESTION_CHARACTER_LIMIT = 150;
export const ANSWER_FRAMES = 4 * FPS;
export const ANSWER_COMMENTARY_GAP_FRAMES = FPS;
export const TRANSITION_FRAMES = 2 * FPS;
export const THEME_FRAMES = 4 * FPS;
export const DEFAULT_INTRODUCTION_SECONDS = 20;
export const MIN_INTRODUCTION_SECONDS = 12;
export const MAX_INTRODUCTION_SECONDS = 40;
export const INTRODUCTION_FRAMES = DEFAULT_INTRODUCTION_SECONDS * FPS;
export const INTRODUCTION_QUESTION_GAP_FRAMES = 2 * FPS;
export const MAX_QUESTIONS = 60;

export type VoiceId = "fr_FR-siwis-medium" | "fr_FR-upmc-medium" | "fr_FR-tom-medium" | "fr_FR-mls-medium";
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

export const INTRODUCTION_LAYER_DEFAULTS: IntroductionLayers = {
  logo: { image: null, x: 600, y: 24, width: 720, zIndex: 1, visible: true },
  questionsPanel: { image: null, x: 440, y: 340, width: 1040, zIndex: 2, visible: true },
  history: { image: null, x: 110, y: 750, width: 310, zIndex: 3, visible: true },
  geography: { image: null, x: 475, y: 750, width: 310, zIndex: 4, visible: true },
  science: { image: null, x: 840, y: 750, width: 310, zIndex: 5, visible: true },
  cinema: { image: null, x: 1205, y: 750, width: 310, zIndex: 6, visible: true },
  hourglass: { image: null, x: 1530, y: 370, width: 270, zIndex: 7, visible: true },
};

export type QuizQuestion = {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  answerCommentary: string;
  force15Seconds: boolean;
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
};

export type QuizProject = {
  title: string;
  introductionText: string;
  introductionImage: string | null;
  introductionLayers: IntroductionLayers;
  introductionDurationSeconds: number;
  introductionAudio: string | null;
  introductionAudioDuration: number | null;
  introductionAudioVoice: VoiceId | null;
  introductionAudioRate: number | null;
  introductionImages: string[];
  background: string | null;
  backgroundMusic: string | null;
  musicVolume: number;
  themeImage: string | null;
  logo: string | null;
  voice: VoiceId;
  themeTitle: string;
  speechRate: number;
  voiceVolume: number;
  questions: QuizQuestion[];
};

export type QuizVideoProps = {
  project: QuizProject;
  questions: QuizQuestion[];
  questionOffset: number;
};

export const makeQuestion = (number: number): QuizQuestion => ({
  id: `question-${number}`,
  title: "",
  prompt: "",
  answer: "",
  answerCommentary: "",
  force15Seconds: false,
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
  if (dataRows.length > MAX_QUESTIONS) throw new Error(`Le fichier contient ${dataRows.length} lignes ; la limite est de ${MAX_QUESTIONS} questions.`);
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
  introductionDurationSeconds: DEFAULT_INTRODUCTION_SECONDS,
  introductionAudio: null,
  introductionAudioDuration: null,
  introductionAudioVoice: null,
  introductionAudioRate: null,
  introductionImages: [],
  background: null,
  backgroundMusic: null,
  musicVolume: 25,
  themeImage: null,
  logo: null,
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
};

export const questionDurationFrames = (question: QuizQuestion) => {
  const visibleTextLength = question.title.length + question.prompt.length;
  return (question.force15Seconds || visibleTextLength > LONG_QUESTION_CHARACTER_LIMIT ? LONG_QUESTION_SECONDS : DEFAULT_QUESTION_SECONDS) * FPS;
};

export const answerNarrationFrames = (answerDuration: number | null, commentaryDuration: number | null) =>
  Math.ceil((answerDuration ?? 0) * FPS) + ANSWER_COMMENTARY_GAP_FRAMES + Math.ceil((commentaryDuration ?? 0) * FPS);

export const transitionFramesAfter = (questions: QuizQuestion[], index: number) => {
  return index < questions.length - 1 ? TRANSITION_FRAMES : 0;
};

export const introductionSlides = (project: QuizProject) => [
  project.themeImage,
  ...project.questions.filter((question) => question.startsTheme).map((question) => question.themeImage),
  ...project.introductionImages,
].filter((image): image is string => Boolean(image));

export const introductionDurationFrames = (project: QuizProject) =>
  Math.round(project.introductionDurationSeconds * FPS);

export const questionStartFrame = (questions: QuizQuestion[], index: number, introFrames = INTRODUCTION_FRAMES) => {
  let frame = introFrames + INTRODUCTION_QUESTION_GAP_FRAMES;
  for (let previous = 0; previous < index; previous += 1) {
    frame += questionDurationFrames(questions[previous]) + ANSWER_FRAMES + transitionFramesAfter(questions, previous);
  }
  return frame;
};

export const questionVideoDuration = (questions: QuizQuestion[], introFrames = INTRODUCTION_FRAMES) =>
  questions.length === 0
    ? introFrames + INTRODUCTION_QUESTION_GAP_FRAMES + FPS
    : introFrames + questions.reduce((duration, _question, index) =>
      duration + questionDurationFrames(_question) + ANSWER_FRAMES + transitionFramesAfter(questions, index), INTRODUCTION_QUESTION_GAP_FRAMES);

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

export const normalizeProject = (input: unknown): QuizProject | null => {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<QuizProject>;
  if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > MAX_QUESTIONS) return null;
  if (!isVoiceId(value.voice)) return null;

  const questions: QuizQuestion[] = [];
  for (const [index, item] of value.questions.entries()) {
    if (!item || typeof item !== "object") return null;
    const row = item as Partial<QuizQuestion>;
    if (typeof row.prompt !== "string" || typeof row.answer !== "string") return null;
    if (row.prompt.length > 1000 || row.answer.length > 500 || (row.title?.length ?? 0) > 100 || (row.answerCommentary?.length ?? 0) > 1000) return null;
    questions.push({
      ...makeQuestion(index + 1),
      id: typeof row.id === "string" ? row.id.slice(0, 80) : `question-${index + 1}`,
      title: typeof row.title === "string" ? row.title : "",
      prompt: row.prompt,
      answer: row.answer,
      answerCommentary: typeof row.answerCommentary === "string" ? row.answerCommentary : "",
      force15Seconds: row.force15Seconds === true,
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

  return {
    title: typeof value.title === "string" ? value.title.slice(0, 120) : "Mon quiz",
    introductionText: typeof value.introductionText === "string" ? value.introductionText.slice(0, 1000) : "",
    introductionImage: typeof value.introductionImage === "string" ? value.introductionImage : null,
    introductionLayers,
    introductionDurationSeconds: typeof value.introductionDurationSeconds === "number"
      ? Math.min(MAX_INTRODUCTION_SECONDS, Math.max(MIN_INTRODUCTION_SECONDS, value.introductionDurationSeconds))
      : DEFAULT_INTRODUCTION_SECONDS,
    introductionAudio: typeof value.introductionAudio === "string" ? value.introductionAudio : null,
    introductionAudioDuration: typeof value.introductionAudioDuration === "number" ? Math.max(0, value.introductionAudioDuration) : null,
    introductionAudioVoice: isVoiceId(value.introductionAudioVoice) ? value.introductionAudioVoice : null,
    introductionAudioRate: typeof value.introductionAudioRate === "number" ? value.introductionAudioRate : null,
    introductionImages: Array.isArray(value.introductionImages)
      ? value.introductionImages.filter((image): image is string => typeof image === "string").slice(0, 60)
      : [],
    background: typeof value.background === "string" ? value.background : null,
    backgroundMusic: typeof value.backgroundMusic === "string" ? value.backgroundMusic : null,
    musicVolume: typeof value.musicVolume === "number"
      ? Math.min(100, Math.max(0, value.musicVolume))
      : defaultProject.musicVolume,
    themeImage: typeof value.themeImage === "string" ? value.themeImage : null,
    logo: typeof value.logo === "string" ? value.logo : null,
    voice: value.voice,
    themeTitle: typeof value.themeTitle === "string" ? value.themeTitle.slice(0, 100) : "",
    speechRate: Math.min(120, Math.max(80, Number(value.speechRate) || 100)),
    voiceVolume: Math.min(100, Math.max(0, Number(value.voiceVolume) || 0)),
    questions,
  };
};
