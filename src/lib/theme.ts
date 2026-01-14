export interface Theme {
  bashBorder: string
  permission: string
  secondaryBorder: string
  text: string
  secondaryText: string
  suggestion: string
  // Semantic colors
  success: string
  error: string
  warning: string
  diff: {
    added: string
    removed: string
    addedDimmed: string
    removedDimmed: string
  }
}

// TODO move to AppContext
export function getTheme(): Theme {
  return {
    bashBorder: "#a855f7", // Purple for bash commands
    permission: "#c084fc", // Light purple for permissions
    secondaryBorder: "#888",
    text: "#fff",
    secondaryText: "#999",
    suggestion: "#c084fc", // Purple for suggestions
    success: "#4eba65", // Keep green for success (semantic)
    error: "#ff6b80", // Keep red for errors (semantic)
    warning: "#ffc107", // Keep yellow for warnings (semantic)
    diff: {
      added: "#2a4d3e", // Dark green for additions (semantic)
      removed: "#4d2a2a", // Dark red for removals (semantic)
      addedDimmed: "#1e3a2e", // Dimmed dark green
      removedDimmed: "#3a1e1e", // Dimmed dark red
    },
  }
}
