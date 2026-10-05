import { AvatarInfo, AvatarState, CursorData } from "../types/avatar";
import { BertoAvatar } from "./BertoAvatar";
import { GLBAvatar } from "./GLBAvatar";

interface AvatarRendererProps {
  activeAvatar: AvatarInfo | null;
  cursorData: CursorData | null;
  isVisible: boolean;
  status: AvatarState;
  isExcited?: boolean;
  isAsleep?: boolean;
  isWakingUp?: boolean;
}

export function AvatarRenderer({
  activeAvatar,
  cursorData,
  isVisible,
  status,
  isExcited,
  isAsleep,
  isWakingUp,
}: AvatarRendererProps) {
  if (activeAvatar && activeAvatar.avatar_type === "glb") {
    return (
      <GLBAvatar
        modelUrl={activeAvatar.entry}
        localPath={activeAvatar.local_path}
        cursorData={cursorData}
        isVisible={isVisible}
        status={status}
        isExcited={isExcited}
      />
    );
  }

  return (
    <BertoAvatar
      cursorData={cursorData}
      isVisible={isVisible}
      status={status}
      isExcited={isExcited}
      isAsleep={isAsleep}
      isWakingUp={isWakingUp}
    />
  );
}

export default AvatarRenderer;
