import {
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  ANSWER_FRAMES,
  ANSWER_COMMENTARY_GAP_FRAMES,
  FPS,
  THEME_FRAMES,
  introductionDurationFrames,
  introductionSlides,
  questionStartFrame,
  questionDurationFrames,
  transitionFramesAfter,
  type QuizQuestion,
  type QuizVideoProps,
} from "../lib/quiz";

const toPublicUrl = (asset: string) => staticFile(asset.replace(/^\/+/, ""));
const QUESTION_IMAGE_WIDTH = 600;
const QUESTION_IMAGE_HEIGHT = 340;
const QUESTION_IMAGE_BOTTOM_MARGIN = 30;

const Backdrop: React.FC<{ image: string | null; opacity?: number }> = ({ image, opacity = 1 }) => (
  <div style={{ position: "absolute", inset: 0, background: "#10201a", opacity }}>
    {image ? (
      <Img src={toPublicUrl(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    ) : (
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 48%, #284034 0%, #14221b 58%, #0d1512 100%)" }} />
    )}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #09110bd8, #111a1266 50%, #0b130bc4)" }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 150px #000a" }} />
  </div>
);

const Logo: React.FC<{ source: string | null; opacity?: number }> = ({ source, opacity = 1 }) => (
  source ? <div style={{ position: "absolute", zIndex: 20, top: 52, left: 64, opacity }}><Img src={toPublicUrl(source)} style={{ maxWidth: 210, maxHeight: 78, objectFit: "contain", objectPosition: "left center" }} /></div> : null
);

const Illustration: React.FC<{ image: string | null }> = ({ image }) => {
  if (!image) return null;
  return (
    <div style={{ boxSizing: "border-box", position: "absolute", zIndex: 2, left: "50%", bottom: QUESTION_IMAGE_BOTTOM_MARGIN, width: QUESTION_IMAGE_WIDTH, height: QUESTION_IMAGE_HEIGHT, display: "grid", placeItems: "center", transform: "translateX(-50%)", pointerEvents: "none" }}>
      <Img src={toPublicUrl(image)} style={{ display: "block", width: "auto", height: QUESTION_IMAGE_HEIGHT, maxWidth: QUESTION_IMAGE_WIDTH, maxHeight: QUESTION_IMAGE_HEIGHT, objectPosition: "center", filter: "drop-shadow(0 8px 22px #0009)" }} />
    </div>
  );
};

const QuestionAnswerCard: React.FC<{ question: QuizQuestion; number: number; frame: number; questionFrames: number }> = ({ question, number, frame, questionFrames }) => {
  const questionAlpha = frame < questionFrames ? interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" }) : 0;
  const answerAlpha = interpolate(frame, [questionFrames, questionFrames + 10, questionFrames + ANSWER_FRAMES, questionFrames + ANSWER_FRAMES + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [questionFrames, questionFrames + 16, questionFrames + 36], [0, 24, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 22], [1.025, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", zIndex: 3, inset: 0, display: "grid", placeItems: "center", padding: "40px 120px 120px", textAlign: "center" }}>
      <div style={{ boxSizing: "border-box", position: "relative", width: 1460, maxWidth: "100%", minHeight: 360, padding: "62px 88px", display: "grid", placeItems: "center", border: "2px solid #d1b36a", outline: "1px solid #f2d88a99", outlineOffset: 9, background: "linear-gradient(135deg, #142019ed, #111913e8 52%, #182019ed)", boxShadow: "0 24px 90px #0009, inset 0 0 70px #d1b36a10", transform: `scale(${scale})` }}>
        <div style={{ position: "absolute", inset: 12, border: "1px solid #d1b36a55", pointerEvents: "none" }} />
        <div style={{ gridArea: "1 / 1", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: questionAlpha }}>
          <div style={{ position: "relative", color: "#d1b36a", fontSize: 38, fontWeight: 600, letterSpacing: 8, marginBottom: 22, textTransform: "uppercase" }}>{question.title ? question.title : `QUESTION ${String(number).padStart(2, "0")}`}</div>
          <div style={{ position: "relative", color: "#fff8e9", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 60, lineHeight: 1.15, textShadow: "0 4px 26px #000c", maxWidth: 1260 }}>{question.prompt}</div>
        </div>
        <div style={{ gridArea: "1 / 1", width: "100%", display: "grid", placeItems: "center", opacity: answerAlpha }}>
          <div style={{ position: "relative", color: "#f1d58d", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 76, lineHeight: 1.16, textShadow: `0 0 ${glow}px #e1b95a, 0 3px 28px #000d`, maxWidth: 1260 }}>{question.answer}</div>
        </div>
      </div>
    </div>
  );
};

const ThemeImageSequence: React.FC<{ image: string | null; frame: number; duration?: number }> = ({ image, frame, duration = THEME_FRAMES }) => {
  const fadeFrames = Math.min(12, Math.floor(duration / 3));
  const opacity = interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", zIndex: 40, inset: 0, overflow: "hidden", backgroundColor: "#080b09", opacity }}>
      {image && <>
        <Img src={toPublicUrl(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px) brightness(.45)", transform: "scale(1.08)" }} />
        <Img src={toPublicUrl(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 10px 35px #000b)" }} />
      </>}
    </div>
  );
};

const resolveTheme = (project: QuizVideoProps["project"], questionIndex: number) => {
  let title = project.themeTitle.trim() || project.title || "Mon quiz";
  let image = project.themeImage;
  let background = project.background;
  let logo = project.logo;
  for (let index = 1; index <= questionIndex; index += 1) {
    const question = project.questions[index];
    if (!question?.startsTheme) continue;
    title = question.themeTitle.trim() || `Thème ${index + 1}`;
    image = question.themeImage;
  }
  return { title, image, background, logo };
};

const Timer: React.FC<{ frame: number; duration: number }> = ({ frame, duration }) => {
  const seconds = Math.max(0, Math.ceil((duration - frame) / FPS));
  const progress = Math.min(1, Math.max(0, frame / duration));
  const sandTop = Math.max(0, 1 - progress);
  const sandBottom = Math.min(1, progress);
  return (
    <div style={{ position: "absolute", zIndex: 5, right: 58, bottom: 48, width: 190, height: 252, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 8px 18px #0009)" }}>
      <svg width="156" height="194" viewBox="0 0 120 150" aria-label={`Il reste ${seconds} secondes`}>
        <defs>
          <clipPath id="hourglassTop"><path d="M34 22 C34 41 46 57 60 70 C74 57 86 41 86 22 Z" /></clipPath>
          <clipPath id="hourglassBottom"><path d="M60 74 C46 86 34 102 34 130 H86 C86 102 74 86 60 74 Z" /></clipPath>
        </defs>
        <path d="M34 22 C34 41 46 57 60 70 C46 83 34 101 34 130 H86 C86 101 74 83 60 70 C74 57 86 41 86 22 Z" fill="#dce7d911" stroke="#f0d58d" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M39 25 C40 41 49 54 57 62 M81 25 C80 41 71 54 63 62" fill="none" stroke="#fff0bc" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
        <rect x="29" y={70 - 53 * sandTop} width="62" height={53 * sandTop} fill="#e4c574" clipPath="url(#hourglassTop)" />
        <rect x="29" y={130 - 56 * sandBottom} width="62" height={56 * sandBottom} fill="#e4c574" clipPath="url(#hourglassBottom)" />
        <path d="M60 71 V73" stroke="#f4df9d" strokeWidth="1.6" strokeLinecap="round" opacity={progress > 0 && progress < 1 ? .95 : 0} />
      </svg>
      <span style={{ marginTop: 2, color: "#fff3d0", fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 600, letterSpacing: 1, lineHeight: 1, textShadow: "0 2px 12px #000d" }}>{seconds}</span>
    </div>
  );
};

export const QuizVideo: React.FC<QuizVideoProps> = ({ project, questions, questionOffset }) => {
  const frame = useCurrentFrame();
  const introFrames = introductionDurationFrames(project);
  const introSlides = introductionSlides(project);
  const isOpeningTheme = frame < introFrames;
  const questionsFrame = Math.max(0, frame - introFrames);
  const matchingIndex = questions.findIndex((_item, index) => questionsFrame < questionStartFrame(questions, index + 1, introFrames) - introFrames);
  const activeIndex = matchingIndex < 0 ? questions.length - 1 : matchingIndex;
  const questionStart = questionStartFrame(questions, activeIndex, introFrames);
  const localFrame = frame - questionStart;
  const hasQuestionStarted = localFrame >= 0;
  const question = questions[Math.max(0, activeIndex)];
  const nextQuestion = questions[activeIndex + 1];
  const isLast = activeIndex === questions.length - 1;
  const questionFrames = questionDurationFrames(question);
  const transitionStart = questionFrames + ANSWER_FRAMES;
  const isTransitioning = localFrame >= transitionStart && !isLast;
  const questionNumber = questionOffset + activeIndex + 1;
  const nextTheme = nextQuestion ? resolveTheme(project, questionOffset + activeIndex + 1) : null;
  const isNewTheme = Boolean(isTransitioning && nextQuestion?.startsTheme);

  if (!question) return null;
  return (
    <div style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative", background: "#101b14", fontFamily: "Arial, sans-serif" }}>
      {project.backgroundMusic && <Sequence from={introFrames} layout="none"><Audio src={toPublicUrl(project.backgroundMusic)} loop volume={project.musicVolume / 100} /></Sequence>}
      {project.introductionAudio && <Sequence from={0} durationInFrames={Math.max(1, Math.ceil((project.introductionAudioDuration ?? 25) * FPS))} layout="none"><Audio src={toPublicUrl(project.introductionAudio)} volume={project.voiceVolume / 100} /></Sequence>}
      {questions.map((item, index) => (
        <Sequence key={`voice-question-${item.id}`} from={questionStartFrame(questions, index, introFrames)} durationInFrames={Math.max(1, Math.ceil((item.questionAudioDuration ?? 15) * FPS))} layout="none">
          {item.questionAudio && item.questionAudioVoice === project.voice && item.questionAudioRate === project.speechRate ? <Audio src={toPublicUrl(item.questionAudio)} volume={project.voiceVolume / 100} /> : null}
        </Sequence>
      ))}
      {questions.map((item, index) => (
        <Sequence key={`voice-answer-${item.id}`} from={questionStartFrame(questions, index, introFrames) + questionDurationFrames(item)} durationInFrames={Math.max(1, Math.ceil((item.answerAudioDuration ?? 4) * FPS))} layout="none">
          {item.answerAudio && item.answerAudioVoice === project.voice && item.answerAudioRate === project.speechRate ? <Audio src={toPublicUrl(item.answerAudio)} volume={project.voiceVolume / 100} /> : null}
        </Sequence>
      ))}
      {questions.map((item, index) => (
        <Sequence key={`voice-commentary-${item.id}`} from={questionStartFrame(questions, index, introFrames) + questionDurationFrames(item) + Math.ceil((item.answerAudioDuration ?? 0) * FPS) + ANSWER_COMMENTARY_GAP_FRAMES} durationInFrames={Math.max(1, Math.ceil((item.commentaryAudioDuration ?? 4) * FPS))} layout="none">
          {item.commentaryAudio && item.commentaryAudioVoice === project.voice && item.commentaryAudioRate === project.speechRate ? <Audio src={toPublicUrl(item.commentaryAudio)} volume={project.voiceVolume / 100} /> : null}
        </Sequence>
      ))}
      <Backdrop image={project.background} />
      {isOpeningTheme && introSlides.map((image, index) => {
        const slideDuration = Math.ceil(introFrames / Math.max(1, introSlides.length));
        const slideStart = index * slideDuration;
        return frame >= slideStart && frame < slideStart + slideDuration
          ? <ThemeImageSequence key={`intro-image-${index}`} image={image} frame={frame - slideStart} duration={slideDuration} />
          : null;
      })}
      {hasQuestionStarted && localFrame < questionFrames && <Illustration image={question.image} />}
      {hasQuestionStarted && localFrame >= questionFrames && localFrame < questionFrames + ANSWER_FRAMES && <Illustration image={question.answerImage || (question.keepImageOnAnswer ? question.image : null)} />}
      {hasQuestionStarted && localFrame < questionFrames + ANSWER_FRAMES && <QuestionAnswerCard question={question} number={questionNumber} frame={localFrame} questionFrames={questionFrames} />}
      {hasQuestionStarted && localFrame < questionFrames && <Timer frame={localFrame} duration={questionFrames} />}
      {localFrame >= transitionStart && !isLast && nextQuestion && (
        isNewTheme && nextTheme?.image
          ? <ThemeImageSequence image={nextTheme.image} frame={localFrame - transitionStart} duration={transitionFramesAfter(questions, activeIndex)} />
          : null
      )}
      <Logo source={project.logo} />
      {hasQuestionStarted && <div style={{ position: "absolute", zIndex: 20, bottom: 72, left: 64, color: "#f1deae", fontSize: 34, fontWeight: 700, letterSpacing: 5, lineHeight: 1, textShadow: "0 2px 10px #000" }}>{String(questionNumber).padStart(2, "0")} / {String(project.questions.length).padStart(2, "0")}</div>}
      <div style={{ position: "absolute", zIndex: 1, inset: 18, border: "1px solid #dfc27650" }} />
      <div style={{ position: "absolute", zIndex: 1, top: 39, right: 47, width: 18, height: 18, borderTop: "1px solid #dfc27688", borderRight: "1px solid #dfc27688" }} />
      <div style={{ position: "absolute", zIndex: 1, bottom: 39, left: 47, width: 18, height: 18, borderBottom: "1px solid #dfc27688", borderLeft: "1px solid #dfc27688" }} />
    </div>
  );
};
