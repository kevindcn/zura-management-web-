import { create } from "zustand";
import { Project } from "../types";

interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
}));
