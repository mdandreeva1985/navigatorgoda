const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-auth`;
let pending: { token: string; request: Promise<Response> } | null = null;
let verified: { token: string; response: Response } | null = null;
let generation = 0;

export function resetAuthVerification() {
  generation += 1;
  pending = null;
  verified = null;
}

export async function verifySession(token: string, force = false): Promise<Response> {
  if (!force && verified?.token === token) return verified.response.clone();
  if (pending?.token === token) return (await pending.request).clone();
  const startedGeneration = generation;
  const request = fetch(`${FUNCTION_URL}?action=verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  pending = { token, request };
  try {
    const response = await request;
    if (response.ok) {
      const data = await response.clone().json();
      if (generation === startedGeneration) {
        verified = { token: data.token || token, response: response.clone() };
      }
    }
    return response.clone();
  } finally {
    if (pending?.request === request) pending = null;
  }
}