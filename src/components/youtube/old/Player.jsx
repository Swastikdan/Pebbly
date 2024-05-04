import YouTube from "react-youtube";
import { videoInner } from "./style.module.css";

const Player = ({ setHasLoaded, videoId }) => {

  const _onReady = (event) => {
    setHasLoaded(true);
    event.target.playVideo();
  };

  return (
    <YouTube
      videoId={videoId}
      onReady={_onReady}
      className={`${videoInner} rounded-lg `}
      iframeClassName={`${videoInner} rounded-lg `}
    />
  );
};

export default Player;
