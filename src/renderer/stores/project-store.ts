import { create } from "zustand";

export interface Project {
  name: string;
  path: string;
  hasAgentsMd: boolean;
  createdAt: number;
}

interface ProjectState {
  projects: Project[];
  recentDirectories: { path: string; lastUsed: number }[];
  loading: boolean;
  newProjectModalOpen: boolean;

  loadProjects: () => Promise<void>;
  loadRecentDirectories: () => Promise<void>;
  createProject: (opts: {
    name: string;
    instructions?: string;
    filePaths?: string[];
  }) => Promise<Project>;
  deleteProject: (name: string) => Promise<void>;
  setNewProjectModalOpen: (open: boolean) => void;
  addRecentDirectory: (path: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  recentDirectories: [],
  loading: false,
  newProjectModalOpen: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await window.api.listProjects();
      set({ projects, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  loadRecentDirectories: async () => {
    try {
      const dirs = await window.api.getRecentDirectories();
      set({ recentDirectories: dirs });
    } catch {
      // ignore
    }
  },

  createProject: async (opts) => {
    const project = await window.api.createProject(opts);
    await get().loadProjects();
    return project;
  },

  deleteProject: async (name) => {
    await window.api.deleteProject(name);
    await get().loadProjects();
  },

  setNewProjectModalOpen: (open) => set({ newProjectModalOpen: open }),

  addRecentDirectory: (path) => {
    window.api.addRecentDirectory(path).catch(() => {});
    // Optimistically update local state
    set((s) => {
      const filtered = s.recentDirectories.filter((r) => r.path !== path);
      return {
        recentDirectories: [
          { path, lastUsed: Date.now() },
          ...filtered,
        ].slice(0, 10),
      };
    });
  },
}));
