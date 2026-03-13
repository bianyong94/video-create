export type VisualSceneResult = {
  scene_id: number;
  image_prompt: string;
  image_path: string;
  width: number;
  height: number;
};

export type VisualGenerateResponse = {
  scenes: VisualSceneResult[];
};
