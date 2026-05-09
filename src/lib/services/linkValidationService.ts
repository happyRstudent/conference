import type { Candidate } from "@/lib/models/types";

function isHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function canReachUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    if (response.ok) return true;
    const fallback = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    return fallback.ok;
  } catch {
    return false;
  }
}

function shouldCheckReachability(): boolean {
  return process.env.ENABLE_LINK_REACHABILITY_CHECK === "true";
}

export async function validateCandidateLinks(candidate: Candidate): Promise<Candidate> {
  const next: Candidate = { ...candidate };

  if (!isHttpUrl(candidate.homepageUrl)) {
    next.homepageUrl = undefined;
  } else if (shouldCheckReachability() && candidate.homepageUrl) {
    const ok = await canReachUrl(candidate.homepageUrl);
    if (!ok) next.homepageUrl = undefined;
  }

  if (!isHttpUrl(candidate.databaseUrl)) {
    next.databaseUrl = undefined;
  } else if (shouldCheckReachability() && candidate.databaseUrl) {
    const ok = await canReachUrl(candidate.databaseUrl);
    if (!ok) next.databaseUrl = undefined;
  }

  return next;
}
