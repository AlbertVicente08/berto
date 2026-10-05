export type AvatarState = "reposo" | "escuchando" | "pensando" | "hablando";

export interface AvatarInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  avatar_type: "code" | "glb";
  entry?: string | null;
  source: "builtin" | "custom";
  local_path?: string | null;
}

export interface CursorData {
  rel_x: number;
  rel_y: number;
  screen_x: number;
  screen_y: number;
  is_inside: boolean;
}
