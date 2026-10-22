// Color and initial generators for JiraLite projects and avatars

const PROJECT_PALETTES = [
  { bg: "from-blue-600 to-indigo-700", text: "text-white", border: "border-blue-500", solid: "#0C66E4" },
  { bg: "from-emerald-600 to-teal-700", text: "text-white", border: "border-emerald-500", solid: "#1F845A" },
  { bg: "from-purple-600 to-pink-700", text: "text-white", border: "border-purple-500", solid: "#8270DB" },
  { bg: "from-amber-600 to-orange-700", text: "text-white", border: "border-amber-500", solid: "#E2483D" },
  { bg: "from-cyan-600 to-blue-700", text: "text-white", border: "border-cyan-500", solid: "#0052CC" },
  { bg: "from-rose-600 to-red-700", text: "text-white", border: "border-rose-500", solid: "#AE2A19" },
  { bg: "from-violet-600 to-purple-800", text: "text-white", border: "border-violet-500", solid: "#5E4DB2" },
];

export function getProjectTheme(seed: string = "PR") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROJECT_PALETTES.length;
  return PROJECT_PALETTES[index];
}

export function getProjectInitials(name?: string, key?: string): string {
  if (key && key.trim()) {
    return key.trim().slice(0, 2).toUpperCase();
  }
  if (!name || !name.trim()) return "PR";

  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
