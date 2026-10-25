import {
  Audio,
  Easing,
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

const questionPromptFontSize = (prompt: string) =>
  Math.max(20, Math.round(72 * Math.sqrt(75 / Math.max(75, prompt.length))));

const questionTitleFontSize = (title: string) =>
  Math.max(24, Math.round(38 * Math.sqrt(32 / Math.max(32, title.length))));

const answerTextFontSize = (answer: string, commentary: string) => {
  for (let fontSize = 76; fontSize >= 18; fontSize -= 1) {
    const answerLines = Math.max(1, Math.ceil(answer.length * fontSize * 0.56 / 1200));
    const commentaryLines = commentary.trim()
      ? Math.max(1, Math.ceil(commentary.length * fontSize * 0.56 / 1120))
      : 0;
    const estimatedHeight = (answerLines + commentaryLines) * fontSize * 1.16 + (commentaryLines ? 22 : 0);
    if (estimatedHeight <= 260) return fontSize;
  }
  return 18;
};

const Backdrop: React.FC<{ image: string | null; opacity?: number; scale?: number }> = ({ image, opacity = 1, scale = 1 }) => (
  <div style={{ position: "absolute", inset: 0, background: "#10201a", opacity }}>
    {image ? (
      <Img src={toPublicUrl(image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
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
  const answerAlpha = interpolate(frame, [questionFrames, questionFrames + 12, questionFrames + ANSWER_FRAMES], [0, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [questionFrames, questionFrames + 16, questionFrames + 36], [0, 24, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 22], [1.025, 1], { extrapolateRight: "clamp" });
  const answerOffset = interpolate(frame, [questionFrames, questionFrames + 12], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const promptFontSize = questionPromptFontSize(question.prompt);
  const titleFontSize = questionTitleFontSize(question.title || `QUESTION ${String(number).padStart(2, "0")}`);
  const answerFontSize = answerTextFontSize(question.answer, question.answerCommentary);
  return (
    <div style={{ position: "absolute", zIndex: 3, inset: 0, display: "grid", placeItems: "center", padding: "40px 120px 120px", textAlign: "center" }}>
      <div style={{ boxSizing: "border-box", position: "relative", width: 1380, maxWidth: "100%", minHeight: 380, padding: "54px 64px", display: "grid", placeItems: "center", border: "2px solid #d1b36a", outline: "1px solid #f2d88a99", outlineOffset: 9, background: "linear-gradient(135deg, #142019ed, #111913e8 52%, #182019ed)", boxShadow: "0 24px 90px #0009, inset 0 0 70px #d1b36a10", transform: `scale(${scale})` }}>
        <div style={{ position: "absolute", inset: 12, border: "1px solid #d1b36a55", pointerEvents: "none" }} />
        <div style={{ gridArea: "1 / 1", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: questionAlpha }}>
          <div style={{ position: "relative", color: "#d1b36a", fontSize: titleFontSize, fontWeight: 600, letterSpacing: 8, marginBottom: 22, textTransform: "uppercase", maxWidth: 1200, textWrap: "balance", overflowWrap: "anywhere" }}>{question.title ? question.title : `QUESTION ${String(number).padStart(2, "0")}`}</div>
          <div style={{ position: "relative", color: "#fff8e9", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: promptFontSize, lineHeight: 1.15, textWrap: "balance", overflowWrap: "anywhere", textShadow: "0 4px 26px #000c", maxWidth: 1200 }}>{question.prompt}</div>
        </div>
        <div style={{ gridArea: "1 / 1", width: "100%", display: "grid", placeItems: "center", opacity: answerAlpha }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: question.answerCommentary.trim() ? 22 : 0, transform: `translateY(${answerOffset}px)`, maxWidth: "100%" }}>
            <div style={{ color: "#f1d58d", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: answerFontSize, lineHeight: 1.16, textShadow: `0 0 ${glow}px #e1b95a, 0 3px 28px #000d`, maxWidth: 1200, textWrap: "balance", overflowWrap: "anywhere" }}>{question.answer}</div>
            {question.answerCommentary.trim() && <div style={{ color: "#fff1cf", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: answerFontSize, lineHeight: 1.16, maxWidth: 1120, textWrap: "balance", overflowWrap: "anywhere", textShadow: "0 2px 12px #000d" }}>{question.answerCommentary}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ThemeImageSequence: React.FC<{ image: string | null; frame: number; duration?: number; zIndex?: number; opacity?: number }> = ({ image, frame, duration = THEME_FRAMES, zIndex = 40, opacity: layerOpacity = 1 }) => {
  const fadeFrames = Math.min(12, Math.floor(duration / 3));
  const opacity = interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", zIndex, inset: 0, overflow: "hidden", backgroundColor: "#080b09", opacity: opacity * layerOpacity }}>
      {image && <>
        <Img src={toPublicUrl(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px) brightness(.45)", transform: "scale(1.08)" }} />
        <Img src={toPublicUrl(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 10px 35px #000b)" }} />
      </>}
    </div>
  );
};

const IntroductionImage: React.FC<{ image: string; frame: number; duration: number }> = ({ image, frame, duration }) => {
  const fadeInFrames = Math.max(1, Math.round(0.7 * FPS));
  const fadeOutFrames = Math.min(Math.round(0.7 * FPS), Math.max(1, Math.round(duration * 0.05)));
  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const fadeOut = interpolate(frame, [duration - fadeOutFrames, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const zoom = interpolate(frame, [0, duration], [1, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  return <div style={{ position: "absolute", zIndex: 4, inset: 0, overflow: "hidden", background: "#000", opacity: fadeOut }}><Img src={toPublicUrl(image)} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", opacity: fadeIn, transform: `scale(${zoom})` }} /></div>;
};

const resolveTheme = (project: QuizVideoProps["project"], questionIndex: number) => {
  let title = project.themeTitle.trim() || project.title || "Mon quiz";
  let image = project.themeImage;
  const background = project.background;
  const logo = project.logo;
  for (let index = 1; index <= questionIndex; index += 1) {
    const question = project.questions[index];
    if (!question?.startsTheme) continue;
    title = question.themeTitle.trim() || `Thème ${index + 1}`;
    image = question.themeImage;
  }
  return { title, image, background, logo };
};

const Timer: React.FC<{ frame: number; duration: number; displaySeconds?: boolean; transitionPulse?: number }> = ({ frame, duration, displaySeconds = true, transitionPulse = 0 }) => {
  const seconds = Math.max(0, Math.ceil((duration - frame) / FPS));
  const progress = Math.min(1, Math.max(0, frame / duration));
  const sandTop = Math.max(0, 1 - progress);
  const sandBottom = Math.min(1, progress);
  const tickScale = interpolate(frame % FPS, [0, 4, 14], [1.12, 1.025, 1], { extrapolateRight: "clamp" });
  const urgencyScale = seconds <= 3 ? 1 + Math.sin((frame / FPS) * Math.PI * 2) * 0.025 : 1;
  const transitionScale = 1 + Math.sin(Math.PI * transitionPulse) * 0.055;
  const transitionGlow = Math.sin(Math.PI * transitionPulse) * 10;
  return (
    <div style={{ position: "absolute", zIndex: 5, right: 58, bottom: 48, width: 190, height: 252, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", filter: `drop-shadow(0 8px 18px #0009) drop-shadow(0 0 ${transitionGlow}px #d1b36a88)` }}>
      <svg width="156" height="194" viewBox="0 0 120 150" aria-label={displaySeconds ? `Il reste ${seconds} secondes` : "Sablier"} style={{ transform: transitionPulse ? `scale(${transitionScale})` : undefined }}>
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
      {displaySeconds ? <span style={{ marginTop: 2, color: "#e4c574", fontFamily: "Georgia, serif", fontSize: 56, fontWeight: 600, letterSpacing: 1, lineHeight: 1, transform: `scale(${tickScale * urgencyScale})`, textShadow: "0 2px 12px #000d" }}>{seconds}</span> : <span aria-hidden="true" style={{ height: 58, marginTop: 2, visibility: "hidden" }} />}
    </div>
  );
};

export const QuizVideo: React.FC<QuizVideoProps> = ({ project, questions, questionOffset }) => {
  const frame = useCurrentFrame();
  const introFrames = introductionDurationFrames(project);
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
  const isHourglassTransitionVariation = isTransitioning && Boolean(nextQuestion) && questionNumber % 8 === 0 && !nextQuestion?.startsTheme;
  const transitionProgress = isTransitioning && nextQuestion
    ? Math.min(1, (localFrame - transitionStart) / Math.max(1, transitionFramesAfter(questions, activeIndex)))
    : 0;
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
      {isOpeningTheme && project.introductionImage && <IntroductionImage image={project.introductionImage} frame={frame} duration={introFrames} />}
      {hasQuestionStarted && localFrame < questionFrames && <Illustration image={question.image} />}
      {hasQuestionStarted && localFrame >= questionFrames && localFrame < questionFrames + ANSWER_FRAMES && <Illustration image={question.answerImage || (question.keepImageOnAnswer ? question.image : null)} />}
      {hasQuestionStarted && localFrame < questionFrames + ANSWER_FRAMES && <QuestionAnswerCard question={question} number={questionNumber} frame={localFrame} questionFrames={questionFrames} />}
      {hasQuestionStarted && localFrame < questionFrames && <Timer frame={localFrame} duration={questionFrames} />}
      {localFrame >= transitionStart && !isLast && nextQuestion && (
        isNewTheme && nextTheme?.image
          ? <ThemeImageSequence image={nextTheme.image} frame={localFrame - transitionStart} duration={transitionFramesAfter(questions, activeIndex)} />
          : null
      )}
      {isHourglassTransitionVariation && <Timer frame={questionFrames} duration={questionFrames} displaySeconds={false} transitionPulse={transitionProgress} />}
      {!isOpeningTheme && <Logo source={project.logo} />}
      {hasQuestionStarted && <div style={{ position: "absolute", zIndex: 20, bottom: 72, left: 64, color: "#e4c574", fontSize: 34, fontWeight: 700, letterSpacing: 5, lineHeight: 1, textShadow: "0 2px 10px #000" }}>{String(questionNumber).padStart(2, "0")} / {String(project.questions.length).padStart(2, "0")}</div>}
      {!isOpeningTheme && <div style={{ position: "absolute", zIndex: 1, inset: 18, border: "1px solid #dfc27650" }} />}
      {!isOpeningTheme && <div style={{ position: "absolute", zIndex: 1, top: 39, right: 47, width: 18, height: 18, borderTop: "1px solid #dfc27688", borderRight: "1px solid #dfc27688" }} />}
      {!isOpeningTheme && <div style={{ position: "absolute", zIndex: 1, bottom: 39, left: 47, width: 18, height: 18, borderBottom: "1px solid #dfc27688", borderLeft: "1px solid #dfc27688" }} />}
    </div>
  );
};
