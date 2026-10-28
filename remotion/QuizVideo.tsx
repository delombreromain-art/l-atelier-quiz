import {
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ANSWER_FRAMES,
  CONCLUSION_VISUAL_FADE_FRAMES,
  CONCLUSION_VOICE_DELAY_FRAMES,
  ENDING_PAUSE_FRAMES,
  FPS,
  RIDDLE_TITLE,
  THEME_FRAMES,
  conclusionDurationFrames,
  introductionDurationFrames,
  questionVideoDuration,
  questionStartFrame,
  questionDurationFrames,
  answerDisplayFrames,
  narrationAudio,
  introductionNarration,
  conclusionNarration,
  transitionFramesAfter,
  type ConclusionLayer,
  type QuizQuestion,
  type IntroductionLayers,
  type QuizVideoProps,
} from "../lib/quiz";

const toPublicUrl = (asset: string) => staticFile(asset.replace(/^\/+/, ""));
const QUESTION_IMAGE_WIDTH = 600;
const QUESTION_IMAGE_HEIGHT = 340;
const QUESTION_IMAGE_BOTTOM_MARGIN = 10;

const questionPromptFontSize = (prompt: string) =>
  Math.max(20, Math.round(72 * Math.sqrt(75 / Math.max(75, prompt.length))));

const questionTitleFontSize = (title: string) =>
  Math.max(24, Math.round(38 * Math.sqrt(32 / Math.max(32, title.length))));

