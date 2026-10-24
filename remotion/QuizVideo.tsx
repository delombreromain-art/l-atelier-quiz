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
  QUESTION_FRAMES,
  THEME_FRAMES,
  introductionDurationFrames,
  introductionSlides,
  questionStartFrame,
  transitionFramesAfter,
  type QuizQuestion,
  type QuizVideoProps,
} from "../lib/quiz";

const toPublicUrl = (asset: string) => staticFile(asset.replace(/^\/+/, ""));

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

const Illustration: React.FC<{ question: QuizQuestion }> = ({ question }) => {
  if (!question.image) return null;
  return (
    <div style={{ position: "absolute", top: 215, right: 140, width: 470, height: 470, display: "grid", placeItems: "center", border: "1px solid #d1b36a66", background: "#07100a55", padding: 18 }}>
      <Img src={toPublicUrl(question.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
};

const PromptText: React.FC<{ question: QuizQuestion; number: number; alpha?: number; scale?: number }> = ({ question, number, alpha = 1, scale = 1 }) => (
  <div style={{ position: "absolute", zIndex: 3, inset: 0, display: "grid", placeItems: "center", padding: "80px 120px", textAlign: "center" }}>
    <div style={{ boxSizing: "border-box", position: "relative", width: 1460, maxWidth: "100%", minHeight: 360, padding: "62px 88px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px solid #d1b36a", outline: "1px solid #f2d88a99", outlineOffset: 9, background: "linear-gradient(135deg, #142019ed, #111913e8 52%, #182019ed)", boxShadow: "0 24px 90px #0009, inset 0 0 70px #d1b36a10", opacity: alpha, transform: `scale(${scale})` }}>
      <div style={{ position: "absolute", inset: 12, border: "1px solid #d1b36a55", pointerEvents: "none" }} />
      <div style={{ position: "relative", color: "#d1b36a", fontSize: 19, letterSpacing: 8, marginBottom: 28, textTransform: "uppercase" }}>
        {question.title ? question.title : `QUESTION ${String(number).padStart(2, "0")}`}
      </div>
      <div style={{ position: "relative", color: "#fff8e9", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 68, lineHeight: 1.18, textShadow: "0 4px 26px #000c", maxWidth: 1260 }}>
        {question.prompt}
      </div>
    </div>
  </div>
);

const AnswerText: React.FC<{ question: QuizQuestion; frame: number }> = ({ question, frame }) => {
  const alpha = interpolate(frame, [QUESTION_FRAMES, QUESTION_FRAMES + 10, QUESTION_FRAMES + ANSWER_FRAMES, QUESTION_FRAMES + ANSWER_FRAMES + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [QUESTION_FRAMES, QUESTION_FRAMES + 16, QUESTION_FRAMES + 36], [0, 24, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", zIndex: 4, inset: 0, display: "grid", placeItems: "center", padding: "80px 120px", textAlign: "center", opacity: alpha }}>
      <div style={{ boxSizing: "border-box", position: "relative", width: 1460, maxWidth: "100%", minHeight: 360, padding: "62px 88px", display: "grid", placeItems: "center", border: "2px solid #d1b36a", outline: "1px solid #f2d88a99", outlineOffset: 9, background: "linear-gradient(135deg, #142019ed, #111913e8 52%, #182019ed)", boxShadow: "0 24px 90px #0009, inset 0 0 70px #d1b36a10" }}>
        <div style={{ position: "absolute", inset: 12, border: "1px solid #d1b36a55", pointerEvents: "none" }} />
        <div style={{ position: "relative", color: "#f1d58d", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 76, lineHeight: 1.16, textShadow: `0 0 ${glow}px #e1b95a, 0 3px 28px #000d`, maxWidth: 1260 }}>{question.answer}</div>
      </div>
    </div>
  );
};

const ThemeImageSequence: React.FC<{ image: string | null; frame: number; duration?: number }> = ({ image, frame, duration = THEME_FRAMES }) => {
  const fadeFrames = Math.min(12, Math.floor(duration / 3));
  const opacity = interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, duration], [1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", zIndex: 40, inset: 0, overflow: "hidden", backgroundColor: "#080b09", opacity }}>
      {image && <Img src={toPublicUrl(image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />}
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

const Timer: React.FC<{ frame: number }> = ({ frame }) => {
  const seconds = Math.max(1, Math.ceil((QUESTION_FRAMES - frame) / 30));
  const progress = Math.min(1, Math.max(0, frame / QUESTION_FRAMES));
  const circumference = 2 * Math.PI * 36;
  return (
    <div style={{ position: "absolute", zIndex: 5, right: 70, bottom: 64, width: 118, height: 118, display: "grid", placeItems: "center" }}>
      <svg width="118" height="118" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="36" fill="#0d1710cc" stroke="#fff3" strokeWidth="2" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#e4c574" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={circumference * progress} strokeLinecap="round" />
      </svg>
      <span style={{ color: "#fff3d0", fontFamily: "Georgia, serif", fontSize: 41, lineHeight: 1 }}>{seconds}</span>
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
  const question = questions[Math.max(0, activeIndex)];
  const nextQuestion = questions[activeIndex + 1];
  const isLast = activeIndex === questions.length - 1;
  const transitionStart = QUESTION_FRAMES + ANSWER_FRAMES;
  const isTransitioning = localFrame >= transitionStart && !isLast;
  const questionNumber = questionOffset + activeIndex + 1;
  const nextTheme = nextQuestion ? resolveTheme(project, questionOffset + activeIndex + 1) : null;
  const isNewTheme = Boolean(isTransitioning && nextQuestion?.startsTheme);

  if (!question) return null;
  const phaseQuestionAlpha = localFrame < QUESTION_FRAMES
    ? interpolate(localFrame, [0, 22], [0, 1], { extrapolateRight: "clamp" })
    : localFrame < QUESTION_FRAMES + ANSWER_FRAMES
      ? 0
      : interpolate(localFrame, [QUESTION_FRAMES + ANSWER_FRAMES, QUESTION_FRAMES + ANSWER_FRAMES + 28], [1, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative", background: "#101b14", fontFamily: "Arial, sans-serif" }}>
      {project.backgroundMusic && <Sequence from={introFrames} layout="none"><Audio src={toPublicUrl(project.backgroundMusic)} loop volume={project.musicVolume / 100} /></Sequence>}
      {project.introductionAudio && <Audio src={toPublicUrl(project.introductionAudio)} volume={project.voiceVolume / 100} />}
      {questions.map((item, index) => (
        <Sequence key={`voice-question-${item.id}`} from={questionStartFrame(questions, index, introFrames)} layout="none">
          {item.questionAudio ? <Audio src={toPublicUrl(item.questionAudio)} volume={project.voiceVolume / 100} /> : null}
        </Sequence>
      ))}
      {questions.map((item, index) => (
        <Sequence key={`voice-answer-${item.id}`} from={questionStartFrame(questions, index, introFrames) + QUESTION_FRAMES} layout="none">
          {item.answerAudio ? <Audio src={toPublicUrl(item.answerAudio)} volume={project.voiceVolume / 100} /> : null}
        </Sequence>
      ))}
      <Backdrop image={project.background} />
      {isOpeningTheme && introSlides.map((image, index) => {
        const slideStart = index * THEME_FRAMES;
        const slideDuration = index === introSlides.length - 1 ? introFrames - slideStart : THEME_FRAMES;
        return frame >= slideStart && frame < slideStart + slideDuration
          ? <ThemeImageSequence key={`intro-image-${index}`} image={image} frame={frame - slideStart} duration={slideDuration} />
          : null;
      })}
      {!isOpeningTheme && localFrame < QUESTION_FRAMES && <Illustration question={question} />}
      {localFrame >= QUESTION_FRAMES && localFrame < QUESTION_FRAMES + ANSWER_FRAMES && question.keepImageOnAnswer && <Illustration question={question} />}
      {!isOpeningTheme && localFrame < QUESTION_FRAMES && (
        <>
          <PromptText question={question} number={questionNumber} alpha={phaseQuestionAlpha} scale={interpolate(localFrame, [0, 22], [1.025, 1], { extrapolateRight: "clamp" })} />
          <Timer frame={localFrame} />
        </>
      )}
      {!isOpeningTheme && localFrame >= QUESTION_FRAMES && localFrame < QUESTION_FRAMES + ANSWER_FRAMES && (
        <>
          <AnswerText question={question} frame={localFrame} />
        </>
      )}
      {localFrame >= QUESTION_FRAMES + ANSWER_FRAMES && !isLast && nextQuestion && (
        isNewTheme && nextTheme?.image
          ? <ThemeImageSequence image={nextTheme.image} frame={localFrame - transitionStart} duration={transitionFramesAfter(questions, activeIndex)} />
          : null
      )}
      <Logo source={project.logo} />
      {!isOpeningTheme && <div style={{ position: "absolute", zIndex: 20, bottom: 50, left: 64, color: "#f1deae99", fontSize: 14, letterSpacing: 4 }}>{String(questionNumber).padStart(2, "0")} / {String(project.questions.length).padStart(2, "0")}</div>}
      <div style={{ position: "absolute", zIndex: 1, inset: 18, border: "1px solid #dfc27650" }} />
      <div style={{ position: "absolute", zIndex: 1, top: 39, right: 47, width: 18, height: 18, borderTop: "1px solid #dfc27688", borderRight: "1px solid #dfc27688" }} />
      <div style={{ position: "absolute", zIndex: 1, bottom: 39, left: 47, width: 18, height: 18, borderBottom: "1px solid #dfc27688", borderLeft: "1px solid #dfc27688" }} />
    </div>
  );
};
