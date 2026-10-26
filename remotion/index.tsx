import { Composition, registerRoot } from "remotion";
import { CONCLUSION_VOICE_DELAY_FRAMES, ENDING_PAUSE_FRAMES, conclusionDurationFrames, conclusionNarration, defaultProject, introductionDurationFrames, questionVideoDuration, type QuizVideoProps } from "../lib/quiz";
import { QuizVideo } from "./QuizVideo";

const defaultProps: QuizVideoProps = {
  project: defaultProject,
  questions: defaultProject.questions,
  questionOffset: 0,
};

const quizDurationInFrames = (props: QuizVideoProps) => {
  const hasFullQuiz = props.questionOffset === 0 && props.questions.length === props.project.questions.length;
  const outroFrames = hasFullQuiz ? conclusionDurationFrames(props.project) : 0;
  const endingDelayFrames = outroFrames > 0
    ? ENDING_PAUSE_FRAMES + (conclusionNarration(props.project) ? CONCLUSION_VOICE_DELAY_FRAMES : 0)
    : 0;
  return questionVideoDuration(
    props.questions,
    introductionDurationFrames(props.project),
    outroFrames + endingDelayFrames,
    props.project.voice,
    props.project.speechRate,
  );
};

const RemotionRoot: React.FC = () => (
  <Composition
    id="QuizVideo"
    component={QuizVideo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={quizDurationInFrames(defaultProps)}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: quizDurationInFrames(props) })}
  />
);

registerRoot(RemotionRoot);
