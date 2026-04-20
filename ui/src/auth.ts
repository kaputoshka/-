// ui/src/auth.ts
// KISS auth storage helpers

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  localStorage.setItem("token", token);
}

export function setRoles(roles: string[]): void {
  localStorage.setItem("roles", JSON.stringify(roles || []));
}

export function getRoles(): string[] {
  try {
    return JSON.parse(localStorage.getItem("roles") || "[]");
  } catch {
    return [];
  }
}

export function hasRole(role: string): boolean {
  return getRoles().includes(role);
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("roles");
  localStorage.removeItem("username");
}