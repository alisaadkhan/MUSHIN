export function sanitizeInput(input: string | null, maxLength: number = 200): string {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .slice(0, maxLength)
    .trim();
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 320);
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters" };
  if (password.length > 128) return { valid: false, message: "Password is too long" };
  return { valid: true, message: "" };
}

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
