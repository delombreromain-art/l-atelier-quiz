export const FPS = 30;
export const QUESTION_FRAMES = 12 * FPS;
export const ANSWER_FRAMES = 4 * FPS;
export const TRANSITION_FRAMES = FPS;
export const THEME_FRAMES = 4 * FPS;
export const MAX_QUESTIONS = 60;

export type VoiceId = "fr_FR-siwis-medium" | "fr_FR-upmc-medium";

export type QuizQuestion = {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  image: string | null;
  themeImage: string | null;
  startsTheme: boolean;
  themeTitle: string;
  keepImageOnAnswer: boolean;
  questionAudio: string | null;
  answerAudio: string | null;
  questionAudioVoice: VoiceId | null;
  answerAudioVoice: VoiceId | null;
  questionAudioRate: number | null;
  answerAudioRate: number | null;
  questionAudioDuration: number | null;
  answerAudioDuration: number | null;
};

export type QuizProject = {
  title: string;
  introductionText: string;
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
  image: null,
  themeImage: null,
  startsTheme: false,
  themeTitle: "",
  keepImageOnAnswer: true,
  questionAudio: null,
  answerAudio: null,
  questionAudioVoice: null,
  answerAudioVoice: null,
  questionAudioRate: null,
  answerAudioRate: null,
  questionAudioDuration: null,
  answerAudioDuration: null,
});

export const defaultProject: QuizProject = {
  title: "Mon premier quiz",
  introductionText: "",
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

export const transitionFramesAfter = (questions: QuizQuestion[], index: number) =>
  index < questions.length - 1 && questions[index + 1]?.startsTheme ? THEME_FRAMES : TRANSITION_FRAMES;

export const introductionSlides = (project: QuizProject) => [
  project.themeImage,
  ...project.questions.filter((question) => question.startsTheme).map((question) => question.themeImage),
  ...project.introductionImages,
].filter((image): image is string => Boolean(image));

export const introductionDurationFrames = (project: QuizProject) => Math.max(
  THEME_FRAMES,
  Math.ceil((project.introductionAudioDuration ?? 0) * FPS),
  introductionSlides(project).length * THEME_FRAMES,
);

export const questionStartFrame = (questions: QuizQuestion[], index: number, introFrames = THEME_FRAMES) => {
  let frame = introFrames;
  for (let previous = 0; previous < index; previous += 1) {
    frame += QUESTION_FRAMES + ANSWER_FRAMES + transitionFramesAfter(questions, previous);
  }
  return frame;
};

export const questionVideoDuration = (questions: QuizQuestion[], introFrames = THEME_FRAMES) =>
  questions.length === 0
    ? FPS
    : introFrames + questions.reduce((duration, _question, index) =>
      duration + QUESTION_FRAMES + ANSWER_FRAMES + (index < questions.length - 1 ? transitionFramesAfter(questions, index) : 0), 0);

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "quiz";

export const isVoiceId = (value: unknown): value is VoiceId =>
  value === "fr_FR-siwis-medium" || value === "fr_FR-upmc-medium";

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
    if (row.prompt.length > 1000 || row.answer.length > 500 || (row.title?.length ?? 0) > 100) return null;
    questions.push({
      ...makeQuestion(index + 1),
      id: typeof row.id === "string" ? row.id.slice(0, 80) : `question-${index + 1}`,
      title: typeof row.title === "string" ? row.title : "",
      prompt: row.prompt,
      answer: row.answer,
      image: typeof row.image === "string" ? row.image : null,
      themeImage: typeof row.themeImage === "string" ? row.themeImage : null,
      startsTheme: row.startsTheme === true,
      themeTitle: typeof row.themeTitle === "string" ? row.themeTitle.slice(0, 100) : "",
      keepImageOnAnswer: row.keepImageOnAnswer !== false,
      questionAudio: typeof row.questionAudio === "string" ? row.questionAudio : null,
      answerAudio: typeof row.answerAudio === "string" ? row.answerAudio : null,
      questionAudioVoice: isVoiceId(row.questionAudioVoice) ? row.questionAudioVoice : null,
      answerAudioVoice: isVoiceId(row.answerAudioVoice) ? row.answerAudioVoice : null,
      questionAudioRate: typeof row.questionAudioRate === "number" ? row.questionAudioRate : null,
      answerAudioRate: typeof row.answerAudioRate === "number" ? row.answerAudioRate : null,
      questionAudioDuration: typeof row.questionAudioDuration === "number" ? row.questionAudioDuration : null,
      answerAudioDuration: typeof row.answerAudioDuration === "number" ? row.answerAudioDuration : null,
    });
  }

  return {
    title: typeof value.title === "string" ? value.title.slice(0, 120) : "Mon quiz",
    introductionText: typeof value.introductionText === "string" ? value.introductionText.slice(0, 1000) : "",
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