const answerTextFontSize = (answer: string) => {
  for (let fontSize = 96; fontSize >= 18; fontSize -= 1) {
    const answerLines = Math.max(1, Math.ceil(answer.length * fontSize * 0.56 / 1200));
    const estimatedHeight = answerLines * fontSize * 1.16;
    if (estimatedHeight <= 270) return fontSize;
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

const QuestionAnswerCard: React.FC<{ question: QuizQuestion; number: number; frame: number; questionFrames: number; answerFrames: number }> = ({ question, number, frame, questionFrames, answerFrames }) => {
  const questionAlpha = frame < questionFrames ? interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" }) : 0;
  const answerAlpha = interpolate(frame, [questionFrames, questionFrames + 12, questionFrames + answerFrames], [0, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [questionFrames, questionFrames + 16, questionFrames + 36], [0, 24, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 22], [1.025, 1], { extrapolateRight: "clamp" });
  const answerOffset = interpolate(frame, [questionFrames, questionFrames + 12], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const promptFontSize = questionPromptFontSize(question.prompt);
  const titleFontSize = questionTitleFontSize(question.isRiddle ? RIDDLE_TITLE : question.title || `QUESTION ${String(number).padStart(2, "0")}`);
  const answerFontSize = answerTextFontSize(question.answer);
  return (
    <div style={{ position: "absolute", zIndex: 3, inset: 0, display: "grid", placeItems: "center", padding: "40px 120px 120px", textAlign: "center" }}>
      <div style={{ boxSizing: "border-box", position: "relative", width: 1380, maxWidth: "100%", minHeight: question.isRiddle ? 640 : 380, height: question.isRiddle ? 640 : "auto", padding: question.isRiddle ? 0 : "54px 64px", overflow: question.isRiddle ? "hidden" : "visible", display: "grid", placeItems: "center", border: "2px solid #d1b36a", outline: "1px solid #f2d88a99", outlineOffset: 9, background: "linear-gradient(135deg, #142019ed, #111913e8 52%, #182019ed)", boxShadow: "0 24px 90px #0009, inset 0 0 70px #d1b36a10", transform: `scale(${scale})` }}>
        <div style={{ position: "absolute", inset: 12, border: "1px solid #d1b36a55", pointerEvents: "none" }} />
        {question.isRiddle ? (
          <div style={{ position: "absolute", inset: 14, overflow: "hidden", opacity: questionAlpha }}>
            {question.image && <Img src={toPublicUrl(question.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #08100de8 0%, #08100d8c 22%, #08100d00 56%, #08100d22 100%)" }} />
            <div style={{ position: "absolute", top: 26, left: 30, right: 30, color: "#f0d485", fontSize: Math.max(56, titleFontSize), fontWeight: 600, letterSpacing: 8, lineHeight: 1.15, textShadow: "0 3px 20px #000", textAlign: "center" }}>{RIDDLE_TITLE}</div>
            {!question.image && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff1cf", fontSize: 24 }}>Add a photo to this riddle.</div>}
          </div>
        ) : (
          <div style={{ gridArea: "1 / 1", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: questionAlpha }}>
            <div style={{ position: "relative", color: "#d1b36a", fontSize: titleFontSize, fontWeight: 600, letterSpacing: 8, marginBottom: 22, textTransform: "uppercase", maxWidth: 1200, textWrap: "balance", overflowWrap: "anywhere" }}>{question.title ? question.title : "QUESTION " + String(number).padStart(2, "0")}</div>
            <div style={{ position: "relative", color: "#fff8e9", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: promptFontSize, lineHeight: 1.15, textWrap: "balance", overflowWrap: "anywhere", textShadow: "0 4px 26px #000c", maxWidth: 1200 }}>{question.prompt}</div>
          </div>
        )}
        <div style={{ gridArea: "1 / 1", width: "100%", display: "grid", placeItems: "center", opacity: answerAlpha }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${answerOffset}px)`, maxWidth: "100%" }}>
            <div style={{ color: "#f1d58d", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: answerFontSize, lineHeight: 1.16, textShadow: `0 0 ${glow}px #e1b95a, 0 3px 28px #000d`, maxWidth: 1200, textWrap: "balance", overflowWrap: "anywhere" }}>{question.answer}</div>
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

const easeOut = Easing.out(Easing.quad);

const IntroductionLayerImage: React.FC<{
  image: string;
  layer: IntroductionLayers[keyof IntroductionLayers];
  startFrame: number;
  enterFrames: number;
  scaleFrom: number;
  risePixels: number;
  lightOnEntry?: boolean;
  shineStartFrame?: number;
  shineFrames?: number;
  spinStartFrame?: number;
  spinFrames?: number;
}> = ({ image, layer, startFrame, enterFrames, scaleFrom, risePixels, lightOnEntry = false, shineStartFrame, shineFrames = 1, spinStartFrame, spinFrames = 48 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + enterFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const scale = interpolate(progress, [0, 1], [scaleFrom, 1]);
  const translateY = risePixels * (1 - progress);
  const brightness = lightOnEntry
    ? interpolate(progress, [0, 0.55, 1], [1, 1.045, 1])
    : 1;
  const shineProgress = shineStartFrame === undefined
    ? 0
    : interpolate(frame, [shineStartFrame, shineStartFrame + shineFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.sin),
    });
  const shineOpacity = interpolate(shineProgress, [0, 0.25, 0.5, 0.75, 1], [0, 0.22, 0.32, 0.22, 0]);
  const shinePosition = interpolate(shineProgress, [0, 1], [120, -20]);
  const spinProgress = spinStartFrame === undefined ? 0 : interpolate(frame, [spinStartFrame, spinStartFrame + spinFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const spinRotation = 720 * spinProgress;
  const spinEndFrame = spinStartFrame === undefined ? 0 : spinStartFrame + spinFrames;
  const spinFlash = spinStartFrame === undefined ? 0 : interpolate(frame, [spinEndFrame - 2, spinEndFrame, spinEndFrame + 3, spinEndFrame + 12], [0, 1, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const imageUrl = toPublicUrl(image);
  return (
    <div style={{
      position: "absolute",
      left: `${layer.x / 1920 * 100}%`,
      top: `${layer.y / 1080 * 100}%`,
      width: `${layer.width / 1920 * 100}%`,
      zIndex: layer.zIndex,
      opacity: progress,
      transform: `translateY(${translateY}px) scale(${scale}) rotate(${spinRotation}deg)`,
      transformOrigin: "center center",
      filter: `brightness(${brightness + spinFlash * 0.12}) drop-shadow(0 0 ${spinFlash * 18}px #d8b866aa)`,
      pointerEvents: "none",
    }}>
      <Img src={imageUrl} style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }} />
      {shineOpacity > 0 && <div style={{
        position: "absolute", inset: 0, opacity: shineOpacity, mixBlendMode: "screen", pointerEvents: "none",
        backgroundImage: "linear-gradient(108deg, transparent 39%, rgba(255,236,177,0) 43%, rgba(255,240,190,.82) 49%, rgba(217,165,70,.42) 53%, transparent 60%)",
        backgroundSize: "260% 100%", backgroundPosition: `${shinePosition}% center`,
        maskImage: `url("${imageUrl}")`, WebkitMaskImage: `url("${imageUrl}")`,
        maskMode: "alpha", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
      }} />}
    </div>
  );
};

const IntroductionComposition: React.FC<{ background: string | null; layers: IntroductionLayers; durationFrames: number }> = ({ background, layers, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = (seconds: number) => Math.max(1, Math.round(seconds * fps));
  const backgroundFadeFrames = frames(0.5);
  const finalFadeFrames = frames(0.6);
  const backgroundOpacity = interpolate(frame, [0, backgroundFadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const backgroundZoom = interpolate(frame, [0, durationFrames], [1, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const compositionOpacity = interpolate(frame, [durationFrames - finalFadeFrames, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const layerAnimations: Partial<Record<keyof IntroductionLayers, { start: number; duration: number; scale: number; rise: number; light?: boolean; shine?: number; shineDuration?: number; spinAt?: number; spinDuration?: number }>> = {
    logo: { start: 0.5, duration: 1.5, scale: 0.96, rise: 0, shine: 2.2 },
    questionsPanel: { start: 3, duration: 1.5, scale: 0.94, rise: 15, shine: 3.8 },
    history: { start: 5, duration: 1.2, scale: 0.92, rise: 10, light: true },
    geography: { start: 5, duration: 1.2, scale: 0.92, rise: 10, light: true },
    science: { start: 5, duration: 1.2, scale: 0.92, rise: 10, light: true },
    cinema: { start: 5, duration: 1.2, scale: 0.92, rise: 10, light: true },
    hourglass: { start: 12, duration: 1, scale: 0.96, rise: 0, light: true, spinAt: 17, spinDuration: 1.6, shine: 19.6, shineDuration: 0.4 },
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: compositionOpacity }}>
      {background && <Img src={toPublicUrl(background)} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
        opacity: interpolate(backgroundOpacity, [0, 1], [0.8, 1]), transform: `scale(${backgroundZoom})`, transformOrigin: "center center",
      }} />}
      {(Object.entries(layers) as [keyof IntroductionLayers, IntroductionLayers[keyof IntroductionLayers]][])
        .filter(([id, layer]) => Boolean(layer.image) && layer.visible && Boolean(layerAnimations[id]))
        .sort(([, left], [, right]) => left.zIndex - right.zIndex)
        .map(([id, layer]) => {
          const animation = layerAnimations[id]!;
          const stagger = id === "history" ? 0 : id === "geography" ? 0.7 : id === "science" ? 1.4 : id === "cinema" ? 2.1 : 0;
          return <IntroductionLayerImage
            key={id}
            image={layer.image!}
            layer={layer}
            startFrame={frames(animation.start + stagger)}
            enterFrames={frames(animation.duration)}
            scaleFrom={animation.scale}
            risePixels={animation.rise}
            lightOnEntry={animation.light}
            shineStartFrame={animation.shine === undefined ? undefined : frames(animation.shine)}
            shineFrames={frames(animation.shineDuration ?? 1)}
            spinStartFrame={animation.spinAt === undefined ? undefined : frames(animation.spinAt)}
            spinFrames={frames(animation.spinDuration ?? 1.6)}
          />;
        })}
    </div>
  );
};

const ConclusionComposition: React.FC<{ background: string | null; images: { source: string | null; layer: ConclusionLayer }[]; frame: number; durationFrames: number; opacity?: number }> = ({ background, images, frame, durationFrames, opacity = 1 }) => {
  const { fps } = useVideoConfig();
  const durationScale = durationFrames / (10 * fps);
  const at = (seconds: number) => Math.max(1, Math.round(seconds * fps * durationScale));
  const backgroundScale = interpolate(frame, [0, durationFrames], [1, 1.015], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <div style={{ position: "absolute", zIndex: 30, inset: 0, overflow: "hidden", pointerEvents: "none", opacity }}>
      {background
        ? <Img src={toPublicUrl(background)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${backgroundScale})` }} />
        : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 48%, #284034 0%, #14221b 58%, #0d1512 100%)" }} />}
      {images.map(({ source, layer }, index) => source && <Img key={`conclusion-image-${index}`} src={toPublicUrl(source)} style={{
        position: "absolute", left: layer.x, top: layer.y, width: layer.width, height: "auto", objectFit: "contain",
        opacity: index === 0
          ? interpolate(frame, [0, at(2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
          : index === 2
            ? interpolate(frame, [at(2), at(5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
            : 1,
        transform: index === 0
          ? `scale(${interpolate(frame, [0, at(2)], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })})`
          : index === 2
            ? `translateY(${interpolate(frame, [at(2), at(5)], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) })}px) scale(${interpolate(frame, [at(2), at(5)], [0.97, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })})`
            : undefined,
        transformOrigin: "center center",
        filter: index === 0
          ? `drop-shadow(0 0 ${interpolate(frame, [0, at(0.35), at(1.6), at(2)], [0, 3, 2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })}px #d9b34c99)`
          : index === 2
            ? `drop-shadow(0 0 ${interpolate(frame, [at(2), at(2.35), at(4.6), at(5)], [0, 3, 2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })}px #d9b34c99)`
            : undefined,
        zIndex: index + 1,
      }} />)}
    </div>
  );
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
  const { fps, durationInFrames } = useVideoConfig();
  const introFrames = introductionDurationFrames(project);
  const introductionVoiceStartFrame = Math.round(0.3 * fps);
  const hasFullQuiz = questionOffset === 0 && questions.length === project.questions.length;
  const outroFrames = hasFullQuiz ? conclusionDurationFrames(project) : 0;
  const endingPauseFrames = outroFrames > 0 ? ENDING_PAUSE_FRAMES : 0;
  const conclusionVoiceDelayFrames = outroFrames > 0 && conclusionNarration(project) ? CONCLUSION_VOICE_DELAY_FRAMES : 0;
  const conclusionFadeFrames = outroFrames > 0 ? CONCLUSION_VISUAL_FADE_FRAMES : 0;
  const conclusionStartFrame = questionVideoDuration(questions, introFrames, endingPauseFrames, project.voice, project.speechRate);
  const isConclusion = outroFrames > 0 && frame >= conclusionStartFrame + conclusionFadeFrames;
  const conclusionLocalFrame = frame - conclusionStartFrame;
  const musicVolume = project.musicVolume / 100;
  const musicCrossfadeFrames = Math.max(1, Math.round(0.7 * fps));
  const introductionMusicVolume = project.introductionMusicVolume / 100;
  const introductionMusicEndFrame = Math.min(
    introFrames,
    project.introductionMusicDuration ? Math.ceil(project.introductionMusicDuration * fps) : introFrames,
  );
  const introductionMusicFadeStartFrame = Math.max(0, introductionMusicEndFrame - musicCrossfadeFrames);
  const narrationIntervals = [
    ...(introductionNarration(project) ? [{ start: introductionVoiceStartFrame, end: introductionVoiceStartFrame + Math.ceil(introductionNarration(project)!.duration * fps), musicDuck: project.introductionVoiceSource === "ai" }] : []),
    ...questions.flatMap((item, index) => {
      const start = questionStartFrame(questions, index, introFrames, project.voice, project.speechRate);
      const q = narrationAudio(item, "question", project.voice, project.speechRate);
      const a = narrationAudio(item, "answer", project.voice, project.speechRate);
      const questionEnd = start + questionDurationFrames(item, project.voice, project.speechRate);
      return [
        q && { start, end: start + Math.ceil(q.duration * fps), musicDuck: item.questionVoiceSource === "ai" },
        a && { start: questionEnd, end: questionEnd + Math.ceil(a.duration * fps), musicDuck: item.answerVoiceSource === "ai" },
      ].filter((interval): interval is { start: number; end: number; musicDuck: boolean } => Boolean(interval));
    }),
    ...(hasFullQuiz && conclusionNarration(project) ? [{ start: conclusionStartFrame + conclusionVoiceDelayFrames, end: conclusionStartFrame + conclusionVoiceDelayFrames + Math.ceil(conclusionNarration(project)!.duration * fps), musicDuck: project.conclusionVoiceSource === "ai" }] : []),
  ];
  const voiceDuckAt = (absoluteFrame: number, musicOnly = false) => {
    const fade = Math.max(1, Math.round(0.25 * fps));
    let amount = 0;
    for (const interval of narrationIntervals) {
      if (musicOnly && !interval.musicDuck) continue;
      const inFade = interpolate(absoluteFrame, [interval.start - fade, interval.start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
      const outFade = interpolate(absoluteFrame, [interval.end, interval.end + fade], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
      amount = Math.max(amount, inFade * outFade);
    }
    return amount;
  };
  const duckedVolume = (absoluteFrame: number, volume: number, musicOnly = false) => volume * (1 - voiceDuckAt(absoluteFrame, musicOnly) * 0.82);
  const themeMusicVolumeAt = (audioFrame: number) => {
    const introductionCrossfade = project.introductionMusic
      ? interpolate(audioFrame, [introductionMusicFadeStartFrame, introductionMusicEndFrame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
      : 1;
    const conclusionCrossfade = hasFullQuiz && project.conclusionMusic
      ? interpolate(audioFrame, [conclusionStartFrame, conclusionStartFrame + musicCrossfadeFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })
      : 1;
    return musicVolume * introductionCrossfade * conclusionCrossfade;
  };
  const introductionMusicVolumeAt = (audioFrame: number) => {
    const fadeIn = interpolate(audioFrame, [0, musicCrossfadeFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
    const fadeOut = interpolate(audioFrame, [introductionMusicFadeStartFrame, introductionMusicEndFrame], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
    return introductionMusicVolume * Math.min(fadeIn, fadeOut);
  };
  const isOpeningTheme = frame < introFrames;
  const introFadeOutFrames = Math.max(1, Math.round(introFrames * 0.6 / 20));
  const questionsFrame = Math.max(0, frame - introFrames);
  const matchingIndex = questions.findIndex((_item, index) => questionsFrame < questionStartFrame(questions, index + 1, introFrames, project.voice, project.speechRate) - introFrames);
  const activeIndex = matchingIndex < 0 ? questions.length - 1 : matchingIndex;
  const questionStart = questionStartFrame(questions, activeIndex, introFrames, project.voice, project.speechRate);
  const localFrame = frame - questionStart;
  const hasQuestionStarted = localFrame >= 0;
  const question = questions[Math.max(0, activeIndex)];
  const nextQuestion = questions[activeIndex + 1];
  const isLast = activeIndex === questions.length - 1;
  const questionFrames = questionDurationFrames(question, project.voice, project.speechRate);
  const answerFrames = answerDisplayFrames(question, project.voice, project.speechRate);
  const finalAnswerHoldFrames = isLast ? endingPauseFrames + conclusionFadeFrames : 0;
  const transitionStart = questionFrames + answerFrames;
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
      {project.backgroundMusic && <Sequence from={0} durationInFrames={durationInFrames} layout="none"><Audio src={toPublicUrl(project.backgroundMusic)} loop loopVolumeCurveBehavior="extend" volume={themeMusicVolumeAt} /></Sequence>}
      {project.introductionMusic && <Sequence from={0} durationInFrames={introductionMusicEndFrame} layout="none"><Audio src={toPublicUrl(project.introductionMusic)} volume={(audioFrame) => introductionMusicVolumeAt(audioFrame)} /></Sequence>}
      {hasFullQuiz && outroFrames > 0 && project.conclusionMusic && <Sequence from={conclusionStartFrame} durationInFrames={outroFrames} layout="none"><Audio src={toPublicUrl(project.conclusionMusic)} loop volume={(audioFrame) => interpolate(audioFrame, [0, musicCrossfadeFrames], [0, project.conclusionMusicVolume / 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })} /></Sequence>}
      {introductionNarration(project) && <Sequence from={introductionVoiceStartFrame} durationInFrames={Math.max(1, Math.ceil(introductionNarration(project)!.duration * fps))} layout="none"><Audio src={toPublicUrl(introductionNarration(project)!.path)} volume={project.voiceVolume / 100} /></Sequence>}
      {hasFullQuiz && conclusionNarration(project) && <Sequence from={conclusionStartFrame + conclusionVoiceDelayFrames} durationInFrames={Math.max(1, Math.ceil(conclusionNarration(project)!.duration * fps))} layout="none"><Audio src={toPublicUrl(conclusionNarration(project)!.path)} volume={project.voiceVolume / 100} /></Sequence>}
      {questions.map((item, index) => {
        const narration = narrationAudio(item, "question", project.voice, project.speechRate);
        const start = questionStartFrame(questions, index, introFrames, project.voice, project.speechRate);
        return narration ? <Sequence key={`voice-question-${item.id}`} from={start} durationInFrames={Math.max(1, Math.ceil(narration.duration * fps))} layout="none"><Audio src={toPublicUrl(narration.path)} volume={project.voiceVolume / 100} /></Sequence> : null;
      })}
      {project.countdownSound && questions.map((item, index) => (
        <Sequence key={`countdown-sound-${item.id}`} from={questionStartFrame(questions, index, introFrames, project.voice, project.speechRate) + questionDurationFrames(item, project.voice, project.speechRate) - 3 * FPS} durationInFrames={3 * FPS} layout="none">
          <Audio src={toPublicUrl(project.countdownSound!)} loop volume={(audioFrame) => duckedVolume(questionStartFrame(questions, index, introFrames, project.voice, project.speechRate) + questionDurationFrames(item, project.voice, project.speechRate) - 3 * FPS + audioFrame, project.countdownSoundVolume / 100)} />
        </Sequence>
      ))}
      {project.answerSound && questions.map((item, index) => (
        <Sequence key={`answer-sound-${item.id}`} from={questionStartFrame(questions, index, introFrames, project.voice, project.speechRate) + questionDurationFrames(item, project.voice, project.speechRate)} durationInFrames={ANSWER_FRAMES} layout="none">
          <Audio src={toPublicUrl(project.answerSound!)} volume={project.answerSoundVolume / 100} />
        </Sequence>
      ))}
      {questions.map((item, index) => {
        const narration = narrationAudio(item, "answer", project.voice, project.speechRate);
        const from = questionStartFrame(questions, index, introFrames, project.voice, project.speechRate) + questionDurationFrames(item, project.voice, project.speechRate);
        return narration ? <Sequence key={`voice-answer-${item.id}`} from={from} durationInFrames={Math.max(1, Math.ceil(narration.duration * fps))} layout="none"><Audio src={toPublicUrl(narration.path)} volume={project.voiceVolume / 100} /></Sequence> : null;
      })}
      {isOpeningTheme
        ? <>
          <Backdrop image={project.background} opacity={frame >= introFrames - introFadeOutFrames ? 1 : 0} />
          <IntroductionComposition background={project.introductionImage || project.background} layers={project.introductionLayers} durationFrames={introFrames} />
        </>
        : isConclusion ? null : <Backdrop image={project.background} />}
      {!isConclusion && hasQuestionStarted && localFrame < questionFrames && !question.isRiddle && <Illustration image={question.image} />}
      {!isConclusion && hasQuestionStarted && localFrame >= questionFrames && localFrame < questionFrames + answerFrames + finalAnswerHoldFrames && <Illustration image={question.answerImage || (question.keepImageOnAnswer ? question.image : null)} />}
      {!isConclusion && hasQuestionStarted && localFrame < questionFrames + answerFrames + finalAnswerHoldFrames && <QuestionAnswerCard question={question} number={questionNumber} frame={localFrame} questionFrames={questionFrames} answerFrames={answerFrames} />}
      {!isConclusion && hasQuestionStarted && localFrame < questionFrames && <Timer frame={localFrame} duration={questionFrames} />}
      {localFrame >= transitionStart && !isLast && nextQuestion && (
        isNewTheme && nextTheme?.image
          ? <ThemeImageSequence image={nextTheme.image} frame={localFrame - transitionStart} duration={transitionFramesAfter(questions, activeIndex)} />
          : null
      )}
      {!isConclusion && isHourglassTransitionVariation && <Timer frame={questionFrames} duration={questionFrames} displaySeconds={false} transitionPulse={transitionProgress} />}
      {!isOpeningTheme && !isConclusion && <Logo source={project.logo} />}
      {!isConclusion && hasQuestionStarted && <div style={{ position: "absolute", zIndex: 20, bottom: 72, left: 64, color: "#e4c574", fontSize: 34, fontWeight: 700, letterSpacing: 5, lineHeight: 1, textShadow: "0 2px 10px #000" }}>{String(questionNumber).padStart(2, "0")} / {String(project.questions.length).padStart(2, "0")}</div>}
      {outroFrames > 0 && frame >= conclusionStartFrame && <ConclusionComposition background={project.conclusionBackgroundImage} images={[{ source: project.conclusionImage, layer: project.conclusionLayer }, { source: project.conclusionImage2, layer: project.conclusionLayer2 }, { source: project.conclusionImage3, layer: project.conclusionLayer3 }]} frame={conclusionLocalFrame} durationFrames={outroFrames} opacity={interpolate(conclusionLocalFrame, [0, conclusionFadeFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) })} />}
    </div>
  );
};
