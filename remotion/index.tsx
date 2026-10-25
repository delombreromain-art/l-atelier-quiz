import { Composition, registerRoot } from "remotion";
import { conclusionDurationFrames, defaultProject, introductionDurationFrames, questionVideoDuration, type QuizVideoProps } from "../lib/quiz";
import { QuizVideo } from "./QuizVideo";

const defaultProps: QuizVideoProps = {
  project: defaultProject,
  questions: defaultProject.questions,
  questionOffset: 0,
};

const RemotionRoot: React.FC = () => (
  <Composition
    id="QuizVideo"
    component={QuizVideo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={questionVideoDuration(defaultProject.questions, introductionDurationFrames(defaultProject), conclusionDurationFrames(defaultProject), defaultProject.voice, defaultProject.speechRate)}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: questionVideoDuration(props.questions, introductionDurationFrames(props.project), props.questionOffset === 0 && props.questions.length === props.project.questions.length ? conclusionDurationFrames(props.project) : 0, props.project.voice, props.project.speechRate) })}
  />
);

registerRoot(RemotionRoot);
